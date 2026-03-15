"""routes/efiling.py — IP India eFiling portal auth & portfolio"""

from flask import Blueprint, request, jsonify, session
from scrapers.ipindia import get_efiling, fetch_tla_queue

bp_efiling = Blueprint("efiling", __name__)


@bp_efiling.route("/efiling/captcha", methods=["GET"])
def efiling_captcha():
    """
    GET /api/efiling/captcha
    Fetches CAPTCHA from IP India + attempts auto-solve.
    Returns:
      { success, captcha: "<base64>", auto_solved: bool, solved_text: "26HD4"|null }

    If auto_solved=true: frontend can skip showing CAPTCHA to user entirely.
    If auto_solved=false: frontend shows the captcha image for manual entry.
    """
    import uuid
    token = session.get("captcha_token")
    if not token:
        token = str(uuid.uuid4())
        session["captcha_token"] = token

    client = get_efiling("__captcha__" + token)
    result = client.get_captcha()
    return jsonify(result)


@bp_efiling.route("/efiling/login", methods=["POST"])
def efiling_login():
    """
    POST /api/efiling/login
    Body: { "username": "...", "password": "...", "captcha": "26HD4" }
    Returns { success, message, username }
    """
    body     = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "")
    captcha  = body.get("captcha", "").strip()

    if not username or not password:
        return jsonify({"error": "username and password required"}), 400
    if not captcha:
        return jsonify({"success": False, "message": "Please enter the CAPTCHA code shown in the image."}), 400

    # Reuse the same client that fetched the captcha (same session cookie)
    token = session.get("captcha_token")
    if token:
        client = get_efiling("__captcha__" + token)
    else:
        client = get_efiling(username)

    result = client.login(username, password, captcha)

    if result.get("success"):
        # Move client to user-keyed pool
        from scrapers.ipindia import _efiling_pool
        _efiling_pool[username] = client
        session["efiling_user"] = username
        session.pop("captcha_token", None)
        return jsonify(result)

    return jsonify(result), 401


@bp_efiling.route("/efiling/logout", methods=["POST"])
def efiling_logout():
    user = session.pop("efiling_user", None)
    session.pop("captcha_token", None)
    if user:
        client = get_efiling(user)
        client.authenticated = False
    return jsonify({"success": True, "message": f"Logged out {user or ''}"})


@bp_efiling.route("/efiling/status")
def efiling_status():
    user = session.get("efiling_user")
    if user:
        client = get_efiling(user)
        return jsonify({"authenticated": client.authenticated, "username": user})
    return jsonify({"authenticated": False, "username": None})


@bp_efiling.route("/efiling/portfolio")
def efiling_portfolio():
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
    user = session.get("efiling_user")
    if not user:
        return jsonify({"error": "Not authenticated"}), 401
    client = get_efiling(user)
    result = fetch_tla_queue(username=user)
    return (jsonify(result), 502) if "error" in result else jsonify(result)
