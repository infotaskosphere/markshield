"""
scrapers/binbash_api.py — BinBash.ai / MarkSimpl Indian Trademark API
======================================================================
This is the CORRECT way to fetch Indian trademark data — the same API
that powers Entermark.ai, QuickCompany, and all major Indian TM platforms.

API: https://api.binbash.ai/api/v2/trademarks/
Docs: https://binbash.readme.io/
Sign up: https://marksimpl.com (get API key)

ENDPOINTS:
  GET /api/v2/trademarks/           - search trademarks
  GET /api/v2/trademarks/<id>/      - single trademark by application number
  GET /api/v3/trademarks/           - newer V3 search (more features)

SEARCH PARAMETERS (all optional):
  word_mark         - trademark name (e.g. "APPLE")
  application_number - exact app number (e.g. 4182961)
  proprietor_name   - owner/company name
  attorney_name     - attorney/agent name (e.g. "MANTHAN DESAI")
  class_number      - Nice class (1-45)
  status            - "Registered", "Objected", "Refused" etc.
  match_type        - "SMART" | "EXACT" | "CONTAINS" | "STARTS_WITH"
  limit             - results per page (max 100)
  offset            - pagination offset

RESPONSE FIELDS per trademark:
  application_number, word_mark, class_number, status, application_date,
  proprietor_name, proprietor_address, state, attorney_name, attorney_address,
  image, alert, expire_at, publication_details, certificate_detail,
  user_detail, tm_type, filing_mode, tm_category, appropriate_office, slug

COST: ~₹0.001 per request (very cheap)
"""

import os, logging, requests
from typing import Optional, List, Dict, Any
from datetime import datetime

log = logging.getLogger("markshield.binbash")

BINBASH_BASE    = "https://api.binbash.ai/api/v2/trademarks"
BINBASH_V3_BASE = "https://api.binbash.ai/api/v3/trademarks"


def _get_api_key() -> str:
    key = os.getenv("BINBASH_API_KEY", "")
    if not key:
        raise ValueError(
            "BINBASH_API_KEY not set. "
            "Sign up at https://marksimpl.com to get your API key, "
            "then add it as BINBASH_API_KEY in your Render environment variables."
        )
    return key


