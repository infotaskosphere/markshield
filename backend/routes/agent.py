"""routes/agent.py — Agent / TMA hearing search"""

from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from scrapers import fetch_cause_list

bp_agent = Blueprint("agent", __name__)


@bp_agent.route("/agent/hearings")
def agent_hearings():
    """
    GET /api/agent/hearings
      ?agent=LALJI+ADVOCATES    (required)
      &from=DD/MM/YYYY          default today
      &to=DD/MM/YYYY            default today + 30d
    """
    agent = request.args.get("agent", "").strip()
    if not agent:
        return jsonify({"error": "agent param required", "example": "?agent=LALJI+ADVOCATES"}), 400

    date_from = request.args.get("from")
    date_to   = request.args.get("to")
    today     = datetime.now()

    if not date_from:
        date_from = today.strftime("%d/%m/%Y")
    if not date_to:
        date_to = (today + timedelta(days=30)).strftime("%d/%m/%Y")

    # Validate
    for label, val in [("from", date_from), ("to", date_to)]:
        try:
            datetime.strptime(val, "%d/%m/%Y")
        except ValueError:
            return jsonify({"error": f"Invalid '{label}' — use DD/MM/YYYY"}), 400

    # Fetch by agent name (cause list supports Agent Name search)
    result = fetch_cause_list(agent_filter=agent)

    return jsonify({
        "hearings":   result.get("hearings", []),
        "total":      result.get("filtered", 0),
        "agent":      agent,
        "date_from":  date_from,
        "date_to":    date_to,
        "fetched_at": datetime.utcnow().isoformat() + "Z",
    })
