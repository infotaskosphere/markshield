"""
scrapers/ipindia.py  —  MarkShield Core Scraping Engine
========================================================
Handles all four IP India data sources:

  1.  Cause List     (tmrsearch · public · GET with params)
  2.  e-Register     (tmrsearch · public · GET by app number)
  3.  Public Search  (tmrsearch · public · POST form)
  4.  eFiling Portal (ipindiaonline · authenticated · ASP.NET)

Features
  ·  Persistent requests.Session with realistic headers
  ·  Automatic retry with exponential back-off
  ·  Polite request throttling (≥ 0.8 s between hits)
  ·  In-memory TTL cache (avoids hammering the server)
  ·  BeautifulSoup + lxml for fast HTML parsing
"""

import time, hashlib, logging, re
import requests
from datetime import datetime, timedelta
from typing   import Optional, List, Dict, Any
from bs4      import BeautifulSoup

log = logging.getLogger("markshield.scraper")

# ── IP India URLs ─────────────────────────────────────────
URL = {
    "cause_list":        "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index",
    "eregister_view":    "https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx",
    "eregister_home":    "https://tmrsearch.ipindia.gov.in/eregister/",
    "public_search":     "https://tmrsearch.ipindia.gov.in/tmrpublicsearch/frmmain.aspx",
    "efiling_login":     "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx",
    "efiling_myapps":    "https://ipindiaonline.gov.in/trademarkefiling/user/frmMyApplication.aspx",
    "adjournment":       "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CopyRightNOCAdjournmentNotice/Index",
}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Safari/537.36"
    ),
    "Accept":          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Connection":      "keep-alive",
}

# ── Cache ─────────────────────────────────────────────────
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


# ── Session ───────────────────────────────────────────────
class _Session:
    """Shared requests session with throttle + retry."""
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update(HEADERS)
        self._last = 0.0
        self.delay = float(0.9)          # seconds between requests

    def _wait(self):
        gap = time.time() - self._last
        if gap < self.delay:
            time.sleep(self.delay - gap)
        self._last = time.time()

    def get(self, url, params=None, timeout=25, retries=3) -> requests.Response:
        self._wait()
        for n in range(retries):
            try:
                r = self.s.get(url, params=params, timeout=timeout, allow_redirects=True)
                r.raise_for_status()
                log.info(f"GET {url[:80]} → {r.status_code}  {len(r.content)}B")
                return r
            except Exception as e:
                wait = 2 ** n
                log.warning(f"GET attempt {n+1}/{retries} failed ({e}) — retry in {wait}s")
                time.sleep(wait)
        raise RuntimeError(f"GET failed after {retries} attempts: {url}")

    def post(self, url, data=None, timeout=25, retries=3) -> requests.Response:
        self._wait()
        for n in range(retries):
            try:
                r = self.s.post(url, data=data, timeout=timeout, allow_redirects=True)
                r.raise_for_status()
                log.info(f"POST {url[:80]} → {r.status_code}")
                return r
            except Exception as e:
                wait = 2 ** n
                log.warning(f"POST attempt {n+1}/{retries} failed ({e}) — retry in {wait}s")
                time.sleep(wait)
        raise RuntimeError(f"POST failed after {retries} attempts: {url}")

_sess = _Session()


# ══════════════════════════════════════════════════════════
#  1.  CAUSE LIST
# ══════════════════════════════════════════════════════════

