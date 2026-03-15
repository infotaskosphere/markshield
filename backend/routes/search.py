"""routes/search.py — Trademark search from local DB + live IP India"""
from flask import Blueprint, request, jsonify

bp_search = Blueprint("search", __name__)


@bp_search.route("/public-search")
def public_search():
    q        = request.args.get("q", "").strip()
    tm_class = request.args.get("class", "")
    status   = request.args.get("status", "")
    limit    = min(int(request.args.get("limit", 50)), 100)
    offset   = int(request.args.get("offset", 0))

    if not q: return jsonify({"error": "q is required"}), 400

    # Search local DB first
    try:
        from database import search_trademarks
        result = search_trademarks(
            word_mark=q, tm_class=tm_class, status=status,
            limit=limit, offset=offset,
        )
        if result["total"] > 0:
            result["source"] = "local_db"
            return jsonify(result)
    except Exception: pass

    # Live IP India public search fallback
    try:
        from scrapers.ipindia import fetch_public_search
        data = fetch_public_search(query=q, tm_class=tm_class)
        return jsonify({
            "results":  data.get("results", []),
            "total":    data.get("total", 0),
            "query":    q,
            "source":   "ipindia_live",
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@bp_search.route("/db-stats")
def db_stats():
    """GET /api/db-stats — show local database statistics"""
    try:
        from database import get_db_stats
        return jsonify(get_db_stats())
    except Exception as e:
        return jsonify({"error": str(e)}), 502
