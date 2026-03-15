"""
scrapers/eregister.py — IP India e-Register Scraper
====================================================
Correct URL: https://tmrsearch.ipindia.gov.in/eregister/eregister.aspx
Method: POST with application number in form field

The e-Register form has a text input for app number and a Search button.
After POST it renders the trademark details in a table on the same page.

IP India e-Register known HTML structure (from page source analysis):
- Form fields: txtNo (or similar) + btnSearch
- Results table with rows like: | Trade Mark | BRANDNAME |
- Label cells contain field names, value cells contain data
"""

import re, time, logging
import requests
import urllib3
from bs4 import BeautifulSoup
from typing import Optional, Dict, Any, List

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger("markshield.eregister")

# Correct URLs discovered from IP India site structure
EREGISTER_URL    = "https://tmrsearch.ipindia.gov.in/eregister/eregister.aspx"
EREGISTER_VIEW   = "https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx"
ESTATUS_URL      = "https://tmrsearch.ipindia.gov.in/estatus/"

HEADERS = {
    "User-Agent":                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":                    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language":           "en-IN,en;q=0.9,hi;q=0.8",
    "Accept-Encoding":           "gzip, deflate",
    "Connection":                "keep-alive",
    "Upgrade-Insecure-Requests": "1",
    "Cache-Control":             "max-age=0",
}

# All possible label texts IP India uses → normalized field name
LABEL_FIELD_MAP = {
    # Trademark name
    "trade mark":                      "trademark_name",
    "trademark":                       "trademark_name",
    "wordmark":                        "trademark_name",
    "word mark":                       "trademark_name",
    "mark":                            "trademark_name",
    "trade mark name":                 "trademark_name",
    # Application
    "application no":                  "app_no",
    "application number":              "app_no",
    "appln no":                        "app_no",
    # Status
    "status":                          "status",
    "current status":                  "status",
    "application status":              "status",
    "tm status":                       "status",
    # Class
    "class":                           "tm_class",
    "class(es)":                       "tm_class",
    "nice class":                      "tm_class",
    "class no":                        "tm_class",
    "class number":                    "tm_class",
    # Applicant / Proprietor
    "applicant's name":                "applicant",
    "applicants name":                 "applicant",
    "applicant name":                  "applicant",
    "applicant":                       "applicant",
    "proprietor":                      "applicant",
    "proprietor's name":               "applicant",
    "applicants name and address":     "applicant",
    "applicant's name and address":    "applicant",
    # Agent
    "agent":                           "agent",
    "agent name":                      "agent",
    "agent / attorney":                "agent",
    "attorney name":                   "agent",
    "authorized agent":                "agent",
    "tma code":                        "tma_code",
    # Dates
    "date of application":             "filing_date",
    "filing date":                     "filing_date",
    "application date":                "filing_date",
    "valid upto":                      "valid_upto",
    "validity":                        "valid_upto",
    "valid up to":                     "valid_upto",
    "date of registration":            "registration_date",
    "registration date":               "registration_date",
    "next date of hearing":            "hearing_date",
    "hearing date":                    "hearing_date",
    "next hearing date":               "hearing_date",
    "date of hearing":                 "hearing_date",
    "examination report date":         "exam_report_date",
    "exam report date":                "exam_report_date",
    # Mark details
    "type of mark":                    "mark_type",
    "mark type":                       "mark_type",
    "description of goods/services":   "goods_services",
    "description of goods and services": "goods_services",
    "goods and services":              "goods_services",
    "goods/services":                  "goods_services",
    "description":                     "goods_services",
    "specification":                   "goods_services",
    # Certificate
    "certificate no":                  "certificate_no",
    "registration no":                 "certificate_no",
    "reg. no":                         "certificate_no",
    # Office
    "office":                          "office",
    "tm office":                       "office",
    "trade mark office":               "office",
    # Other
    "user detail":                     "user_since",
    "used since":                      "user_since",
    "since":                           "user_since",
    "proprietor address":              "proprietor_address",
    "address":                         "proprietor_address",
    "country":                         "country",
}


def _normalize_label(text: str) -> str:
    """Strip, lowercase, collapse whitespace, remove trailing punctuation."""
    t = re.sub(r"\s+", " ", text.strip().lower())
    t = t.rstrip(":*").strip()
    return t


def _is_empty(val: str) -> bool:
    return not val or val.strip() in ("", "\xa0", "-", "N/A", "NA", "None", "null", "0")


def _new_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _get_viewstate(soup: BeautifulSoup) -> dict:
    """Extract all ASP.NET hidden fields from form."""
    fields = {}
    for inp in soup.find_all("input", type="hidden"):
        name = inp.get("name") or inp.get("id") or ""
        val  = inp.get("value", "")
        if name:
            fields[name] = val
    return fields


