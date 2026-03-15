"""routes/application.py — Application status via BinBash API"""
from flask import Blueprint, request, jsonify

bp_app = Blueprint("application", __name__)


@bp_app.route("/application/<app_no>")
def application(app_no):
    try:
        from scrapers.binbash_api import get_trademark_by_appno
        result = get_trademark_by_appno(app_no.strip())
        if result.get("error"):
            return jsonify(result), 404
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e), "hint": "Set BINBASH_API_KEY in Render environment"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@bp_app.route("/applications/bulk", methods=["POST"])
def applications_bulk():
    body    = request.get_json(silent=True) or {}
    app_nos = body.get("app_nos", [])
    if not app_nos:
        return jsonify({"error": "app_nos required"}), 400
    if len(app_nos) > 50:
        return jsonify({"error": "Max 50 per request"}), 400
    try:
        from scrapers.binbash_api import bulk_fetch_by_appnos
        results = bulk_fetch_by_appnos(app_nos)
        return jsonify({
            "results": results,
            "total":   len(results),
            "success": sum(1 for r in results if not r.get("error")),
            "failed":  sum(1 for r in results if r.get("error")),
        })
    except ValueError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 502
