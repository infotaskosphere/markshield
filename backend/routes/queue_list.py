"""routes/queue_list.py — TLA Queue List endpoints"""

from flask import Blueprint, request, jsonify
from scrapers.ipindia import fetch_tla_queue, _now

bp_queue = Blueprint("queue", __name__)


@bp_queue.route("/queue-list")
def queue_list():
    """
    GET /api/queue-list
      ?username=TMA/GJ/2847   optional TMA code / agent filter
      &app_no=6001234         optional application number filter
    """
    username = request.args.get("username", "").strip() or None
    app_no   = request.args.get("app_no",   "").strip() or None
    result   = fetch_tla_queue(username=username, app_no=app_no)
    return (jsonify(result), 502) if "error" in result else jsonify(result)


@bp_queue.route("/queue-list/pending-replies")
def pending_replies():
    """
    GET /api/queue-list/pending-replies
    Returns only items with unfiled/pending replies, sorted by urgency (overdue first).
    """
    username = request.args.get("username", "").strip() or None
    result   = fetch_tla_queue(username=username)

    if "error" in result:
        return jsonify(result), 502

    FILED_STATUSES = {"filed", "complied", "done", "submitted", "replied", "completed"}
    pending = [
        i for i in result["items"]
        if i.get("reply_status", "").strip().lower() not in FILED_STATUSES
    ]

    # Sort: overdue (-∞) first, then by days_left ascending
    pending.sort(key=lambda i: (i.get("days_left") is None, i.get("days_left") or 9999))

    return jsonify({
        "items":      pending,
        "total":      len(pending),
        "overdue":    sum(1 for i in pending if i.get("urgency") == "overdue"),
        "critical":   sum(1 for i in pending if i.get("urgency") == "critical"),
        "source_url": "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx",
        "fetched_at": _now(),
    })
