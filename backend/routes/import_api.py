"""
routes/import_api.py — MarkShield Bulk Import API
===================================================
Import trademark data on-demand for:
  1. A TMA code  → fetches all applications for that attorney
  2. Application numbers → fetches specific apps you've manually added

Endpoints:
  POST /api/import/tma        — import all apps for a TMA code
  POST /api/import/appnos     — import specific application numbers
  POST /api/import/portfolio  — import TMA + any extra app numbers together
  GET  /api/import/status/<job_id>  — poll import progress
  GET  /api/import/history    — see all past imports
"""

import threading, uuid, logging, time
from flask import Blueprint, request, jsonify
from datetime import datetime

bp_import = Blueprint("import_api", __name__)
log = logging.getLogger("markshield.import")

# In-memory job store
_jobs: dict = {}


def _now():
    return datetime.utcnow().isoformat() + "Z"


def _make_job():
    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {
        "job_id":   job_id,
        "status":   "running",
        "progress": 0,
        "message":  "Starting…",
        "result":   None,
        "error":    None,
        "started_at": _now(),
    }
    return job_id


# ── Endpoint 1: Import by TMA Code ────────────────────────────────────────────

@bp_import.route("/import/tma", methods=["POST"])
def import_by_tma():
    """
    POST /api/import/tma
    Body: {
        "tma_code":   "manthan15",
        "agent_name": "MANTHAN DESAI"   (optional but improves results)
    }

    Fetches ALL trademark applications for this attorney from IP India
    (TLA Queue + Cause List + eRegister) and stores in local DB.

    Returns job_id — poll /api/import/status/<job_id> for progress.
    """
    body       = request.get_json(silent=True) or {}
    tma_code   = body.get("tma_code",   "").strip()
    agent_name = body.get("agent_name", "").strip()

    if not tma_code:
        return jsonify({"error": "tma_code is required"}), 400

    job_id = _make_job()

    def run():
        cb = lambda msg, pct: _update_job(job_id, msg, pct)
        try:
            from database import register_attorney
            register_attorney(tma_code, agent_name)

            from scrapers.ipindia_bulk import sync_attorney_portfolio
            result = sync_attorney_portfolio(
                tma_code=tma_code,
                agent_name=agent_name,
                progress_cb=cb,
            )
            _jobs[job_id]["result"] = {
                "imported":  len(result.get("applications", [])),
                "summary":   result.get("summary", {}),
                "tma_code":  tma_code,
                "agent_name": agent_name,
                "sources":   result.get("sources", []),
            }
            _jobs[job_id]["status"] = "done"
            log.info(f"TMA import done: {tma_code} → {len(result.get('applications',[]))} apps")

        except Exception as e:
            log.error(f"TMA import error: {e}")
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"job_id": job_id, "status": "started",
                    "message": f"Importing all applications for TMA code: {tma_code}",
                    "poll_url": f"/api/import/status/{job_id}"})


# ── Endpoint 2: Import Specific Application Numbers ───────────────────────────