def fetch_cause_list(
    date:         Optional[str] = None,   # DD/MM/YYYY
    agent_filter: Optional[str] = None,
    location:     Optional[str] = None,
    ttl:          int           = 300,
) -> dict:
    """
    Fetch the IP India hearing cause list.
    date defaults to today.  agent_filter is a case-insensitive substring match.
    """
    if not date:
        date = datetime.now().strftime("%d/%m/%Y")

    ck = _ck("cl", date, agent_filter, location)
    cached = _cget(ck)
    if cached:
        return cached

    params: dict = {}
    if location and location.lower() not in ("", "all"):
        params["Location"] = location

    # Search by date (default) or agent name
    if agent_filter:
        params.update({"SearchField": "Agent Name", "SearchText": agent_filter})
    else:
        params.update({"SearchField": "Hearing Date", "SearchText": date})

    try:
        resp     = _sess.get(URL["cause_list"], params=params)
        hearings = _parse_cause_list(resp.text)
    except Exception as e:
        log.error(f"cause_list fetch error: {e}")
        return {"error": str(e), "hearings": [], "total": 0}

    total = len(hearings)

    # Post-filter by agent (more reliable than URL param alone)
    if agent_filter:
        af = agent_filter.upper()
        hearings = [h for h in hearings if af in h["agent"].upper()]

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
    soup  = BeautifulSoup(html, "lxml")
    table = soup.find("table")
    if not table:
        log.warning("No table in cause list response")
        return []
    rows = table.find_all("tr")
    out  = []
    for row in rows[1:]:
        td = row.find_all("td")
        if len(td) < 7:
            continue
        app_no = td[0].get_text(strip=True)
        atype  = td[6].get_text(strip=True)
        status = (
            "objected" if "Objected" in atype else
            "opposed"  if "Opposed"  in atype else
            "hearing"
        )
        slot_raw = td[5].get_text(strip=True)
        slot_label = "🌅 Morning (10:30 AM – 1:30 PM)" if "morning" in slot_raw.lower() \
                else "🌆 Afternoon (2:00 PM – 5:00 PM)"
        out.append({
            "app_no":       app_no,
            "room":         td[1].get_text(strip=True),
            "agent":        td[2].get_text(strip=True),
            "applicant":    td[3].get_text(strip=True),
            "hearing_date": td[4].get_text(strip=True),
            "slot":         slot_label,
            "app_type":     atype,
            "status":       status,
            "view_url":     f"{URL['eregister_view']}?AppNosValue={app_no}",
        })
    log.info(f"Parsed {len(out)} cause-list rows")
    return out


# ══════════════════════════════════════════════════════════
#  2.  e-REGISTER  (application status)
# ══════════════════════════════════════════════════════════

def fetch_application(app_no: str, ttl: int = 600) -> dict:
    """Fetch full trademark application details from e-Register."""
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

    # e-Register is a label/value table layout
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) >= 2:
                key = cells[0].get_text(strip=True).lower() \
                        .replace(" ", "_").replace(".", "").replace(":", "").replace("/", "_")
                val = cells[1].get_text(strip=True)
                if key and val:
                    raw[key] = val

    # Normalise common field names
    MAP = {
        "trade_mark":                    "trademark_name",
        "class":                         "tm_class",
        "date_of_application":           "filing_date",
        "applicant's_name_address":      "applicant",
        "applicants_name_address":       "applicant",
        "agent":                         "agent",
        "status":                        "status",
        "valid_upto":                    "valid_upto",
        "next_date_of_hearing":          "hearing_date",
        "examination_report_date":       "exam_report_date",
        "type_of_mark":                  "mark_type",
        "description_of_goods_services": "goods_services",
    }
    out = {"app_no": app_no}
    for rk, nk in MAP.items():
        if rk in raw:
            out[nk] = raw[rk]

    out["_raw"] = raw   # keep full parsed fields for debugging
    return out


def fetch_applications_bulk(app_nos: List[str]) -> List[dict]:
    results = []
    for i, no in enumerate(app_nos):
        log.info(f"bulk {i+1}/{len(app_nos)}: {no}")
        results.append(fetch_application(no))
        if i < len(app_nos) - 1:
            time.sleep(0.8)
    return results


# ══════════════════════════════════════════════════════════
#  3.  PUBLIC SEARCH
# ══════════════════════════════════════════════════════════

