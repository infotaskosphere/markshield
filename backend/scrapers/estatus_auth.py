"""
scrapers/estatus_auth.py — IP India eStatus Session Manager
============================================================
URL: https://tmrsearch.ipindia.gov.in/estatus/OTP/index

Actual form structure (from live page):
  - Email input OR Mobile No input
  - Math captcha "Evaluate the Expression: 7 - 1 = ?"
  - captcha answer input  
  - Send OTP button → OTP sent
  - OTP input + Verify button → session saved
"""

import re, logging, requests, urllib3, json
from bs4 import BeautifulSoup
from database import get_conn

urllib3.disable_warnings()
log = logging.getLogger("markshield.estatus")

BASE     = "https://tmrsearch.ipindia.gov.in/estatus"
OTP_URL  = f"{BASE}/OTP/index"

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection":      "keep-alive",
    "Referer":         "https://tmrsearch.ipindia.gov.in/estatus/",
}


# ── DB session storage ────────────────────────────────────────────────────────

def _init_table():
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
    _init_table()
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    with get_conn() as conn:
        conn.execute("DELETE FROM estatus_sessions")
        conn.execute(
            "INSERT INTO estatus_sessions (cookies, email, mobile, created_at, last_used) VALUES (?,?,?,?,?)",
            (json.dumps(cookies), email, mobile, now, now)
        )
    log.info("eStatus session saved")


def load_session() -> dict:
    try:
        _init_table()
        with get_conn() as conn:
            row = conn.execute(
                "SELECT cookies FROM estatus_sessions ORDER BY id DESC LIMIT 1"
            ).fetchone()
        if row:
            return json.loads(row["cookies"])
    except Exception as e:
        log.warning(f"load_session: {e}")
    return {}


def has_session() -> bool:
    return bool(load_session())


def clear_session():
    try:
        with get_conn() as conn:
            conn.execute("DELETE FROM estatus_sessions")
    except Exception:
        pass


# ── Solve math captcha ────────────────────────────────────────────────────────

