"""
scrapers/ipindia.py  —  MarkShield Core Scraping Engine
========================================================
Handles all IP India data sources:

  1. Cause List     — tmrsearch.ipindia.gov.in  (public, GET)
  2. e-Register     — tmrsearch.ipindia.gov.in  (public, GET)
  3. Public Search  — tmrsearch.ipindia.gov.in  (public, POST ASP.NET form)
  4. TLA Queue List — ipindiaonline.gov.in       (public, GET)
  5. eFiling Portal — ipindiaonline.gov.in       (authenticated, ASP.NET session)

Fixes applied:
  - Timeout increased to 40s (Render free tier is slow)
  - Better login detection for eFiling (was accepting wrong password)
  - Robust HTML parser fallbacks for each source
  - Proper SSL verification disabled only for ipindiaonline.gov.in (known SSL issues)
  - Session cookies preserved across requests
"""

import time, hashlib, logging, re, urllib3
import requests
from datetime import datetime, timedelta
from typing   import Optional, List, Dict, Any
from bs4      import BeautifulSoup

# Suppress SSL warnings for ipindiaonline (their cert chain has issues)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

log = logging.getLogger("markshield.scraper")

# ── IP India URLs ─────────────────────────────────────────────────────────────
URL = {
    "cause_list":     "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index",
    "eregister_view": "https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx",
    "eregister_home": "https://tmrsearch.ipindia.gov.in/eregister/",
    "public_search":  "https://tmrsearch.ipindia.gov.in/tmrpublicsearch/frmmain.aspx",
    "efiling_login":  "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx",
    "efiling_myapps": "https://ipindiaonline.gov.in/trademarkefiling/user/frmMyApplication.aspx",
    "tla_queue":      "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx",
}

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection":      "keep-alive",
    "Upgrade-Insecure-Requests": "1",
}

# ── Cache ─────────────────────────────────────────────────────────────────────
_cache: Dict[str, dict] = {}

def _ck(*args) -> str:
    return hashlib.md5("|".join(str(a) for a in args).encode()).hexdigest()

def _cget(k: str) -> Optional[Any]:
    e = _cache.get(k)
    if e and datetime.utcnow() < e["exp"]:
        log.debug(f"cache HIT {k[:8]}")
        return e["v"]
    return None

def _cset(k: str, v: Any, ttl: int = 300):
    _cache[k] = {"v": v, "exp": datetime.utcnow() + timedelta(seconds=ttl)}

def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ── Shared public session (tmrsearch) ─────────────────────────────────────────
class _PublicSession:
    """Session for tmrsearch.ipindia.gov.in (public, SSL verified)."""
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update(HEADERS)
        self._last = 0.0
        self.delay = 1.0  # seconds between requests — be polite

    def _wait(self):
        gap = time.time() - self._last
        if gap < self.delay:
            time.sleep(self.delay - gap)
        self._last = time.time()

    def get(self, url, params=None, timeout=40, retries=3) -> requests.Response:
        self._wait()
        for n in range(retries):
            try:
                r = self.s.get(url, params=params, timeout=timeout, allow_redirects=True)
                r.raise_for_status()
                log.info(f"GET {url[:80]} → {r.status_code} ({len(r.content)}B)")
                return r
            except requests.exceptions.Timeout:
                log.warning(f"GET timeout attempt {n+1}/{retries}: {url[:60]}")
                time.sleep(2 ** n)
            except requests.exceptions.HTTPError as e:
                log.warning(f"GET HTTP error {e}: {url[:60]}")
                time.sleep(2 ** n)
            except Exception as e:
                log.warning(f"GET error attempt {n+1}/{retries}: {e}")
                time.sleep(2 ** n)
        raise RuntimeError(f"GET failed after {retries} attempts: {url}")

    def post(self, url, data=None, timeout=40, retries=3) -> requests.Response:
        self._wait()
        for n in range(retries):
            try:
                r = self.s.post(url, data=data, timeout=timeout, allow_redirects=True)
                r.raise_for_status()
                log.info(f"POST {url[:80]} → {r.status_code}")
                return r
            except Exception as e:
                log.warning(f"POST attempt {n+1}/{retries} failed: {e}")
                time.sleep(2 ** n)
        raise RuntimeError(f"POST failed after {retries} attempts: {url}")

_sess = _PublicSession()


# ══════════════════════════════════════════════════════════════════════════════
#  1. CAUSE LIST
#  Source: https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index
# ══════════════════════════════════════════════════════════════════════════════

