# scrapers/__init__.py — MarkShield Scraper Package
# Core imports (always available)
from .ipindia import (
    fetch_cause_list,
    fetch_public_search,
    fetch_tla_queue,
    get_efiling,
)

# Optional imports — won't crash if new files not deployed yet
try:
    from .eregister import fetch_application, fetch_applications_bulk
except ImportError:
    from .ipindia import fetch_application, fetch_applications_bulk

try:
    from .attorney_portfolio import fetch_attorney_portfolio
except ImportError:
    def fetch_attorney_portfolio(*a, **kw):
        return {"error": "attorney_portfolio module not available", "applications": []}

__all__ = [
    "fetch_cause_list",
    "fetch_application",
    "fetch_applications_bulk",
    "fetch_public_search",
    "fetch_tla_queue",
    "get_efiling",
    "fetch_attorney_portfolio",
]