def fetch_public_search(
    query:       str,
    search_type: str = "wordmark",   # wordmark | proprietor | application
    tm_class:    str = "",
    proprietor:  str = "",
    ttl:         int = 1800,
) -> dict:
    """Search IP India public TM database."""
    ck = _ck("ps", query, search_type, tm_class)
    cached = _cget(ck)
    if cached:
        return cached

    try:
        # Step 1 — GET page to extract ASP.NET viewstate
        home = _sess.get(URL["public_search"])
        soup = BeautifulSoup(home.text, "lxml")
        vs   = (soup.find("input", {"id": "__VIEWSTATE"}) or {}).get("value", "")
        evv  = (soup.find("input", {"id": "__EVENTVALIDATION"}) or {}).get("value", "")
        vsg  = (soup.find("input", {"id": "__VIEWSTATEGENERATOR"}) or {}).get("value", "")

        # Step 2 — POST search form
        form = {
            "__VIEWSTATE":          vs,
            "__EVENTVALIDATION":    evv,
            "__VIEWSTATEGENERATOR": vsg,
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
        log.error(f"public search error: {e}")
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
    soup   = BeautifulSoup(html, "lxml")
    table  = None

    # Try known GridView id patterns first
    for pat in [r"GridView", r"gv", r"grid"]:
        table = soup.find("table", {"id": re.compile(pat, re.I)})
        if table:
            break

    # Fall back to any wide table
    if not table:
        for t in soup.find_all("table"):
            if len(t.find_all("tr")) > 2 and len(t.find_all("tr")[0].find_all(["th","td"])) >= 4:
                table = t
                break

    if not table:
        log.warning("No results table in public search")
        return []

    rows = table.find_all("tr")
    out  = []
    for row in rows[1:]:
        td = row.find_all("td")
        if len(td) >= 4:
            app_no = td[0].get_text(strip=True)
            out.append({
                "app_no":     app_no,
                "trademark":  td[1].get_text(strip=True),
                "class":      td[2].get_text(strip=True),
                "proprietor": td[3].get_text(strip=True),
                "status":     td[4].get_text(strip=True) if len(td) > 4 else "",
                "valid_upto": td[5].get_text(strip=True) if len(td) > 5 else "",
                "view_url":   f"{URL['eregister_view']}?AppNosValue={app_no}",
            })
    log.info(f"Parsed {len(out)} public-search results")
    return out


# ══════════════════════════════════════════════════════════
#  4.  eFILING  (authenticated session)
# ══════════════════════════════════════════════════════════

class EFilingClient:
    """
    Manages an authenticated ASP.NET session with IP India eFiling portal.
    One instance per user — stored in the module-level dict below.
    """

    def __init__(self):
        self.s             = requests.Session()
        self.s.headers.update(HEADERS)
        self.authenticated = False
        self.username: Optional[str] = None
        self._last = 0.0

    def _wait(self):
        gap = time.time() - self._last
        if gap < 1.0:
            time.sleep(1.0 - gap)
        self._last = time.time()

    # ── helpers ───────────────────────────────────────────
    @staticmethod
    def _viewstate(soup: BeautifulSoup) -> dict:
        def g(n): return (soup.find("input", {"name": n}) or {}).get("value", "")
        return {
            "__VIEWSTATE":          g("__VIEWSTATE"),
            "__EVENTVALIDATION":    g("__EVENTVALIDATION"),
            "__VIEWSTATEGENERATOR": g("__VIEWSTATEGENERATOR"),
        }

    # ── login ─────────────────────────────────────────────
    def login(self, username: str, password: str) -> dict:
        log.info(f"eFiling login: {username}")
        try:
            self._wait()
            page = self.s.get(URL["efiling_login"], timeout=25)
            soup = BeautifulSoup(page.text, "lxml")
            vs   = self._viewstate(soup)

            form = {
                **vs,
                "ctl00$ContentPlaceHolder1$txtUserName": username,
                "ctl00$ContentPlaceHolder1$txtPassword": password,
                "ctl00$ContentPlaceHolder1$btnLogin":    "Login",
            }
            self._wait()
            resp = self.s.post(URL["efiling_login"], data=form, timeout=25, allow_redirects=True)

            body_lower = resp.text.lower()
            if any(w in body_lower for w in ["invalid", "incorrect", "wrong password"]):
                return {"success": False, "message": "Invalid username or password"}

            if "frmLoginNew" not in resp.url or any(
                w in body_lower for w in ["logout", "dashboard", "my application"]
            ):
                self.authenticated = True
                self.username      = username
                log.info(f"eFiling login OK: {username}")
                return {"success": True, "message": "Login successful", "username": username}

            return {"success": False, "message": "Login failed — check credentials"}

        except Exception as e:
            log.error(f"eFiling login error: {e}")
            return {"success": False, "message": f"Connection error: {e}"}

    # ── portfolio ─────────────────────────────────────────
    def fetch_portfolio(self) -> dict:
        if not self.authenticated:
            return {"error": "Not authenticated"}
        try:
            self._wait()
            resp = self.s.get(URL["efiling_myapps"], timeout=25)
            apps = _parse_efiling_portfolio(resp.text)
            return {
                "applications": apps,
                "total":        len(apps),
                "username":     self.username,
                "fetched_at":   _now(),
            }
        except Exception as e:
            log.error(f"portfolio fetch error: {e}")
            return {"error": str(e), "applications": []}


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


# ── session store (one EFilingClient per username) ────────
_efiling_pool: Dict[str, EFilingClient] = {}

def get_efiling(username: str) -> EFilingClient:
    if username not in _efiling_pool:
        _efiling_pool[username] = EFilingClient()
    return _efiling_pool[username]


# ── util ──────────────────────────────────────────────────
def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"