def _headers() -> dict:
    return {
        "Authorization": f"Api-Key {_get_api_key()}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


# ── Core search function ──────────────────────────────────────────────────────

def search_trademarks(
    word_mark: str = "",
    application_number: str = "",
    proprietor_name: str = "",
    attorney_name: str = "",
    class_number: str = "",
    status: str = "",
    match_type: str = "SMART",
    limit: int = 100,
    offset: int = 0,
) -> dict:
    """
    Search Indian trademarks via BinBash API.
    Returns full structured JSON with all fields.
    """
    params = {}
    if word_mark:          params["word_mark"]          = word_mark
    if application_number: params["application_number"] = application_number
    if proprietor_name:    params["proprietor_name"]    = proprietor_name
    if attorney_name:      params["attorney_name"]      = attorney_name
    if class_number:       params["class_number"]       = class_number
    if status:             params["status"]             = status
    if match_type:         params["match_type"]         = match_type
    params["limit"]  = limit
    params["offset"] = offset

    try:
        resp = requests.get(
            BINBASH_BASE + "/",
            headers=_headers(),
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        data = resp.json()
        log.info(f"BinBash search: {len(data.get('results', []))} results (total={data.get('count', '?')})")
        return data

    except requests.exceptions.HTTPError as e:
        if e.response.status_code == 401:
            raise ValueError("Invalid BINBASH_API_KEY. Check your API key at marksimpl.com")
        if e.response.status_code == 429:
            raise ValueError("BinBash API rate limit exceeded. Upgrade your plan at marksimpl.com")
        raise
    except Exception as e:
        log.error(f"BinBash search error: {e}")
        raise


# ── Get single application by number ─────────────────────────────────────────

def get_trademark_by_appno(app_no: str) -> dict:
    """
    Fetch full details for a single trademark application number.
    Returns dict with all fields or raises on error.
    """
    app_no = str(app_no).strip()

    # Try direct detail endpoint first
    try:
        resp = requests.get(
            f"{BINBASH_BASE}/{app_no}/",
            headers=_headers(),
            timeout=30,
        )
        if resp.status_code == 200:
            data = resp.json()
            log.info(f"BinBash direct fetch: {app_no} → {data.get('status', '?')}")
            return _normalize(data)
        # Fall through to search if 404
    except Exception as e:
        log.warning(f"Direct fetch failed for {app_no}: {e}")

    # Fallback: search by application_number
    data = search_trademarks(application_number=app_no, limit=1)
    results = data.get("results", [])
    if results:
        return _normalize(results[0])

    return {
        "app_no": app_no,
        "error": f"Application {app_no} not found in BinBash database",
    }


# ── Get ALL applications for an attorney ─────────────────────────────────────

def get_attorney_portfolio(
    attorney_name: str,
    fetch_all_pages: bool = True,
    max_results: int = 1000,
    progress_cb=None,
) -> dict:
    """
    Fetch ALL trademark applications for an attorney by name.
    Handles pagination automatically to get complete portfolio.

    Args:
        attorney_name:   Attorney full name (e.g. "MANTHAN DESAI")
        fetch_all_pages: If True, fetches all pages (may take a few seconds)
        max_results:     Cap total results (safety limit)
        progress_cb:     fn(message, percent) for progress updates

    Returns:
        {
          "applications": [...full list...],
          "summary": {total, registered, objected, ...},
          "attorney_name": "...",
          "fetched_at": "..."
        }
    """
    if progress_cb: progress_cb(f"Searching BinBash API for attorney: {attorney_name}…", 10)

    all_results = []
    offset = 0
    page_size = 100
    total_count = None

    while True:
        data = search_trademarks(
            attorney_name=attorney_name,
            match_type="CONTAINS",
            limit=page_size,
            offset=offset,
        )

        results = data.get("results", [])
        if total_count is None:
            total_count = data.get("count", 0)
            if progress_cb: progress_cb(f"Found {total_count} applications — fetching all…", 20)

        all_results.extend(results)

        pct = min(20 + int(len(all_results) / max(total_count, 1) * 70), 90)
        if progress_cb: progress_cb(f"Fetched {len(all_results)}/{total_count} applications…", pct)

        # Stop conditions
        if not results: break
        if len(results) < page_size: break
        if len(all_results) >= max_results: break
        if not fetch_all_pages: break
        if not data.get("next"): break

        offset += page_size

    # Normalize all results
    applications = [_normalize(r) for r in all_results]

    # Sort: hearings first, then by status
    STATUS_ORDER = ["Registered", "Accepted", "Advertised", "Objected", "Opposed",
                    "Under Examination", "Formalities Check Fail", "Abandoned", "Refused", "Withdrawn"]
    applications.sort(key=lambda a: (
        0 if a.get("hearing_date") else 1,
        STATUS_ORDER.index(a["status"]) if a["status"] in STATUS_ORDER else 99
    ))

    summary = _build_summary(applications)

    if progress_cb: progress_cb(f"✅ Portfolio complete — {len(applications)} applications", 100)

    return {
        "attorney_name": attorney_name,
        "applications":  applications,
        "summary":       summary,
        "total":         len(applications),
        "fetched_at":    _now(),
        "source":        "BinBash.ai / MarkSimpl Indian Trademark API",
    }


# ── Search by proprietor (for TM Watch / conflict check) ─────────────────────

def get_proprietor_trademarks(proprietor_name: str, max_results: int = 500) -> dict:
    """Fetch all trademarks owned by a proprietor/company."""
    all_results = []
    offset = 0

    while len(all_results) < max_results:
        data = search_trademarks(
            proprietor_name=proprietor_name,
            match_type="CONTAINS",
            limit=100,
            offset=offset,
        )
        results = data.get("results", [])
        all_results.extend(results)
        if len(results) < 100: break
        if not data.get("next"): break
        offset += 100

    return {
        "proprietor_name": proprietor_name,
        "applications":    [_normalize(r) for r in all_results],
        "total":           len(all_results),
        "fetched_at":      _now(),
    }


# ── Public search (word mark search) ─────────────────────────────────────────

def public_search(
    word_mark: str,
    class_number: str = "",
    status: str = "",
    match_type: str = "SMART",
    limit: int = 50,
) -> dict:
    """
    Search trademarks by word mark (brand name).
    Used in Smart Search page.
    """
    data = search_trademarks(
        word_mark=word_mark,
        class_number=class_number,
        status=status,
        match_type=match_type,
        limit=limit,
    )
    return {
        "results":    [_normalize(r) for r in data.get("results", [])],
        "total":      data.get("count", 0),
        "query":      word_mark,
        "class":      class_number,
        "groups":     data.get("groups", {}),
        "fetched_at": _now(),
    }


# ── Bulk fetch by application numbers ────────────────────────────────────────

def bulk_fetch_by_appnos(app_nos: List[str]) -> List[dict]:
    """Fetch multiple applications by their numbers."""
    results = []
    for app_no in app_nos:
        try:
            results.append(get_trademark_by_appno(app_no))
        except Exception as e:
            results.append({"app_no": app_no, "error": str(e)})
    return results


# ── Normalise API response to MarkShield standard format ─────────────────────

def _normalize(item: dict) -> dict:
    """Convert BinBash API response fields to MarkShield's internal format."""
    status = item.get("status", "") or ""

    return {
        # Core IDs
        "app_no":           str(item.get("application_number") or item.get("app_no") or ""),
        "slug":             item.get("slug", ""),

        # Trademark details
        "trademark_name":   item.get("word_mark", "") or "—",
        "tm_class":         str(item.get("class_number", "")) or "—",
        "class_detail":     item.get("class_detail", "") or "—",
        "mark_type":        item.get("tm_type", "") or "—",
        "tm_category":      item.get("tm_category", "") or "—",

        # People
        "applicant":        item.get("proprietor_name", "") or "—",
        "applicant_address":item.get("proprietor_address", "") or "—",
        "agent":            item.get("attorney_name", "") or "—",
        "agent_address":    item.get("attorney_address", "") or "—",
        "state":            item.get("state", "") or "—",
        "office":           item.get("appropriate_office", "") or "—",

        # Status
        "status":           status or "—",
        "status_class":     _classify(status),
        "alert":            item.get("alert", "") or "",

        # Dates
        "filing_date":      item.get("application_date", "") or "—",
        "valid_upto":       item.get("expire_at", "") or "—",
        "registration_date":item.get("registration_date", "") or "—",
        "hearing_date":     item.get("next_hearing_date", "") or "",
        "user_since":       item.get("user_detail", "") or "—",

        # Documents
        "certificate_no":   item.get("certificate_detail", "") or "—",
        "publication":      item.get("publication_details", "") or "—",
        "image_url":        item.get("image", "") or "",
        "filing_mode":      item.get("filing_mode", "") or "—",

        # Links
        "view_url": (
            f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx"
            f"?AppNosValue={item.get('application_number', '')}"
        ),
        "binbash_url": (
            f"https://binbash.ai/trademarks/{item.get('slug', '')}"
            if item.get("slug") else ""
        ),
    }


def _classify(status: str) -> str:
    """Classify raw status string into a consistent category."""
    s = (status or "").lower()
    if "registered" in s:   return "registered"
    if "objected" in s:     return "objected"
    if "opposed" in s:      return "opposed"
    if "refused" in s:      return "refused"
    if "accepted" in s:     return "accepted"
    if "advertised" in s:   return "advertised"
    if "examination" in s:  return "under_examination"
    if "formalities" in s:  return "formalities_check"
    if "abandoned" in s:    return "abandoned"
    if "withdrawn" in s:    return "withdrawn"
    if "hearing" in s:      return "hearing_scheduled"
    return "pending"


def _build_summary(applications: List[dict]) -> dict:
    return {
        "total":             len(applications),
        "registered":        sum(1 for a in applications if a["status_class"] == "registered"),
        "objected":          sum(1 for a in applications if a["status_class"] == "objected"),
        "opposed":           sum(1 for a in applications if a["status_class"] == "opposed"),
        "refused":           sum(1 for a in applications if a["status_class"] in ("refused","abandoned","withdrawn")),
        "accepted":          sum(1 for a in applications if a["status_class"] in ("accepted","advertised")),
        "pending":           sum(1 for a in applications if a["status_class"] in ("pending","under_examination","formalities_check")),
        "hearings_upcoming": sum(1 for a in applications if a.get("hearing_date")),
        "with_alert":        sum(1 for a in applications if a.get("alert")),
        "classes":           sorted(set(a["tm_class"] for a in applications if a["tm_class"] != "—")),
    }
