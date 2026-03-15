"""
scrapers/ipindia_scraper.py  ─  MarkShield Core IP India Scraper
================================================================
Scrapes IP India DIRECTLY.  No third-party API, no paid service.
This is exactly how MarkSimpl built their database.

DATA SOURCES
────────────
A. Oracle APEX New Search  (tmsearch.ipindia.gov.in/ords/r/tisa/)
   • Playwright opens the page, XHR calls return clean JSON
   • Covers: search by name / attorney / app-number

B. eRegister  (tmrsearch.ipindia.gov.in/eregister/)
   • Playwright renders the JS-heavy page → parse HTML
   • Covers: full details for one application

C. TLA Queue  (ipindiaonline.gov.in  – public, no login)
   • Plain requests.get() – always works
   • Covers: all pending matters for a TMA code

D. Cause List  (tmrsearch.ipindia.gov.in – public, no login)
   • Plain requests.get()
   • Covers: upcoming hearings by agent / date
"""

import re, time, logging, requests, urllib3
from typing import Dict, List, Optional
from bs4 import BeautifulSoup
from database import upsert_trademark, upsert_many, _classify

urllib3.disable_warnings()
log = logging.getLogger("markshield.scraper")

# ── Playwright launch args that work on Render (no root) ─────────────────────
PW_ARGS = [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
    "--single-process",
    "--no-zygote",
    "--disable-software-rasterizer",
]

CHROME_UA = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/122.0.0.0 Safari/537.36"
)

HEADERS = {
    "User-Agent":      CHROME_UA,
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection":      "keep-alive",
}


# ═══════════════════════════════════════════════════════════════════════════
# A.  ORACLE APEX NEW SEARCH
#     tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search/
#     Playwright → intercept XHR JSON → rich results
# ═══════════════════════════════════════════════════════════════════════════

APEX_URLS = [
    "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search/dpiit-public-search",
    "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search1000/dpiit-public-search",
]


def _launch_browser(pw):
    """Launch Chromium with Render-compatible args."""
    return pw.chromium.launch(headless=True, args=PW_ARGS)