@bp_import.route("/import/appnos", methods=["POST"])
def import_by_appnos():
    """
    POST /api/import/appnos
    Body: {
        "app_nos":  ["4182961", "6001234", "5089123"],
        "tma_code": "manthan15"   (optional — tags these apps to your attorney)
    }

    Fetches full details for each application number from IP India eRegister
    and stores in local DB.

    Returns job_id — poll /api/import/status/<job_id> for progress.
    """
    body     = request.get_json(silent=True) or {}
    app_nos  = body.get("app_nos", [])
    tma_code = body.get("tma_code", "").strip()

    if not app_nos:
        return jsonify({"error": "app_nos array is required"}), 400

    # Clean + deduplicate
    app_nos = list(dict.fromkeys(str(n).strip() for n in app_nos if str(n).strip()))

    if len(app_nos) > 200:
        return jsonify({"error": "Max 200 application numbers per request"}), 400

    job_id = _make_job()

    def run():
        cb = lambda msg, pct: _update_job(job_id, msg, pct)
        try:
            from scrapers.ipindia_bulk import fetch_eregister_single
            from database import get_by_appno, upsert_trademark

            cb(f"Starting import of {len(app_nos)} applications…", 2)

            success = 0
            failed  = 0
            skipped = 0
            results = []

            for idx, app_no in enumerate(app_nos):
                pct = 5 + int((idx / len(app_nos)) * 90)

                # Check if already in DB
                existing = get_by_appno(app_no)
                if existing and existing.get("trademark_name") and existing["trademark_name"] != "—":
                    skipped += 1
                    results.append({
                        "app_no": app_no,
                        "status": "skipped",
                        "trademark_name": existing.get("trademark_name"),
                        "tm_status": existing.get("status"),
                    })
                    cb(f"[{idx+1}/{len(app_nos)}] {app_no} — already in DB, skipping", pct)
                    continue

                cb(f"[{idx+1}/{len(app_nos)}] Fetching {app_no} from IP India…", pct)

                try:
                    data = fetch_eregister_single(app_no)

                    # Tag with tma_code if provided
                    if tma_code and not data.get("tma_code"):
                        data["tma_code"] = tma_code
                        upsert_trademark(data)

                    if data.get("trademark_name") and data["trademark_name"] not in ("—", ""):
                        success += 1
                        results.append({
                            "app_no":         app_no,
                            "status":         "imported",
                            "trademark_name": data.get("trademark_name"),
                            "tm_status":      data.get("status"),
                            "applicant":      data.get("applicant"),
                            "agent":          data.get("agent"),
                            "tm_class":       data.get("tm_class"),
                            "filing_date":    data.get("filing_date"),
                        })
                        cb(f"[{idx+1}/{len(app_nos)}] ✅ {app_no} — {data.get('trademark_name','?')}", pct)
                    else:
                        failed += 1
                        results.append({"app_no": app_no, "status": "no_data"})
                        cb(f"[{idx+1}/{len(app_nos)}] ⚠ {app_no} — no data returned", pct)

                except Exception as e:
                    failed += 1
                    results.append({"app_no": app_no, "status": "error", "error": str(e)})
                    cb(f"[{idx+1}/{len(app_nos)}] ❌ {app_no} — {e}", pct)

                # Polite delay between requests
                if idx < len(app_nos) - 1:
                    time.sleep(0.8)

            cb(f"✅ Import complete: {success} imported, {skipped} skipped, {failed} failed", 100)

            _jobs[job_id]["result"] = {
                "total":    len(app_nos),
                "imported": success,
                "skipped":  skipped,
                "failed":   failed,
                "records":  results,
            }
            _jobs[job_id]["status"] = "done"

        except Exception as e:
            log.error(f"App import error: {e}")
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify({
        "job_id":  job_id,
        "status":  "started",
        "total":   len(app_nos),
        "message": f"Importing {len(app_nos)} application(s) from IP India eRegister",
        "poll_url": f"/api/import/status/{job_id}",
    })


# ── Endpoint 3: Import Portfolio (TMA + extra app numbers) ────────────────────

