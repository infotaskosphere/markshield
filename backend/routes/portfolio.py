"""routes/portfolio.py — Attorney portfolio routes"""

import threading, uuid, logging
from flask import Blueprint, request, jsonify
from sync_scheduler import get_cached_portfolio, register_tma_for_sync

bp_portfolio = Blueprint("portfolio", __name__)
log = logging.getLogger("markshield.portfolio_route")

# In-memory live job store
_jobs: dict = {}


@bp_portfolio.route("/attorney-portfolio", methods=["POST"])
def attorney_portfolio_start():
    """
    POST /api/attorney-portfolio
    Body: { "tma_code": "manthan15", "agent_name": "MANTHAN DESAI" }

    1. Returns cached data immediately if available (< 6 hours old)
    2. Starts a fresh background fetch job
    3. Poll GET /api/attorney-portfolio/<job_id> for live updates
    """
    body       = request.get_json(silent=True) or {}
    tma_code   = body.get("tma_code",   "").strip()
    agent_name = body.get("agent_name", "").strip()
    force      = body.get("force", False)

    if not tma_code:
        return jsonify({"error": "tma_code is required"}), 400

    # Register for nightly sync (no-op if already registered)
    register_tma_for_sync(tma_code, agent_name)

    # Return cached data if fresh enough (< 6 hours) and not forced refresh
    if not force:
        cached = get_cached_portfolio(tma_code)
        if cached and cached.get("applications") and cached.get("cache_age_minutes", 9999) < 360:
            cached["from_cache"] = True
            log.info(f"Returning cached portfolio for {tma_code}: {len(cached['applications'])} apps, {cached['cache_age_minutes']}min old")
            return jsonify({"status": "cached", "result": cached, "job_id": None})

    # Start live fetch job
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "progress": 0, "message": "Starting…", "result": None, "error": None}

    def run():
        def progress_cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct

        try:
            from scrapers.playwright_scraper import fetch_portfolio_by_agent
            result = fetch_portfolio_by_agent(
                tma_code=tma_code,
                agent_name=agent_name,
                progress_cb=progress_cb,
            )
            # Save to cache
            from sync_scheduler import _save, _now
            result["synced_at"] = _now()
            _save(f"portfolio_{tma_code}", result)

            _jobs[job_id]["result"] = result
            _jobs[job_id]["status"] = "done"
        except Exception as e:
            log.error(f"Portfolio fetch error: {e}")
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"status": "started", "job_id": job_id})


@bp_portfolio.route("/attorney-portfolio/<job_id>")
def attorney_portfolio_poll(job_id):
    """GET /api/attorney-portfolio/<job_id> — poll job status"""
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found or expired"}), 404

    resp = {"job_id": job_id, "status": job["status"],
            "progress": job["progress"], "message": job["message"]}

    if job["status"] == "done":
        resp["result"] = job["result"]
        del _jobs[job_id]
    elif job["status"] == "error":
        resp["error"] = job["error"]
        del _jobs[job_id]

    return jsonify(resp)


@bp_portfolio.route("/attorney-portfolio/cached/<tma_code>")
def attorney_portfolio_cached(tma_code):
    """GET /api/attorney-portfolio/cached/<tma_code> — instant cached response"""
    cached = get_cached_portfolio(tma_code)
    if not cached:
        return jsonify({"error": "No cached data — trigger a fetch first", "applications": []}), 404
    cached["from_cache"] = True
    return jsonify(cached)
