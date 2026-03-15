"""
scrapers/efiling_session.py — IP India eFiling Login + Data Fetcher
====================================================================
URL: https://ipindiaonline.gov.in/trademarkefiling/

LOGIN PAGE:
  - Username (TMA code e.g. manthan15)
  - Password
  - Image CAPTCHA (alphanumeric, e.g. "A3K9P") — solved by ddddocr
  - POST → session cookie saved

AFTER LOGIN, these pages are accessible:
  1. frmFormFilingHistory.aspx     → ALL applications filed by attorney
  2. DynamicUtilities/TLA_QueueList_new.aspx → pending matters
  3. frmOnlineStatus.aspx          → application status lookup
  4. frmCertificateDetails.aspx    → certificate details

STRATEGY:
  1. GET login page → download captcha image → solve with ddddocr
  2. POST username + password + captcha_text → session cookie
  3. GET frmFormFilingHistory.aspx → parse ALL application numbers
  4. For each app_no → GET eRegister → parse full details
  5. Save everything to local SQLite DB
  6. Session cookie saved permanently — no re-login needed

This is the GOLD source — directly from attorney's own eFiling account.
Returns EVERY application they ever filed.
"""

import re, io, base64, logging, time, json, requests, urllib3
from bs4 import BeautifulSoup
from database import get_conn, upsert_trademark, upsert_many, _classify

urllib3.disable_warnings()
log = logging.getLogger("markshield.efiling_session")

LOGIN_URL   = "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"
CAPTCHA_URL = "https://ipindiaonline.gov.in/trademarkefiling/CaptchaGenerator/captcha.aspx"
HISTORY_URL = "https://ipindiaonline.gov.in/trademarkefiling/online/frmFormFilingHistory.aspx"
STATUS_URL  = "https://ipindiaonline.gov.in/trademarkefiling/online/frmOnlineStatus.aspx"
BASE_URL    = "https://ipindiaonline.gov.in/trademarkefiling"
EREGISTER   = "https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx"

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection":      "keep-alive",
}


# ── DB session storage ────────────────────────────────────────────────────────