def fetch_cause_list(
    date:         Optional[str] = None,   # DD/MM/YYYY — defaults to today
    agent_filter: Optional[str] = None,   # case-insensitive substring match
    location:     Optional[str] = None,   # Delhi, Mumbai, Chennai, Kolkata, Ahmedabad
    ttl:          int           = 300,
) -> dict:
    if not date:
        date = datetime.now().strftime("%d/%m/%Y")

    ck = _ck("cl", date, agent_filter, location)
    cached = _cget(ck)
    if cached:
        return cached

    # Build params — the site accepts SearchField + SearchText
    params: dict = {}
    if location and location.lower() not in ("", "all", "all locations"):
        params["Location"] = location

    if agent_filter:
        params["SearchField"] = "Agent Name"
        params["SearchText"]  = agent_filter
    else:
        params["SearchField"] = "Hearing Date"
        params["SearchText"]  = date

    try:
        resp     = _sess.get(URL["cause_list"], params=params)
        hearings = _parse_cause_list(resp.text)
    except Exception as e:
        log.error(f"cause_list fetch error: {e}")
        return {"error": str(e), "hearings": [], "total": 0}

    total = len(hearings)

    # Post-filter by agent (URL param alone may not be reliable)
    if agent_filter:
        af = agent_filter.upper()
        hearings = [h for h in hearings if af in h.get("agent", "").upper()]

    result = {
        "hearings":   hearings,
        "total":      total,
        "filtered":   len(hearings),
        "date":       date,
        "agent":      agent_filter,
        "location":   location,
        "source_url": URL["cause_list"],
        "fetched_at": _now(),
    }
    _cset(ck, result, ttl)
    return result


def _parse_cause_list(html: str) -> List[dict]:
    soup = BeautifulSoup(html, "lxml")

    # Try to find table by id first, then fallback
    table = soup.find("table", {"id": re.compile(r"grid|gv|cause|list", re.I)})
    if not table:
        table = soup.find("table")

    if not table:
        log.warning("No table found in cause list response")
        # Check if there's a "no records" message
        body_text = soup.get_text()
        if "no record" in body_text.lower() or "no data" in body_text.lower():
            log.info("Cause list: no records for this date/filter")
        return []

    rows = table.find_all("tr")
    out  = []
    for row in rows[1:]:  # skip header
        td = row.find_all("td")
        if len(td) < 5:
            continue

        app_no = td[0].get_text(strip=True)
        if not app_no or not any(c.isdigit() for c in app_no):
            continue  # skip non-data rows

        # Slot detection — column index may vary
        slot_raw   = td[5].get_text(strip=True) if len(td) > 5 else ""
        slot_label = "🌅 Morning (10:30 AM – 1:30 PM)" if "morning" in slot_raw.lower() else "🌆 Afternoon (2:00 PM – 5:00 PM)"

        atype  = td[6].get_text(strip=True) if len(td) > 6 else ""
        status = (
            "objected" if "objected"  in atype.lower() else
            "opposed"  if "opposed"   in atype.lower() else
            "refused"  if "refused"   in atype.lower() else
            "hearing"
        )

        out.append({
            "app_no":       app_no,
            "room":         td[1].get_text(strip=True) if len(td) > 1 else "",
            "agent":        td[2].get_text(strip=True) if len(td) > 2 else "",
            "applicant":    td[3].get_text(strip=True) if len(td) > 3 else "",
            "hearing_date": td[4].get_text(strip=True) if len(td) > 4 else "",
            "slot":         slot_label,
            "app_type":     atype,
            "status":       status,
            "view_url":     f"{URL['eregister_view']}?AppNosValue={app_no}",
        })

    log.info(f"Cause list parsed: {len(out)} rows")
    return out


# ══════════════════════════════════════════════════════════════════════════════
#  2. e-REGISTER (Application Status)
#  Source: https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx
# ══════════════════════════════════════════════════════════════════════════════

def fetch_application(app_no: str, ttl: int = 600) -> dict:
    app_no = app_no.strip()
    ck     = _ck("app", app_no)
    cached = _cget(ck)
    if cached:
        return cached

    view_url = f"{URL['eregister_view']}?AppNosValue={app_no}"
    try:
        resp = _sess.get(view_url)
        data = _parse_eregister(resp.text, app_no)
    except Exception as e:
        log.error(f"eregister fetch error ({app_no}): {e}")
        return {"error": str(e), "app_no": app_no}

    data.update({"source_url": view_url, "fetched_at": _now()})
    _cset(ck, data, ttl)
    return data


