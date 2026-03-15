"""
scrapers/estatus_auth.py — IP India eStatus One-Shot OTP Flow
=============================================================
URL: https://tmrsearch.ipindia.gov.in/estatus/OTP/index

Key insight: The math captcha (7-1=?) changes every page load and is
tied to the session cookie. So we must:
  1. GET the page  → get session cookie + captcha expression
  2. Solve the math immediately (same session)
  3. POST email/mobile + answer → OTP sent  (same session)
  4. User enters OTP → POST verify          (same session)

ALL steps use the SAME requests.Session() object.
Never open a new tab — the captcha will be different.
"""

import re, logging, requests, urllib3, json
from bs4 import BeautifulSoup
from database import get_conn

urllib3.disable_warnings()
log = logging.getLogger("markshield.estatus")

OTP_URL = "https://tmrsearch.ipindia.gov.in/estatus/OTP/index"
BASE    = "https://tmrsearch.ipindia.gov.in/estatus"

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection":      "keep-alive",
}

# ── DB: one active session ────────────────────────────────────────────────────

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
        # Store pending OTP session between requests
        conn.execute("""
            CREATE TABLE IF NOT EXISTS estatus_pending (
                id       INTEGER PRIMARY KEY,
                cookies  TEXT,
                email    TEXT,
                mobile   TEXT,
                ts       TEXT
            )
        """)


def save_session(cookies: dict, email="", mobile=""):
    _init_table()
    from datetime import datetime
    now = datetime.utcnow().isoformat() + "Z"
    with get_conn() as conn:
        conn.execute("DELETE FROM estatus_sessions")
        conn.execute(
            "INSERT INTO estatus_sessions (cookies,email,mobile,created_at,last_used) VALUES(?,?,?,?,?)",
            (json.dumps(cookies), email, mobile, now, now)
        )
    log.info("eStatus session saved permanently")


def _save_pending(cookies: dict, email="", mobile=""):
    """Save intermediate session cookies between send-otp and verify-otp calls."""
    _init_table()
    from datetime import datetime
    with get_conn() as conn:
        conn.execute("DELETE FROM estatus_pending")
        conn.execute(
            "INSERT INTO estatus_pending (cookies,email,mobile,ts) VALUES(?,?,?,?)",
            (json.dumps(cookies), email, mobile, datetime.utcnow().isoformat()+"Z")
        )


def _load_pending() -> dict:
    try:
        _init_table()
        with get_conn() as conn:
            row = conn.execute("SELECT cookies FROM estatus_pending LIMIT 1").fetchone()
        return json.loads(row["cookies"]) if row else {}
    except Exception:
        return {}


def load_session() -> dict:
    try:
        _init_table()
        with get_conn() as conn:
            row = conn.execute(
                "SELECT cookies FROM estatus_sessions ORDER BY id DESC LIMIT 1"
            ).fetchone()
        return json.loads(row["cookies"]) if row else {}
    except Exception:
        return {}


def has_session() -> bool:
    return bool(load_session())


def clear_session():
    try:
        with get_conn() as conn:
            conn.execute("DELETE FROM estatus_sessions")
            conn.execute("DELETE FROM estatus_pending")
    except Exception:
        pass


# ── Math captcha solver ───────────────────────────────────────────────────────