def _init_db():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS efiling_sessions (
                id         INTEGER PRIMARY KEY,
                username   TEXT,
                cookies    TEXT,
                created_at TEXT,
                last_used  TEXT
            )
        """)


def save_efiling_session(cookies: dict, username: str):
    _init_db()
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    with get_conn() as conn:
        conn.execute("DELETE FROM efiling_sessions")
        conn.execute(
            "INSERT INTO efiling_sessions (username, cookies, created_at, last_used) VALUES(?,?,?,?)",
            (username, json.dumps(cookies), now, now)
        )
    log.info(f"eFiling session saved for {username}")


def load_efiling_session() -> tuple:
    """Returns (username, cookies_dict) or ('', {})"""
    try:
        _init_db()
        with get_conn() as conn:
            row = conn.execute(
                "SELECT username, cookies FROM efiling_sessions ORDER BY id DESC LIMIT 1"
            ).fetchone()
        if row:
            return row["username"], json.loads(row["cookies"])
    except Exception as e:
        log.warning(f"load_efiling_session: {e}")
    return "", {}


def has_efiling_session() -> bool:
    _, cookies = load_efiling_session()
    return bool(cookies)


def clear_efiling_session():
    try:
        with get_conn() as conn:
            conn.execute("DELETE FROM efiling_sessions")
    except Exception:
        pass


# ── CAPTCHA solver ────────────────────────────────────────────────────────────

def _solve_captcha_image(img_bytes: bytes) -> str:
    """
    Solve alphanumeric image CAPTCHA.
    Uses ddddocr (ML-based, ~90% accuracy on IP India captchas).
    Falls back to pytesseract if ddddocr not available.
    """
    # Method 1: ddddocr (best for this type)
    try:
        import ddddocr
        ocr  = ddddocr.DdddOcr(show_ad=False)
        text = ocr.classification(img_bytes)
        # IP India captcha: uppercase alphanumeric, typically 5-6 chars
        text = re.sub(r"[^A-Z0-9]", "", text.upper())
        log.info(f"ddddocr solved captcha: {text}")
        return text
    except ImportError:
        pass
    except Exception as e:
        log.warning(f"ddddocr error: {e}")

    # Method 2: pytesseract
    try:
        import pytesseract
        from PIL import Image, ImageFilter, ImageEnhance
        img = Image.open(io.BytesIO(img_bytes))
        # Preprocess: grayscale → sharpen → threshold
        img = img.convert("L")
        img = img.filter(ImageFilter.SHARPEN)
        enhancer = ImageEnhance.Contrast(img)
        img = enhancer.enhance(2.0)
        text = pytesseract.image_to_string(
            img, config="--psm 8 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
        )
        text = re.sub(r"[^A-Z0-9]", "", text.upper())
        log.info(f"pytesseract solved captcha: {text}")
        return text
    except ImportError:
        pass
    except Exception as e:
        log.warning(f"pytesseract error: {e}")

    log.error("No CAPTCHA solver available — install ddddocr: pip install ddddocr")
    return ""


# ── Login ─────────────────────────────────────────────────────────────────────

def login(username: str, password: str, max_attempts: int = 3) -> dict:
    """
    Login to IP India eFiling portal.
    Automatically solves CAPTCHA using ddddocr.
    Returns { success, message, username } on success.
    """
    for attempt in range(1, max_attempts + 1):
        log.info(f"eFiling login attempt {attempt}/{max_attempts} for {username}")
        try:
            s = requests.Session()
            s.headers.update(HEADERS)

            # ── GET login page ────────────────────────────────────────────────
            home = s.get(LOGIN_URL, timeout=25, verify=True)
            home.raise_for_status()
            soup = BeautifulSoup(home.text, "lxml")

            # ── Download captcha image ────────────────────────────────────────
            cap_img = soup.find("img", {"src": re.compile(r"captcha", re.I)})
            cap_url = cap_img["src"] if cap_img else None

            if cap_url:
                # Handle all relative URL formats
                if cap_url.startswith("http"):
                    full_url = cap_url
                elif cap_url.startswith("//"):
                    full_url = "https:" + cap_url
                elif cap_url.startswith("/"):
                    full_url = "https://ipindiaonline.gov.in" + cap_url
                elif cap_url.startswith("../"):
                    # e.g. ../CaptchaGenerator/captcha.aspx → build from base
                    full_url = "https://ipindiaonline.gov.in/trademarkefiling/user/" + cap_url
                    # Resolve ../ properly
                    import urllib.parse
                    full_url = urllib.parse.urljoin(
                        "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx",
                        cap_url
                    )
                else:
                    full_url = "https://ipindiaonline.gov.in/trademarkefiling/user/" + cap_url
                log.info(f"Captcha URL: {cap_url} → {full_url}")
                img_resp  = s.get(full_url, timeout=15, verify=True)
                img_bytes = img_resp.content
            else:
                # Try direct captcha URL
                img_resp  = s.get(CAPTCHA_URL, timeout=15, verify=True)
                img_bytes = img_resp.content

            captcha_text = _solve_captcha_image(img_bytes)
            if not captcha_text:
                return {
                    "success": False,
                    "error":   "CAPTCHA solver not available",
                    "hint":    "Add ddddocr to requirements.txt and redeploy"
                }

            log.info(f"Captcha solved: '{captcha_text}'")

            # ── Build login form ──────────────────────────────────────────────
            form = {}
            for inp in soup.find_all("input", {"type": "hidden"}):
                n = inp.get("name") or inp.get("id")
                if n:
                    form[n] = inp.get("value", "")

            # Username field
            for name_hint in ["txtUserName", "txtUsername", "UserName", "username"]:
                el = soup.find("input", {"id": name_hint}) or soup.find("input", {"name": name_hint})
                if el:
                    form[el.get("name") or el.get("id")] = username
                    break

            # Password field
            for name_hint in ["txtPassword", "Password", "password"]:
                el = soup.find("input", {"id": name_hint}) or soup.find("input", {"name": name_hint})
                if el:
                    form[el.get("name") or el.get("id")] = password
                    break

            # Captcha field
            for name_hint in ["txtCaptcha", "Captcha", "captcha", "CaptchaText"]:
                el = soup.find("input", {"id": name_hint}) or soup.find("input", {"name": name_hint})
                if el:
                    form[el.get("name") or el.get("id")] = captcha_text
                    break

            # Submit button
            for btn in soup.find_all("input", {"type": "submit"}):
                n = btn.get("name") or btn.get("id")
                if n:
                    form[n] = btn.get("value", "Login")
                    break

            # ── POST login ────────────────────────────────────────────────────
            resp = s.post(
                LOGIN_URL, data=form, timeout=30, verify=True,
                headers={**HEADERS, "Referer": LOGIN_URL,
                         "Content-Type": "application/x-www-form-urlencoded"},
                allow_redirects=True,
            )

            text_lower = resp.text.lower()

            # Check for successful login
            logged_in = any(k in text_lower for k in [
                "logout", "filing history", "welcome", "dashboard",
                "frmformfilinghistory", "my application", "sign out"
            ]) and "invalid" not in text_lower and "incorrect" not in text_lower

            if logged_in:
                save_efiling_session(dict(s.cookies), username)
                log.info(f"Login successful for {username}")
                return {
                    "success":  True,
                    "message":  f"✅ Logged in as {username}",
                    "username": username,
                }

            # Wrong captcha — retry
            if "captcha" in text_lower or "invalid captcha" in text_lower:
                log.warning(f"Wrong captcha on attempt {attempt}: '{captcha_text}'")
                continue

            # Wrong credentials
            if any(k in text_lower for k in ["invalid user", "invalid password", "wrong password"]):
                return {"success": False, "error": "Invalid username or password"}

            log.warning(f"Login attempt {attempt} failed, retrying...")
            time.sleep(1)

        except Exception as e:
            log.error(f"Login error attempt {attempt}: {e}")
            if attempt == max_attempts:
                return {"success": False, "error": str(e)}
            time.sleep(2)

    return {"success": False, "error": "Login failed after 3 attempts (captcha solving failed)"}


# ── Fetch filing history ──────────────────────────────────────────────────────

def fetch_filing_history(username: str = "", cookies: dict = None) -> list:
    """
    Fetch all applications from eFiling Filing History page.
    Returns list of { app_no, tm_name, status, filing_date, ... }
    """
    if not cookies:
        username, cookies = load_efiling_session()
    if not cookies:
        return []

    try:
        s = requests.Session()
        s.headers.update(HEADERS)
        for k, v in cookies.items():
            s.cookies.set(k, v)

        resp = s.get(HISTORY_URL, timeout=30, verify=True,
                     headers={**HEADERS, "Referer": BASE_URL + "/online/"})

        # Check if session expired (redirected back to login)
        if "frmlogin" in resp.url.lower() or "login" in resp.url.lower():
            log.warning("eFiling session expired")
            return []

        soup = BeautifulSoup(resp.text, "lxml")
        apps = []

        # Find results table
        table = None
        for tid in ["GridView1", "gvFilingHistory", "grdFilingHistory",
                    "ctl00_ContentPlaceHolder1_GridView1"]:
            table = soup.find("table", {"id": tid})
            if table:
                break

        if not table:
            # Find biggest table
            all_tables = soup.find_all("table")
            table = max(all_tables, key=lambda t: len(t.find_all("tr")), default=None)

        if not table:
            log.warning("No table found in filing history")
            return []

        rows    = table.find_all("tr")
        headers = [h.get_text(strip=True).lower()
                   for h in rows[0].find_all(["th","td"])] if rows else []

        def col(hints, cells):
            for hint in hints:
                for i, h in enumerate(headers):
                    if hint in h and i < len(cells):
                        v = cells[i].get_text(" ", strip=True)
                        if v:
                            return v
            return ""

        for row in rows[1:]:
            tds = row.find_all("td")
            if len(tds) < 2:
                continue

            app_no = col(["app no","appno","application no","no."], tds)
            if not app_no:
                app_no = tds[0].get_text(strip=True)
            if not app_no or not any(c.isdigit() for c in app_no):
                continue

            status = col(["status","current"], tds)
            record = {
                "app_no":         app_no.strip(),
                "trademark_name": col(["trade mark","trademark","mark","word"], tds),
                "tm_class":       col(["class"], tds),
                "applicant":      col(["applicant","proprietor","owner"], tds),
                "filing_date":    col(["date","filed","filing"], tds),
                "status":         status,
                "status_class":   _classify(status),
                "agent":          username,
                "tma_code":       username,
                "source":         "efiling_history",
                "view_url": f"{EREGISTER}?AppNosValue={app_no.strip()}",
            }
            apps.append(record)
            upsert_trademark(record)

        log.info(f"Filing history: {len(apps)} applications for {username}")
        return apps

    except Exception as e:
        log.error(f"fetch_filing_history error: {e}")
        return []


# ── Fetch eRegister status for one app ───────────────────────────────────────

def fetch_eregister_status(app_no: str, session: requests.Session = None) -> dict:
    """Fetch full trademark details from eRegister using Playwright."""
    try:
        from scrapers.ipindia_scraper import fetch_application
        result = fetch_application(app_no, session=session)
        return result
    except Exception as e:
        log.warning(f"eRegister fetch failed for {app_no}: {e}")
        return {"app_no": app_no, "error": str(e)}


# ── Full sync: login + history + eRegister enrichment ────────────────────────

def sync_efiling_portfolio(
    username:    str,
    password:    str = "",
    progress_cb=None,
) -> dict:
    """
    Complete eFiling portfolio sync:
    1. Login (with auto CAPTCHA solve)
    2. Fetch ALL applications from Filing History
    3. Enrich each with eRegister details (status, goods, certificate etc.)
    4. Save to local DB
    """
    from datetime import datetime

    cb = progress_cb or (lambda m, p: log.info(f"{p}% {m}"))

    cb("Connecting to IP India eFiling portal…", 5)

    # ── Step 1: Login (or use saved session) ─────────────────────────────────
    username_saved, saved_cookies = load_efiling_session()

    if saved_cookies and username_saved == username:
        cb("Using saved eFiling session…", 10)
        cookies = saved_cookies
    else:
        if not password:
            return {"success": False, "error": "Password required for first login"}
        cb("Logging in to IP India eFiling…", 10)
        result = login(username, password)
        if not result["success"]:
            return {"success": False, "error": result.get("error", "Login failed")}
        _, cookies = load_efiling_session()

    # ── Step 2: Fetch filing history ─────────────────────────────────────────
    cb("Fetching filing history…", 25)
    apps = fetch_filing_history(username=username, cookies=cookies)

    if not apps:
        return {
            "success":      False,
            "error":        "No applications found — session may have expired, try logging in again",
            "applications": [],
        }

    cb(f"Found {len(apps)} applications — enriching from eRegister…", 40)

    # ── Step 3: Enrich with eRegister for complete details ───────────────────
    # Only apps missing full details
    need_enrich = [a for a in apps if not a.get("trademark_name") or a["trademark_name"] == "—"][:50]

    for idx, app in enumerate(need_enrich):
        pct = 40 + int((idx / max(len(need_enrich), 1)) * 50)
        cb(f"eRegister {idx+1}/{len(need_enrich)}: {app['app_no']}", pct)
        try:
            detail = fetch_eregister_status(app["app_no"])
            if detail and not detail.get("error"):
                # Merge details
                for k, v in detail.items():
                    if v and v not in ("—", "") and k != "app_no":
                        app[k] = v
                upsert_trademark(app)
        except Exception as e:
            log.warning(f"Enrich error {app['app_no']}: {e}")
        if idx < len(need_enrich) - 1:
            time.sleep(0.5)

    # ── Build summary ─────────────────────────────────────────────────────────
    from database import get_attorney_portfolio, update_attorney_sync, log_sync
    all_apps = get_attorney_portfolio(tma_code=username, agent_name=username)

    summary = {
        "total":             len(all_apps),
        "registered":        sum(1 for a in all_apps if a.get("status_class") == "registered"),
        "objected":          sum(1 for a in all_apps if a.get("status_class") == "objected"),
        "opposed":           sum(1 for a in all_apps if a.get("status_class") == "opposed"),
        "pending":           sum(1 for a in all_apps if a.get("status_class") in ("pending", "under_examination")),
        "hearings_upcoming": sum(1 for a in all_apps if a.get("hearing_date") and a["hearing_date"] not in ("—", "")),
        "refused":           sum(1 for a in all_apps if a.get("status_class") in ("refused", "abandoned")),
    }

    update_attorney_sync(username, len(all_apps))
    log_sync(username, "efiling_sync", len(all_apps), "success", "",
             datetime.utcnow().isoformat() + "Z")

    cb(f"✅ Sync complete — {len(all_apps)} applications", 100)

    return {
        "success":      True,
        "username":     username,
        "applications": all_apps,
        "summary":      summary,
        "source":       "IP India eFiling Portal + eRegister",
        "synced_at":    datetime.utcnow().isoformat() + "Z",
    }
