"""
scrapers/attorney_portfolio.py — Full Attorney Portfolio Scraper
================================================================
Fetches ALL trademark applications for a given attorney from IP India
by searching multiple public sources and combining them.

Sources used:
  1. TLA Queue List (ipindiaonline.gov.in) — pending/queue matters by TMA code
  2. Public Search — agent name search on tmrsearch.ipindia.gov.in
  3. Cause List    — upcoming hearings for the attorney
  4. e-Register   — individual application status lookup

Strategy:
  - Collect all application numbers from TLA Queue + Cause List
  - Deduplicate
  - Batch-fetch status from e-Register for each
  - Return unified portfolio with status, deadlines, hearings
"""

import time, logging, re
import requests
import urllib3
from datetime import datetime
from bs4 import BeautifulSoup
from typing import List, Dict, Optional

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
log = logging.getLogger("markshield.portfolio")

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
}

EREGISTER_URL  = "https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx"
TLA_QUEUE_URL  = "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx"
CAUSE_LIST_URL = "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index"
PUBLIC_SEARCH_URL = "https://tmrsearch.ipindia.gov.in/tmrpublicsearch/frmmain.aspx"


def _session():
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


def _now():
    return datetime.utcnow().isoformat() + "Z"


# ── Step 1: Get all app numbers from TLA Queue ──────────────────────────────
def _fetch_queue_apps(tma_code: str, progress_cb=None) -> List[Dict]:
    """Fetch all items from TLA Queue for this TMA code."""
    if progress_cb: progress_cb("Fetching TLA Queue list from IP India eFiling…", 10)
    try:
        s = _session()
        r = s.get(TLA_QUEUE_URL, params={"UserName": tma_code}, timeout=40, verify=False)
        soup = BeautifulSoup(r.text, "lxml")

        table = None
        for tid in ["GridView1", "gvQueue", "ctl00_ContentPlaceHolder1_GridView1"]:
            table = soup.find("table", {"id": tid})
            if table: break
        if not table:
            tables = soup.find_all("table")
            if tables:
                table = max(tables, key=lambda t: len(t.find_all("tr")), default=None)

        if not table:
            log.warning("No table in TLA Queue response")
            return []

        rows = table.find_all("tr")
        if len(rows) < 2:
            return []

        headers = [h.get_text(strip=True).lower() for h in rows[0].find_all(["th", "td"])]

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
            app_no = col(["app no", "appno", "application"], tds) or tds[0].get_text(strip=True)
            if not app_no or not any(c.isdigit() for c in app_no): continue
            items.append({
                "app_no":       app_no.strip(),
                "tm_name":      col(["trade mark", "trademark", "mark"], tds),
                "action_type":  col(["action", "notice", "type"], tds),
                "issue_date":   col(["date", "issue"], tds),
                "reply_status": col(["reply", "status"], tds),
                "agent":        col(["agent", "tma", "attorney"], tds),
                "tm_class":     col(["class"], tds),
                "office":       col(["office", "location"], tds),
                "source":       "tla_queue",
            })

        log.info(f"TLA Queue: {len(items)} items for {tma_code}")
        return items

    except Exception as e:
        log.error(f"TLA Queue fetch error: {e}")
        return []


# ── Step 2: Get app numbers from Cause List ─────────────────────────────────
def _fetch_causelist_apps(agent_name: str, progress_cb=None) -> List[Dict]:
    """Fetch upcoming hearings from cause list for this agent."""
    if progress_cb: progress_cb(f"Fetching cause list hearings for {agent_name}…", 25)
    try:
        s = _session()
        params = {"SearchField": "Agent Name", "SearchText": agent_name}
        r = s.get(CAUSE_LIST_URL, params=params, timeout=40)
        soup = BeautifulSoup(r.text, "lxml")

        table = soup.find("table")
        if not table: return []

        rows = table.find_all("tr")
        items = []
        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 4: continue
            app_no = tds[0].get_text(strip=True)
            if not app_no or not any(c.isdigit() for c in app_no): continue
            items.append({
                "app_no":       app_no,
                "agent":        tds[2].get_text(strip=True) if len(tds) > 2 else "",
                "applicant":    tds[3].get_text(strip=True) if len(tds) > 3 else "",
                "hearing_date": tds[4].get_text(strip=True) if len(tds) > 4 else "",
                "slot":         tds[5].get_text(strip=True) if len(tds) > 5 else "",
                "source":       "cause_list",
            })

        log.info(f"Cause List: {len(items)} items for {agent_name}")
        return items

    except Exception as e:
        log.error(f"Cause list fetch error: {e}")
        return []