def _parse_eregister(html: str, app_no: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    raw: dict = {"app_no": app_no}

    # e-Register uses a label→value table layout
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                key = (cells[0].get_text(strip=True)
                       .lower()
                       .replace(" ", "_")
                       .replace(".", "")
                       .replace(":", "")
                       .replace("/", "_")
                       .replace("'", "")
                       .replace("(", "")
                       .replace(")", ""))
                val = cells[1].get_text(strip=True)
                if key and val:
                    raw[key] = val

    # Normalise field names to consistent keys
    FIELD_MAP = {
        "trade_mark":                    "trademark_name",
        "wordmark":                      "trademark_name",
        "class":                         "tm_class",
        "date_of_application":           "filing_date",
        "applicants_name_address":       "applicant",
        "applicant_name":                "applicant",
        "agent":                         "agent",
        "status":                        "status",
        "valid_upto":                    "valid_upto",
        "next_date_of_hearing":          "hearing_date",
        "hearing_date":                  "hearing_date",
        "examination_report_date":       "exam_report_date",
        "type_of_mark":                  "mark_type",
        "description_of_goods_services": "goods_services",
        "user_detail":                   "user_since",
        "certificate_no":                "certificate_no",
    }
    out = {"app_no": app_no}
    for rk, nk in FIELD_MAP.items():
        if rk in raw:
            out[nk] = raw[rk]

    out["_raw"] = raw
    return out


def fetch_applications_bulk(app_nos: List[str]) -> List[dict]:
    results = []
    for i, no in enumerate(app_nos):
        log.info(f"Bulk fetch {i+1}/{len(app_nos)}: {no}")
        results.append(fetch_application(no))
        if i < len(app_nos) - 1:
            time.sleep(1.0)  # be polite
    return results


# ══════════════════════════════════════════════════════════════════════════════
#  3. PUBLIC SEARCH
#  Source: https://tmrsearch.ipindia.gov.in/tmrpublicsearch/frmmain.aspx
# ══════════════════════════════════════════════════════════════════════════════

def fetch_public_search(
    query:       str,
    search_type: str = "wordmark",   # wordmark | proprietor | application
    tm_class:    str = "",
    proprietor:  str = "",
    ttl:         int = 1800,
) -> dict:
    ck = _ck("ps", query, search_type, tm_class)
    cached = _cget(ck)
    if cached:
        return cached

    try:
        # Step 1 — GET page to extract ASP.NET hidden fields (__VIEWSTATE etc.)
        home = _sess.get(URL["public_search"])
        soup = BeautifulSoup(home.text, "lxml")

        def _hidden(field_id):
            el = soup.find("input", {"id": field_id}) or soup.find("input", {"name": field_id})
            return (el or {}).get("value", "")

        vs  = _hidden("__VIEWSTATE")
        evv = _hidden("__EVENTVALIDATION")
        vsg = _hidden("__VIEWSTATEGENERATOR")

        if not vs:
            log.warning("Could not extract VIEWSTATE — page structure may have changed")

        # Step 2 — POST the search form
        form = {
            "__VIEWSTATE":          vs,
            "__EVENTVALIDATION":    evv,
            "__VIEWSTATEGENERATOR": vsg,
            "__EVENTTARGET":        "",
            "__EVENTARGUMENT":      "",
            "ctl00$ContentPlaceHolder1$hdnStatus": "1",
            "ctl00$ContentPlaceHolder1$txtTradeMark":
                query if search_type == "wordmark" else "",
            "ctl00$ContentPlaceHolder1$txtProprietorName":
                proprietor or (query if search_type == "proprietor" else ""),
            "ctl00$ContentPlaceHolder1$ddlTMClass": tm_class,
            "ctl00$ContentPlaceHolder1$btnSearch": "Search",
        }
        resp    = _sess.post(URL["public_search"], data=form)
        results = _parse_public_search(resp.text)

    except Exception as e:
        log.error(f"Public search error: {e}")
        return {"error": str(e), "results": [], "query": query}

    out = {
        "results":    results,
        "total":      len(results),
        "query":      query,
        "type":       search_type,
        "class":      tm_class,
        "source_url": URL["public_search"],
        "fetched_at": _now(),
    }
    _cset(ck, out, ttl)
    return out


def _parse_public_search(html: str) -> List[dict]:
    soup  = BeautifulSoup(html, "lxml")
    table = None

    # Try known GridView ids
    for pat in [r"GridView", r"gvTMList", r"gvSearch", r"gv", r"grid"]:
        table = soup.find("table", {"id": re.compile(pat, re.I)})
        if table:
            break

    # Fallback — find the widest table with data rows
    if not table:
        for t in soup.find_all("table"):
            rows = t.find_all("tr")
            if len(rows) > 2:
                cols = rows[1].find_all("td") if len(rows) > 1 else []
                if len(cols) >= 4:
                    table = t
                    break

    if not table:
        log.warning("No results table found in public search response")
        # Log snippet for debugging
        snippet = html[:500] if html else "(empty)"
        log.debug(f"Response snippet: {snippet}")
        return []

    rows = table.find_all("tr")
    out  = []
    for row in rows[1:]:
        td = row.find_all("td")
        if len(td) < 4:
            continue
        app_no = td[0].get_text(strip=True)
        if not app_no:
            continue
        out.append({
            "app_no":     app_no,
            "trademark":  td[1].get_text(strip=True) if len(td) > 1 else "",
            "class":      td[2].get_text(strip=True) if len(td) > 2 else "",
            "proprietor": td[3].get_text(strip=True) if len(td) > 3 else "",
            "status":     td[4].get_text(strip=True) if len(td) > 4 else "",
            "valid_upto": td[5].get_text(strip=True) if len(td) > 5 else "",
            "view_url":   f"{URL['eregister_view']}?AppNosValue={app_no}",
        })

    log.info(f"Public search parsed: {len(out)} results")
    return out


# ══════════════════════════════════════════════════════════════════════════════
#  4. TLA QUEUE LIST
#  Source: https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx
# ══════════════════════════════════════════════════════════════════════════════

REPLY_DEADLINE_DAYS = {
    "examination report": 30,
    "fer":                30,
    "examination":        30,
    "opposition":         60,
    "sec 45":             60,
    "sec 46":             60,
    "show cause":         30,
}

def _deadline_days(action_type: str) -> int:
    at = (action_type or "").lower()
    for k, v in REPLY_DEADLINE_DAYS.items():
        if k in at:
            return v
    return 30

def _days_left(date_str: str, deadline_days: int) -> Optional[int]:
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%Y-%m-%d"):
        try:
            base = datetime.strptime(date_str.strip(), fmt)
            due  = base + timedelta(days=deadline_days)
            return (due - datetime.now()).days
        except Exception:
            continue
    return None


def fetch_tla_queue(username: str = None, app_no: str = None, ttl: int = 180) -> dict:
    """
    Fetch TLA Queue List from IP India eFiling portal.
    This is a PUBLIC page — no login required.
    Optional filters: username (TMA code) or app_no.
    """
    ck = _ck("queue", username or "", app_no or "")
    cached = _cget(ck)
    if cached:
        return cached

    params = {}
    if app_no:    params["AppNo"]    = app_no
    if username:  params["UserName"] = username

    # Queue list is on ipindiaonline — use separate session with SSL verify=False
    try:
        session = requests.Session()
        session.headers.update(HEADERS)
        time.sleep(1.0)
        resp = session.get(URL["tla_queue"], params=params, timeout=40, verify=False, allow_redirects=True)
        resp.raise_for_status()
        items = _parse_queue(resp.text)
    except Exception as e:
        log.error(f"TLA Queue fetch error: {e}")
        return {"error": str(e), "items": [], "total": 0}

    # Enrich with deadline calculations
    for item in items:
        dd = _deadline_days(item.get("action_type", ""))
        item["deadline_days"] = dd
        dl = _days_left(item.get("date", ""), dd)
        item["days_left"] = dl
        if dl is not None:
            item["urgency"] = (
                "overdue"  if dl < 0  else
                "critical" if dl <= 7  else
                "warning"  if dl <= 15 else
                "ok"
            )
        else:
            item["urgency"] = "unknown"

    result = {
        "items":      items,
        "total":      len(items),
        "pending":    sum(1 for i in items if i.get("reply_status", "").lower() in ("", "pending", "not filed")),
        "overdue":    sum(1 for i in items if i.get("urgency") == "overdue"),
        "critical":   sum(1 for i in items if i.get("urgency") == "critical"),
        "source_url": URL["tla_queue"],
        "fetched_at": _now(),
    }
    _cset(ck, result, ttl)
    return result


def _parse_queue(html: str) -> list:
    soup = BeautifulSoup(html, "lxml")

    # Try known IDs first
    table = None
    for tid in ["GridView1", "gvQueue", "gvApplications", "ctl00_ContentPlaceHolder1_GridView1"]:
        table = soup.find("table", {"id": tid})
        if table:
            break

    # Fallback — largest table on the page
    if not table:
        tables = soup.find_all("table")
        if tables:
            table = max(tables, key=lambda t: len(t.find_all("tr")), default=None)

    if not table:
        log.warning("No table found in TLA Queue response")
        return []

    rows = table.find_all("tr")
    if len(rows) < 2:
        return []

    # Parse header row to get column positions
    header_row = rows[0].find_all(["th", "td"])
    headers = [h.get_text(strip=True).lower() for h in header_row]
    log.info(f"Queue headers: {headers}")

    def col(hints, cells):
        for hint in hints:
            for i, h in enumerate(headers):
                if hint in h and i < len(cells):
                    v = cells[i].get_text(strip=True)
                    if v:
                        return v
        return ""

    out = []
    for row in rows[1:]:
        tds = row.find_all("td")
        if len(tds) < 3:
            continue

        app_no = col(["app no", "appno", "application no", "application number"], tds)
        if not app_no and tds:
            app_no = tds[0].get_text(strip=True)

        item = {
            "app_no":       app_no,
            "tm_name":      col(["trade mark", "trademark", "mark", "wordmark"], tds),
            "action_type":  col(["action", "notice type", "examination", "opposition", "type"], tds),
            "date":         col(["date", "issue date", "exam date", "notice date"], tds),
            "reply_status": col(["reply", "response", "status"], tds),
            "agent":        col(["agent", "attorney", "tma", "tma code"], tds),
            "applicant":    col(["applicant", "proprietor", "owner"], tds),
            "office":       col(["office", "location", "city", "branch"], tds),
            "tm_class":     col(["class"], tds),
            "view_url":     f"{URL['eregister_view']}?AppNosValue={app_no}",
        }
        if app_no:
            out.append(item)

    log.info(f"Queue parsed: {len(out)} items")
    return out


# ══════════════════════════════════════════════════════════════════════════════
#  5. eFILING PORTAL (Authenticated)
#  Source: https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx
#
#  BUG FIX: The previous login() method was incorrectly accepting wrong
#  passwords because the check for redirect URL was too loose. Fixed by:
#  1. Checking for explicit error messages first
#  2. Verifying the post-login URL is NOT the login page
#  3. Checking for authenticated page markers in the response body
# ══════════════════════════════════════════════════════════════════════════════

class EFilingClient:
    """Authenticated session with IP India eFiling portal."""

    def __init__(self):
        self.s             = requests.Session()
        self.s.headers.update(HEADERS)
        self.authenticated = False
        self.username: Optional[str] = None
        self._last = 0.0

    def _wait(self):
        gap = time.time() - self._last
        if gap < 1.2:
            time.sleep(1.2 - gap)
        self._last = time.time()

    @staticmethod
    def _get_viewstate(soup: BeautifulSoup) -> dict:
        def g(name):
            el = soup.find("input", {"name": name}) or soup.find("input", {"id": name})
            return (el or {}).get("value", "")
        return {
            "__VIEWSTATE":          g("__VIEWSTATE"),
            "__EVENTVALIDATION":    g("__EVENTVALIDATION"),
            "__VIEWSTATEGENERATOR": g("__VIEWSTATEGENERATOR"),
        }

    def login(self, username: str, password: str) -> dict:
        """
        Login to IP India eFiling portal.
        Returns {"success": True/False, "message": "..."}

        FIXED: Previous version accepted wrong passwords because the URL
        redirect check was unreliable. Now uses multiple verification methods.
        """
        log.info(f"eFiling login attempt: {username}")
        self.authenticated = False

        try:
            self._wait()
            # Step 1: GET the login page to extract viewstate
            login_page = self.s.get(
                URL["efiling_login"],
                timeout=40,
                verify=False,
                allow_redirects=True
            )
            soup = BeautifulSoup(login_page.text, "lxml")
            vs   = self._get_viewstate(soup)

            if not vs["__VIEWSTATE"]:
                return {"success": False, "message": "Could not load eFiling login page. Please try again."}

            # Step 2: POST credentials
            form = {
                **vs,
                "ctl00$ContentPlaceHolder1$txtUserName": username,
                "ctl00$ContentPlaceHolder1$txtPassword": password,
                "ctl00$ContentPlaceHolder1$btnLogin":    "Login",
            }

            self._wait()
            resp = self.s.post(
                URL["efiling_login"],
                data=form,
                timeout=40,
                verify=False,
                allow_redirects=True
            )

            body       = resp.text
            body_lower = body.lower()
            final_url  = resp.url.lower()

            # ── FAILURE CHECKS (check these first) ────────────────────────
            failure_phrases = [
                "invalid username",
                "invalid password",
                "incorrect password",
                "wrong password",
                "authentication failed",
                "login failed",
                "user name or password is incorrect",
                "invalid user",
                "please enter valid",
                "username or password",
            ]
            for phrase in failure_phrases:
                if phrase in body_lower:
                    log.warning(f"eFiling login rejected: '{phrase}' found in response")
                    return {"success": False, "message": "Invalid username or password. Please check your IP India eFiling credentials."}

            # ── STILL ON LOGIN PAGE CHECK ──────────────────────────────────
            # If we're still on the login page after POST, credentials were wrong
            login_url_fragment = "frmloginnew"
            if login_url_fragment in final_url:
                # Double-check: look for success markers in body
                success_markers = ["logout", "my application", "welcome", "dashboard", "frmhome", "frmmyapplication"]
                if not any(m in body_lower for m in success_markers):
                    log.warning("eFiling: still on login page after POST — credentials rejected")
                    return {"success": False, "message": "Login failed. Invalid username or password."}

            # ── SUCCESS CHECKS ─────────────────────────────────────────────
            success_url_fragments    = ["frmmyapplication", "frmhome", "frmdashboard", "frmwelcome"]
            success_body_markers     = ["logout", "my application", "my profile", "welcome", "sign out", "frmlogout"]

            url_ok  = any(f in final_url  for f in success_url_fragments)
            body_ok = any(m in body_lower for m in success_body_markers)

            if url_ok or body_ok:
                self.authenticated = True
                self.username      = username
                log.info(f"eFiling login SUCCESS: {username}")
                return {
                    "success":  True,
                    "message":  "Login successful",
                    "username": username,
                }

            # If we can't determine success or failure clearly
            log.warning(f"eFiling login ambiguous. Final URL: {final_url[:80]}")
            return {"success": False, "message": "Login result unclear. Please try again or check your credentials."}

        except requests.exceptions.Timeout:
            return {"success": False, "message": "Connection timed out. IP India server is slow — please try again."}
        except Exception as e:
            log.error(f"eFiling login exception: {e}")
            return {"success": False, "message": f"Connection error: {str(e)}"}

    def fetch_portfolio(self) -> dict:
        """Fetch all applications for authenticated user."""
        if not self.authenticated:
            return {"error": "Not authenticated — please login first"}
        try:
            self._wait()
            resp = self.s.get(URL["efiling_myapps"], timeout=40, verify=False)
            apps = _parse_efiling_portfolio(resp.text)
            return {
                "applications": apps,
                "total":        len(apps),
                "username":     self.username,
                "fetched_at":   _now(),
            }
        except Exception as e:
            log.error(f"Portfolio fetch error: {e}")
            return {"error": str(e), "applications": []}

    def fetch_queue(self) -> dict:
        """Fetch TLA Queue for authenticated user."""
        if not self.authenticated:
            return {"error": "Not authenticated"}
        return fetch_tla_queue(username=self.username)


def _parse_efiling_portfolio(html: str) -> List[dict]:
    soup  = BeautifulSoup(html, "lxml")
    table = soup.find("table")
    if not table:
        return []
    rows = table.find_all("tr")
    out  = []
    for row in rows[1:]:
        td = row.find_all("td")
        if len(td) >= 4:
            out.append({
                "app_no":         td[0].get_text(strip=True),
                "trademark_name": td[1].get_text(strip=True) if len(td) > 1 else "",
                "class":          td[2].get_text(strip=True) if len(td) > 2 else "",
                "status":         td[3].get_text(strip=True) if len(td) > 3 else "",
                "filing_date":    td[4].get_text(strip=True) if len(td) > 4 else "",
            })
    return out


# ── eFiling session pool (one client per username) ────────────────────────────
_efiling_pool: Dict[str, EFilingClient] = {}

def get_efiling(username: str) -> EFilingClient:
    if username not in _efiling_pool:
        _efiling_pool[username] = EFilingClient()
    return _efiling_pool[username]
