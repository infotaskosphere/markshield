"""
scrapers/ipindia_bulk.py — IP India Bulk Data Fetcher
======================================================
Fetches ALL trademarks for an attorney and stores them in our local DB.
This is how BinBash built their database — iterate, fetch, store.

Sources (in order of reliability):
  1. TLA Queue         — public, no auth, returns app numbers + pending status
  2. Cause List        — public, no auth, returns hearing schedule
  3. Oracle APEX REST  — intercept AJAX calls from new IP India search
  4. eRegister POST    — fetch individual app details

The key insight: IP India's new APEX search at tmsearch.ipindia.gov.in
makes XHR calls to Oracle REST endpoints that return clean JSON.
We intercept those with Playwright.
"""

import time, logging, re, requests, urllib3
from typing import List, Dict, Optional
from bs4 import BeautifulSoup
from datetime import datetime
from database import upsert_trademark, upsert_many, update_attorney_sync, log_sync, _classify

urllib3.disable_warnings()
log = logging.getLogger("markshield.bulk")

EREGISTER_URL = "https://tmrsearch.ipindia.gov.in/eregister/eregister.aspx"
TLA_URL       = "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx"
CAUSELIST_URL = "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index"
APEX_SEARCH   = "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search/dpiit-public-search"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
}


def _session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _now():
    return datetime.utcnow().isoformat() + "Z"


# ══════════════════════════════════════════════════════════════════════════════
# SOURCE 1: TLA QUEUE — 100% reliable, returns all pending matters by TMA code
# ══════════════════════════════════════════════════════════════════════════════

