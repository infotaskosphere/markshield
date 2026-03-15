"""routes/portfolio.py — Full attorney portfolio by TMA code"""

import threading
import uuid
from flask import Blueprint, request, jsonify
from scrapers.attorney_portfolio import fetch_attorney_portfolio

bp_portfolio = Blueprint("portfolio", __name__)

# In-memory job store for async portfolio fetch
_jobs: dict = {}


@bp_portfolio.route("/attorney-portfolio", methods=["POST"])
def attorney_portfolio():
    """
    POST /api/attorney-portfolio
    Body: { "tma_code": "manthan15", "agent_name": "MANTHAN DESAI" }

    Starts an async portfolio fetch job.
    Returns: { "job_id": "...", "status": "started" }

    Poll GET /api/attorney-portfolio/<job_id> for status/results.
    """
    body       = request.get_json(silent=True) or {}
    tma_code   = body.get("tma_code",   "").strip()
    agent_name = body.get("agent_name", "").strip()

    if not tma_code:
        return jsonify({"error": "tma_code is required"}), 400

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {
        "status":   "running",
        "progress": 0,
        "message":  "Starting…",
        "result":   None,
        "error":    None,
    }

    def run():
        def progress_cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct

        try:
            result = fetch_attorney_portfolio(
                tma_code=tma_code,
                agent_name=agent_name,
                max_detail_fetch=50,
                progress_cb=progress_cb,
            )
            _jobs[job_id]["result"] = result
            _jobs[job_id]["status"] = "done"
        except Exception as e:
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"

    threading.Thread(target=run, daemon=True).start()

    return jsonify({"job_id": job_id, "status": "started"})


@bp_portfolio.route("/attorney-portfolio/<job_id>")
def attorney_portfolio_status(job_id):
    """
    GET /api/attorney-portfolio/<job_id>
    Returns current job status, progress, and result when done.
    """
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404

    resp = {
        "job_id":   job_id,
        "status":   job["status"],
        "progress": job["progress"],
        "message":  job["message"],
    }
    if job["status"] == "done":
        resp["result"] = job["result"]
        del _jobs[job_id]   # clean up
    elif job["status"] == "error":
        resp["error"] = job["error"]
        del _jobs[job_id]

    return jsonify(resp)
