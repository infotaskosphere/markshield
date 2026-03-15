# scrapers/__init__.py
from .ipindia import fetch_cause_list, fetch_public_search, fetch_tla_queue, get_efiling

try:
    from .binbash_api import (
        get_trademark_by_appno  as fetch_application,
        bulk_fetch_by_appnos    as fetch_applications_bulk,
        public_search,
        get_attorney_portfolio,
        get_proprietor_trademarks,
    )
except Exception:
    from .ipindia import fetch_application, fetch_applications_bulk  # type: ignore

try:
    from .eregister import fetch_application as _er_fetch  # fallback only
except Exception:
    pass

__all__ = [
    "fetch_cause_list", "fetch_application", "fetch_applications_bulk",
    "fetch_public_search", "fetch_tla_queue", "get_efiling",
    "get_attorney_portfolio", "get_proprietor_trademarks", "public_search",
]
