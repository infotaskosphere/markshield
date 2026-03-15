"""
routes/efiling_login.py — eFiling Login + Portfolio Fetch
"""
import threading, uuid, logging
from flask import Blueprint, request, jsonify

bp_efiling_login = Blueprint("efiling_login", __name__)
log = logging.getLogger("markshield.efiling_login")
_jobs: dict = {}


@bp_efiling_login.route("/efiling-session/status")
def status():
    try:
        from scrapers.efiling_session import has_efiling_session, load_efiling_session
        username, cookies = load_efiling_session()
        return jsonify({
            "connected": bool(cookies),
            "username":  username,
            "message":   f"✅ Logged in as {username}" if cookies else "Not logged in",
        })
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})


@bp_efiling_login.route("/efiling-session/login", methods=["POST"])
def login():
    """
    POST { username, password }
    → Auto-solves CAPTCHA → logs in → saves session → fetches all applications
    """
    body     = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "progress": 0, "message": "Starting…",
                     "result": None, "error": None}

    def run():
        def cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct

        try:
            from scrapers.efiling_session import sync_efiling_portfolio
            result = sync_efiling_portfolio(
                username=username,
                password=password,
                progress_cb=cb,
            )
            if result["success"]:
                _jobs[job_id]["status"] = "done"
                _jobs[job_id]["result"] = result
            else:
                _jobs[job_id]["status"] = "error"
                _jobs[job_id]["error"]  = result.get("error", "Failed")
        except Exception as e:
            log.error(f"eFiling sync error: {e}")
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"]  = str(e)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"success": True, "job_id": job_id,
                    "message": "Login started — auto-solving captcha…"})


@bp_efiling_login.route("/efiling-session/status/<job_id>")
def job_status(job_id):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    resp = {"job_id": job_id, "status": job["status"],
            "progress": job["progress"], "message": job["message"]}
    if job["status"] == "done":
        resp["result"] = job["result"]
        del _jobs[job_id]
    elif job["status"] == "error":
        resp["error"] = job["error"]
        del _jobs[job_id]
    return jsonify(resp)


@bp_efiling_login.route("/efiling-session/sync", methods=["POST"])
def sync():
    """Re-sync portfolio using saved session (no password needed)."""
    body     = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "progress": 0, "message": "Syncing…",
                     "result": None, "error": None}

    def run():
        def cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct
        try:
            from scrapers.efiling_session import sync_efiling_portfolio
            result = sync_efiling_portfolio(username=username, progress_cb=cb)
            _jobs[job_id]["status"] = "done" if result["success"] else "error"
            _jobs[job_id]["result" if result["success"] else "error"] = \
                result if result["success"] else result.get("error")
        except Exception as e:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"]  = str(e)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"job_id": job_id, "message": "Sync started"})


@bp_efiling_login.route("/efiling-session/logout", methods=["POST"])
def logout():
    try:
        from scrapers.efiling_session import clear_efiling_session
        clear_efiling_session()
        return jsonify({"success": True, "message": "eFiling session cleared"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502
