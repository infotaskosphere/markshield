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


# =============================================================================
# FULL PORTFOLIO FETCH BY AGENT/TMA CODE
# Uses Oracle APEX new search + TLA Queue to get ALL applications
# =============================================================================

def fetch_portfolio_by_agent(tma_code: str, agent_name: str = "", progress_cb=None) -> dict:
    """
    Fetch ALL trademark applications for an attorney using Playwright.

    Strategy:
    1. Open Oracle APEX new search → search by agent name → intercept JSON
    2. Open TLA Queue → get all pending matters
    3. Merge, deduplicate, enrich with individual app details
    """
    if progress_cb: progress_cb("Starting Playwright portfolio fetch…", 5)

    all_apps = {}

    # ── Step 1: TLA Queue (always works, no CAPTCHA) ─────────────────────────
    try:
        import requests, urllib3
        urllib3.disable_warnings()
        TLA_URL = "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx"
        from bs4 import BeautifulSoup

        s = requests.Session()
        s.headers.update({"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0"})

        if progress_cb: progress_cb("Fetching TLA Queue list…", 10)
        resp = s.get(TLA_URL, params={"UserName": tma_code}, timeout=40, verify=False)
        soup = BeautifulSoup(resp.text, "lxml")

        table = None
        for tid in ["GridView1", "gvQueue", "ctl00_ContentPlaceHolder1_GridView1"]:
            table = soup.find("table", {"id": tid})
            if table: break
        if not table:
            tables = soup.find_all("table")
            if tables:
                table = max(tables, key=lambda t: len(t.find_all("tr")), default=None)

        if table:
            rows = table.find_all("tr")
            headers = [h.get_text(strip=True).lower() for h in rows[0].find_all(["th","td"])] if rows else []

            def col(hints, cells):
                for hint in hints:
                    for i, h in enumerate(headers):
                        if hint in h and i < len(cells):
                            v = cells[i].get_text(strip=True)
                            if v: return v
                return ""

            for row in rows[1:]:
                tds = row.find_all("td")
                if len(tds) < 2: continue
                app_no = col(["app no","appno","application"], tds) or tds[0].get_text(strip=True)
                if not app_no or not any(c.isdigit() for c in app_no): continue
                all_apps[app_no.strip()] = {
                    "app_no":       app_no.strip(),
                    "tm_name":      col(["trade mark","trademark","mark"], tds),
                    "action_type":  col(["action","notice","type"], tds),
                    "issue_date":   col(["date","issue"], tds),
                    "reply_status": col(["reply","status"], tds),
                    "tm_class":     col(["class"], tds),
                    "office":       col(["office","location"], tds),
                    "source":       "tla_queue",
                }
        log.info(f"TLA Queue: {len(all_apps)} items")
        if progress_cb: progress_cb(f"TLA Queue: {len(all_apps)} matters found", 20)

    except Exception as e:
        log.warning(f"TLA Queue error: {e}")

    # ── Step 2: Playwright → Oracle APEX search by agent name ─────────────────
    if agent_name:
        try:
            from playwright.sync_api import sync_playwright

            if progress_cb: progress_cb(f"Opening IP India new search for agent: {agent_name}…", 25)

            apex_results = []
            captured_json = []

            SEARCH_URLS = [
                "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search/dpiit-public-search",
                "https://tmrsearch.ipindia.gov.in/ESEARCH",
                "https://tmsearch.ipindia.gov.in/ords/r/tisa/trademark_search600/login",
            ]

            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True, args=["--no-sandbox","--disable-setuid-sandbox"])
                context = browser.new_context(
                    user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0 Safari/537.36"
                )
                page = context.new_page()

                def on_response(resp):
                    try:
                        ct = resp.headers.get("content-type","")
                        if "json" in ct:
                            data = resp.json()
                            captured_json.append({"url": resp.url, "data": data})
                    except Exception:
                        pass

                page.on("response", on_response)

                # Try each search URL
                for url in SEARCH_URLS:
                    try:
                        page.goto(url, wait_until="networkidle", timeout=25000)
                        page.wait_for_timeout(2000)

                        # Try to find agent search field
                        filled = False
                        for sel in [
                            'input[placeholder*="agent" i]',
                            'input[placeholder*="attorney" i]',
                            'input[id*="agent" i]',
                            'input[name*="agent" i]',
                            '#P1_AGENT', '#P_AGENT', '#AGENT',
                        ]:
                            inp = page.query_selector(sel)
                            if inp:
                                inp.fill(agent_name)
                                log.info(f"Filled agent field: {sel}")
                                filled = True
                                break

                        if filled:
                            # Click search
                            for btn_sel in ['button[type="submit"]', 'input[type="submit"]',
                                           'button:has-text("Search")', 'a:has-text("Search")']:
                                btn = page.query_selector(btn_sel)
                                if btn:
                                    btn.click()
                                    break
                            else:
                                page.keyboard.press("Enter")

                            page.wait_for_timeout(4000)
                            try:
                                page.wait_for_load_state("networkidle", timeout=12000)
                            except Exception:
                                pass

                            # Extract from captured JSON
                            for item in captured_json:
                                data = item["data"]
                                rows = (data.get("items") or data.get("rows") or
                                        data.get("data") or data.get("results") or [])
                                if isinstance(rows, list):
                                    for row in rows:
                                        if isinstance(row, dict):
                                            app_no = str(row.get("APP_NO") or row.get("application_no") or
                                                        row.get("appno") or row.get("APPLICATION_NO") or "").strip()
                                            if app_no and any(c.isdigit() for c in app_no):
                                                apex_results.append(row)

                            # Also parse page HTML for results
                            html_results = _parse_new_search_html(page.content())
                            apex_results.extend(html_results)

                            if apex_results:
                                log.info(f"Got {len(apex_results)} results from {url}")
                                break

                    except Exception as e:
                        log.warning(f"Search URL {url} failed: {e}")
                        continue

                browser.close()

            # Merge APEX results into all_apps
            for row in apex_results:
                app_no = str(row.get("APP_NO") or row.get("application_no") or
                            row.get("appno") or row.get("APPLICATION_NO") or
                            row.get("app no") or "").strip()
                if not app_no: continue

                if app_no not in all_apps:
                    all_apps[app_no] = {"app_no": app_no}

                # Map fields
                for src_key, dst_key in [
                    ("TM_NAME","tm_name"),("trademark_name","tm_name"),("TRADEMARK_NAME","tm_name"),
                    ("STATUS","status"),("APPLICATION_STATUS","status"),("status","status"),
                    ("CLASS","tm_class"),("TM_CLASS","tm_class"),("class","tm_class"),
                    ("APPLICANT","applicant"),("PROPRIETOR","applicant"),("applicant","applicant"),
                    ("AGENT","agent"),("agent_name","agent"),
                    ("FILING_DATE","filing_date"),("DATE_OF_APPLICATION","filing_date"),
                    ("VALID_UPTO","valid_upto"),
                    ("HEARING_DATE","hearing_date"),
                ]:
                    val = row.get(src_key)
                    if val and dst_key not in all_apps[app_no]:
                        all_apps[app_no][dst_key] = str(val).strip()

                all_apps[app_no]["source"] = "apex_search"

            if progress_cb: progress_cb(f"APEX search: {len(apex_results)} applications found", 50)

        except ImportError:
            log.warning("Playwright not installed — APEX search skipped")
            if progress_cb: progress_cb("Playwright not available — using TLA Queue only", 50)
        except Exception as e:
            log.error(f"Playwright portfolio error: {e}")
            if progress_cb: progress_cb(f"APEX search error: {e}", 50)

    # ── Step 3: Enrich top apps with Playwright e-Register fetch ─────────────
    app_list = list(all_apps.keys())
    total = len(app_list)

    if progress_cb: progress_cb(f"Found {total} apps — enriching with e-Register data…", 55)

    # Fetch details for apps missing status (cap at 30 to avoid timeout)
    need_detail = [n for n in app_list if not all_apps[n].get("status")][:30]

    for idx, app_no in enumerate(need_detail):
        try:
            detail = fetch_application_playwright(app_no)
            if detail:
                for k, v in detail.items():
                    if v and k != "app_no" and k not in all_apps[app_no]:
                        all_apps[app_no][k] = v
        except Exception as e:
            log.warning(f"Detail fetch failed for {app_no}: {e}")

        pct = 55 + int((idx + 1) / max(len(need_detail), 1) * 35)
        if progress_cb and idx % 5 == 0:
            progress_cb(f"Enriching {idx+1}/{len(need_detail)}: {app_no}…", pct)

    if progress_cb: progress_cb("Building final portfolio…", 93)

    # ── Build final list ──────────────────────────────────────────────────────
    def classify(status):
        s = (status or "").lower()
        if "register" in s:  return "registered"
        if "object" in s:    return "objected"
        if "oppos" in s:     return "opposed"
        if "refus" in s:     return "refused"
        if "accept" in s:    return "accepted"
        if "advertis" in s:  return "advertised"
        if "examin" in s:    return "under_examination"
        if "hearing" in s:   return "hearing_scheduled"
        if "abandon" in s:   return "abandoned"
        return "pending"

    applications = []
    for app_no, d in all_apps.items():
        raw_status = d.get("status","")
        applications.append({
            "app_no":       app_no,
            "tm_name":      d.get("tm_name") or d.get("trademark_name") or "—",
            "tm_class":     d.get("tm_class") or "—",
            "applicant":    d.get("applicant") or d.get("proprietor") or "—",
            "status":       raw_status or "Pending",
            "status_class": classify(raw_status),
            "filing_date":  d.get("filing_date") or "—",
            "valid_upto":   d.get("valid_upto") or "—",
            "hearing_date": d.get("hearing_date") or "—",
            "action_type":  d.get("action_type") or "—",
            "reply_status": d.get("reply_status") or "—",
            "office":       d.get("office") or "—",
            "sources":      [d.get("source","")],
            "view_url":     f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}",
        })

    # Sort: hearings first
    applications.sort(key=lambda a: (
        0 if a["hearing_date"] not in ("—","") else 1,
        ["registered","accepted","hearing_scheduled","objected","opposed",
         "under_examination","pending","refused","abandoned"].index(a["status_class"])
        if a["status_class"] in ["registered","accepted","hearing_scheduled","objected","opposed",
                                  "under_examination","pending","refused","abandoned"] else 99
    ))

    summary = {
        "total":             len(applications),
        "registered":        sum(1 for a in applications if a["status_class"]=="registered"),
        "pending":           sum(1 for a in applications if a["status_class"] in ("pending","under_examination")),
        "objected":          sum(1 for a in applications if a["status_class"]=="objected"),
        "opposed":           sum(1 for a in applications if a["status_class"]=="opposed"),
        "hearings_upcoming": sum(1 for a in applications if a["hearing_date"] not in ("—","")),
        "accepted":          sum(1 for a in applications if a["status_class"] in ("accepted","advertised")),
        "refused":           sum(1 for a in applications if a["status_class"] in ("refused","abandoned")),
    }

    if progress_cb: progress_cb(f"✅ Complete — {len(applications)} applications", 100)

    return {
        "tma_code":     tma_code,
        "agent_name":   agent_name,
        "applications": applications,
        "summary":      summary,
        "fetched_at":   __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "sources":      ["TLA Queue (ipindiaonline.gov.in)", "Oracle APEX Search (tmsearch.ipindia.gov.in)", "e-Register (Playwright)"],
    }
