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


@bp_queue.route("/verify-tma", methods=["POST"])
def verify_tma():
    """
    POST /api/verify-tma
    Body: { "tma_code": "TMA/GJ/2847" }

    Verifies a TMA code by fetching the public TLA Queue list.
    No login or CAPTCHA required — this is a public IP India endpoint.
    Returns: { success, tma_code, items_found, attorney_name, message }
    """
    body     = request.get_json(silent=True) or {}
    tma_code = body.get("tma_code", "").strip()

    if not tma_code:
        return jsonify({"success": False, "message": "TMA code is required."}), 400

    result = fetch_tla_queue(username=tma_code)

    if "error" in result:
        return jsonify({
            "success": False,
            "message": f"Could not reach IP India: {result['error']}"
        }), 502

    items = result.get("items", [])

    # Try to extract attorney name from results
    attorney_name = ""
    for item in items:
        agent = item.get("agent", "")
        if agent and tma_code.upper() in agent.upper():
            attorney_name = agent
            break
    if not attorney_name and items:
        attorney_name = items[0].get("agent", "")

    # Register attorney for nightly sync immediately after verification
    try:
        from sync_scheduler import register_tma_for_sync
        register_tma_for_sync(tma_code, attorney_name)
    except Exception as e:
        pass  # Don't fail verification if scheduler isn't available

    return jsonify({
        "success":       True,
        "tma_code":      tma_code,
        "items_found":   len(items),
        "attorney_name": attorney_name,
        "pending":       result.get("pending", 0),
        "overdue":       result.get("overdue", 0),
        "message":       f"TMA code verified — {len(items)} matter(s) found in IP India queue."
                         if items else
                         "TMA code accepted. No pending matters found (queue may be empty).",
        "connected_at":  _now(),
    })
