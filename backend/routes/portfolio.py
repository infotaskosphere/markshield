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
    try:
        from database import register_attorney
        register_attorney(tma_code, agent_name)
    except Exception: pass
    if not force:
        try:
            from database import get_attorney_portfolio
            apps = get_attorney_portfolio(tma_code=tma_code, agent_name=agent_name)
            if apps:
                return jsonify({"status": "cached", "job_id": None,
                                "result": _build(apps, tma_code, agent_name, True)})
        except Exception: pass
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status":"running","progress":0,"message":"Starting…","result":None,"error":None}
    def run():
        def cb(m,p): _jobs[job_id]["message"]=m; _jobs[job_id]["progress"]=p
        try:
            from scrapers.ipindia_scraper import sync_full_portfolio
            result = sync_full_portfolio(tma_code=tma_code, agent_name=agent_name, progress_cb=cb)
            _jobs[job_id]["result"] = result
            _jobs[job_id]["status"] = "done"
        except Exception as e:
            log.error(f"Portfolio sync error: {e}")
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"
    threading.Thread(target=run, daemon=True).start()
    return jsonify({"status": "started", "job_id": job_id})

@bp_portfolio.route("/attorney-portfolio/<job_id>")
def poll(job_id):
    job = _jobs.get(job_id)
    if not job: return jsonify({"error": "Job not found"}), 404
    resp = {"job_id":job_id,"status":job["status"],"progress":job["progress"],"message":job["message"]}
    if job["status"] == "done":
        resp["result"] = job["result"]; del _jobs[job_id]
    elif job["status"] == "error":
        resp["error"] = job["error"]; del _jobs[job_id]
    return jsonify(resp)

def _build(apps, tma_code, agent_name, from_cache=False):
    s = {"total":len(apps),
         "registered":sum(1 for a in apps if a.get("status_class")=="registered"),
         "objected":   sum(1 for a in apps if a.get("status_class")=="objected"),
         "opposed":    sum(1 for a in apps if a.get("status_class")=="opposed"),
         "pending":    sum(1 for a in apps if a.get("status_class") in ("pending","under_examination")),
         "hearings_upcoming": sum(1 for a in apps if a.get("hearing_date") and a["hearing_date"] not in ("—","")),
         "refused":    sum(1 for a in apps if a.get("status_class") in ("refused","abandoned"))}
    return {"tma_code":tma_code,"agent_name":agent_name,
            "applications":apps,"summary":s,"from_cache":from_cache}
