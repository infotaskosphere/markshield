"""routes/portfolio.py — Attorney portfolio from local DB + live sync"""
import threading, uuid, logging
from flask import Blueprint, request, jsonify

bp_portfolio = Blueprint("portfolio", __name__)
log = logging.getLogger("markshield.portfolio")
_jobs: dict = {}


@bp_portfolio.route("/attorney-portfolio", methods=["POST"])
def start():
    body       = request.get_json(silent=True) or {}
    tma_code   = body.get("tma_code", "").strip()
    agent_name = body.get("agent_name", "").strip()
    force      = body.get("force", False)

    if not tma_code and not agent_name:
        return jsonify({"error": "tma_code or agent_name required"}), 400

    # Register attorney
    try:
        from database import register_attorney
        register_attorney(tma_code, agent_name)
    except Exception: pass

    # Return from local DB instantly if available and not forced
    if not force:
        try:
            from database import get_attorney_portfolio, get_db_stats
            apps = get_attorney_portfolio(tma_code=tma_code, agent_name=agent_name)
            if apps:
                return jsonify({
                    "status": "cached",
                    "job_id": None,
                    "result": _build_result(apps, tma_code, agent_name),
                })
        except Exception as e:
            log.warning(f"DB read failed: {e}")

    # Start live sync job
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "progress": 0, "message": "Starting…", "result": None, "error": None}

    def run():
        def cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct
        try:
            from scrapers.ipindia_bulk import sync_attorney_portfolio
            result = sync_attorney_portfolio(tma_code=tma_code, agent_name=agent_name, progress_cb=cb)
            _jobs[job_id]["result"] = result
            _jobs[job_id]["status"] = "done"
        except Exception as e:
            log.error(f"Sync error: {e}")
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"status": "started", "job_id": job_id})


@bp_portfolio.route("/attorney-portfolio/<job_id>")
def poll(job_id):
    job = _jobs.get(job_id)
    if not job: return jsonify({"error": "Job not found"}), 404
    resp = {"job_id": job_id, "status": job["status"],
            "progress": job["progress"], "message": job["message"]}
    if job["status"] == "done":
        resp["result"] = job["result"]
        del _jobs[job_id]
    elif job["status"] == "error":
        resp["error"] = job["error"]
        del _jobs[job_id]
    return jsonify(resp)


def _build_result(apps, tma_code, agent_name):
    from database import _classify
    summary = {
        "total":             len(apps),
        "registered":        sum(1 for a in apps if a.get("status_class")=="registered"),
        "objected":          sum(1 for a in apps if a.get("status_class")=="objected"),
        "opposed":           sum(1 for a in apps if a.get("status_class")=="opposed"),
        "pending":           sum(1 for a in apps if a.get("status_class") in ("pending","under_examination")),
        "hearings_upcoming": sum(1 for a in apps if a.get("hearing_date")),
        "refused":           sum(1 for a in apps if a.get("status_class") in ("refused","abandoned")),
    }
    return {"tma_code": tma_code, "agent_name": agent_name,
            "applications": apps, "summary": summary, "from_cache": True}