@bp_import.route("/import/portfolio", methods=["POST"])
def import_portfolio():
    """
    POST /api/import/portfolio
    Body: {
        "tma_code":   "manthan15",
        "agent_name": "MANTHAN DESAI",
        "extra_app_nos": ["4182961", "6001234"]   (optional extra apps to include)
    }

    Runs TMA import + any extra application numbers together in one job.
    Best way to build your complete portfolio.
    """
    body         = request.get_json(silent=True) or {}
    tma_code     = body.get("tma_code",     "").strip()
    agent_name   = body.get("agent_name",   "").strip()
    extra_app_nos = [str(n).strip() for n in body.get("extra_app_nos", []) if str(n).strip()]

    if not tma_code and not extra_app_nos:
        return jsonify({"error": "tma_code or extra_app_nos required"}), 400

    job_id = _make_job()

    def run():
        cb = lambda msg, pct: _update_job(job_id, msg, pct)
        tma_count   = 0
        extra_count = 0

        try:
            # Step 1: Import by TMA code
            if tma_code:
                cb(f"Importing TMA portfolio for {tma_code}…", 5)
                from database import register_attorney
                register_attorney(tma_code, agent_name)

                from scrapers.ipindia_bulk import sync_attorney_portfolio
                result = sync_attorney_portfolio(
                    tma_code=tma_code,
                    agent_name=agent_name,
                    progress_cb=lambda m, p: cb(m, int(p * 0.7)),  # scale to 70%
                )
                tma_count = len(result.get("applications", []))
                cb(f"TMA import done: {tma_count} apps", 70)

            # Step 2: Import extra app numbers
            if extra_app_nos:
                cb(f"Importing {len(extra_app_nos)} extra application(s)…", 72)
                from scrapers.ipindia_bulk import fetch_eregister_single
                from database import upsert_trademark

                for idx, app_no in enumerate(extra_app_nos):
                    pct = 72 + int((idx / len(extra_app_nos)) * 25)
                    cb(f"Fetching {app_no}…", pct)
                    try:
                        data = fetch_eregister_single(app_no)
                        if tma_code and not data.get("tma_code"):
                            data["tma_code"] = tma_code
                            upsert_trademark(data)
                        if data.get("trademark_name"):
                            extra_count += 1
                    except Exception as e:
                        log.warning(f"Extra app {app_no} failed: {e}")
                    if idx < len(extra_app_nos) - 1:
                        time.sleep(0.8)

            # Final count from DB
            from database import get_attorney_portfolio
            all_apps = get_attorney_portfolio(tma_code=tma_code, agent_name=agent_name)

            cb(f"✅ Complete — {len(all_apps)} total applications in database", 100)

            _jobs[job_id]["result"] = {
                "tma_imported":   tma_count,
                "extra_imported": extra_count,
                "total_in_db":    len(all_apps),
                "tma_code":       tma_code,
                "agent_name":     agent_name,
            }
            _jobs[job_id]["status"] = "done"

        except Exception as e:
            log.error(f"Portfolio import error: {e}")
            _jobs[job_id]["error"]  = str(e)
            _jobs[job_id]["status"] = "error"

    threading.Thread(target=run, daemon=True).start()
    return jsonify({
        "job_id":  job_id,
        "status":  "started",
        "message": f"Importing portfolio for {tma_code or 'manual apps'}",
        "poll_url": f"/api/import/status/{job_id}",
    })


# ── Endpoint 4: Poll Job Status ───────────────────────────────────────────────

@bp_import.route("/import/status/<job_id>")
def import_status(job_id):
    """
    GET /api/import/status/<job_id>
    Returns current status, progress percentage, and result when done.
    """
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found or expired"}), 404

    resp = {
        "job_id":     job["job_id"],
        "status":     job["status"],
        "progress":   job["progress"],
        "message":    job["message"],
        "started_at": job["started_at"],
    }

    if job["status"] == "done":
        resp["result"] = job["result"]
        resp["finished_at"] = _now()
        # Keep in memory for 5 minutes then auto-expire
    elif job["status"] == "error":
        resp["error"] = job["error"]

    return jsonify(resp)


# ── Endpoint 5: Import History ────────────────────────────────────────────────

@bp_import.route("/import/history")
def import_history():
    """
    GET /api/import/history
    Returns all past import jobs from the sync log.
    """
    try:
        from database import get_conn
        with get_conn() as conn:
            rows = conn.execute("""
                SELECT * FROM sync_log
                ORDER BY finished_at DESC
                LIMIT 50
            """).fetchall()
        return jsonify({
            "history": [dict(r) for r in rows],
            "total":   len(rows),
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 502


# ── Endpoint 6: DB Stats ──────────────────────────────────────────────────────

@bp_import.route("/import/db-stats")
def db_stats():
    """
    GET /api/import/db-stats
    Shows how many trademarks are in your local database.
    """
    try:
        from database import get_db_stats
        return jsonify(get_db_stats())
    except Exception as e:
        return jsonify({"error": str(e)}), 502


# ── Endpoint 7: Clear / Re-import ────────────────────────────────────────────

@bp_import.route("/import/clear-appno/<app_no>", methods=["DELETE"])
def clear_appno(app_no):
    """
    DELETE /api/import/clear-appno/4182961
    Removes one application from local DB so it gets re-fetched next import.
    """
    try:
        from database import get_conn
        with get_conn() as conn:
            conn.execute("DELETE FROM trademarks WHERE app_no = ?", (str(app_no),))
        return jsonify({"deleted": app_no, "message": "Removed from DB — re-import to refresh"})
    except Exception as e:
        return jsonify({"error": str(e)}), 502


# ── Helper ─────────────────────────────────────────────────────────────────────

def _update_job(job_id, msg, pct):
    if job_id in _jobs:
        _jobs[job_id]["message"]  = msg
        _jobs[job_id]["progress"] = int(pct)
        log.debug(f"[{job_id}] {pct}% — {msg}")
