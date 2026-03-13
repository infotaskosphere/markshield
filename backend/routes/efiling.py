"""routes/efiling.py — IP India eFiling portal auth"""

from flask import Blueprint, request, jsonify, session
from scrapers import get_efiling

bp_efiling = Blueprint("efiling", __name__)


@bp_efiling.route("/efiling/login", methods=["POST"])
def efiling_login():
    """
    POST /api/efiling/login
    Body: {"username": "your_ipindia_user", "password": "your_password"}
    """
    body = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400

    client = get_efiling(username)
    result = client.login(username, password)

    if result.get("success"):
        session["efiling_user"] = username
        return jsonify(result)
    return jsonify(result), 401


@bp_efiling.route("/efiling/logout", methods=["POST"])
def efiling_logout():
    user = session.pop("efiling_user", None)
    return jsonify({"success": True, "message": f"Logged out {user or ''}"})


@bp_efiling.route("/efiling/status")
def efiling_status():
    user = session.get("efiling_user")
    if user:
        client = get_efiling(user)
        return jsonify({"authenticated": client.authenticated, "username": user})
    return jsonify({"authenticated": False})


@bp_efiling.route("/efiling/portfolio")
def efiling_portfolio():
    """
    GET /api/efiling/portfolio
    Returns all applications for the authenticated eFiling user.
    Requires prior POST /api/efiling/login.
    """
    user = session.get("efiling_user")
    if not user:
        return jsonify({"error": "Not authenticated — POST /api/efiling/login first"}), 401
    client = get_efiling(user)
    result = client.fetch_portfolio()
    return (jsonify(result), 502) if "error" in result else jsonify(result)