def fetch_tla_queue_full(tma_code: str) -> List[Dict]:
    """Fetch all items from TLA Queue for this TMA code and save to DB."""
    log.info(f"TLA Queue fetch: {tma_code}")
    try:
        s = _session()
        resp = s.get(TLA_URL, params={"UserName": tma_code}, timeout=40, verify=False)
        soup = BeautifulSoup(resp.text, "lxml")

        table = None
        for tid in ["GridView1", "gvQueue", "ctl00_ContentPlaceHolder1_GridView1"]:
            table = soup.find("table", {"id": tid})
            if table: break
        if not table:
            all_tables = soup.find_all("table")
            if all_tables:
                table = max(all_tables, key=lambda t: len(t.find_all("tr")), default=None)

        if not table:
            return []

        rows = table.find_all("tr")
        headers = [h.get_text(strip=True).lower() for h in rows[0].find_all(["th","td"])] if rows else []

        def col(hints, cells):
            for hint in hints:
                for i, h in enumerate(headers):
                    if hint in h and i < len(cells):
                        v = cells[i].get_text(strip=True)
                        if v: return v
            return ""

        items = []
        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 2: continue
            app_no = col(["app no","appno","application"], tds) or tds[0].get_text(strip=True)
            if not app_no or not any(c.isdigit() for c in app_no):
                continue

            record = {
                "app_no":       app_no.strip(),
                "tm_name":      col(["trade mark","trademark","mark"], tds),
                "action_type":  col(["action","notice","type"], tds),
                "issue_date":   col(["date","issue"], tds),
                "reply_status": col(["reply","status"], tds),
                "agent":        col(["agent","tma","attorney"], tds),
                "tma_code":     tma_code,
                "tm_class":     col(["class"], tds),
                "office":       col(["office","location"], tds),
                "source":       "tla_queue",
            }
            items.append(record)

            # Save to DB immediately
            upsert_trademark({
                "app_no":       record["app_no"],
                "trademark_name": record["tm_name"],
                "tm_class":     record["tm_class"],
                "agent":        record["agent"],
                "tma_code":     tma_code,
                "status":       record["reply_status"] or "Pending",
                "status_class": "pending",
                "office":       record["office"],
                "hearing_date": "",
                "source":       "tla_queue",
            })

        log.info(f"TLA Queue: {len(items)} items saved for {tma_code}")
        return items

    except Exception as e:
        log.error(f"TLA Queue error: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# SOURCE 2: CAUSE LIST — fetch upcoming hearings by agent name
# ══════════════════════════════════════════════════════════════════════════════

def fetch_causelist_full(agent_name: str, tma_code: str = "") -> List[Dict]:
    """Fetch cause list for agent and save to DB."""
    log.info(f"Cause list fetch: {agent_name}")
    try:
        s = _session()
        params = {"SearchField": "Agent Name", "SearchText": agent_name}
        resp = s.get(CAUSELIST_URL, params=params, timeout=40)
        soup = BeautifulSoup(resp.text, "lxml")

        table = soup.find("table")
        if not table: return []

        rows = table.find_all("tr")
        items = []
        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 4: continue
            app_no = tds[0].get_text(strip=True)
            if not app_no or not any(c.isdigit() for c in app_no): continue

            hearing_date = tds[4].get_text(strip=True) if len(tds) > 4 else ""
            record = {
                "app_no":       app_no,
                "agent":        tds[2].get_text(strip=True) if len(tds) > 2 else agent_name,
                "applicant":    tds[3].get_text(strip=True) if len(tds) > 3 else "",
                "hearing_date": hearing_date,
                "tma_code":     tma_code,
                "source":       "cause_list",
            }
            items.append(record)

            upsert_trademark({
                "app_no":       app_no,
                "agent":        record["agent"],
                "applicant":    record["applicant"],
                "hearing_date": hearing_date,
                "tma_code":     tma_code,
                "status":       "Hearing Scheduled" if hearing_date else "",
                "status_class": "hearing_scheduled" if hearing_date else "pending",
                "source":       "cause_list",
            })

        log.info(f"Cause list: {len(items)} hearings saved")
        return items

    except Exception as e:
        log.error(f"Cause list error: {e}")
        return []


# ══════════════════════════════════════════════════════════════════════════════
# SOURCE 3: EREGISTER — fetch full details for individual apps
# ══════════════════════════════════════════════════════════════════════════════

def fetch_eregister_single(app_no: str, session=None) -> Dict:
    """
    Fetch full trademark details from eRegister and save to DB.
    Uses multi-strategy parsing.
    """
    s = session or _session()
    app_no = str(app_no).strip()
    result = {"app_no": app_no}

    # Method A: Direct GET with AppNosValue
    try:
        url = f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}"
        resp = s.get(url, timeout=30, verify=True)
        parsed = _parse_eregister_html(resp.text)
        if _has_data(parsed):
            result.update(parsed)
            result["source"] = "eregister_get"
            result["view_url"] = url
            upsert_trademark(result)
            log.info(f"eRegister GET success: {app_no} → {result.get('status','?')}")
            return result
    except Exception as e:
        log.debug(f"GET failed for {app_no}: {e}")

    # Method A2: APEX search (new IP India — JSON based)
    try:
        from scrapers.eregister import fetch_via_apex_search
        apex = fetch_via_apex_search(app_no)
        if apex and any(apex.get(k) for k in ["trademark_name","status","applicant"]):
            result.update(apex)
            result["source"] = "apex_search"
            upsert_trademark(result)
            log.info(f"APEX success: {app_no} → {result.get('status','?')}")
            return result
    except Exception as e:
        log.debug(f"APEX fallback failed: {e}")

    # Method B: POST to eregister.aspx
    try:
        home = s.get(EREGISTER_URL, timeout=25)
        soup = BeautifulSoup(home.text, "lxml")

        vs  = _hidden(soup, "__VIEWSTATE")
        evv = _hidden(soup, "__EVENTVALIDATION")
        vsg = _hidden(soup, "__VIEWSTATEGENERATOR")

        # Find actual input field name
        txt = soup.find("input", {"type": "text"})
        txt_name = txt.get("name","") if txt else "ctl00$ContentPlaceHolder1$txtNo"

        form = {
            "__VIEWSTATE": vs, "__EVENTVALIDATION": evv,
            "__VIEWSTATEGENERATOR": vsg,
            txt_name: app_no,
            "ctl00$ContentPlaceHolder1$btnSearch": "Search",
        }

        resp2 = s.post(EREGISTER_URL, data=form, timeout=30,
                       headers={**HEADERS, "Referer": EREGISTER_URL,
                                "Content-Type": "application/x-www-form-urlencoded"})
        parsed = _parse_eregister_html(resp2.text)
        if _has_data(parsed):
            result.update(parsed)
            result["source"] = "eregister_post"
            result["view_url"] = f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}"
            upsert_trademark(result)
            log.info(f"eRegister POST success: {app_no} → {result.get('status','?')}")
            return result
    except Exception as e:
        log.debug(f"POST failed for {app_no}: {e}")

    log.warning(f"eRegister: no data for {app_no}")
    return result


