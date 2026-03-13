"""routes/application.py — e-Register application status"""

from flask import Blueprint, request, jsonify
from scrapers import fetch_application, fetch_applications_bulk

bp_app = Blueprint("app", __name__)


@bp_app.route("/application/<app_no>")
def get_application(app_no):
    """GET /api/application/5847291"""
    app_no = app_no.strip()
    if not app_no.isdigit():
        return jsonify({"error": "Application number must be numeric"}), 400
    result = fetch_application(app_no)
    return (jsonify(result), 502) if "error" in result and len(result) <= 2 else jsonify(result)


@bp_app.route("/applications/bulk", methods=["POST"])
def get_bulk():
    """
    POST /api/applications/bulk
    Body: {"app_nos": ["5847291", "5821043"]}   (max 50)
    """
    body    = request.get_json(silent=True) or {}
    app_nos = body.get("app_nos", [])

    if not app_nos:
        return jsonify({"error": "app_nos array required"}), 400
    if len(app_nos) > 50:
        return jsonify({"error": "Maximum 50 per request"}), 400

    invalid = [n for n in app_nos if not str(n).strip().isdigit()]
    if invalid:
        return jsonify({"error": f"Non-numeric app numbers: {invalid}"}), 400

    results = fetch_applications_bulk([str(n).strip() for n in app_nos])
    return jsonify({"results": results, "total": len(results)})
