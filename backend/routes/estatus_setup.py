"""
routes/estatus_setup.py — eStatus OTP Authentication Endpoints
"""
from flask import Blueprint, request, jsonify

bp_estatus = Blueprint("estatus_setup", __name__)


@bp_estatus.route("/estatus/status")
def estatus_status():
    """GET /api/estatus/status — check if session is saved"""
    try:
        from scrapers.estatus_auth import has_session, load_session
        if has_session():
            cookies = load_session()
            return jsonify({
                "connected": True,
                "message":   "✅ eStatus session active — full data fetching enabled",
                "cookie_count": len(cookies),
            })
        return jsonify({
            "connected": False,
            "message":   "No session — complete OTP setup to enable full data fetching",
        })
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})


@bp_estatus.route("/estatus/captcha")
def estatus_captcha():
    """GET /api/estatus/captcha — get math captcha for OTP flow"""
    try:
        from scrapers.estatus_auth import get_captcha_info
        email  = request.args.get("email", "")
        mobile = request.args.get("mobile", "")
        result = get_captcha_info(email=email, mobile=mobile)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp_estatus.route("/estatus/send-otp", methods=["POST"])
def estatus_send_otp():
    """POST /api/estatus/send-otp — send OTP to email/mobile"""
    try:
        body           = request.get_json(silent=True) or {}
        email          = body.get("email", "")
        mobile         = body.get("mobile", "")
        captcha_answer = body.get("captcha_answer")
        session_cookies= body.get("session_cookies", {})

        if not email and not mobile:
            return jsonify({"success": False, "error": "email or mobile required"}), 400

        from scrapers.estatus_auth import send_otp
        result = send_otp(
            email=email, mobile=mobile,
            captcha_answer=captcha_answer,
            session_cookies=session_cookies,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp_estatus.route("/estatus/verify-otp", methods=["POST"])
def estatus_verify_otp():
    """POST /api/estatus/verify-otp — verify OTP and save session"""
    try:
        body           = request.get_json(silent=True) or {}
        otp            = body.get("otp", "").strip()
        email          = body.get("email", "")
        mobile         = body.get("mobile", "")
        session_cookies= body.get("session_cookies", {})

        if not otp:
            return jsonify({"success": False, "error": "OTP is required"}), 400

        from scrapers.estatus_auth import verify_otp
        result = verify_otp(
            otp=otp, email=email, mobile=mobile,
            session_cookies=session_cookies,
        )
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp_estatus.route("/estatus/disconnect", methods=["POST"])
def estatus_disconnect():
    """POST /api/estatus/disconnect — clear saved session"""
    try:
        from scrapers.estatus_auth import clear_session
        clear_session()
        return jsonify({"success": True, "message": "Session cleared"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502
