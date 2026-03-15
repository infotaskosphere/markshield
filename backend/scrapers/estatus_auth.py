"""
scrapers/estatus_auth.py — IP India eStatus Session Manager
============================================================
URL: https://tmrsearch.ipindia.gov.in/estatus

Flow:
  1. GET /estatus → parse math CAPTCHA (e.g. "7 - 1 = ?") → solve it
  2. POST email/mobile + captcha answer → triggers OTP SMS/email
  3. User enters OTP once in frontend
  4. POST OTP → server sets session cookie
  5. Save cookie to DB permanently
  6. All future requests use saved cookie → full trademark data returned

After session saved, fetch any application:
  GET /estatus/OTP/Home?AppNosValue=4264411 (with session cookie)
  → returns full HTML with all trademark details
"""

import re, logging, requests, urllib3, json
from bs4 import BeautifulSoup
from database import get_conn

urllib3.disable_warnings()
log = logging.getLogger("markshield.estatus")

BASE     = "https://tmrsearch.ipindia.gov.in/estatus"
HOME_URL = f"{BASE}/OTP/index"

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection":      "keep-alive",
}


# ── Session storage in DB ─────────────────────────────────────────────────────

def _init_session_table():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS estatus_sessions (
                id         INTEGER PRIMARY KEY,
                cookies    TEXT,
                email      TEXT,
                mobile     TEXT,
                created_at TEXT,
                last_used  TEXT
            )
        """)


def save_session(cookies: dict, email: str = "", mobile: str = ""):
    _init_session_table()
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    with get_conn() as conn:
        conn.execute("DELETE FROM estatus_sessions")  # only one session
        conn.execute(
            "INSERT INTO estatus_sessions (cookies, email, mobile, created_at, last_used) VALUES (?,?,?,?,?)",
            (json.dumps(cookies), email, mobile, now, now)
        )
    log.info("eStatus session saved to DB")


def load_session() -> dict:
    """Returns cookies dict or {} if no session saved."""
    try:
        _init_session_table()
        with get_conn() as conn:
            row = conn.execute("SELECT cookies FROM estatus_sessions ORDER BY id DESC LIMIT 1").fetchone()
        if row:
            return json.loads(row["cookies"])
    except Exception as e:
        log.warning(f"load_session error: {e}")
    return {}


def has_session() -> bool:
    return bool(load_session())


def clear_session():
    try:
        with get_conn() as conn:
            conn.execute("DELETE FROM estatus_sessions")
    except Exception:
        pass


# ── Step 1: Get captcha ───────────────────────────────────────────────────────

def get_captcha_info(email: str = "", mobile: str = "") -> dict:
    """
    GET estatus page → extract math captcha expression.
    Returns: { captcha_expr: "7 - 1 = ?", captcha_answer: 6, session_id: "..." }
    """
    try:
        s = requests.Session()
        s.headers.update(HEADERS)
        resp = s.get(HOME_URL, timeout=20)
        soup = BeautifulSoup(resp.text, "lxml")

        # Find captcha expression — "7 - 1 = ?" or similar
        captcha_expr = ""
        captcha_answer = None

        for el in soup.find_all(["label", "span", "div", "td", "p"]):
            text = el.get_text(strip=True)
            # Match patterns like "7 - 1 = ?" or "3 + 4 = ?" or "8 * 2 = ?"
            m = re.search(r"(\d+)\s*([\+\-\*\/])\s*(\d+)\s*=\s*\?", text)
            if m:
                captcha_expr = text
                a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
                if op == "+":   captcha_answer = a + b
                elif op == "-": captcha_answer = a - b
                elif op == "*": captcha_answer = a * b
                elif op == "/": captcha_answer = a // b
                log.info(f"Captcha: {text} → answer: {captcha_answer}")
                break

        # Store session cookies for next step
        session_cookies = dict(s.cookies)

        return {
            "success":        True,
            "captcha_expr":   captcha_expr or "Captcha not found",
            "captcha_answer": captcha_answer,
            "session_cookies": session_cookies,
            "html_snippet":   resp.text[:500],
        }
    except Exception as e:
        log.error(f"get_captcha_info error: {e}")
        return {"success": False, "error": str(e)}


# ── Step 2: Send OTP ──────────────────────────────────────────────────────────

def send_otp(
    email: str = "",
    mobile: str = "",
    captcha_answer: int = None,
    session_cookies: dict = None,
) -> dict:
    """
    POST email/mobile + captcha → triggers OTP to user's phone/email.
    Returns: { success, message }
    """
    try:
        s = requests.Session()
        s.headers.update(HEADERS)

        # Restore session cookies from step 1
        if session_cookies:
            for k, v in session_cookies.items():
                s.cookies.set(k, v)

        # Re-fetch to get current CSRF/hidden fields
        home = s.get(HOME_URL, timeout=20)
        soup = BeautifulSoup(home.text, "lxml")

        # Build form data
        form = {}
        for inp in soup.find_all("input"):
            n = inp.get("name") or inp.get("id")
            if n:
                form[n] = inp.get("value", "")

        # Fill in user's email or mobile
        for key in list(form.keys()):
            k = key.lower()
            if "email" in k:
                form[key] = email
            elif "mobile" in k or "phone" in k:
                form[key] = mobile

        # Fill captcha answer
        for key in list(form.keys()):
            k = key.lower()
            if "captcha" in k or "answer" in k or "code" in k:
                form[key] = str(captcha_answer) if captcha_answer is not None else ""

        # Find send OTP button name
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                form[n] = btn.get("value", "Send OTP")

        # POST
        resp = s.post(
            HOME_URL, data=form, timeout=20,
            headers={**HEADERS, "Referer": HOME_URL,
                     "Content-Type": "application/x-www-form-urlencoded"}
        )

        success = "otp" in resp.text.lower() or resp.status_code == 200
        return {
            "success":        success,
            "message":        "OTP sent to your email/mobile" if success else "Failed to send OTP",
            "session_cookies": dict(s.cookies),
            "status_code":    resp.status_code,
        }
    except Exception as e:
        log.error(f"send_otp error: {e}")
        return {"success": False, "error": str(e)}


# ── Step 3: Verify OTP → save session ────────────────────────────────────────

def verify_otp(
    otp: str,
    email: str = "",
    mobile: str = "",
    session_cookies: dict = None,
) -> dict:
    """
    POST OTP → verify → save session cookies permanently.
    After this, all future fetches work automatically.
    Returns: { success, message }
    """
    try:
        s = requests.Session()
        s.headers.update(HEADERS)

        if session_cookies:
            for k, v in session_cookies.items():
                s.cookies.set(k, v)

        home = s.get(HOME_URL, timeout=20)
        soup = BeautifulSoup(home.text, "lxml")

        form = {}
        for inp in soup.find_all("input"):
            n = inp.get("name") or inp.get("id")
            if n:
                form[n] = inp.get("value", "")

        # Fill OTP
        for key in list(form.keys()):
            k = key.lower()
            if "otp" in k or "verify" in k or "code" in k:
                form[key] = otp.strip()

        # Find verify button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n and ("verify" in n.lower() or "submit" in n.lower()):
                form[n] = btn.get("value", "Verify")

        resp = s.post(
            HOME_URL, data=form, timeout=20,
            headers={**HEADERS, "Referer": HOME_URL,
                     "Content-Type": "application/x-www-form-urlencoded"}
        )

        # Check if login was successful
        success = (resp.status_code == 200 and
                   ("logout" in resp.text.lower() or
                    "application" in resp.text.lower() or
                    "trademark" in resp.text.lower() or
                    "search" in resp.text.lower()))

        if success:
            # Save all session cookies permanently
            final_cookies = dict(s.cookies)
            save_session(final_cookies, email=email, mobile=mobile)
            log.info(f"eStatus session saved: {list(final_cookies.keys())}")
            return {
                "success": True,
                "message": "✅ Session saved! All future data fetches will work automatically.",
                "cookies_saved": list(final_cookies.keys()),
            }
        else:
            return {
                "success": False,
                "message": "OTP verification failed — check OTP and try again",
                "status":  resp.status_code,
            }

    except Exception as e:
        log.error(f"verify_otp error: {e}")
        return {"success": False, "error": str(e)}


# ── Fetch application using saved session ─────────────────────────────────────

def fetch_with_session(app_no: str) -> dict:
    """
    Fetch trademark details using saved eStatus session cookies.
    Returns full trademark dict or {} if session expired.
    """
    cookies = load_session()
    if not cookies:
        log.warning("No eStatus session — need to login first")
        return {}

    try:
        s = requests.Session()
        s.headers.update(HEADERS)
        for k, v in cookies.items():
            s.cookies.set(k, v)

        # Try fetching application
        for url_pattern in [
            f"{BASE}/OTP/Home?AppNosValue={app_no}",
            f"{BASE}/OTP/AppStatus?AppNosValue={app_no}",
            f"{BASE}?AppNosValue={app_no}",
        ]:
            try:
                resp = s.get(url_pattern, timeout=25)
                if resp.status_code == 200 and len(resp.text) > 1000:
                    data = _parse_estatus_html(resp.text, app_no)
                    if data.get("trademark_name") or data.get("status"):
                        log.info(f"eStatus fetch success: {app_no}")
                        # Update last_used timestamp
                        try:
                            from datetime import datetime
                            with get_conn() as conn:
                                conn.execute(
                                    "UPDATE estatus_sessions SET last_used=?",
                                    (datetime.utcnow().isoformat() + "Z",)
                                )
                        except Exception:
                            pass
                        return data
            except Exception:
                continue

        # Session may have expired
        log.warning(f"eStatus session may be expired for {app_no}")
        return {}

    except Exception as e:
        log.error(f"fetch_with_session error: {e}")
        return {}


def _parse_estatus_html(html: str, app_no: str) -> dict:
    """Parse eStatus response HTML."""
    from scrapers.ipindia_scraper import _parse_eregister_html
    result = _parse_eregister_html(html)
    result["app_no"] = app_no
    result["source"] = "estatus"
    return result