def _solve_captcha_html(html: str):
    """
    Find and solve math expression in HTML.
    Patterns: "7 - 1 = ?", "3+4=?", "8 × 2 = _"
    Returns (expr_text, answer) or (None, None)
    """
    soup = BeautifulSoup(html, "lxml")

    # Try every element's text
    for el in soup.find_all(True):
        text = el.get_text(" ", strip=True)
        m = re.search(r"(\d+)\s*([\+\-\*×x\/÷])\s*(\d+)\s*[=]\s*[\?_]", text)
        if m:
            a  = int(m.group(1))
            op = m.group(2)
            b  = int(m.group(3))
            ans = {
                "+": a + b,
                "-": a - b,
                "*": a * b, "×": a * b, "x": a * b,
                "/": a // b if b else 0, "÷": a // b if b else 0,
            }.get(op, 0)
            expr = m.group(0)
            log.info(f"Captcha solved: {expr} → {ans}")
            return expr, ans

    # Also try raw HTML (sometimes wrapped in spans)
    m = re.search(r"(\d+)\s*([\+\-\*×x\/÷])\s*(\d+)\s*[=]\s*[\?_]", html)
    if m:
        a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
        ans = {"+":a+b,"-":a-b,"*":a*b,"×":a*b,"x":a*b,"/":a//b if b else 0,"÷":a//b if b else 0}.get(op,0)
        return m.group(0), ans

    return None, None


def _build_form(soup: BeautifulSoup, extra: dict = None) -> dict:
    """Collect all form fields + override with extra values."""
    form = {}
    # All hidden fields (CSRF, ViewState, etc.)
    for inp in soup.find_all("input", {"type": "hidden"}):
        n = inp.get("name") or inp.get("id")
        if n:
            form[n] = inp.get("value", "")
    if extra:
        form.update(extra)
    return form


def _find_field(soup: BeautifulSoup, *keywords) -> str:
    """Find an input field name by matching keywords against name/id/placeholder."""
    for inp in soup.find_all("input"):
        n  = (inp.get("name")        or "").lower()
        i  = (inp.get("id")          or "").lower()
        ph = (inp.get("placeholder") or "").lower()
        combined = f"{n} {i} {ph}"
        if any(k in combined for k in keywords):
            return inp.get("name") or inp.get("id") or ""
    return ""


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

def send_otp_atomic(email: str = "", mobile: str = "") -> dict:
    """
    ONE atomic call:
      1. GET eStatus page
      2. Solve math captcha automatically
      3. POST form → OTP sent to user's email/mobile

    Session cookies are saved to DB for the verify step.
    Returns { success, message, captcha_expr, captcha_answer }
    """
    try:
        s = requests.Session()
        s.headers.update(HEADERS)

        # ── Step A: GET the page ──────────────────────────────────────────────
        resp = s.get(OTP_URL, timeout=25, verify=True)
        resp.raise_for_status()
        log.info(f"eStatus GET: {resp.status_code}, {len(resp.text)} chars")

        soup = BeautifulSoup(resp.text, "lxml")

        # ── Step B: Solve captcha ─────────────────────────────────────────────
        captcha_expr, captcha_ans = _solve_captcha_html(resp.text)

        if captcha_ans is None:
            log.warning(f"Captcha not found in HTML. Page snippet: {resp.text[500:1000]}")
            return {
                "success": False,
                "error":   "Could not find math captcha on IP India page",
                "hint":    "IP India page structure may have changed",
                "page_snippet": resp.text[500:900],
            }

        log.info(f"Captcha: '{captcha_expr}' → {captcha_ans}")

        # ── Step C: Build form ────────────────────────────────────────────────
        form = _build_form(soup)

        # Email field
        ef = _find_field(soup, "email", "mail")
        if ef:
            form[ef] = email
        else:
            form["ctl00$ContentPlaceHolder1$txtEmail"] = email
            form["Email"] = email

        # Mobile field
        mf = _find_field(soup, "mobile", "phone", "mob", "cell")
        if mf:
            form[mf] = mobile
        else:
            form["ctl00$ContentPlaceHolder1$txtMobile"] = mobile
            form["Mobile"] = mobile

        # Captcha answer field
        cf = _find_field(soup, "captcha", "answer", "expression", "expr", "code")
        if cf:
            form[cf] = str(captcha_ans)
        else:
            form["ctl00$ContentPlaceHolder1$txtCaptcha"] = str(captcha_ans)
            form["CaptchaCode"] = str(captcha_ans)
            form["Answer"] = str(captcha_ans)

        # Submit button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                form[n] = btn.get("value", "Send OTP")

        log.info(f"Posting form with fields: {list(form.keys())}")

        # ── Step D: POST ──────────────────────────────────────────────────────
        resp2 = s.post(
            OTP_URL, data=form, timeout=25, verify=True,
            headers={**HEADERS,
                     "Referer":      OTP_URL,
                     "Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )

        text_lower = resp2.text.lower()
        success = any(k in text_lower for k in [
            "otp", "sent", "verify", "enter otp", "enter the otp",
            "check your", "email sent", "sms sent"
        ])

        log.info(f"POST result: {resp2.status_code}, success={success}")
        log.info(f"Response: {resp2.text[:400]}")

        if success:
            # Save cookies for verify step
            _save_pending(dict(s.cookies), email=email, mobile=mobile)
            return {
                "success":        True,
                "message":        f"OTP sent to {'email' if email else 'mobile'} — check inbox/SMS",
                "captcha_expr":   captcha_expr,
                "captcha_answer": captcha_ans,
            }

        # Check for specific errors in response
        error_msg = "Failed to send OTP"
        if "invalid captcha" in text_lower or "wrong captcha" in text_lower:
            error_msg = "Captcha solving failed — IP India may have changed their format"
        elif "invalid email" in text_lower:
            error_msg = "Invalid email address"
        elif "invalid mobile" in text_lower:
            error_msg = "Invalid mobile number"

        return {
            "success":        False,
            "message":        error_msg,
            "captcha_expr":   captcha_expr,
            "captcha_answer": captcha_ans,
            "response_hint":  resp2.text[300:700],
        }

    except Exception as e:
        log.error(f"send_otp_atomic error: {e}")
        return {"success": False, "error": str(e)}


def verify_otp(otp: str, email: str = "", mobile: str = "") -> dict:
    """
    Verify OTP using the saved pending session cookies.
    Saves permanent session on success.
    """
    try:
        pending_cookies = _load_pending()
        if not pending_cookies:
            return {"success": False, "error": "Session expired — click Send OTP again"}

        s = requests.Session()
        s.headers.update(HEADERS)
        for k, v in pending_cookies.items():
            s.cookies.set(k, v)

        # Re-fetch to get current form state
        resp = s.get(OTP_URL, timeout=20, verify=True)
        soup = BeautifulSoup(resp.text, "lxml")

        form = _build_form(soup)

        # OTP field
        of = _find_field(soup, "otp", "verify", "pin", "code")
        if of:
            form[of] = otp.strip()
        else:
            form["ctl00$ContentPlaceHolder1$txtOTP"] = otp.strip()
            form["OTP"] = otp.strip()
            form["otp"] = otp.strip()

        # Verify button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                v = btn.get("value", "")
                if any(k in v.lower() for k in ["verify","submit","confirm","check","ok"]):
                    form[n] = v
                    break

        resp2 = s.post(
            OTP_URL, data=form, timeout=25, verify=True,
            headers={**HEADERS,
                     "Referer":      OTP_URL,
                     "Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )

        text_lower = resp2.text.lower()

        # Success: logged in, sees application search page
        success = any(k in text_lower for k in [
            "application no", "appno", "trademark", "search trademark",
            "logout", "welcome", "home", "successfully verified",
        ]) and not any(k in text_lower for k in ["invalid otp","wrong otp","otp expired","incorrect"])

        if success:
            cookies = dict(s.cookies)
            save_session(cookies, email=email, mobile=mobile)
            return {
                "success": True,
                "message": "✅ Session saved permanently — full IP India data now enabled",
                "cookies_saved": len(cookies),
            }

        error = "OTP incorrect or expired"
        if "expired" in text_lower: error = "OTP expired — click Send OTP again"
        elif "invalid" in text_lower: error = "Invalid OTP — check and retry"
        elif "wrong"   in text_lower: error = "Wrong OTP — check and retry"

        return {"success": False, "message": error}

    except Exception as e:
        log.error(f"verify_otp error: {e}")
        return {"success": False, "error": str(e)}


def fetch_with_session(app_no: str) -> dict:
    """Use saved session to fetch trademark details from eStatus."""
    cookies = load_session()
    if not cookies:
        return {}
    try:
        s = requests.Session()
        s.headers.update(HEADERS)
        for k, v in cookies.items():
            s.cookies.set(k, v)

        for url in [
            f"{BASE}/OTP/Home?AppNosValue={app_no}",
            f"{BASE}/OTP/AppStatus?AppNosValue={app_no}",
        ]:
            r = s.get(url, timeout=25, verify=True)
            if r.status_code == 200 and len(r.text) > 2000:
                from scrapers.ipindia_scraper import _parse_eregister_html
                data = _parse_eregister_html(r.text)
                if data.get("trademark_name") or data.get("status"):
                    data["app_no"] = app_no
                    data["source"] = "estatus"
                    return data
        return {}
    except Exception as e:
        log.error(f"fetch_with_session: {e}")
        return {}
