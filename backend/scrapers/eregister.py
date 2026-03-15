"""
scrapers/eregister.py — IP India eRegister Scraper (FIXED)
===========================================================
Root cause of all-dashes bug:
  Application_View_Trademark.aspx loads data via JavaScript AFTER page load.
  Simple requests.get() gets empty HTML shell — no data.

Fix: Use Playwright (headless Chrome) to actually render the JS, then parse.
Fallback: requests POST to eregister.aspx with VIEWSTATE.
"""

import time, re, logging
import requests, urllib3
from bs4 import BeautifulSoup
from typing import Dict, Any, Optional, List

urllib3.disable_warnings()
log = logging.getLogger("markshield.eregister")

EREGISTER_URL = "https://ipindiaonline.gov.in/eregister/eregister.aspx"
VIEW_URL      = "https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection": "keep-alive",
}

LABEL_MAP = {
    "trade mark":                       "trademark_name",
    "wordmark":                         "trademark_name",
    "trademark":                        "trademark_name",
    "mark":                             "trademark_name",
    "class":                            "tm_class",
    "class(es)":                        "tm_class",
    "status":                           "status",
    "current status":                   "status",
    "application status":               "status",
    "applicant's name":                 "applicant",
    "applicants name":                  "applicant",
    "applicant":                        "applicant",
    "proprietor":                       "applicant",
    "proprietor's name":                "applicant",
    "applicants name and address":      "applicant",
    "applicant's name and address":     "applicant",
    "agent":                            "agent",
    "agent name":                       "agent",
    "agent / attorney":                 "agent",
    "date of application":              "filing_date",
    "filing date":                      "filing_date",
    "valid upto":                       "valid_upto",
    "valid up to":                      "valid_upto",
    "date of registration":             "registration_date",
    "next date of hearing":             "hearing_date",
    "hearing date":                     "hearing_date",
    "type of mark":                     "mark_type",
    "description of goods/services":    "goods_services",
    "goods and services":               "goods_services",
    "description":                      "goods_services",
    "certificate no":                   "certificate_no",
    "office":                           "office",
    "tm office":                        "office",
    "user detail":                      "user_since",
    "publication details":              "publication",
}


def fetch_application(app_no: str, session=None) -> Dict[str, Any]:
    """
    Fetch trademark details. Uses Playwright (primary) → requests (fallback).
    """
    app_no = str(app_no).strip()
    base = {
        "app_no":   app_no,
        "view_url": f"{VIEW_URL}?AppNosValue={app_no}",
    }

    # ── Method 1: Playwright (renders JavaScript — gets actual data) ──────────
    result = _fetch_playwright(app_no)
    if _has_data(result):
        log.info(f"Playwright success: {app_no} → {result.get('status','?')}")
        return {**base, **result}

    # ── Method 2: POST to eregister.aspx ─────────────────────────────────────
    result = _fetch_post(app_no, session)
    if _has_data(result):
        log.info(f"POST success: {app_no} → {result.get('status','?')}")
        return {**base, **result}

    log.warning(f"All methods failed for {app_no}")
    return {**base, "error": "Could not fetch — IP India may require CAPTCHA or JS"}


def _fetch_playwright(app_no: str) -> dict:
    """Use Playwright to fully render the page and extract data."""
    try:
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            page = browser.new_page()
            page.set_extra_http_headers(HEADERS)

            # Navigate and wait for JS to populate the data
            url = f"{VIEW_URL}?AppNosValue={app_no}"
            page.goto(url, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)  # extra wait for JS to finish

            html = page.content()
            browser.close()

        result = _parse_html(html)
        return result

    except ImportError:
        log.warning("Playwright not installed")
        return {}
    except Exception as e:
        log.warning(f"Playwright failed for {app_no}: {e}")
        return {}