# ── Step 3: Search by agent name on public search ───────────────────────────
def _fetch_public_search_apps(agent_name: str, progress_cb=None) -> List[Dict]:
    """
    Search IP India public search for all trademarks by agent name.
    Uses the 'Agent' search field which returns all applications filed by that agent.
    """
    if progress_cb: progress_cb(f"Searching IP India public database for agent: {agent_name}…", 35)
    try:
        s = _session()
        # GET page first to extract ASP.NET hidden fields
        home = s.get(PUBLIC_SEARCH_URL, timeout=40)
        soup = BeautifulSoup(home.text, "lxml")

        def hidden(fid):
            el = soup.find("input", {"id": fid}) or soup.find("input", {"name": fid})
            return (el or {}).get("value", "")

        vs  = hidden("__VIEWSTATE")
        evv = hidden("__EVENTVALIDATION")
        vsg = hidden("__VIEWSTATEGENERATOR")

        if not vs:
            log.warning("Could not extract VIEWSTATE from public search")
            return []

        # POST with agent name in the agent/attorney field
        form = {
            "__VIEWSTATE":          vs,
            "__EVENTVALIDATION":    evv,
            "__VIEWSTATEGENERATOR": vsg,
            "__EVENTTARGET":        "",
            "__EVENTARGUMENT":      "",
            # Try agent name field — IP India form uses this for attorney search
            "ctl00$ContentPlaceHolder1$txtAgent":         agent_name,
            "ctl00$ContentPlaceHolder1$txtTradeMark":     "",
            "ctl00$ContentPlaceHolder1$txtProprietorName":"",
            "ctl00$ContentPlaceHolder1$ddlTMClass":       "",
            "ctl00$ContentPlaceHolder1$hdnStatus":        "1",
            "ctl00$ContentPlaceHolder1$btnSearch":        "Search",
        }
        resp = s.post(PUBLIC_SEARCH_URL, data=form, timeout=60)
        soup2 = BeautifulSoup(resp.text, "lxml")

        # Find results table
        table = None
        for pat in ["GridView", "gvTMList", "gvSearch", "gv", "grid"]:
            table = soup2.find("table", {"id": re.compile(pat, re.I)})
            if table: break
        if not table:
            for t in soup2.find_all("table"):
                rows = t.find_all("tr")
                if len(rows) > 3:
                    cols = rows[1].find_all("td") if len(rows) > 1 else []
                    if len(cols) >= 4:
                        table = t
                        break

        if not table:
            log.info("No results in public search for agent")
            return []

        rows = table.find_all("tr")
        items = []
        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 4: continue
            app_no = tds[0].get_text(strip=True)
            if not app_no: continue
            items.append({
                "app_no":      app_no,
                "tm_name":     tds[1].get_text(strip=True) if len(tds) > 1 else "",
                "tm_class":    tds[2].get_text(strip=True) if len(tds) > 2 else "",
                "proprietor":  tds[3].get_text(strip=True) if len(tds) > 3 else "",
                "status":      tds[4].get_text(strip=True) if len(tds) > 4 else "",
                "valid_upto":  tds[5].get_text(strip=True) if len(tds) > 5 else "",
                "source":      "public_search",
            })

        log.info(f"Public search: {len(items)} results for agent {agent_name}")
        return items

    except Exception as e:
        log.error(f"Public search error: {e}")
        return []