def _hidden(soup, name):
    el = soup.find("input", {"name": name}) or soup.find("input", {"id": name})
    return (el or {}).get("value", "")


def _has_data(d):
    return any(d.get(k) for k in ["trademark_name", "status", "applicant", "filing_date"])


LABEL_MAP = {
    "trade mark": "trademark_name", "wordmark": "trademark_name", "trademark": "trademark_name",
    "class": "tm_class", "class(es)": "tm_class",
    "status": "status", "current status": "status", "application status": "status",
    "applicant's name": "applicant", "applicants name": "applicant", "applicant": "applicant",
    "proprietor": "applicant", "proprietors name": "applicant",
    "applicants name and address": "applicant", "applicant's name and address": "applicant",
    "agent": "agent", "agent name": "agent", "agent / attorney": "agent",
    "date of application": "filing_date", "filing date": "filing_date",
    "valid upto": "valid_upto", "valid up to": "valid_upto",
    "date of registration": "registration_date",
    "next date of hearing": "hearing_date", "hearing date": "hearing_date",
    "type of mark": "mark_type",
    "description of goods/services": "goods_services", "goods and services": "goods_services",
    "description": "goods_services",
    "certificate no": "certificate_no", "registration no": "certificate_no",
    "office": "office", "tm office": "office",
    "user detail": "user_since", "used since": "user_since",
    "publication details": "publication", "publication": "publication",
}

SPAN_MAP = {
    "lblTradeMark": "trademark_name", "lblTradeMarkName": "trademark_name",
    "lblWordmark": "trademark_name", "lblMark": "trademark_name",
    "lblStatus": "status", "lblApplicationStatus": "status", "lblTmStatus": "status",
    "lblClass": "tm_class", "lblTmClass": "tm_class", "lblClassNo": "tm_class",
    "lblApplicantName": "applicant", "lblProprietorName": "applicant", "lblApplicant": "applicant",
    "lblAgentName": "agent", "lblAgent": "agent",
    "lblDateOfApplication": "filing_date", "lblFilingDate": "filing_date",
    "lblValidUpto": "valid_upto",
    "lblNextHearingDate": "hearing_date", "lblHearingDate": "hearing_date",
    "lblGoodsServices": "goods_services", "lblDescription": "goods_services",
    "lblTypeOfMark": "mark_type",
    "lblOffice": "office", "lblTmOffice": "office",
    "lblCertificateNo": "certificate_no",
}


