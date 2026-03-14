"""routes/queue_list.py — TLA Queue List (Pending Applications) endpoint"""

from flask import Blueprint, request, jsonify
from scrapers.ipindia import _sess, _ck, _cget, _cset, _now, HEADERS
from bs4 import BeautifulSoup
from datetime import datetime
import logging

log = logging.getLogger("markshield.queue")
bp_queue = Blueprint("queue", __name__)

URL_QUEUE = "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx"

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
    return 30  # default

def _days_left(date_str: str, deadline_days: int) -> int:
    """Return days remaining from date_str (DD/MM/YYYY or DD-MM-YYYY) + deadline_days vs today."""
    for fmt in ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y"):
        try:
            base = datetime.strptime(date_str.strip(), fmt)
            due  = base.replace(hour=23, minute=59)
            from datetime import timedelta
            due += timedelta(days=deadline_days)
            diff = (due - datetime.now()).days
            return diff
        except Exception:
            continue
    return None


def fetch_tla_queue(username: str = None, app_no: str = None, ttl: int = 180) -> dict:
    """
    Fetch the TLA Queue List from IP India eFiling portal.
    Optionally filter by username (TMA/agent) or application number.
    """
    ck = _ck("queue", username or "", app_no or "")
    cached = _cget(ck)
    if cached:
        return cached

    params = {}
    if app_no:
        params["AppNo"] = app_no
    if username:
        params["UserName"] = username

    try:
        resp  = _sess.get(URL_QUEUE, params=params)
        items = _parse_queue(resp.text)
    except Exception as e:
        log.error(f"TLA queue fetch error: {e}")
        return {"error": str(e), "items": [], "total": 0}

    # Enrich with days left
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

    total    = len(items)
    pending  = sum(1 for i in items if i.get("reply_status","").lower() in ("", "pending", "not filed"))
    overdue  = sum(1 for i in items if i.get("urgency") == "overdue")
    critical = sum(1 for i in items if i.get("urgency") == "critical")

    result = {
        "items":      items,
        "total":      total,
        "pending":    pending,
        "overdue":    overdue,
        "critical":   critical,
        "source_url": URL_QUEUE,
        "fetched_at": _now(),
    }
    _cset(ck, result, ttl)
    return result


def _parse_queue(html: str) -> list:
    soup  = BeautifulSoup(html, "lxml")
    table = None

    # Try common GridView ids
    for pid in ["GridView1", "gvQueue", "gvApplications", "ctl00_ContentPlaceHolder1_GridView1"]:
        table = soup.find("table", {"id": pid})
        if table:
            break

    if not table:
        # fallback — largest table
        tables = soup.find_all("table")
        table  = max(tables, key=lambda t: len(t.find_all("tr")), default=None) if tables else None

    if not table:
        log.warning("No table found in TLA Queue response")
        return []

    rows = table.find_all("tr")
    if len(rows) < 2:
        return []

    # Parse header to map column positions
    headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th", "td"])]
    log.info(f"Queue table headers: {headers}")

    def col(name_hints: list, row_cells):
        for hint in name_hints:
            for i, h in enumerate(headers):
                if hint in h and i < len(row_cells):
                    return row_cells[i].get_text(strip=True)
        return ""

    out = []
    for row in rows[1:]:
        tds = row.find_all("td")
        if len(tds) < 3:
            continue
        app_no      = col(["app", "application no", "appno"], tds) or (tds[0].get_text(strip=True) if tds else "")
        tm_name     = col(["trade mark", "trademark", "mark name", "wordmark"], tds)
        action_type = col(["action", "type", "notice", "objection", "examination", "opposition"], tds)
        date_str    = col(["date", "issue date", "exam date", "notice date", "filed date"], tds)
        reply_status= col(["reply", "status", "response"], tds)
        agent       = col(["agent", "attorney", "tma"], tds)
        applicant   = col(["applicant", "proprietor", "owner"], tds)
        office      = col(["office", "location", "city"], tds)
        tm_class    = col(["class"], tds)

        out.append({
            "app_no":       app_no,
            "tm_name":      tm_name,
            "action_type":  action_type,
            "date":         date_str,
            "reply_status": reply_status,
            "agent":        agent,
            "applicant":    applicant,
            "office":       office,
            "tm_class":     tm_class,
            "view_url":     f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}",
        })

    log.info(f"Parsed {len(out)} queue items")
    return out


@bp_queue.route("/queue-list")
def queue_list():
    """
    GET /api/queue-list
      ?username=TMA/GJ/2847    optional agent/TMA filter
      &app_no=5847291          optional application number filter
    """
    username = request.args.get("username", "").strip() or None
    app_no   = request.args.get("app_no", "").strip() or None
    result   = fetch_tla_queue(username=username, app_no=app_no)
    return (jsonify(result), 502) if "error" in result else jsonify(result)


@bp_queue.route("/queue-list/pending-replies")
def pending_replies():
    """
    GET /api/queue-list/pending-replies
    Returns only items with pending/overdue replies, sorted by urgency.
    """
    username = request.args.get("username", "").strip() or None
    result   = fetch_tla_queue(username=username)
    if "error" in result:
        return jsonify(result), 502

    pending = [
        i for i in result["items"]
        if i.get("urgency") in ("overdue", "critical", "warning", "ok", "unknown")
        and i.get("reply_status", "").lower() not in ("filed", "complied", "done", "submitted")
    ]

    # Sort: overdue first, then by days_left ascending
    def sort_key(i):
        dl = i.get("days_left")
        if dl is None:
            return 9999
        return dl

    pending.sort(key=sort_key)

    return jsonify({
        "items":      pending,
        "total":      len(pending),
        "overdue":    sum(1 for i in pending if i.get("urgency") == "overdue"),
        "critical":   sum(1 for i in pending if i.get("urgency") == "critical"),
        "source_url": URL_QUEUE,
        "fetched_at": _now(),
    })
