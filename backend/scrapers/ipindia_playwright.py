"""
scrapers/playwright_scraper.py — Playwright-based IP India Scraper
===================================================================
Uses Playwright to:
1. Open the new Oracle APEX search (tmsearch.ipindia.gov.in/ords/r/tisa/)
2. Intercept the AJAX/REST API calls it makes to get JSON data
3. Return clean structured data without CAPTCHA

This is how Entermark and similar platforms work — they use a headless browser
to drive the JS-rendered pages and capture the underlying REST API responses.

Also handles the old estatus page via OTP (when attorney's email/phone available).
"""

import json, logging, time, asyncio
from typing import Optional, List, Dict, Any

log = logging.getLogger("markshield.playwright")

# ── New Oracle APEX Search URL ───────────────────────────────────────────────
NEW_SEARCH_URL  = "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search/dpiit-public-search"
NEW_SEARCH_URL2 = "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search1000/dpiit-public-search"
ESEARCH_URL     = "https://tmrsearch.ipindia.gov.in/ESEARCH"


def search_trademark_by_name(query: str, tm_class: str = "", max_results: int = 100) -> dict:
    """
    Search trademarks by name using the new Oracle APEX search.
    Intercepts the REST API calls to get JSON data directly.
    """
    try:
        from playwright.sync_api import sync_playwright

        results = []
        api_data = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            # Intercept AJAX API calls made by Oracle APEX
            def handle_response(response):
                url = response.url
                if "ords" in url and ("trademark" in url.lower() or "search" in url.lower()):
                    try:
                        if response.headers.get("content-type", "").startswith("application/json"):
                            data = response.json()
                            api_data.append({"url": url, "data": data})
                            log.info(f"Captured API response from: {url[:80]}")
                    except Exception:
                        pass

            page.on("response", handle_response)

            # Navigate to new search
            log.info(f"Opening new IP India search for: {query}")
            page.goto(NEW_SEARCH_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(2000)

            # Try to find and fill the search input
            try:
                # Oracle APEX search inputs
                selectors = [
                    'input[placeholder*="search" i]',
                    'input[placeholder*="trademark" i]',
                    'input[type="search"]',
                    'input[type="text"]',
                    '#P1_SEARCH',
                    '#SEARCH',
                ]
                for sel in selectors:
                    inp = page.query_selector(sel)
                    if inp:
                        inp.fill(query)
                        log.info(f"Filled search input: {sel}")
                        break

                # Click search button
                for btn_sel in ['button[type="submit"]', 'button:has-text("Search")', 'input[type="submit"]']:
                    btn = page.query_selector(btn_sel)
                    if btn:
                        btn.click()
                        break

                page.wait_for_timeout(3000)
                page.wait_for_load_state("networkidle", timeout=15000)

            except Exception as e:
                log.warning(f"Search input interaction failed: {e}")

            # Extract any captured API data
            for item in api_data:
                data = item["data"]
                if isinstance(data, dict):
                    # Oracle APEX returns data in various formats
                    rows = (data.get("items") or data.get("rows") or
                            data.get("data") or data.get("results") or [])
                    if rows:
                        results.extend(rows)

            # If no API data captured, try parsing the page HTML
            if not results:
                html = page.content()
                results = _parse_new_search_html(html)

            browser.close()

        return {
            "results": results,
            "total":   len(results),
            "query":   query,
            "source":  "new_apex_search",
        }

    except ImportError:
        log.error("Playwright not installed. Run: playwright install chromium")
        return {"error": "Playwright not available", "results": [], "total": 0}
    except Exception as e:
        log.error(f"Playwright search error: {e}")
        return {"error": str(e), "results": [], "total": 0}


def fetch_application_playwright(app_no: str) -> dict:
    """
    Fetch individual application details using Playwright.
    Opens the new APEX search, searches by application number,
    and captures the JSON API response.
    """
    try:
        from playwright.sync_api import sync_playwright

        captured = []

        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context()
            page = context.new_page()

            def on_response(resp):
                try:
                    url = resp.url
                    ct = resp.headers.get("content-type", "")
                    if "json" in ct and any(k in url for k in ["ords", "trademark", "estatus", "search"]):
                        data = resp.json()
                        captured.append({"url": url, "data": data})
                except Exception:
                    pass

            page.on("response", on_response)

            # Try ESEARCH first (newer system)
            log.info(f"Playwright fetch for app: {app_no}")
            page.goto(ESEARCH_URL, wait_until="networkidle", timeout=30000)
            page.wait_for_timeout(1500)

            # Look for application number input
            for sel in ['input[name*="appno" i]', 'input[placeholder*="application" i]',
                        'input[type="text"]', '#app_no', '#txtAppNo']:
                inp = page.query_selector(sel)
                if inp:
                    inp.fill(app_no)
                    break

            # Submit
            for sel in ['button[type="submit"]', 'input[type="submit"]', 'button:has-text("Search")']:
                btn = page.query_selector(sel)
                if btn:
                    btn.click()
                    break
            else:
                page.keyboard.press("Enter")

            page.wait_for_timeout(4000)
            try:
                page.wait_for_load_state("networkidle", timeout=10000)
            except Exception:
                pass

            # Parse captured API responses
            for item in captured:
                data = item["data"]
                parsed = _extract_app_fields(data, app_no)
                if parsed.get("trademark_name") or parsed.get("status"):
                    browser.close()
                    return {"app_no": app_no, **parsed,
                            "view_url": f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}"}

            # Fallback: parse the page HTML
            html = page.content()
            browser.close()

            from scrapers.eregister import _parse_page
            result = _parse_page(html, app_no)
            return {
                "app_no": app_no, **result,
                "view_url": f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}"
            }

    except ImportError:
        log.error("Playwright not installed")
        return {"app_no": app_no, "error": "Playwright not available"}
    except Exception as e:
        log.error(f"Playwright app fetch error: {e}")
        return {"app_no": app_no, "error": str(e)}


