"""routes/search.py — Public trademark search via BinBash API"""
from flask import Blueprint, request, jsonify

bp_search = Blueprint("search", __name__)


@bp_search.route("/public-search")
def public_search():
    q          = request.args.get("q", "").strip()
    tm_class   = request.args.get("class", "")
    status     = request.args.get("status", "")
    match_type = request.args.get("match_type", "SMART")
    limit      = min(int(request.args.get("limit", 50)), 100)

    if not q:
        return jsonify({"error": "q (search query) is required"}), 400

    try:
        from scrapers.binbash_api import public_search as bb_search
        result = bb_search(word_mark=q, class_number=tm_class,
                           status=status, match_type=match_type, limit=limit)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@bp_search.route("/proprietor-search")
def proprietor_search():
    name = request.args.get("name", "").strip()
    if not name:
        return jsonify({"error": "name is required"}), 400
    try:
        from scrapers.binbash_api import get_proprietor_trademarks
        result = get_proprietor_trademarks(name)
        return jsonify(result)
    except ValueError as e:
        return jsonify({"error": str(e)}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 502
