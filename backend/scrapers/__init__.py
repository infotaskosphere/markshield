# scrapers/__init__.py — MarkShield Scraper Package
# Core imports (always available — these work without any API key)
from .ipindia import (
    fetch_cause_list,
    fetch_public_search,
    fetch_tla_queue,
    get_efiling,
)

# Application fetch — uses eregister (Playwright + requests fallback)
try:
    from .eregister import fetch_application, fetch_applications_bulk
except ImportError:
    # fallback to ipindia if eregister not present
    from .ipindia import fetch_application, fetch_applications_bulk  # type: ignore

# Bulk portfolio sync — uses ipindia_bulk
try:
    from .ipindia_bulk import (
        sync_attorney_portfolio,
        fetch_eregister_single,
        fetch_tla_queue_full,
        fetch_causelist_full,
    )
except ImportError:
    pass

__all__ = [
    "fetch_cause_list",
    "fetch_application",
    "fetch_applications_bulk",
    "fetch_public_search",
    "fetch_tla_queue",
    "get_efiling",
    "sync_attorney_portfolio",
    "fetch_eregister_single",
]
