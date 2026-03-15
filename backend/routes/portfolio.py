"""routes/portfolio.py — Attorney portfolio via BinBash API"""
import threading, uuid, logging
from flask import Blueprint, request, jsonify

bp_portfolio = Blueprint("portfolio", __name__)
log = logging.getLogger("markshield.portfolio")

_jobs: dict = {}


@bp_portfolio.route("/attorney-portfolio", methods=["POST"])
def attorney_portfolio_start():
    body       = request.get_json(silent=True) or {}
    tma_code   = body.get("tma_code",   "").strip()
    agent_name = body.get("agent_name", "").strip()
    force      = body.get("force", False)

    if not agent_name and not tma_code:
        return jsonify({"error": "agent_name or tma_code required"}), 400

    # Register for sync
    try:
        from sync_scheduler import register_tma_for_sync
        register_tma_for_sync(tma_code, agent_name)
    except Exception:
        pass

    # Return cached data if available and not forced
    if not force and tma_code:
        try:
            from sync_scheduler import get_cached_portfolio
            cached = get_cached_portfolio(tma_code)
            if cached and cached.get("applications") and cached.get("cache_age_minutes", 9999) < 360:
                cached["from_cache"] = True
                return jsonify({"status": "cached", "result": cached, "job_id": None})
        except Exception:
            pass

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "progress": 0, "message": "Starting…", "result": None, "error": None}

    def run():
        def cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct

        try:
            from scrapers.binbash_api import get_attorney_portfolio
            # Also merge TLA Queue data (public, no API key needed)
            result = get_attorney_portfolio(
                attorney_name=agent_name or tma_code,
                progress_cb=cb,
            )

            # Enrich with TLA Queue pending data
            try:
                from scrapers.ipindia import fetch_tla_queue
                queue = fetch_tla_queue(username=tma_code)
                queue_map = {i["app_no"]: i for i in queue.get("items", [])}
                for app in result["applications"]:
                    if app["app_no"] in queue_map:
                        q = queue_map[app["app_no"]]
                        app["action_type"]  = q.get("action_type", "")
                        app["reply_status"] = q.get("reply_status", "")
                        app["issue_date"]   = q.get("date", "")
                        app["in_queue"]     = True
                result["queue_total"]   = queue.get("total", 0)
                result["queue_pending"] = queue.get("pending", 0)
                result["queue_overdue"] = queue.get("overdue", 0)
            except Exception as eq:
                log.warning(f"TLA Queue merge failed: {eq}")

            # Save to cache
            try:
                from sync_scheduler import _save, _now
                result["tma_code"]  = tma_code
                result["synced_at"] = _now()
                _save(f"portfolio_{tma_code}", result)
            except Exception:
                pass

            _jobs[job_id]["result"] = result
            _jobs[job_id]["status"] = "done"

        except ValueError as e:
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"
        except Exception as e:
            log.error(f"Portfolio error: {e}")
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"status": "started", "job_id": job_id})


@bp_portfolio.route("/attorney-portfolio/<job_id>")
def attorney_portfolio_poll(job_id):
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
