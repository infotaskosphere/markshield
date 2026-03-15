"""
sync_scheduler.py — MarkShield Nightly Portfolio Sync
======================================================
Runs background jobs to keep attorney portfolio data fresh.

Jobs:
  1. Nightly portfolio sync    — 2:00 AM — fetch all apps for each saved TMA code
  2. Cause list refresh        — Every 6 hours — update upcoming hearings
  3. Pending replies check     — Every 4 hours — check TLA Queue for deadlines

Storage: JSON files in /tmp/markshield_cache/ (or configure a real DB path)

Usage:
  python sync_scheduler.py              # run scheduler in background
  python sync_scheduler.py --run-now    # run all jobs immediately (for testing)

Render deployment: Add as a background worker service in render.yaml
"""

import os, json, logging, argparse
from datetime import datetime, timedelta
from pathlib import Path

log = logging.getLogger("markshield.scheduler")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

CACHE_DIR = Path(os.getenv("CACHE_DIR", "/tmp/markshield_cache"))
CACHE_DIR.mkdir(parents=True, exist_ok=True)


def _now():
    return datetime.utcnow().isoformat() + "Z"


def _save(key: str, data: dict):
    path = CACHE_DIR / f"{key}.json"
    with open(path, "w") as f:
        json.dump(data, f)
    log.info(f"Saved cache: {path}")


def _load(key: str) -> dict:
    path = CACHE_DIR / f"{key}.json"
    if path.exists():
        with open(path) as f:
            return json.load(f)
    return {}


def _get_all_tma_codes() -> list:
    """
    Read all TMA codes that need syncing.
    In production this would query your user database.
    For now reads from SYNC_TMA_CODES env var (comma-separated)
    or from saved cache files.
    """
    # From environment variable
    env_codes = os.getenv("SYNC_TMA_CODES", "")
    if env_codes:
        return [c.strip() for c in env_codes.split(",") if c.strip()]

    # From existing cache files (any attorney who has done setup)
    codes = []
    for f in CACHE_DIR.glob("portfolio_*.json"):
        data = json.loads(f.read_text())
        code = data.get("tma_code")
        if code:
            codes.append(code)
    return codes


# ── Job 1: Nightly Portfolio Sync ─────────────────────────────────────────────
def job_sync_portfolio():
    """Fetch full portfolio for all registered attorneys."""
    log.info("=== NIGHTLY PORTFOLIO SYNC STARTED ===")

    try:
        from scrapers.playwright_scraper import fetch_portfolio_by_agent
    except ImportError:
        log.error("playwright_scraper not found")
        return

    tma_codes = _get_all_tma_codes()
    if not tma_codes:
        log.info("No TMA codes to sync")
        return

    log.info(f"Syncing {len(tma_codes)} attorney(s): {tma_codes}")

    for tma_code in tma_codes:
        try:
            log.info(f"Syncing portfolio for: {tma_code}")
            existing = _load(f"portfolio_{tma_code}")
            agent_name = existing.get("agent_name", "")

            def progress(msg, pct):
                log.info(f"  [{tma_code}] {pct}% — {msg}")

            result = fetch_portfolio_by_agent(
                tma_code=tma_code,
                agent_name=agent_name,
                progress_cb=progress,
            )
            result["synced_at"] = _now()
            _save(f"portfolio_{tma_code}", result)

            apps = len(result.get("applications", []))
            log.info(f"✅ {tma_code}: {apps} applications synced")

        except Exception as e:
            log.error(f"❌ Portfolio sync failed for {tma_code}: {e}")


# ── Job 2: Cause List Refresh ─────────────────────────────────────────────────
def job_refresh_cause_list():
    """Fetch today + next 7 days cause list for all attorneys."""
    log.info("=== CAUSE LIST REFRESH STARTED ===")

    try:
        from scrapers.ipindia import fetch_cause_list
    except ImportError:
        log.error("ipindia scraper not found")
        return

    tma_codes = _get_all_tma_codes()
    today = datetime.now()

    for tma_code in tma_codes:
        existing = _load(f"portfolio_{tma_code}")
        agent_name = existing.get("agent_name", "")
        if not agent_name:
            continue

        hearings_all = []
        for days_ahead in range(0, 30):
            date = (today + timedelta(days=days_ahead)).strftime("%d/%m/%Y")
            try:
                result = fetch_cause_list(agent_filter=agent_name.upper(), date=date)
                hearings_all.extend(result.get("hearings", []))
            except Exception as e:
                log.warning(f"Cause list error for {date}: {e}")

        _save(f"causelist_{tma_code}", {
            "tma_code": tma_code,
            "agent_name": agent_name,
            "hearings": hearings_all,
            "total": len(hearings_all),
            "synced_at": _now(),
        })
        log.info(f"✅ Cause list for {tma_code}: {len(hearings_all)} hearings")


