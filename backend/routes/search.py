from flask import Blueprint, request, jsonify
bp_search = Blueprint("search", __name__)

@bp_search.route("/public-search")
def public_search():
    q          = request.args.get("q","").strip()
    app_no     = request.args.get("app_no","").strip()
    attorney   = request.args.get("attorney","").strip()
    tm_class   = request.args.get("class","")
    limit      = min(int(request.args.get("limit",50)),100)
    if not any([q, app_no, attorney]):
        return jsonify({"error": "q, app_no or attorney required"}), 400
    try:
        from scrapers.ipindia_scraper import _apex_search
        results = _apex_search(
            word_mark=q, application_number=app_no,
            attorney_name=attorney, tm_class=tm_class,
            max_results=limit,
        )
        if results:
            try:
                from database import upsert_many
                upsert_many(results)
            except Exception: pass
            return jsonify({"results": results, "total": len(results),
                            "query": q or app_no or attorney, "source": "ipindia_apex"})
    except Exception as e:
        pass
    # fallback to local DB
    try:
        from database import search_trademarks
        result = search_trademarks(word_mark=q, app_no=app_no, agent=attorney,
                                   tm_class=tm_class, limit=limit)
        if result["total"] > 0:
            result["source"] = "local_db"
            return jsonify(result)
    except Exception: pass
    return jsonify({"results":[], "total":0, "query": q, "source": "no_results"})

@bp_search.route("/db-stats")
def db_stats():
    try:
        from database import get_db_stats
        return jsonify(get_db_stats())
    except Exception as e:
        return jsonify({"error": str(e)}), 502
