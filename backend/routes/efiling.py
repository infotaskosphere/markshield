"""routes/efiling.py — IP India eFiling portal auth & portfolio"""

from flask import Blueprint, request, jsonify, session
from scrapers.ipindia import get_efiling, fetch_tla_queue

bp_efiling = Blueprint("efiling", __name__)


@bp_efiling.route("/efiling/login", methods=["POST"])
def efiling_login():
    """
    POST /api/efiling/login
    Body: {"username": "your_ipindia_username", "password": "your_password"}

    Authenticates with https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx
    Returns {"success": true/false, "message": "..."}
    """
    body     = request.get_json(silent=True) or {}
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
    if user:
        client = get_efiling(user)
        client.authenticated = False
    return jsonify({"success": True, "message": f"Logged out {user or ''}"})


@bp_efiling.route("/efiling/status")
def efiling_status():
    """GET /api/efiling/status — check if currently authenticated"""
    user = session.get("efiling_user")
    if user:
        client = get_efiling(user)
        return jsonify({"authenticated": client.authenticated, "username": user})
    return jsonify({"authenticated": False, "username": None})


@bp_efiling.route("/efiling/portfolio")
def efiling_portfolio():
    """
    GET /api/efiling/portfolio
    Returns all trademark applications for the authenticated eFiling user.
    Requires prior POST /api/efiling/login.
    """
    user = session.get("efiling_user")
    if not user:
        return jsonify({"error": "Not authenticated — POST /api/efiling/login first"}), 401

    client = get_efiling(user)
    if not client.authenticated:
        return jsonify({"error": "Session expired — please login again"}), 401

    result = client.fetch_portfolio()
    return (jsonify(result), 502) if "error" in result else jsonify(result)


@bp_efiling.route("/efiling/queue")
def efiling_queue():
    """
    GET /api/efiling/queue
    Returns TLA Queue for the authenticated user.
    """
    user = session.get("efiling_user")
    if not user:
        return jsonify({"error": "Not authenticated"}), 401

    client = get_efiling(user)
    result = fetch_tla_queue(username=user)
    return (jsonify(result), 502) if "error" in result else jsonify(result)