def _apex_search(
    word_mark: str = "",
    application_number: str = "",
    attorney_name: str = "",
    proprietor_name: str = "",
    tm_class: str = "",
    max_results: int = 500,
    progress_cb=None,
) -> List[Dict]:
    """
    Search IP India's Oracle APEX system.
    Returns list of normalized trademark dicts.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.warning("Playwright not installed")
        return []

    results   = []
    captured  = []

    try:
        with sync_playwright() as p:
            browser = _launch_browser(p)
            ctx     = browser.new_context(user_agent=CHROME_UA)
            page    = ctx.new_page()

            # ── Intercept every JSON XHR from Oracle APEX ──────────────────
            def on_response(resp):
                try:
                    ct = resp.headers.get("content-type", "")
                    if "json" in ct:
                        data = resp.json()
                        if isinstance(data, dict):
                            rows = (
                                data.get("items") or data.get("rows") or
                                data.get("data")  or data.get("results") or []
                            )
                            if rows:
                                captured.extend(rows)
                                log.info(f"APEX XHR captured {len(rows)} rows from {resp.url[:70]}")
                except Exception:
                    pass

            page.on("response", on_response)

            # ── Try each APEX URL ──────────────────────────────────────────
            for apex_url in APEX_URLS:
                try:
                    page.goto(apex_url, wait_until="networkidle", timeout=30000)
                    page.wait_for_timeout(2500)

                    # Fill search fields
                    field_map = {
                        word_mark:          ['input[placeholder*="word" i]', '#P1_WORD_MARK',
                                             '#P_WORD_MARK', '#WORD_MARK', 'input[id*="word" i]'],
                        application_number: ['input[placeholder*="application" i]', '#P1_APP_NO',
                                             '#APP_NO', 'input[id*="app" i]'],
                        attorney_name:      ['input[placeholder*="agent" i]', '#P1_AGENT',
                                             '#AGENT_NAME', 'input[id*="agent" i]'],
                        proprietor_name:    ['input[placeholder*="proprietor" i]', '#P1_PROP',
                                             '#PROPRIETOR', 'input[id*="prop" i]'],
                        tm_class:           ['select[id*="class" i]', '#P1_CLASS', '#CLASS'],
                    }

                    filled = False
                    for value, selectors in field_map.items():
                        if not value:
                            continue
                        for sel in selectors:
                            try:
                                el = page.query_selector(sel)
                                if el and el.is_visible():
                                    if sel.startswith("select"):
                                        el.select_option(value=value)
                                    else:
                                        el.fill(value)
                                    filled = True
                                    log.info(f"Filled '{sel}' = '{value}'")
                                    break
                            except Exception:
                                continue

                    if not filled:
                        # Try any visible text input
                        for inp in page.query_selector_all('input[type="text"]'):
                            try:
                                if inp.is_visible():
                                    inp.fill(word_mark or application_number or
                                             attorney_name or proprietor_name)
                                    filled = True
                                    break
                            except Exception:
                                continue

                    if filled:
                        # Submit
                        submitted = False
                        for btn_sel in [
                            'button[type="submit"]', 'input[type="submit"]',
                            'button:has-text("Search")', 'a:has-text("Search")',
                            '#B1', '#SEARCH', '#P1_SEARCH',
                        ]:
                            try:
                                btn = page.query_selector(btn_sel)
                                if btn and btn.is_visible():
                                    btn.click()
                                    submitted = True
                                    break
                            except Exception:
                                continue
                        if not submitted:
                            page.keyboard.press("Enter")

                        # Wait for results
                        page.wait_for_timeout(4000)
                        try:
                            page.wait_for_load_state("networkidle", timeout=12000)
                        except Exception:
                            pass

                    if captured:
                        log.info(f"APEX: {len(captured)} rows captured")
                        break

                    # Parse HTML as fallback
                    html_rows = _parse_apex_html(page.content())
                    if html_rows:
                        captured.extend(html_rows)
                        break

                except Exception as e:
                    log.warning(f"APEX URL failed {apex_url}: {e}")
                    continue

            browser.close()

    except Exception as e:
        log.error(f"APEX search error: {e}")

    # Normalize rows
    for row in captured[:max_results]:
        n = _normalize_apex_row(row)
        if n.get("app_no"):
            results.append(n)

    log.info(f"APEX search returning {len(results)} results")
    return results


def _parse_apex_html(html: str) -> List[Dict]:
    """Parse APEX results table from HTML."""
    soup = BeautifulSoup(html, "lxml")
    rows = []
    for tbl in soup.find_all("table"):
        trs = tbl.find_all("tr")
        if len(trs) < 2:
            continue
        headers = [th.get_text(strip=True).lower() for th in trs[0].find_all(["th", "td"])]
        for tr in trs[1:]:
            cells = tr.find_all("td")
            item  = {}
            for i, cell in enumerate(cells):
                if i < len(headers) and headers[i]:
                    item[headers[i]] = cell.get_text(" ", strip=True)
            if item:
                rows.append(item)
    return rows


def _normalize_apex_row(row: dict) -> dict:
    """Map Oracle APEX column names → MarkShield fields."""
    def g(*keys):
        for k in keys:
            if row.get(k) and str(row[k]).strip() not in ("", "None", "null"):
                return str(row[k]).strip()
        return ""

    app_no = g("APP_NO", "APPLICATION_NO", "application_no", "application_number",
               "APPNO", "appno", "app no", "APPLICATION NUMBER")
    if not app_no:
        return {}

    status = g("STATUS", "status", "APPLICATION_STATUS", "application_status",
               "TM_STATUS", "tm_status", "Current Status")
    return {
        "app_no":         app_no,
        "trademark_name": g("TM_NAME", "trademark_name", "TRADEMARK_NAME", "WORD_MARK",
                            "word_mark", "MARK", "Trade Mark", "trade mark"),
        "tm_class":       g("CLASS", "TM_CLASS", "class_number", "CLASS_NUMBER",
                            "CLASS_NO", "Class"),
        "class_detail":   g("CLASS_DETAIL", "class_detail", "GOODS_SERVICES",
                            "goods_services", "DESCRIPTION"),
        "applicant":      g("APPLICANT", "applicant", "PROPRIETOR", "proprietor",
                            "PROPRIETOR_NAME", "proprietor_name", "Applicant"),
        "applicant_address": g("APPLICANT_ADDRESS", "applicant_address",
                               "PROPRIETOR_ADDRESS", "proprietor_address"),
        "agent":          g("AGENT", "agent", "ATTORNEY", "attorney",
                            "AGENT_NAME", "attorney_name", "Agent"),
        "state":          g("STATE", "state"),
        "office":         g("OFFICE", "office", "APPROPRIATE_OFFICE",
                            "appropriate_office", "TM_OFFICE"),
        "status":         status,
        "status_class":   _classify(status),
        "alert":          g("ALERT", "alert"),
        "filing_date":    g("FILING_DATE", "filing_date", "DATE_OF_APPLICATION",
                            "application_date", "APPLICATION_DATE", "Date of Application"),
        "valid_upto":     g("VALID_UPTO", "valid_upto", "EXPIRE_AT", "expire_at",
                            "EXPIRY_DATE", "Valid Upto"),
        "hearing_date":   g("HEARING_DATE", "hearing_date", "NEXT_HEARING_DATE",
                            "next_hearing_date"),
        "image_url":      g("IMAGE", "image", "IMAGE_URL", "image_url"),
        "certificate_no": g("CERTIFICATE_NO", "certificate_no", "CERT_NO",
                            "certificate_detail"),
        "publication":    g("PUBLICATION", "publication", "publication_details"),
        "mark_type":      g("TM_TYPE", "tm_type", "MARK_TYPE", "mark_type"),
        "filing_mode":    g("FILING_MODE", "filing_mode"),
        "view_url": (
            f"https://tmrsearch.ipindia.gov.in/eregister/"
            f"Application_View_Trademark.aspx?AppNosValue={app_no}"
        ),
        "source": "ipindia_apex",
    }


# ═══════════════════════════════════════════════════════════════════════════
# B.  EREGISTER — Full application details
#     Playwright renders JS then we parse the filled HTML
# ═══════════════════════════════════════════════════════════════════════════

EREGISTER_VIEW = (
    "https://tmrsearch.ipindia.gov.in/eregister/"
    "Application_View_Trademark.aspx?AppNosValue={app_no}"
)
EREGISTER_HOME = "https://tmrsearch.ipindia.gov.in/eregister/eregister.aspx"

SPAN_IDS = {
    "lblTradeMark": "trademark_name",  "lblTradeMarkName": "trademark_name",
    "lblWordmark":  "trademark_name",  "lblMark":          "trademark_name",
    "lblStatus":    "status",          "lblApplicationStatus": "status",
    "lblClass":     "tm_class",        "lblTmClass":       "tm_class",
    "lblApplicantName": "applicant",   "lblProprietorName": "applicant",
    "lblAgentName": "agent",           "lblAgent":         "agent",
    "lblDateOfApplication": "filing_date", "lblFilingDate": "filing_date",
    "lblValidUpto": "valid_upto",
    "lblNextHearingDate": "hearing_date", "lblHearingDate": "hearing_date",
    "lblGoodsServices": "goods_services", "lblDescription": "goods_services",
    "lblTypeOfMark": "mark_type",
    "lblOffice":    "office",          "lblCertificateNo": "certificate_no",
}

LABEL_MAP = {
    "trade mark": "trademark_name", "wordmark": "trademark_name",
    "trademark": "trademark_name",  "mark": "trademark_name",
    "class": "tm_class",            "class(es)": "tm_class",
    "status": "status",             "current status": "status",
    "application status": "status",
    "applicant's name": "applicant", "applicants name": "applicant",
    "applicant": "applicant",        "proprietor": "applicant",
    "proprietors name": "applicant", "proprietor's name": "applicant",
    "applicants name and address": "applicant",
    "applicant's name and address": "applicant",
    "agent": "agent",               "agent name": "agent",
    "agent / attorney": "agent",
    "date of application": "filing_date", "filing date": "filing_date",
    "valid upto": "valid_upto",     "valid up to": "valid_upto",
    "date of registration": "registration_date",
    "next date of hearing": "hearing_date",
    "type of mark": "mark_type",
    "description of goods/services": "goods_services",
    "goods and services": "goods_services",
    "description": "goods_services",
    "certificate no": "certificate_no",
    "office": "office",             "tm office": "office",
    "user detail": "user_since",
    "publication details": "publication",
}


def fetch_application(app_no: str, session=None) -> Dict:
    # Try eStatus saved session first (most complete data)
    try:
        from scrapers.estatus_auth import fetch_with_session, has_session
        if has_session():
            data = fetch_with_session(app_no)
            if data.get("trademark_name") or data.get("status"):
                log.info(f"eStatus session hit: {app_no}")
                return {"app_no": app_no, **data,
                        "view_url": f"{EREGISTER_VIEW.format(app_no=app_no)}"}
    except Exception as e:
        log.debug(f"eStatus session failed: {e}")
    _orig_fetch_application(app_no, session)


def _orig_fetch_application(app_no: str, session=None) -> Dict:
    """
    Fetch complete trademark details from eRegister.
    Method 1: Playwright renders page (handles JS)
    Method 2: requests POST form
    """
    app_no = str(app_no).strip()
    url    = EREGISTER_VIEW.format(app_no=app_no)
    base   = {"app_no": app_no, "view_url": url}

    # Method 1: Playwright
    data = _pw_fetch_eregister(url)
    if _has_data(data):
        log.info(f"eRegister PW: {app_no} → {data.get('status','?')}")
        result = {**base, **data}
        try:
            upsert_trademark(result)
        except Exception:
            pass
        return result

    # Method 2: requests POST
    data = _requests_fetch_eregister(app_no, session)
    if _has_data(data):
        log.info(f"eRegister POST: {app_no}")
        result = {**base, **data}
        try:
            upsert_trademark(result)
        except Exception:
            pass
        return result

    return {**base, "error": "No data returned from IP India eRegister"}


def _pw_fetch_eregister(url: str) -> Dict:
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = _launch_browser(p)
            page    = browser.new_page()
            page.set_extra_http_headers({"User-Agent": CHROME_UA})

            # Visit home first for session cookie
            try:
                page.goto("https://tmrsearch.ipindia.gov.in/eregister/",
                          wait_until="domcontentloaded", timeout=15000)
            except Exception:
                pass

            page.goto(url, wait_until="networkidle", timeout=30000)
            # Wait for data to load
            page.wait_for_timeout(3000)
            html = page.content()
            browser.close()
        return _parse_eregister_html(html)
    except Exception as e:
        log.debug(f"PW eRegister failed: {e}")
        return {}


def _requests_fetch_eregister(app_no: str, session=None) -> Dict:
    try:
        s = session or requests.Session()
        s.headers.update(HEADERS)
        home = s.get(EREGISTER_HOME, timeout=20, verify=True)
        soup = BeautifulSoup(home.text, "lxml")

        form = {
            inp["name"]: inp.get("value", "")
            for inp in soup.find_all("input", {"type": "hidden"})
            if inp.get("name")
        }
        txt = soup.find("input", {"type": "text"})
        if txt and txt.get("name"):
            form[txt["name"]] = app_no
        else:
            form["ctl00$ContentPlaceHolder1$txtNo"] = app_no

        for btn in soup.find_all("input", {"type": "submit"}):
            if btn.get("name"):
                form[btn["name"]] = btn.get("value", "Search")

        resp = s.post(
            EREGISTER_HOME, data=form, timeout=25, verify=True,
            headers={**HEADERS, "Referer": EREGISTER_HOME,
                     "Content-Type": "application/x-www-form-urlencoded"},
        )
        return _parse_eregister_html(resp.text)
    except Exception as e:
        log.debug(f"requests eRegister failed: {e}")
        return {}


def _parse_eregister_html(html: str) -> Dict:
    soup = BeautifulSoup(html, "lxml")
    out  = {}

    # Strategy 1: span IDs
    for suffix, field in SPAN_IDS.items():
        for pfx in ["ctl00_ContentPlaceHolder1_", "ContentPlaceHolder1_", ""]:
            el = soup.find(id=f"{pfx}{suffix}")
            if el:
                val = el.get_text(" ", strip=True)
                if val and val not in ("\xa0", "-", "N/A", ""):
                    out.setdefault(field, val)
                break
    if _has_data(out):
        return out

    # Strategy 2: table rows
    for tbl in soup.find_all("table"):
        for row in tbl.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            lbl = re.sub(r"\s+", " ",
                         cells[0].get_text(strip=True).lower().rstrip(":*").strip())
            val = cells[1].get_text(" ", strip=True).strip()
            if not val or val in ("\xa0", "-", "N/A"):
                continue
            if lbl in LABEL_MAP:
                out.setdefault(LABEL_MAP[lbl], val)
            else:
                for k, f in LABEL_MAP.items():
                    if k and k in lbl and len(k) > 4:
                        out.setdefault(f, val)
                        break
    if _has_data(out):
        return out

    # Strategy 3: regex
    for field, pats in {
        "trademark_name": [r"(?:Trade\s*Mark|Wordmark)[:\|]?\s*<[^>]*>([^<]{2,80})<"],
        "status":         [r"(?:Status|Application Status)[:\|]?\s*<[^>]*>([A-Za-z ]{3,50})<"],
        "applicant":      [r"Applicant[^:]*[:\|]\s*<[^>]*>([^<]{3,150})<"],
        "filing_date":    [r"Date of Application[^:]*[:\|]\s*<[^>]*>([^<]{6,20})<"],
        "tm_class":       [r"\bClass\b[^:]*[:\|]\s*<[^>]*>(\d{1,2})<"],
    }.items():
        for pat in pats:
            m = re.search(pat, html, re.I | re.S)
            if m:
                val = re.sub(r"<[^>]+>", "", m.group(1)).strip()
                if val and len(val) > 1:
                    out.setdefault(field, val)
                    break

    if out.get("status"):
        out["status_class"] = _classify(out["status"])
    return out


def _has_data(d: Dict) -> bool:
    return any(
        d.get(k) and str(d[k]).strip() not in ("—", "-", "N/A", "")
        for k in ["trademark_name", "status", "applicant", "filing_date"]
    )


# ═══════════════════════════════════════════════════════════════════════════
# C.  TLA QUEUE — All pending matters for a TMA code
#     Pure HTTP — always works, no Playwright needed
# ═══════════════════════════════════════════════════════════════════════════

TLA_URL = (
    "https://ipindiaonline.gov.in/trademarkefiling/"
    "DynamicUtilities/TLA_QueueList_new.aspx"
)


def fetch_tla_queue_full(tma_code: str) -> List[Dict]:
    """Fetch all TLA Queue items for this TMA code and save to DB."""
    try:
        s = requests.Session()
        s.headers.update(HEADERS)
        resp = s.get(TLA_URL, params={"UserName": tma_code},
                     timeout=40, verify=False)
        soup = BeautifulSoup(resp.text, "lxml")

        # Find the biggest table
        table = None
        for tid in ["GridView1", "gvQueue", "ctl00_ContentPlaceHolder1_GridView1"]:
            table = soup.find("table", {"id": tid})
            if table:
                break
        if not table:
            all_tbls = soup.find_all("table")
            table = max(all_tbls, key=lambda t: len(t.find_all("tr")),
                        default=None) if all_tbls else None
        if not table:
            return []

        rows    = table.find_all("tr")
        headers = [h.get_text(strip=True).lower()
                   for h in rows[0].find_all(["th", "td"])] if rows else []

        def col(hints, cells):
            for hint in hints:
                for i, h in enumerate(headers):
                    if hint in h and i < len(cells):
                        v = cells[i].get_text(strip=True)
                        if v:
                            return v
            return ""

        items = []
        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 2:
                continue
            app_no = (col(["app no", "appno", "application"], tds) or
                      tds[0].get_text(strip=True))
            if not app_no or not any(c.isdigit() for c in app_no):
                continue

            record = {
                "app_no":       app_no.strip(),
                "trademark_name": col(["trade mark", "trademark", "mark"], tds),
                "tm_class":     col(["class"], tds),
                "agent":        col(["agent", "tma", "attorney"], tds),
                "tma_code":     tma_code,
                "action_type":  col(["action", "notice", "type"], tds),
                "filing_date":  col(["date", "issue"], tds),
                "reply_status": col(["reply", "status"], tds),
                "office":       col(["office", "location"], tds),
                "status":       "Pending",
                "status_class": "pending",
                "source":       "tla_queue",
                "view_url": (
                    f"https://tmrsearch.ipindia.gov.in/eregister/"
                    f"Application_View_Trademark.aspx?AppNosValue={app_no.strip()}"
                ),
            }
            items.append(record)

        upsert_many(items)
        log.info(f"TLA Queue: {len(items)} items for {tma_code}")
        return items

    except Exception as e:
        log.error(f"TLA Queue error: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════════
# D.  CAUSE LIST — Upcoming hearings
# ═══════════════════════════════════════════════════════════════════════════

CAUSELIST_URL = (
    "https://tmrsearch.ipindia.gov.in/"
    "TMRDynamicUtility/CauseListForHearingCase/Index"
)


def fetch_causelist(agent_name: str = "", date: str = "",
                    tma_code: str = "") -> List[Dict]:
    try:
        s = requests.Session()
        s.headers.update(HEADERS)
        params = {}
        if agent_name:
            params["SearchField"] = "Agent Name"
            params["SearchText"]  = agent_name
        if date:
            params["HearingDate"] = date

        resp = s.get(CAUSELIST_URL, params=params, timeout=30)
        soup = BeautifulSoup(resp.text, "lxml")

        tbl = soup.find("table")
        if not tbl:
            return []

        rows  = tbl.find_all("tr")
        items = []
        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 3:
                continue
            app_no = tds[0].get_text(strip=True)
            if not any(c.isdigit() for c in app_no):
                continue
            hearing = tds[4].get_text(strip=True) if len(tds) > 4 else date
            record  = {
                "app_no":       app_no,
                "agent":        tds[2].get_text(strip=True) if len(tds) > 2 else agent_name,
                "applicant":    tds[3].get_text(strip=True) if len(tds) > 3 else "",
                "hearing_date": hearing,
                "tma_code":     tma_code,
                "status":       "Hearing Scheduled" if hearing else "",
                "status_class": "hearing_scheduled" if hearing else "pending",
                "source":       "cause_list",
                "view_url": (
                    f"https://tmrsearch.ipindia.gov.in/eregister/"
                    f"Application_View_Trademark.aspx?AppNosValue={app_no}"
                ),
            }
            items.append(record)
            upsert_trademark(record)

        log.info(f"Cause list: {len(items)} hearings")
        return items

    except Exception as e:
        log.error(f"Cause list error: {e}")
        return []


# ═══════════════════════════════════════════════════════════════════════════
# MAIN: Full attorney portfolio sync
# ═══════════════════════════════════════════════════════════════════════════

def sync_full_portfolio(
    tma_code: str,
    agent_name: str = "",
    progress_cb=None,
) -> Dict:
    """
    Fetch EVERYTHING for an attorney.
    Combines all 4 sources → saves to SQLite DB.
    """
    from datetime import datetime
    from database import (
        get_attorney_portfolio, update_attorney_sync,
        log_sync, register_attorney, _classify as classify,
    )

    started = datetime.utcnow().isoformat() + "Z"
    cb = progress_cb or (lambda m, p: log.info(f"{p}% {m}"))

    register_attorney(tma_code, agent_name)

    # ── Step 1: TLA Queue ─────────────────────────────────────────────────
    cb("Fetching TLA Queue from IP India…", 5)
    queue_items = fetch_tla_queue_full(tma_code)
    cb(f"TLA Queue: {len(queue_items)} matters", 20)

    # ── Step 2: Cause List ────────────────────────────────────────────────
    if agent_name:
        cb(f"Fetching cause list for {agent_name}…", 22)
        cl_items = fetch_causelist(agent_name=agent_name, tma_code=tma_code)
        cb(f"Cause list: {len(cl_items)} hearings", 35)

    # ── Step 3: APEX search by attorney name ──────────────────────────────
    if agent_name:
        cb(f"Searching Oracle APEX for {agent_name}…", 38)
        apex_items = _apex_search(attorney_name=agent_name, max_results=500,
                                  progress_cb=lambda m, p: cb(m, 38 + int(p * 0.3)))
        upsert_many(apex_items)
        cb(f"APEX: {len(apex_items)} applications found", 70)

    # ── Step 4: Enrich missing apps via eRegister ─────────────────────────
    from database import get_conn
    with get_conn() as conn:
        need = conn.execute("""
            SELECT app_no FROM trademarks
            WHERE (tma_code = ? OR agent LIKE ?)
              AND (trademark_name IS NULL OR trademark_name IN ('', '—'))
            LIMIT 40
        """, (tma_code, f"%{agent_name}%")).fetchall()

    need = [r["app_no"] for r in need]
    if need:
        cb(f"Enriching {len(need)} apps from eRegister…", 72)
        s = requests.Session()
        s.headers.update(HEADERS)
        for idx, app_no in enumerate(need):
            fetch_application(app_no, session=s)
            if idx < len(need) - 1:
                time.sleep(0.8)
            if idx % 5 == 0:
                cb(f"eRegister {idx+1}/{len(need)}: {app_no}", 72 + int(idx/len(need)*18))

    # ── Build result from DB ──────────────────────────────────────────────
    apps = get_attorney_portfolio(tma_code=tma_code, agent_name=agent_name)

    summary = {
        "total":             len(apps),
        "registered":        sum(1 for a in apps if a.get("status_class") == "registered"),
        "objected":          sum(1 for a in apps if a.get("status_class") == "objected"),
        "opposed":           sum(1 for a in apps if a.get("status_class") == "opposed"),
        "pending":           sum(1 for a in apps if a.get("status_class") in
                               ("pending", "under_examination")),
        "hearings_upcoming": sum(1 for a in apps if a.get("hearing_date") and
                               a["hearing_date"] not in ("—", "")),
        "refused":           sum(1 for a in apps if a.get("status_class") in
                               ("refused", "abandoned")),
    }

    update_attorney_sync(tma_code, len(apps))
    log_sync(tma_code, "full_sync", len(apps), "success", "", started)

    cb(f"✅ Complete — {len(apps)} applications in database", 100)

    return {
        "tma_code":     tma_code,
        "agent_name":   agent_name,
        "applications": apps,
        "summary":      summary,
        "synced_at":    datetime.utcnow().isoformat() + "Z",
        "sources":      ["TLA Queue", "Cause List",
                         "Oracle APEX Search", "eRegister"],
    }


# ═══════════════════════════════════════════════════════════════════════════
# Bulk application fetch
# ═══════════════════════════════════════════════════════════════════════════

def fetch_applications_bulk(app_nos: List[str]) -> List[Dict]:
    s = requests.Session()
    s.headers.update(HEADERS)
    results = []
    for i, no in enumerate(app_nos):
        results.append(fetch_application(no, session=s))
        if i < len(app_nos) - 1:
            time.sleep(0.8)
    return results
