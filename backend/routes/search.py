"""routes/search.py — TM Public Search"""

from flask import Blueprint, request, jsonify
from scrapers import fetch_public_search

bp_search = Blueprint("search", __name__)


@bp_search.route("/public-search")
def public_search():
    """
    GET /api/public-search
      ?q=MARKNAME         required (or proprietor)
      &class=29           optional
      &type=wordmark      wordmark|proprietor|application
      &proprietor=NAME    optional
    """
    q          = request.args.get("q", "").strip()
    tm_class   = request.args.get("class", "").strip()
    stype      = request.args.get("type", "wordmark").lower()
    proprietor = request.args.get("proprietor", "").strip()

    if not q and not proprietor:
        return jsonify({"error": "q or proprietor required", "example": "?q=FRESHMART&class=29"}), 400
    if stype not in ("wordmark", "proprietor", "application"):
        return jsonify({"error": "type must be wordmark|proprietor|application"}), 400

    result = fetch_public_search(
        query=q or proprietor,
        search_type=stype,
        tm_class=tm_class,
        proprietor=proprietor,
    )
    return (jsonify(result), 502) if "error" in result and not result.get("results") else jsonify(result)