def _solve_expr(text: str):
    """Extract and solve math expression like '7 - 1 = ?' from any text."""
    # Patterns: "7 - 1 = ?", "7-1=?", "3 + 4 = ?", "8 * 2 = ?"
    m = re.search(r"(\d+)\s*([\+\-\*×\/÷])\s*(\d+)\s*=\s*[\?_]", text)
    if m:
        a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
        ans = {"+": a+b, "-": a-b, "*": a*b, "×": a*b, "/": a//b if b else 0, "÷": a//b if b else 0}.get(op)
        return m.group(0), ans
    return None, None


def _get_session() -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    return s


# ── Step 1: Load captcha ──────────────────────────────────────────────────────

def get_captcha_info(email: str = "", mobile: str = "") -> dict:
    """
    Fetch eStatus page and extract math captcha.
    Returns captcha expression + auto-solved answer + session cookies.
    """
    try:
        s = _get_session()
        resp = s.get(OTP_URL, timeout=25, verify=True)
        resp.raise_for_status()

        soup = BeautifulSoup(resp.text, "lxml")

        # Debug: get all text on page to find captcha
        all_text = soup.get_text(" ", strip=True)
        log.info(f"Page text sample: {all_text[:500]}")

        captcha_expr   = ""
        captcha_answer = None

        # Strategy 1: find any element containing math expression
        for el in soup.find_all(True):
            text = el.get_text(strip=True)
            expr, ans = _solve_expr(text)
            if expr and ans is not None:
                captcha_expr   = text
                captcha_answer = ans
                log.info(f"Found captcha in <{el.name}>: '{text}' → {ans}")
                break

        # Strategy 2: search raw HTML for math pattern
        if not captcha_expr:
            expr, ans = _solve_expr(resp.text)
            if expr and ans is not None:
                captcha_expr   = expr
                captcha_answer = ans
                log.info(f"Found captcha in raw HTML: {expr} → {ans}")

        # Get all form field names for debugging
        fields = {}
        for inp in soup.find_all(["input", "select"]):
            n = inp.get("name") or inp.get("id") or ""
            t = inp.get("type","text")
            if n:
                fields[n] = {"type": t, "value": inp.get("value","")}

        return {
            "success":         True,
            "captcha_expr":    captcha_expr or "Not found — check backend logs",
            "captcha_answer":  captcha_answer,
            "session_cookies": dict(s.cookies),
            "form_fields":     list(fields.keys()),  # for debugging
            "page_url":        resp.url,
            "status":          resp.status_code,
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
    try:
        s = _get_session()
        if session_cookies:
            for k, v in session_cookies.items():
                s.cookies.set(k, v)

        # Re-fetch page to get fresh form state
        home = s.get(OTP_URL, timeout=20, verify=True)
        soup = BeautifulSoup(home.text, "lxml")

        # Collect ALL hidden fields (CSRF etc.)
        form = {}
        for inp in soup.find_all("input", {"type": "hidden"}):
            n = inp.get("name") or inp.get("id")
            if n:
                form[n] = inp.get("value", "")

        # Find email and mobile fields by scanning all inputs
        for inp in soup.find_all("input", {"type": ["text", "email", "tel", ""]}):
            n = (inp.get("name") or inp.get("id") or "").lower()
            ph = (inp.get("placeholder") or "").lower()
            real_name = inp.get("name") or inp.get("id") or ""
            if not real_name:
                continue

            if any(k in n or k in ph for k in ["email", "mail"]):
                form[real_name] = email
                log.info(f"Set email field: {real_name} = {email}")
            elif any(k in n or k in ph for k in ["mobile", "phone", "cell", "mob"]):
                form[real_name] = mobile
                log.info(f"Set mobile field: {real_name} = {mobile}")

        # Find captcha answer field
        for inp in soup.find_all("input", {"type": ["text", "number", ""]}):
            n = (inp.get("name") or inp.get("id") or "").lower()
            ph = (inp.get("placeholder") or "").lower()
            real_name = inp.get("name") or inp.get("id") or ""
            if not real_name:
                continue
            if any(k in n or k in ph for k in ["captcha","answer","code","expression","expr"]):
                form[real_name] = str(captcha_answer) if captcha_answer is not None else ""
                log.info(f"Set captcha field: {real_name} = {captcha_answer}")

        # Find submit button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                v = btn.get("value","Send OTP")
                if any(k in v.lower() for k in ["otp","send","submit"]):
                    form[n] = v
                    log.info(f"Submit button: {n} = {v}")

        for btn in soup.find_all("button", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                form[n] = btn.get("value","")

        log.info(f"Sending form: {list(form.keys())}")

        resp = s.post(
            OTP_URL, data=form, timeout=25, verify=True,
            headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded",
                     "Referer": OTP_URL},
            allow_redirects=True,
        )

        text_lower = resp.text.lower()
        success = any(k in text_lower for k in ["otp", "sent", "verify", "enter otp", "enter the otp"])

        log.info(f"Send OTP response: {resp.status_code}, success={success}")
        log.info(f"Response snippet: {resp.text[:300]}")

        return {
            "success":        success,
            "message":        "OTP sent to your email/mobile — check inbox/SMS" if success else "Failed to send OTP — check captcha answer",
            "session_cookies": dict(s.cookies),
            "status_code":    resp.status_code,
            "response_hint":  resp.text[:200],
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
    try:
        s = _get_session()
        if session_cookies:
            for k, v in session_cookies.items():
                s.cookies.set(k, v)

        home = s.get(OTP_URL, timeout=20, verify=True)
        soup = BeautifulSoup(home.text, "lxml")

        form = {}
        for inp in soup.find_all("input", {"type": "hidden"}):
            n = inp.get("name") or inp.get("id")
            if n:
                form[n] = inp.get("value", "")

        # Find OTP input field
        otp_found = False
        for inp in soup.find_all("input", {"type": ["text","number","tel",""]}):
            n = (inp.get("name") or inp.get("id") or "").lower()
            ph = (inp.get("placeholder") or "").lower()
            real_name = inp.get("name") or inp.get("id") or ""
            if not real_name:
                continue
            if any(k in n or k in ph for k in ["otp","verify","code","pin"]):
                form[real_name] = otp.strip()
                otp_found = True
                log.info(f"OTP field: {real_name} = {otp}")

        if not otp_found:
            # Try all text inputs
            for inp in soup.find_all("input", {"type": "text"}):
                n = inp.get("name") or inp.get("id")
                if n:
                    form[n] = otp.strip()

        # Verify submit button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                v = btn.get("value","Verify")
                if any(k in v.lower() for k in ["verify","submit","confirm","check"]):
                    form[n] = v

        resp = s.post(
            OTP_URL, data=form, timeout=25, verify=True,
            headers={**HEADERS, "Content-Type": "application/x-www-form-urlencoded",
                     "Referer": OTP_URL},
            allow_redirects=True,
        )

        text_lower = resp.text.lower()
        # Success indicators
        success = any(k in text_lower for k in [
            "logout", "application no", "trademark", "search", "home",
            "welcome", "successfully", "valid", "authenticated"
        ]) and "invalid" not in text_lower and "wrong" not in text_lower

        if success:
            cookies = dict(s.cookies)
            save_session(cookies, email=email, mobile=mobile)
            return {
                "success": True,
                "message": "✅ Session saved permanently — full IP India data now enabled",
                "cookies_saved": list(cookies.keys()),
            }

        # Check for specific error messages
        error_hint = ""
        if "invalid" in text_lower: error_hint = "Invalid OTP"
        elif "expired" in text_lower: error_hint = "OTP expired — request new one"
        elif "wrong" in text_lower: error_hint = "Wrong OTP"

        return {
            "success": False,
            "message": f"OTP verification failed — {error_hint or 'check OTP and try again'}",
            "response_hint": resp.text[:300],
        }

    except Exception as e:
        log.error(f"verify_otp error: {e}")
        return {"success": False, "error": str(e)}


# ── Fetch with saved session ──────────────────────────────────────────────────

def fetch_with_session(app_no: str) -> dict:
    """Use saved session to fetch trademark details."""
    cookies = load_session()
    if not cookies:
        return {}

    try:
        s = _get_session()
        for k, v in cookies.items():
            s.cookies.set(k, v)

        for url in [
            f"{BASE}/OTP/Home?AppNosValue={app_no}",
            f"{BASE}/OTP/AppStatus?AppNosValue={app_no}",
            f"{BASE}/?AppNosValue={app_no}",
        ]:
            try:
                r = s.get(url, timeout=25, verify=True)
                if r.status_code == 200 and len(r.text) > 2000:
                    from scrapers.ipindia_scraper import _parse_eregister_html
                    data = _parse_eregister_html(r.text)
                    if data.get("trademark_name") or data.get("status"):
                        data["app_no"] = app_no
                        data["source"] = "estatus_session"
                        # Update last_used
                        try:
                            from datetime import datetime
                            with get_conn() as conn:
                                conn.execute(
                                    "UPDATE estatus_sessions SET last_used=?",
                                    (datetime.utcnow().isoformat()+"Z",)
                                )
                        except Exception:
                            pass
                        return data
            except Exception:
                continue

        return {}

    except Exception as e:
        log.error(f"fetch_with_session error: {e}")
        return {}