def _extract_app_fields(data: Any, app_no: str) -> dict:
    """Extract trademark fields from Oracle APEX JSON response."""
    out = {}
    if not data:
        return out

    if isinstance(data, dict):
        # Try common Oracle APEX response structures
        items = (data.get("items") or data.get("rows") or
                 data.get("data") or [data])
        if items:
            for item in items if isinstance(items, list) else [items]:
                if not isinstance(item, dict): continue
                # Map Oracle APEX column names to our fields
                field_map = {
                    "trademark_name": ["trademark_name","tm_name","mark","wordmark","TRADEMARK_NAME","TM_NAME","MARK"],
                    "status":         ["status","application_status","STATUS","APPLICATION_STATUS","tm_status"],
                    "tm_class":       ["class","tm_class","CLASS","TM_CLASS","class_no"],
                    "applicant":      ["applicant","proprietor","APPLICANT","PROPRIETOR","applicant_name"],
                    "agent":          ["agent","attorney","AGENT","agent_name","ATTORNEY"],
                    "filing_date":    ["filing_date","date_of_application","FILING_DATE","DATE_OF_APPLICATION"],
                    "valid_upto":     ["valid_upto","validity","VALID_UPTO"],
                    "hearing_date":   ["hearing_date","next_hearing_date","HEARING_DATE","NEXT_HEARING_DATE"],
                    "goods_services": ["goods_services","description","GOODS_SERVICES","DESCRIPTION","goods_and_services"],
                }
                for field, keys in field_map.items():
                    for k in keys:
                        if k in item and item[k]:
                            out[field] = str(item[k]).strip()
                            break
    return out


def _parse_new_search_html(html: str) -> list:
    """Parse results from the new APEX search HTML."""
    from bs4 import BeautifulSoup
    soup = BeautifulSoup(html, "lxml")
    results = []

    # Oracle APEX renders results in various table/card formats
    for table in soup.find_all("table"):
        rows = table.find_all("tr")
        if len(rows) < 2: continue
        headers = [th.get_text(strip=True).lower() for th in rows[0].find_all(["th","td"])]
        for row in rows[1:]:
            cells = row.find_all("td")
            if not cells: continue
            item = {}
            for i, cell in enumerate(cells):
                if i < len(headers):
                    item[headers[i]] = cell.get_text(strip=True)
            if item:
                results.append(item)

    return results
