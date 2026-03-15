"""routes/application.py — Application status lookup via IP India e-Register"""

from flask import Blueprint, request, jsonify
from scrapers.eregister import fetch_application, fetch_applications_bulk

bp_app = Blueprint("application", __name__)


@bp_app.route("/application/<app_no>")
def application(app_no):
    """
    GET /api/application/4182961
    Returns full trademark status from IP India e-Register.
    """
    result = fetch_application(app_no.strip())
    if result.get("error") and not result.get("trademark_name"):
        return jsonify(result), 502
    return jsonify(result)


@bp_app.route("/applications/bulk", methods=["POST"])
def applications_bulk():
    """
    POST /api/applications/bulk
    Body: { "app_nos": ["4182961", "6001234"] }
    Returns array of application details.
    """
    body    = request.get_json(silent=True) or {}
    app_nos = body.get("app_nos", [])

    if not app_nos:
        return jsonify({"error": "app_nos array required"}), 400
    if len(app_nos) > 30:
        return jsonify({"error": "Max 30 applications per request"}), 400

    results = fetch_applications_bulk(app_nos)
    return jsonify({
        "results": results,
        "total":   len(results),
        "success": sum(1 for r in results if not r.get("error")),
        "failed":  sum(1 for r in results if r.get("error")),
    })
