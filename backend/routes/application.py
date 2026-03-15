from flask import Blueprint, request, jsonify
bp_app = Blueprint("application", __name__)

@bp_app.route("/application/<app_no>")
def application(app_no):
    app_no = app_no.strip()
    try:
        from database import get_by_appno
        cached = get_by_appno(app_no)
        if cached and cached.get("trademark_name") and cached["trademark_name"] not in ("—",""):
            cached["from_cache"] = True
            return jsonify(cached)
    except Exception: pass
    try:
        from scrapers.ipindia_scraper import fetch_application
        result = fetch_application(app_no)
        if result.get("error") and not result.get("trademark_name"):
            return jsonify(result), 404
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e), "app_no": app_no}), 502

@bp_app.route("/applications/bulk", methods=["POST"])
def applications_bulk():
    body    = request.get_json(silent=True) or {}
    app_nos = body.get("app_nos", [])
    if not app_nos: return jsonify({"error": "app_nos required"}), 400
    if len(app_nos) > 30: return jsonify({"error": "Max 30"}), 400
    from scrapers.ipindia_scraper import fetch_applications_bulk
    from database import upsert_trademark
    results = fetch_applications_bulk([str(n) for n in app_nos])
    for r in results:
        try: upsert_trademark(r)
        except Exception: pass
    return jsonify({"results": results, "total": len(results),
                    "success": sum(1 for r in results if not r.get("error")),
                    "failed":  sum(1 for r in results if r.get("error"))})