def _parse_eregister_html(html: str) -> dict:
    soup = BeautifulSoup(html, "lxml")
    out = {}

    # Strategy 1: Span IDs (ASP.NET controls)
    for suffix, field in SPAN_MAP.items():
        for prefix in ["ctl00_ContentPlaceHolder1_", "ContentPlaceHolder1_", ""]:
            el = soup.find(id=f"{prefix}{suffix}")
            if el:
                val = el.get_text(" ", strip=True)
                if val and val not in ("\xa0", "-", "N/A", ""):
                    out[field] = val
                break
    if _has_data(out): return out

    # Strategy 2: Table label→value rows
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2: continue
            label = re.sub(r"\s+", " ", cells[0].get_text(strip=True).lower().rstrip(":*").strip())
            value = cells[1].get_text(" ", strip=True).strip()
            if not value or value in ("\xa0", "-", "N/A"): continue
            field = LABEL_MAP.get(label)
            if field and field not in out:
                out[field] = value
                continue
            for k, f in LABEL_MAP.items():
                if k and k in label and len(k) > 4 and f not in out:
                    out[f] = value
                    break
    if _has_data(out): return out

    # Strategy 3: Regex fallback
    for field, patterns in {
        "trademark_name": [r"Trade\s*Mark\s*[:\|]?\s*<[^>]*>([^<]{2,60})<"],
        "status":         [r"Status\s*[:\|]?\s*<[^>]*>([A-Za-z ]{3,40})<"],
        "applicant":      [r"Applicant[^:]*[:\|]\s*<[^>]*>([^<]{3,100})<"],
        "filing_date":    [r"Date\s*of\s*Application[^:]*[:\|]\s*<[^>]*>([^<]{6,20})<"],
        "tm_class":       [r"\bClass\b[^:]*[:\|]\s*<[^>]*>(\d{1,2})<"],
    }.items():
        if field in out: continue
        for pat in patterns:
            m = re.search(pat, html, re.I | re.S)
            if m:
                val = re.sub(r"<[^>]+>", "", m.group(1)).strip()
                if val and len(val) > 1:
                    out[field] = val
                    break

    if out.get("status"):
        out["status_class"] = _classify(out["status"])
    return out


# ══════════════════════════════════════════════════════════════════════════════
# SOURCE 4: ORACLE APEX — intercept REST calls from new IP India search
# ══════════════════════════════════════════════════════════════════════════════

