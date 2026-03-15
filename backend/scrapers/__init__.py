# scrapers/__init__.py  ─  all imports from our own IP India scraper
from .ipindia import fetch_cause_list, fetch_public_search, fetch_tla_queue, get_efiling

try:
    from .ipindia_scraper import (
        fetch_application,
        fetch_applications_bulk,
        sync_full_portfolio      as sync_attorney_portfolio,
        fetch_tla_queue_full,
        fetch_causelist,
        fetch_causelist          as fetch_causelist_full,
        _apex_search,
    )
    fetch_eregister_single = fetch_application
except ImportError as e:
    import logging
    logging.getLogger("markshield").warning(f"ipindia_scraper import failed: {e}")

__all__ = [
    "fetch_cause_list", "fetch_application", "fetch_applications_bulk",
    "fetch_public_search", "fetch_tla_queue", "get_efiling",
    "sync_attorney_portfolio", "fetch_eregister_single",
]