def _fetch_post(app_no: str, session=None) -> dict:
    """POST to eregister.aspx with ASP.NET form submission."""
    try:
        s = session or requests.Session()
        s.headers.update(HEADERS)

        # GET form to extract VIEWSTATE
        home = s.get(EREGISTER_URL, timeout=25, verify=False)
        soup = BeautifulSoup(home.text, "lxml")

        def hidden(name):
            el = soup.find("input", {"name": name}) or soup.find("input", {"id": name})
            return (el or {}).get("value", "")

        vs  = hidden("__VIEWSTATE")
        evv = hidden("__EVENTVALIDATION")
        vsg = hidden("__VIEWSTATEGENERATOR")

        txt = soup.find("input", {"type": "text"})
        txt_name = txt.get("name", "") if txt else ""

        form = {
            "__VIEWSTATE": vs, "__EVENTVALIDATION": evv,
            "__VIEWSTATEGENERATOR": vsg,
        }
        if txt_name:
            form[txt_name] = app_no
        else:
            form["ctl00$ContentPlaceHolder1$txtNo"] = app_no
            form["ctl00$ContentPlaceHolder1$txtApplicationNo"] = app_no

        # Try every submit button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id") or ""
            if n:
                form[n] = btn.get("value", "Search")

        resp = s.post(
            EREGISTER_URL, data=form, timeout=30, verify=False,
            headers={**HEADERS, "Referer": EREGISTER_URL,
                     "Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )

        return _parse_html(resp.text)

    except Exception as e:
        log.warning(f"POST failed for {app_no}: {e}")
        return {}


def _parse_html(html: str) -> dict:
    """Parse eRegister HTML using multiple strategies."""
    soup = BeautifulSoup(html, "lxml")
    out  = {}

    # Strategy 1: Known ASP.NET span IDs
    SPAN_MAP = {
        "lblTradeMark":          "trademark_name",
        "lblTradeMarkName":      "trademark_name",
        "lblWordmark":           "trademark_name",
        "lblStatus":             "status",
        "lblApplicationStatus":  "status",
        "lblClass":              "tm_class",
        "lblApplicantName":      "applicant",
        "lblProprietorName":     "applicant",
        "lblAgentName":          "agent",
        "lblAgent":              "agent",
        "lblDateOfApplication":  "filing_date",
        "lblFilingDate":         "filing_date",
        "lblValidUpto":          "valid_upto",
        "lblNextHearingDate":    "hearing_date",
        "lblHearingDate":        "hearing_date",
        "lblGoodsServices":      "goods_services",
        "lblDescription":        "goods_services",
        "lblTypeOfMark":         "mark_type",
        "lblOffice":             "office",
        "lblCertificateNo":      "certificate_no",
    }
    for suffix, field in SPAN_MAP.items():
        for prefix in ["ctl00_ContentPlaceHolder1_", "ContentPlaceHolder1_", ""]:
            el = soup.find(id=f"{prefix}{suffix}")
            if el:
                val = el.get_text(" ", strip=True)
                if val and val not in ("\xa0", "-", "N/A", ""):
                    out[field] = val
                break

    if _has_data(out):
        return out

    # Strategy 2: Table label → value rows
    for table in soup.find_all("table"):
        for row in table.find_all("tr"):
            cells = row.find_all(["td", "th"])
            if len(cells) < 2:
                continue
            label = re.sub(r"\s+", " ", cells[0].get_text(strip=True).lower().rstrip(":*").strip())
            value = cells[1].get_text(" ", strip=True).strip()
            if not value or value in ("\xa0", "-", "N/A"):
                continue
            field = LABEL_MAP.get(label)
            if field and field not in out:
                out[field] = value
                continue
            for k, f in LABEL_MAP.items():
                if k and k in label and len(k) > 4 and f not in out:
                    out[f] = value
                    break

    if _has_data(out):
        return out

    # Strategy 3: Any element that has data- attributes or specific classes
    for el in soup.find_all(True):
        el_id = (el.get("id") or "").lower()
        text  = el.get_text(" ", strip=True)
        if not text or len(text) < 2 or text in ("\xa0", "-"):
            continue
        for suffix in ["trademark", "trademarknm", "status", "applicant", "class", "filingdate"]:
            if suffix in el_id and text:
                field = {
                    "trademark": "trademark_name", "trademarknm": "trademark_name",
                    "status": "status", "applicant": "applicant",
                    "class": "tm_class", "filingdate": "filing_date",
                }.get(suffix)
                if field and field not in out:
                    out[field] = text

    if out.get("status"):
        from database import _classify
        out["status_class"] = _classify(out["status"])

    return out


def _has_data(d: dict) -> bool:
    return any(d.get(k) and d[k] not in ("—", "-", "N/A", "")
               for k in ["trademark_name", "status", "applicant", "filing_date"])


def fetch_applications_bulk(app_nos: List[str], delay: float = 1.0) -> List[dict]:
    s = requests.Session()
    s.headers.update(HEADERS)
    results = []
    for i, no in enumerate(app_nos):
        log.info(f"Bulk {i+1}/{len(app_nos)}: {no}")
        results.append(fetch_application(no, session=s))
        if i < len(app_nos) - 1:
            time.sleep(delay)
    return results


# ── APEX Search fallback (new IP India search — returns JSON) ─────────────────

def fetch_via_apex_search(app_no: str) -> dict:
    """
    Use the new Oracle APEX search at tmsearch.ipindia.gov.in.
    Search by application number — this returns JSON data.
    """
    try:
        from playwright.sync_api import sync_playwright

        result = {}

        with sync_playwright() as p:
            browser = p.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
            )
            context = browser.new_context()
            page    = context.new_page()

            captured = []

            def on_response(resp):
                try:
                    ct = resp.headers.get("content-type", "")
                    if "json" in ct:
                        data = resp.json()
                        if data:
                            captured.append({"url": resp.url, "data": data})
                except Exception:
                    pass

            page.on("response", on_response)

            APEX_URLS = [
                "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search/dpiit-public-search",
                "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search1000/dpiit-public-search",
            ]

            for apex_url in APEX_URLS:
                try:
                    page.goto(apex_url, wait_until="networkidle", timeout=25000)
                    page.wait_for_timeout(2000)

                    # Find application number search input
                    for sel in [
                        'input[placeholder*="application" i]',
                        'input[placeholder*="number" i]',
                        '#P1_APP_NO', '#P_APP_NO', '#APP_NO',
                        'input[type="text"]',
                    ]:
                        try:
                            inp = page.query_selector(sel)
                            if inp and inp.is_visible():
                                inp.fill(str(app_no))
                                page.keyboard.press("Enter")
                                page.wait_for_timeout(3000)
                                try:
                                    page.wait_for_load_state("networkidle", timeout=8000)
                                except Exception:
                                    pass
                                break
                        except Exception:
                            continue

                    # Extract from captured JSON
                    for item in captured:
                        data = item["data"]
                        rows = (data.get("items") or data.get("rows") or
                                data.get("data") or data.get("results") or [])
                        if isinstance(rows, list):
                            for row in rows:
                                if not isinstance(row, dict):
                                    continue
                                # Check if this row matches our app number
                                row_appno = str(row.get("APP_NO") or row.get("application_number") or
                                               row.get("APPLICATION_NO") or "").strip()
                                if row_appno == str(app_no) or not row_appno:
                                    result = _normalize_apex(row)
                                    if _has_data(result):
                                        break
                        if _has_data(result):
                            break

                    if _has_data(result):
                        break

                    # Also parse page HTML
                    html_result = _parse_html(page.content())
                    if _has_data(html_result):
                        result = html_result
                        break

                except Exception as e:
                    log.warning(f"APEX {apex_url}: {e}")
                    continue

            browser.close()

        return result

    except ImportError:
        return {}
    except Exception as e:
        log.warning(f"APEX search error: {e}")
        return {}


def _normalize_apex(row: dict) -> dict:
    def g(*keys):
        for k in keys:
            if row.get(k): return str(row[k]).strip()
        return ""

    status = g("STATUS", "status", "APPLICATION_STATUS", "application_status")
    return {
        "trademark_name": g("TM_NAME","trademark_name","TRADEMARK_NAME","WORD_MARK","word_mark","MARK","NAME"),
        "tm_class":       g("CLASS","TM_CLASS","class_number","CLASS_NUMBER","CLASS_NO"),
        "applicant":      g("APPLICANT","applicant","PROPRIETOR","proprietor","PROPRIETOR_NAME","proprietor_name"),
        "agent":          g("AGENT","agent","ATTORNEY","attorney","AGENT_NAME","attorney_name"),
        "status":         status,
        "status_class":   _classify_local(status),
        "filing_date":    g("FILING_DATE","filing_date","DATE_OF_APPLICATION","application_date","APPLICATION_DATE"),
        "valid_upto":     g("VALID_UPTO","valid_upto","EXPIRE_AT","expire_at"),
        "hearing_date":   g("HEARING_DATE","hearing_date","NEXT_HEARING_DATE"),
        "goods_services": g("GOODS_SERVICES","goods_services","CLASS_DETAIL","class_detail","DESCRIPTION","description"),
        "image_url":      g("IMAGE","image","IMAGE_URL"),
        "office":         g("OFFICE","office","APPROPRIATE_OFFICE","appropriate_office"),
    }


def _classify_local(status: str) -> str:
    s = (status or "").lower()
    if "registered" in s:  return "registered"
    if "objected" in s:    return "objected"
    if "opposed" in s:     return "opposed"
    if "refused" in s:     return "refused"
    if "accepted" in s:    return "accepted"
    if "advertised" in s:  return "advertised"
    if "examination" in s: return "under_examination"
    if "abandoned" in s:   return "abandoned"
    return "pending"