def fetch_apex_by_agent(agent_name: str, tma_code: str = "", progress_cb=None) -> List[Dict]:
    """
    Use Playwright to open Oracle APEX new search and intercept REST JSON.
    This is how the new IP India search system works internally.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.warning("Playwright not installed — skipping APEX fetch")
        return []

    captured = []
    results = []

    if progress_cb: progress_cb("Opening IP India new search (Playwright)…", 30)

    URLS_TO_TRY = [
        "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search/dpiit-public-search",
        "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search1000/dpiit-public-search",
        "https://tmrsearch.ipindia.gov.in/ESEARCH",
    ]

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36"
            )
            page = context.new_page()

            def on_response(resp):
                try:
                    url = resp.url
                    ct  = resp.headers.get("content-type", "")
                    if "json" in ct and any(k in url for k in ["ords", "search", "trademark", "tisa"]):
                        data = resp.json()
                        captured.append({"url": url, "data": data})
                        log.info(f"APEX intercepted: {url[:80]}")
                except Exception:
                    pass

            page.on("response", on_response)

            for try_url in URLS_TO_TRY:
                try:
                    page.goto(try_url, wait_until="networkidle", timeout=25000)
                    page.wait_for_timeout(2000)

                    # Try to find agent/attorney search field
                    filled = False
                    for sel in [
                        'input[placeholder*="agent" i]', 'input[placeholder*="attorney" i]',
                        'input[id*="agent" i]', 'input[id*="AGENT" i]',
                        'input[name*="agent" i]', '#P1_AGENT', '#AGENT_NAME',
                        '[data-fieldname*="agent" i]',
                    ]:
                        try:
                            inp = page.query_selector(sel)
                            if inp and inp.is_visible():
                                inp.fill(agent_name)
                                filled = True
                                log.info(f"Filled agent field: {sel}")
                                break
                        except Exception:
                            continue

                    if filled:
                        # Submit
                        for btn_sel in [
                            'button[type="submit"]', 'input[type="submit"]',
                            'button:has-text("Search")', 'a:has-text("Search")',
                            '#B1', '#P1_SUBMIT', '#SEARCH_BUTTON',
                        ]:
                            try:
                                btn = page.query_selector(btn_sel)
                                if btn and btn.is_visible():
                                    btn.click()
                                    break
                            except Exception:
                                continue
                        else:
                            page.keyboard.press("Enter")

                        page.wait_for_timeout(4000)
                        try:
                            page.wait_for_load_state("networkidle", timeout=12000)
                        except Exception:
                            pass

                        # Parse captured JSON
                        for item in captured:
                            data = item["data"]
                            rows = (data.get("items") or data.get("rows") or
                                    data.get("data") or data.get("results") or [])
                            if isinstance(rows, list) and rows:
                                results.extend(rows)
                                log.info(f"APEX JSON: {len(rows)} rows from {item['url'][:60]}")

                        if results:
                            break

                    # Also parse page HTML
                    html_results = _parse_apex_html(page.content())
                    results.extend(html_results)

                except Exception as e:
                    log.warning(f"APEX try {try_url}: {e}")
                    continue

            browser.close()

    except Exception as e:
        log.error(f"Playwright error: {e}")

    # Normalize and save to DB
    saved = []
    for row in results:
        try:
            normalized = _normalize_apex_row(row, tma_code)
            if normalized.get("app_no"):
                upsert_trademark(normalized)
                saved.append(normalized)
        except Exception as e:
            log.warning(f"APEX row normalize error: {e}")

    log.info(f"APEX: {len(saved)} records saved")
    return saved


def _normalize_apex_row(row: dict, tma_code: str = "") -> dict:
    """Normalize Oracle APEX JSON row to our DB format."""
    def g(*keys):
        for k in keys:
            if row.get(k): return str(row[k]).strip()
        return ""

    app_no = g("APP_NO", "APPLICATION_NO", "application_no", "application_number",
               "APPNO", "appno", "app_no")
    if not app_no: return {}

    status = g("STATUS", "status", "APPLICATION_STATUS", "application_status", "TM_STATUS")
    return {
        "app_no":         app_no,
        "trademark_name": g("TM_NAME","trademark_name","TRADEMARK_NAME","WORD_MARK","word_mark","MARK"),
        "tm_class":       g("CLASS","TM_CLASS","class","CLASS_NUMBER","class_number"),
        "class_detail":   g("CLASS_DETAIL","class_detail","GOODS_SERVICES","goods_services"),
        "applicant":      g("APPLICANT","applicant","PROPRIETOR","proprietor","PROPRIETOR_NAME","proprietor_name"),
        "agent":          g("AGENT","agent","ATTORNEY","attorney","AGENT_NAME","attorney_name"),
        "tma_code":       tma_code,
        "state":          g("STATE","state"),
        "office":         g("OFFICE","office","APPROPRIATE_OFFICE","appropriate_office"),
        "status":         status,
        "status_class":   _classify(status),
        "filing_date":    g("FILING_DATE","filing_date","DATE_OF_APPLICATION","application_date","APPLICATION_DATE"),
        "valid_upto":     g("VALID_UPTO","valid_upto","EXPIRE_AT","expire_at"),
        "hearing_date":   g("HEARING_DATE","hearing_date","NEXT_HEARING_DATE"),
        "image_url":      g("IMAGE","image","IMAGE_URL"),
        "alert":          g("ALERT","alert"),
        "filing_mode":    g("FILING_MODE","filing_mode"),
        "view_url":       f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}",
        "source":         "apex_search",
    }


def _parse_apex_html(html: str) -> list:
    """Parse result rows from APEX page HTML."""
    soup = BeautifulSoup(html, "lxml")
    results = []
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2: continue
        headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th","td"])]
        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells: continue
            item = {}
            for i, cell in enumerate(cells):
                if i < len(headers) and headers[i]:
                    item[headers[i]] = cell.get_text(strip=True)
            if item.get("app no") or item.get("application number"):
                results.append(item)
    return results


# ══════════════════════════════════════════════════════════════════════════════
# MAIN ENTRY: Full attorney portfolio fetch and sync
# ══════════════════════════════════════════════════════════════════════════════

def sync_attorney_portfolio(
    tma_code: str,
    agent_name: str = "",
    progress_cb=None,
) -> dict:
    """
    Full portfolio sync for one attorney.
    Fetches from all sources and stores in local DB.
    Returns summary dict.
    """
    started = _now()
    if progress_cb: progress_cb("Starting portfolio sync…", 2)

    total_saved = 0

    # ── Step 1: TLA Queue ─────────────────────────────────────────────────
    if progress_cb: progress_cb("Fetching TLA Queue from IP India…", 8)
    queue_items = fetch_tla_queue_full(tma_code)
    total_saved += len(queue_items)
    if progress_cb: progress_cb(f"TLA Queue: {len(queue_items)} matters found", 20)

    # ── Step 2: Cause List ────────────────────────────────────────────────
    if agent_name:
        if progress_cb: progress_cb(f"Fetching cause list for {agent_name}…", 25)
        cl_items = fetch_causelist_full(agent_name, tma_code)
        total_saved += len(cl_items)
        if progress_cb: progress_cb(f"Cause list: {len(cl_items)} hearings found", 35)

    # ── Step 3: APEX Search ───────────────────────────────────────────────
    if agent_name:
        apex_items = fetch_apex_by_agent(agent_name, tma_code, progress_cb)
        total_saved += len(apex_items)
        if progress_cb: progress_cb(f"APEX search: {len(apex_items)} records found", 55)

    # ── Step 4: Enrich with eRegister (apps without full details) ─────────
    from database import get_attorney_portfolio, get_conn
    with get_conn() as conn:
        need_detail = conn.execute("""
            SELECT app_no FROM trademarks
            WHERE (tma_code = ? OR agent LIKE ?)
              AND (trademark_name IS NULL OR trademark_name = '' OR trademark_name = '—')
            LIMIT 40
        """, (tma_code, f"%{agent_name}%")).fetchall()

    need_detail = [r["app_no"] for r in need_detail]
    if need_detail:
        if progress_cb: progress_cb(f"Enriching {len(need_detail)} apps from eRegister…", 60)
        s = _session()
        for idx, app_no in enumerate(need_detail):
            fetch_eregister_single(app_no, session=s)
            if idx < len(need_detail) - 1:
                time.sleep(0.8)
            pct = 60 + int((idx+1) / len(need_detail) * 30)
            if progress_cb and idx % 5 == 0:
                progress_cb(f"eRegister {idx+1}/{len(need_detail)}: {app_no}", pct)

    # ── Final summary ─────────────────────────────────────────────────────
    from database import get_attorney_portfolio as db_get
    apps = db_get(tma_code=tma_code, agent_name=agent_name)

    from database import _classify as cls
    summary = {
        "total":             len(apps),
        "registered":        sum(1 for a in apps if a["status_class"]=="registered"),
        "objected":          sum(1 for a in apps if a["status_class"]=="objected"),
        "opposed":           sum(1 for a in apps if a["status_class"]=="opposed"),
        "pending":           sum(1 for a in apps if a["status_class"] in ("pending","under_examination")),
        "hearings_upcoming": sum(1 for a in apps if a.get("hearing_date")),
        "refused":           sum(1 for a in apps if a["status_class"] in ("refused","abandoned")),
    }

    update_attorney_sync(tma_code, len(apps))
    log_sync(tma_code, "full_sync", len(apps), "success", f"Synced {len(apps)} apps", started)

    if progress_cb: progress_cb(f"✅ Sync complete — {len(apps)} applications in DB", 100)

    return {
        "tma_code":     tma_code,
        "agent_name":   agent_name,
        "applications": apps,
        "summary":      summary,
        "synced_at":    _now(),
        "sources":      ["TLA Queue", "Cause List", "Oracle APEX", "eRegister"],
    }
