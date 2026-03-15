"""routes/application.py — Application status from local DB + live fetch"""
from flask import Blueprint, request, jsonify

bp_app = Blueprint("application", __name__)


@bp_app.route("/application/<app_no>")
def application(app_no):
    app_no = app_no.strip()

    # Check local DB first (instant)
    try:
        from database import get_by_appno
        cached = get_by_appno(app_no)
        if cached and cached.get("trademark_name"):
            cached["from_cache"] = True
            return jsonify(cached)
    except Exception: pass

    # Live fetch from IP India
    try:
        from scrapers.ipindia_bulk import fetch_eregister_single
        result = fetch_eregister_single(app_no)
        if result.get("trademark_name"):
            return jsonify(result)
        return jsonify({"error": f"No data found for application {app_no}", "app_no": app_no}), 404
    except Exception as e:
        return jsonify({"error": str(e), "app_no": app_no}), 502


@bp_app.route("/applications/bulk", methods=["POST"])
def applications_bulk():
    body    = request.get_json(silent=True) or {}
    app_nos = body.get("app_nos", [])
    if not app_nos: return jsonify({"error": "app_nos required"}), 400
    if len(app_nos) > 50: return jsonify({"error": "Max 50 per request"}), 400

    results = []
    from database import get_by_appno
    from scrapers.ipindia_bulk import fetch_eregister_single
    import time

    for no in app_nos:
        cached = get_by_appno(str(no))
        if cached and cached.get("trademark_name"):
            cached["from_cache"] = True
            results.append(cached)
        else:
            result = fetch_eregister_single(str(no))
            results.append(result)
            time.sleep(0.5)

    return jsonify({
        "results": results, "total": len(results),
        "success": sum(1 for r in results if not r.get("error")),
        "failed":  sum(1 for r in results if r.get("error")),
    })