# ── Step 4: Fetch individual app status from e-Register ────────────────────
def _fetch_eregister_status(app_no: str) -> Dict:
    """Fetch detailed status for a single application from e-Register."""
    try:
        s = _session()
        r = s.get(f"{EREGISTER_URL}?AppNosValue={app_no}", timeout=30)
        soup = BeautifulSoup(r.text, "lxml")

        raw = {}
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["td", "th"])
                if len(cells) >= 2:
                    key = cells[0].get_text(strip=True).lower().replace(" ", "_").replace(":", "").replace("/", "_")
                    val = cells[1].get_text(strip=True)
                    if key and val:
                        raw[key] = val

        FIELD_MAP = {
            "trade_mark": "tm_name", "wordmark": "tm_name",
            "class": "tm_class",
            "date_of_application": "filing_date",
            "applicants_name_address": "applicant", "applicant_name": "applicant",
            "agent": "agent_name",
            "status": "status",
            "valid_upto": "valid_upto",
            "next_date_of_hearing": "hearing_date",
            "type_of_mark": "mark_type",
            "description_of_goods_services": "goods_services",
            "certificate_no": "certificate_no",
        }
        out = {"app_no": app_no}
        for rk, nk in FIELD_MAP.items():
            if rk in raw:
                out[nk] = raw[rk]

        out["view_url"] = f"{EREGISTER_URL}?AppNosValue={app_no}"
        return out

    except Exception as e:
        log.warning(f"e-Register fetch error for {app_no}: {e}")
        return {"app_no": app_no, "error": str(e)}


# ── Status classification ───────────────────────────────────────────────────
def _classify_status(status: str) -> str:
    s = (status or "").lower()
    if "register" in s:   return "registered"
    if "object" in s:     return "objected"
    if "oppos" in s:      return "opposed"
    if "refus" in s:      return "refused"
    if "abandon" in s:    return "abandoned"
    if "withdraw" in s:   return "withdrawn"
    if "accept" in s:     return "accepted"
    if "advertis" in s:   return "advertised"
    if "examin" in s:     return "under_examination"
    if "formali" in s:    return "formalities_check"
    if "hearing" in s:    return "hearing_scheduled"
    return "pending"


