"""routes/cause_list.py — Hearing cause list endpoints"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from scrapers import fetch_cause_list

bp_cause = Blueprint("cause", __name__)


def _parse_date(s, label="date"):
    try:
        datetime.strptime(s, "%d/%m/%Y")
        return s, None
    except ValueError:
        return None, f"Invalid {label} — use DD/MM/YYYY"


@bp_cause.route("/cause-list")
def cause_list():
    """
    GET /api/cause-list
      ?date=DD/MM/YYYY      default: today
      &agent=AGENT_NAME     optional filter
      &location=Delhi       optional filter
    """
    date  = request.args.get("date")
    agent = request.args.get("agent", "").strip() or None
    loc   = request.args.get("location", "").strip() or None

    if date:
        date, err = _parse_date(date)
        if err:
            return jsonify({"error": err}), 400

    result = fetch_cause_list(date=date, agent_filter=agent, location=loc)
    return (jsonify(result), 502) if "error" in result and not result.get("hearings") else jsonify(result)


@bp_cause.route("/cause-list/today")
def cause_list_today():
    """GET /api/cause-list/today  ?agent=NAME"""
    agent  = request.args.get("agent", "").strip() or None
    result = fetch_cause_list(date=datetime.now().strftime("%d/%m/%Y"), agent_filter=agent)
    return jsonify(result)


@bp_cause.route("/cause-list/upcoming")
@bp_cause.route("/hearings/upcoming")
def cause_list_upcoming():
    """
    GET /api/cause-list/upcoming
      ?days=30    default 30
      &agent=NAME
    """
    days  = min(int(request.args.get("days", 30)), 90)
    agent = request.args.get("agent", "").strip() or None
    today = datetime.now()

    all_hearings, errors = [], []
    for i in range(days):
        day = today + timedelta(days=i)
        if day.weekday() >= 5:          # skip weekends
            continue
        ds     = day.strftime("%d/%m/%Y")
        result = fetch_cause_list(date=ds, agent_filter=agent)
        if "error" not in result:
            all_hearings.extend(result.get("hearings", []))
        else:
            errors.append(f"{ds}: {result['error']}")

    return jsonify({
        "hearings":   all_hearings,
        "total":      len(all_hearings),
        "days":       days,
        "agent":      agent,
        "errors":     errors[:5],
        "fetched_at": datetime.utcnow().isoformat() + "Z",
    })