def fetch_application(app_no: str, session: Optional[requests.Session] = None) -> Dict[str, Any]:
    """
    Fetch trademark application details from IP India e-Register.
    
    Uses the correct URL: eregister.aspx with POST form submission.
    Falls back to Application_View_Trademark.aspx GET as secondary.
    """
    app_no = str(app_no).strip()
    s = session or _new_session()

    base_result = {
        "app_no":   app_no,
        "view_url": f"{EREGISTER_VIEW}?AppNosValue={app_no}",
    }

    # ── Method 1: POST to eregister.aspx (correct method) ───────────────────
    try:
        log.info(f"e-Register POST attempt: {app_no}")

        # Step 1: GET the form page to get VIEWSTATE
        home = s.get(EREGISTER_URL, timeout=30)
        home.raise_for_status()
        soup_home = BeautifulSoup(home.text, "lxml")

        vs_fields = _get_viewstate(soup_home)

        # Find the text input for application number
        # IP India uses various field names
        txt_input = (
            soup_home.find("input", {"id": re.compile(r"txt(No|AppNo|ApplicationNo|Number)", re.I)}) or
            soup_home.find("input", {"name": re.compile(r"txt(No|AppNo|ApplicationNo|Number)", re.I)}) or
            soup_home.find("input", {"type": "text"})
        )

        # Find the submit button
        btn = (
            soup_home.find("input", {"type": "submit"}) or
            soup_home.find("input", {"value": re.compile(r"search|go|submit|view", re.I)}) or
            soup_home.find("button", {"type": "submit"})
        )

        # Build form data
        form_data = dict(vs_fields)  # start with all hidden fields

        if txt_input:
            field_name = txt_input.get("name") or txt_input.get("id") or "txtNo"
            form_data[field_name] = app_no
            log.debug(f"Using text field: {field_name}")
        else:
            # Try common field names
            for fn in ["ctl00$ContentPlaceHolder1$txtNo",
                       "ctl00$ContentPlaceHolder1$txtApplicationNo",
                       "txtNo", "txtApplicationNo", "AppNosValue"]:
                form_data[fn] = app_no

        if btn:
            btn_name = btn.get("name") or btn.get("id") or ""
            if btn_name:
                form_data[btn_name] = btn.get("value", "Search")

        # Also try common button names
        for bn in ["ctl00$ContentPlaceHolder1$btnSearch",
                   "ctl00$ContentPlaceHolder1$btnGo",
                   "ctl00$ContentPlaceHolder1$btnView"]:
            if bn not in form_data:
                form_data[bn] = "Search"

        # Step 2: POST the form
        resp = s.post(
            EREGISTER_URL,
            data=form_data,
            timeout=35,
            headers={**HEADERS, "Referer": EREGISTER_URL, "Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )
        resp.raise_for_status()

        result = _parse_page(resp.text, app_no)
        if _has_meaningful_data(result):
            log.info(f"e-Register POST success for {app_no}: status={result.get('status','?')}")
            return {**base_result, **result}
        else:
            log.warning(f"POST returned no data for {app_no}. HTML snippet: {resp.text[500:800]}")

    except Exception as e:
        log.warning(f"e-Register POST failed for {app_no}: {e}")

    # ── Method 2: GET with AppNosValue param ─────────────────────────────────
    try:
        log.info(f"e-Register GET fallback: {app_no}")
        r = s.get(
            EREGISTER_VIEW,
            params={"AppNosValue": app_no},
            timeout=30,
            allow_redirects=True,
        )
        r.raise_for_status()
        result = _parse_page(r.text, app_no)
        if _has_meaningful_data(result):
            log.info(f"GET fallback success for {app_no}")
            return {**base_result, **result}
    except Exception as e:
        log.warning(f"GET fallback failed for {app_no}: {e}")

    # ── Method 3: Try alternate estatus URL ──────────────────────────────────
    try:
        r3 = s.get(
            ESTATUS_URL,
            params={"appno": app_no},
            timeout=30,
        )
        result = _parse_page(r3.text, app_no)
        if _has_meaningful_data(result):
            return {**base_result, **result}
    except Exception as e:
        log.warning(f"estatus URL failed for {app_no}: {e}")

    log.error(f"All methods failed for application {app_no}")
    return {
        **base_result,
        "error": "Could not fetch data — IP India server may be slow or application number not found",
        "trademark_name": "—", "status": "Unknown", "applicant": "—",
    }


def _has_meaningful_data(d: dict) -> bool:
    """True if we got at least status or trademark_name."""
    fields = ["trademark_name", "status", "applicant", "filing_date", "tm_class"]
    return any(k in d and d[k] and not _is_empty(d[k]) for k in fields)


def _parse_page(html: str, app_no: str) -> dict:
    """
    Parse e-Register response HTML using multiple strategies.
    IP India pages use ASP.NET with table-based label:value layout.
    """
    soup = BeautifulSoup(html, "lxml")
    out  = {}

    # ── Strategy 1: Find all tables and extract label→value pairs ────────────
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        for row in rows:
            cells = row.find_all(["td", "th"])

            # Pattern A: 2+ cells, first is label, rest are values
            if len(cells) >= 2:
                raw_label = cells[0].get_text(strip=True)
                label     = _normalize_label(raw_label)
                value     = cells[1].get_text(" ", strip=True).strip()

                if _is_empty(value):
                    continue

                field = LABEL_FIELD_MAP.get(label)
                if field:
                    if field not in out or _is_empty(out.get(field)):
                        out[field] = value
                    continue

                # Try partial match
                for k, f in LABEL_FIELD_MAP.items():
                    if k and k in label and len(k) > 3:
                        if f not in out or _is_empty(out.get(f)):
                            out[f] = value
                        break

            # Pattern B: cells with class "lbl"/"val" or "label"/"value"
            for cell in cells:
                cls = " ".join(cell.get("class", []))
                if "lbl" in cls or "label" in cls:
                    next_td = cell.find_next_sibling("td")
                    if next_td:
                        lbl = _normalize_label(cell.get_text(strip=True))
                        val = next_td.get_text(" ", strip=True).strip()
                        if not _is_empty(val):
                            f = LABEL_FIELD_MAP.get(lbl)
                            if f and f not in out:
                                out[f] = val

    if _has_meaningful_data(out):
        return out

    # ── Strategy 2: Span elements with known ID patterns ────────────────────
    SPAN_SUFFIX_MAP = {
        "TradeMark":          "trademark_name",
        "TradeMarkName":      "trademark_name",
        "Mark":               "trademark_name",
        "Status":             "status",
        "ApplicationStatus":  "status",
        "Class":              "tm_class",
        "TmClass":            "tm_class",
        "ApplicantName":      "applicant",
        "Proprietor":         "applicant",
        "AgentName":          "agent",
        "DateOfApplication":  "filing_date",
        "FilingDate":         "filing_date",
        "ValidUpto":          "valid_upto",
        "NextHearingDate":    "hearing_date",
        "HearingDate":        "hearing_date",
        "GoodsServices":      "goods_services",
        "TypeOfMark":         "mark_type",
        "Office":             "office",
        "CertificateNo":      "certificate_no",
    }
    for suffix, field in SPAN_SUFFIX_MAP.items():
        for prefix in ["ctl00_ContentPlaceHolder1_lbl", "lbl", "ContentPlaceHolder1_lbl"]:
            el = soup.find(id=f"{prefix}{suffix}")
            if el:
                val = el.get_text(" ", strip=True)
                if not _is_empty(val) and field not in out:
                    out[field] = val
                break

    if _has_meaningful_data(out):
        return out

    # ── Strategy 3: Regex on raw HTML as last resort ─────────────────────────
    patterns = {
        "trademark_name": [
            r"Trade\s*Mark\s*[:\|]\s*</?\w[^>]*>([^<]{2,80})<",
            r"Word\s*Mark\s*[:\|]\s*</?\w[^>]*>([^<]{2,80})<",
        ],
        "status": [
            r"Status\s*[:\|]\s*</?\w[^>]*>([^<]{3,60})<",
            r"Current\s*Status\s*[:\|]\s*</?\w[^>]*>([^<]{3,60})<",
        ],
        "applicant": [
            r"Applicant[^:]*[:\|]\s*</?\w[^>]*>([^<]{3,120})<",
            r"Proprietor[^:]*[:\|]\s*</?\w[^>]*>([^<]{3,120})<",
        ],
        "filing_date": [
            r"Date\s*of\s*Application[^:]*[:\|]\s*</?\w[^>]*>([^<]{6,20})<",
        ],
        "tm_class": [
            r"Class[^:]*[:\|]\s*</?\w[^>]*>(\d{1,2})<",
        ],
    }

    for field, pats in patterns.items():
        if field in out: continue
        for pat in pats:
            m = re.search(pat, html, re.I | re.S)
            if m:
                val = re.sub(r"<[^>]+>", "", m.group(1)).strip()
                if not _is_empty(val):
                    out[field] = val
                    break

    return out


def fetch_applications_bulk(app_nos: List[str], delay: float = 1.0) -> List[dict]:
    """Fetch multiple applications with shared session and polite delay."""
    s = _new_session()
    results = []
    for i, no in enumerate(app_nos):
        log.info(f"Bulk: {i+1}/{len(app_nos)} → {no}")
        results.append(fetch_application(no, session=s))
        if i < len(app_nos) - 1:
            time.sleep(delay)
    return results
