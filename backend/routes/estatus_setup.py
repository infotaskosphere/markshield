"""routes/estatus_setup.py — eStatus OTP Authentication"""
from flask import Blueprint, request, jsonify
bp_estatus = Blueprint("estatus_setup", __name__)


@bp_estatus.route("/estatus/status")
def status():
    try:
        from scrapers.estatus_auth import has_session
        ok = has_session()
        return jsonify({"connected": ok,
                        "message": "✅ eStatus active" if ok else "Not connected"})
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})


@bp_estatus.route("/estatus/send-otp", methods=["POST"])
def send_otp():
    """
    POST { email, mobile }
    → Backend atomically: GET page → solve math captcha → POST form → OTP sent
    → User never needs to see or solve captcha manually
    """
    body   = request.get_json(silent=True) or {}
    email  = body.get("email",  "").strip()
    mobile = body.get("mobile", "").strip()
    if not email and not mobile:
        return jsonify({"success": False, "error": "email or mobile required"}), 400
    try:
        from scrapers.estatus_auth import send_otp_atomic
        result = send_otp_atomic(email=email, mobile=mobile)
        return jsonify(result)
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp_estatus.route("/estatus/verify-otp", methods=["POST"])
def verify_otp():
    body   = request.get_json(silent=True) or {}
    otp    = body.get("otp",    "").strip()
    email  = body.get("email",  "").strip()
    mobile = body.get("mobile", "").strip()
    if not otp:
        return jsonify({"success": False, "error": "OTP required"}), 400
    try:
        from scrapers.estatus_auth import verify_otp as _verify
        return jsonify(_verify(otp=otp, email=email, mobile=mobile))
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp_estatus.route("/estatus/disconnect", methods=["POST"])
def disconnect():
    try:
        from scrapers.estatus_auth import clear_session
        clear_session()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502