# ── Job 3: TLA Queue Deadline Check ───────────────────────────────────────────
def job_check_pending_replies():
    """Check TLA Queue for overdue/critical deadlines."""
    log.info("=== PENDING REPLIES CHECK STARTED ===")

    try:
        from scrapers.ipindia import fetch_tla_queue
    except ImportError:
        log.error("ipindia scraper not found")
        return

    tma_codes = _get_all_tma_codes()

    for tma_code in tma_codes:
        try:
            result = fetch_tla_queue(username=tma_code)
            items = result.get("items", [])

            overdue  = [i for i in items if i.get("urgency") == "overdue"]
            critical = [i for i in items if i.get("urgency") == "critical"]

            _save(f"queue_{tma_code}", {
                "tma_code": tma_code,
                "items":    items,
                "total":    len(items),
                "overdue":  len(overdue),
                "critical": len(critical),
                "synced_at": _now(),
            })

            if overdue or critical:
                log.warning(f"⚠️  {tma_code}: {len(overdue)} overdue, {len(critical)} critical deadlines")
            else:
                log.info(f"✅ {tma_code}: {len(items)} items, no critical deadlines")

        except Exception as e:
            log.error(f"Queue check failed for {tma_code}: {e}")


# ── Scheduler Setup ────────────────────────────────────────────────────────────
def run_scheduler():
    """Start APScheduler with all jobs."""
    try:
        from apscheduler.schedulers.blocking import BlockingScheduler
        from apscheduler.triggers.cron import CronTrigger
    except ImportError:
        log.error("APScheduler not installed. Run: pip install apscheduler")
        return

    scheduler = BlockingScheduler(timezone="Asia/Kolkata")

    # Nightly portfolio sync — 2:00 AM IST
    scheduler.add_job(
        job_sync_portfolio,
        CronTrigger(hour=2, minute=0),
        id="portfolio_sync",
        name="Nightly Portfolio Sync",
        misfire_grace_time=3600,
    )

    # Cause list refresh — 8 AM, 2 PM, 8 PM IST
    scheduler.add_job(
        job_refresh_cause_list,
        CronTrigger(hour="8,14,20", minute=0),
        id="cause_list_refresh",
        name="Cause List Refresh",
        misfire_grace_time=1800,
    )

    # Pending replies check — Every 4 hours
    scheduler.add_job(
        job_check_pending_replies,
        CronTrigger(hour="*/4", minute=30),
        id="pending_check",
        name="Pending Replies Check",
        misfire_grace_time=900,
    )

    log.info("Scheduler started with jobs:")
    log.info("  📅 Portfolio sync:    2:00 AM IST daily")
    log.info("  📋 Cause list:        8 AM / 2 PM / 8 PM IST")
    log.info("  ⚠️  Pending replies:   Every 4 hours")

    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("Scheduler stopped")


# ── API endpoint for cache reads ───────────────────────────────────────────────
def get_cached_portfolio(tma_code: str) -> dict:
    """Read cached portfolio — used by Flask routes for instant response."""
    data = _load(f"portfolio_{tma_code}")
    if data:
        data["from_cache"] = True
        data["cache_age_minutes"] = int(
            (datetime.utcnow() - datetime.fromisoformat(
                data.get("synced_at","2000-01-01T00:00:00Z").rstrip("Z")
            )).total_seconds() / 60
        )
    return data


def get_cached_queue(tma_code: str) -> dict:
    return _load(f"queue_{tma_code}")


def get_cached_causelist(tma_code: str) -> dict:
    return _load(f"causelist_{tma_code}")


def register_tma_for_sync(tma_code: str, agent_name: str = ""):
    """Called when a new attorney connects — registers them for nightly sync."""
    existing = _load(f"portfolio_{tma_code}")
    if not existing:
        _save(f"portfolio_{tma_code}", {
            "tma_code":   tma_code,
            "agent_name": agent_name,
            "applications": [],
            "summary":    {},
            "registered_at": _now(),
            "synced_at":  None,
        })
        log.info(f"Registered {tma_code} for nightly sync")

        # Trigger an immediate sync in background thread
        import threading
        def initial_sync():
            try:
                from scrapers.playwright_scraper import fetch_portfolio_by_agent
                result = fetch_portfolio_by_agent(tma_code=tma_code, agent_name=agent_name)
                result["synced_at"] = _now()
                _save(f"portfolio_{tma_code}", result)
                log.info(f"Initial sync complete for {tma_code}: {len(result.get('applications',[]))} apps")
            except Exception as e:
                log.error(f"Initial sync failed for {tma_code}: {e}")

        threading.Thread(target=initial_sync, daemon=True).start()


# ── CLI ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="MarkShield Sync Scheduler")
    parser.add_argument("--run-now", action="store_true", help="Run all jobs immediately")
    parser.add_argument("--portfolio", action="store_true", help="Run portfolio sync only")
    parser.add_argument("--cause-list", action="store_true", help="Run cause list refresh only")
    parser.add_argument("--queue", action="store_true", help="Run queue check only")
    parser.add_argument("--tma", default="", help="TMA code to sync (for testing)")
    args = parser.parse_args()

    if args.tma:
        os.environ["SYNC_TMA_CODES"] = args.tma

    if args.run_now or args.portfolio:
        job_sync_portfolio()
    if args.run_now or args.cause_list:
        job_refresh_cause_list()
    if args.run_now or args.queue:
        job_check_pending_replies()
    if not any([args.run_now, args.portfolio, args.cause_list, args.queue]):
        run_scheduler()