# ── Main entry point ────────────────────────────────────────────────────────
def fetch_attorney_portfolio(
    tma_code: str,
    agent_name: str = "",
    max_detail_fetch: int = 50,
    progress_cb=None,
) -> dict:
    """
    Fetch FULL trademark portfolio for an attorney.

    Args:
        tma_code:         IP India TMA/eFiling code (e.g. "manthan15" or "TMA/GJ/2847")
        agent_name:       Attorney full name for cause list / public search
        max_detail_fetch: Max apps to fetch full e-Register details for (avoids timeout)
        progress_cb:      fn(message, percent) for progress updates

    Returns full portfolio dict with all applications, statuses, and summary.
    """
    if progress_cb: progress_cb("Starting portfolio fetch from IP India…", 5)

    all_apps: Dict[str, Dict] = {}  # app_no → merged data

    # ── Source 1: TLA Queue (most reliable — keyed by TMA code) ─────────────
    queue_items = _fetch_queue_apps(tma_code, progress_cb)
    for item in queue_items:
        no = item["app_no"]
        all_apps[no] = {**item}

    if progress_cb: progress_cb(f"TLA Queue: {len(queue_items)} matters found", 20)

    # ── Source 2: Cause List (upcoming hearings by agent name) ───────────────
    if agent_name:
        cl_items = _fetch_causelist_apps(agent_name.upper(), progress_cb)
        for item in cl_items:
            no = item["app_no"]
            if no in all_apps:
                all_apps[no].update({k: v for k, v in item.items() if v and k != "source"})
                all_apps[no]["has_hearing"] = True
                all_apps[no]["hearing_date"] = item.get("hearing_date", "")
            else:
                all_apps[no] = {**item, "has_hearing": True}
        if progress_cb: progress_cb(f"Cause List: {len(cl_items)} hearings found", 35)

    # ── Source 3: Public Search by agent name ────────────────────────────────
    if agent_name:
        ps_items = _fetch_public_search_apps(agent_name.upper(), progress_cb)
        for item in ps_items:
            no = item["app_no"]
            if no in all_apps:
                all_apps[no].update({k: v for k, v in item.items() if v and k != "source"})
            else:
                all_apps[no] = {**item}
        if progress_cb: progress_cb(f"Public Search: {len(ps_items)} applications found", 50)

    app_numbers = list(all_apps.keys())
    total = len(app_numbers)

    if progress_cb: progress_cb(f"Found {total} unique applications — fetching status from e-Register…", 55)

    # ── Source 4: e-Register detail fetch (batch, capped) ───────────────────
    # Prioritise apps that don't already have a status
    to_fetch = [n for n in app_numbers if not all_apps[n].get("status")]
    to_fetch += [n for n in app_numbers if all_apps[n].get("status") and n not in to_fetch]
    to_fetch = to_fetch[:max_detail_fetch]

    for idx, app_no in enumerate(to_fetch):
        detail = _fetch_eregister_status(app_no)
        all_apps[app_no].update({k: v for k, v in detail.items() if v and k not in ("app_no",)})
        # Small delay to be polite to IP India servers
        if idx < len(to_fetch) - 1:
            time.sleep(0.8)
        pct = 55 + int((idx + 1) / len(to_fetch) * 35)
        if progress_cb and idx % 5 == 0:
            progress_cb(f"Fetching e-Register: {idx + 1}/{len(to_fetch)} applications…", pct)

    if progress_cb: progress_cb("Building portfolio summary…", 92)

    # ── Classify and build final list ────────────────────────────────────────
    applications = []
    for app_no, data in all_apps.items():
        raw_status = data.get("status", "")
        status_class = _classify_status(raw_status)
        applications.append({
            "app_no":       app_no,
            "tm_name":      data.get("tm_name") or data.get("trademark") or "—",
            "tm_class":     data.get("tm_class") or "—",
            "applicant":    data.get("applicant") or data.get("proprietor") or "—",
            "status":       raw_status or "Pending",
            "status_class": status_class,
            "filing_date":  data.get("filing_date") or "—",
            "valid_upto":   data.get("valid_upto") or "—",
            "hearing_date": data.get("hearing_date") or "—",
            "action_type":  data.get("action_type") or "—",
            "reply_status": data.get("reply_status") or "—",
            "issue_date":   data.get("issue_date") or "—",
            "goods_services": data.get("goods_services") or "—",
            "mark_type":    data.get("mark_type") or "—",
            "office":       data.get("office") or "—",
            "sources":      list(set(filter(None, [data.get("source")]))),
            "view_url":     f"{EREGISTER_URL}?AppNosValue={app_no}",
        })

    # Sort: hearings first, then by status priority
    STATUS_ORDER = ["registered", "accepted", "advertised", "hearing_scheduled",
                    "objected", "opposed", "under_examination", "pending",
                    "refused", "abandoned", "withdrawn"]
    applications.sort(key=lambda a: (
        0 if a["hearing_date"] and a["hearing_date"] != "—" else 1,
        STATUS_ORDER.index(a["status_class"]) if a["status_class"] in STATUS_ORDER else 99
    ))

    # ── Summary ──────────────────────────────────────────────────────────────
    summary = {
        "total":             len(applications),
        "registered":        sum(1 for a in applications if a["status_class"] == "registered"),
        "pending":           sum(1 for a in applications if a["status_class"] in ("pending", "under_examination", "formalities_check")),
        "objected":          sum(1 for a in applications if a["status_class"] == "objected"),
        "opposed":           sum(1 for a in applications if a["status_class"] == "opposed"),
        "hearings_upcoming": sum(1 for a in applications if a["hearing_date"] and a["hearing_date"] != "—"),
        "refused":           sum(1 for a in applications if a["status_class"] in ("refused", "abandoned", "withdrawn")),
        "accepted":          sum(1 for a in applications if a["status_class"] in ("accepted", "advertised")),
        "detail_fetched":    len(to_fetch),
        "total_found":       total,
    }

    if progress_cb: progress_cb(f"✅ Portfolio complete — {len(applications)} applications", 100)

    return {
        "tma_code":     tma_code,
        "agent_name":   agent_name,
        "applications": applications,
        "summary":      summary,
        "fetched_at":   _now(),
        "sources":      ["TLA Queue (ipindiaonline.gov.in)", "Cause List (tmrsearch.ipindia.gov.in)", "e-Register (tmrsearch.ipindia.gov.in)"],
        "note":         f"Showing all {len(applications)} applications found. e-Register details fetched for {len(to_fetch)} apps." if len(applications) > max_detail_fetch else "",
    }
