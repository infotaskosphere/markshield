"""
scrapers/estatus_auth.py — IP India eStatus Complete Flow
=========================================================

CONFIRMED FLOW (from live screenshots):

STAGE 1 — Login (tmrsearch.ipindia.gov.in/estatus/OTP/index)
  Captcha type: "Enter the first number in 6 5 2 7= ?"
  Answer: 6 (first number in sequence)
  → Enter email/mobile + captcha → Send OTP
  → Enter OTP → Verify → Redirects to Home

STAGE 2 — Home (tmrsearch.ipindia.gov.in/estatus/Home/Index)
  Shows buttons:
    - Trade Mark Application/Registered Mark
    - Trade Marks Indexes
    - Track Legal Certificate Requests

STAGE 3 — Application Lookup
  URL: tmrsearch.ipindia.gov.in/estatus/TradeMarkApplication/ViewRegistered
  Captcha type: "Evaluate the Expression: 3 + 7 = ?"
  Answer: 10 (math result)
  → Enter application number + captcha → View → Full trademark details
"""

import re, json, logging, requests, urllib3
from bs4 import BeautifulSoup
from database import get_conn

urllib3.disable_warnings()
log = logging.getLogger("markshield.estatus")

BASE       = "https://tmrsearch.ipindia.gov.in/estatus"
OTP_URL    = f"{BASE}/OTP/index"
HOME_URL   = f"{BASE}/Home/Index"
VIEW_URL   = f"{BASE}/TradeMarkApplication/ViewRegistered"

HEADERS = {
    "User-Agent":      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Accept":          "text/html,application/xhtml+xml,*/*;q=0.8",
    "Accept-Language": "en-IN,en;q=0.9",
    "Connection":      "keep-alive",
}


# ── DB ────────────────────────────────────────────────────────────────────────

def _init_table():
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS estatus_sessions (
                id INTEGER PRIMARY KEY,
                cookies TEXT, email TEXT, mobile TEXT,
                created_at TEXT, last_used TEXT
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS estatus_pending (
                id INTEGER PRIMARY KEY,
                cookies TEXT, email TEXT, mobile TEXT, ts TEXT
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
    log.info("eStatus session saved")


def _save_pending(cookies: dict, email="", mobile=""):
    _init_table()
    from datetime import datetime
    with get_conn() as conn:
        conn.execute("DELETE FROM estatus_pending")
        conn.execute(
            "INSERT INTO estatus_pending (cookies,email,mobile,ts) VALUES(?,?,?,?)",
            (json.dumps(cookies), email, mobile, datetime.utcnow().isoformat() + "Z")
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


# ── Captcha solver ────────────────────────────────────────────────────────────

def _solve_captcha(html: str) -> tuple:
    """
    Solve either captcha type from IP India eStatus.

    TYPE A (Login page): "Enter the first number in 6 5 2 7= ?"
      → answer = 6

    TYPE B (Application page): "Evaluate the Expression: 3 + 7 = ?"
      → answer = 10
    """
    soup = BeautifulSoup(html, "lxml")
    text = re.sub(r"\s+", " ", soup.get_text(" ")).strip()
    log.info(f"Solving captcha. Page text: {text[:300]}")

    # TYPE A: "Enter the first/last/Nth number in X Y Z W= ?"
    m = re.search(r"enter\s+the\s+(\w+)\s+number\s+in\s+([\d\s]+)", text, re.IGNORECASE)
    if m:
        position = m.group(1).lower()
        nums = re.findall(r"\d+", m.group(2))
        if nums:
            pos_map = {
                "first": 0, "1st": 0,
                "second": 1, "2nd": 1,
                "third": 2, "3rd": 2,
                "fourth": 3, "4th": 3,
                "last": -1,
            }
            idx = pos_map.get(position, 0)
            ans = int(nums[idx])
            expr = f"Enter the {position} number in {' '.join(nums)} → {ans}"
            log.info(f"TYPE A captcha: {expr}")
            return expr, ans

    # TYPE B: "Evaluate the Expression: 3 + 7 = ?" or "3 + 7 = ?"
    m = re.search(r"(\d+)\s*([+\-*/×÷])\s*(\d+)\s*=\s*\?", text)
    if m:
        a, op, b = int(m.group(1)), m.group(2), int(m.group(3))
        ops = {
            "+": a + b, "-": a - b,
            "*": a * b, "×": a * b,
            "/": a // b if b else 0, "÷": a // b if b else 0,
        }
        ans = ops.get(op, 0)
        expr = f"{a} {op} {b} = {ans}"
        log.info(f"TYPE B captcha (math): {expr}")
        return expr, ans

    # Fallback: any sequence of numbers before "= ?"
    m = re.search(r"([\d\s]+)=\s*\?", text)
    if m:
        nums = re.findall(r"\d+", m.group(1))
        if nums:
            ans = int(nums[0])
            log.info(f"Fallback captcha (first of sequence): {ans}")
            return f"First of {nums}", ans

    log.error(f"Captcha not solved. Text: {text[:400]}")
    return None, None


def _find_field(soup, *keywords) -> str:
    """Find input field name by keywords in name/id/placeholder."""
    for inp in soup.find_all("input"):
        attrs = " ".join([
            (inp.get("name") or "").lower(),
            (inp.get("id") or "").lower(),
            (inp.get("placeholder") or "").lower(),
        ])
        if any(k in attrs for k in keywords):
            return inp.get("name") or inp.get("id") or ""
    return ""


def _hidden_fields(soup) -> dict:
    return {
        inp.get("name") or inp.get("id"): inp.get("value", "")
        for inp in soup.find_all("input", {"type": "hidden"})
        if inp.get("name") or inp.get("id")
    }


def _new_session(cookies: dict = None) -> requests.Session:
    s = requests.Session()
    s.headers.update(HEADERS)
    if cookies:
        for k, v in cookies.items():
            s.cookies.set(k, v)
    return s


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 1: Send OTP
# ═══════════════════════════════════════════════════════════════════════════════

def send_otp_atomic(email: str = "", mobile: str = "") -> dict:
    """
    GET login page → auto-solve captcha → POST → OTP sent.
    Saves pending session for verify step.
    """
    try:
        s = _new_session()

        resp = s.get(OTP_URL, timeout=25, verify=True)
        resp.raise_for_status()

        expr, ans = _solve_captcha(resp.text)
        if ans is None:
            return {"success": False, "error": "Could not solve captcha — IP India page may have changed"}

        soup = BeautifulSoup(resp.text, "lxml")
        form = _hidden_fields(soup)

        # Email field
        ef = _find_field(soup, "email", "mail")
        if ef:
            form[ef] = email
        else:
            form["ctl00$ContentPlaceHolder1$txtEmail"] = email

        # Mobile field
        mf = _find_field(soup, "mobile", "phone", "mob")
        if mf:
            form[mf] = mobile
        else:
            form["ctl00$ContentPlaceHolder1$txtMobile"] = mobile

        # Captcha field
        cf = _find_field(soup, "captcha", "answer", "code")
        if cf:
            form[cf] = str(ans)
        else:
            form["ctl00$ContentPlaceHolder1$txtCaptcha"] = str(ans)

        # Submit button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                form[n] = btn.get("value", "Send OTP")
                break

        log.info(f"Sending OTP form. Captcha: {expr}")

        resp2 = s.post(
            OTP_URL, data=form, timeout=25, verify=True,
            headers={**HEADERS, "Referer": OTP_URL,
                     "Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )

        success = any(k in resp2.text.lower() for k in [
            "otp", "sent", "verify", "resend", "success"
        ])

        if success:
            _save_pending(dict(s.cookies), email=email, mobile=mobile)
            return {
                "success":        True,
                "message":        f"OTP sent — check your {'email' if email else 'mobile'}",
                "captcha_expr":   expr,
                "captcha_answer": ans,
            }

        return {
            "success":       False,
            "message":       "OTP send failed — captcha may be wrong",
            "captcha_expr":  expr,
            "captcha_answer": ans,
            "response_hint": resp2.text[200:500],
        }

    except Exception as e:
        log.error(f"send_otp_atomic: {e}")
        return {"success": False, "error": str(e)}

# Alias
send_otp = send_otp_atomic


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 2: Verify OTP → save session
# ═══════════════════════════════════════════════════════════════════════════════

def verify_otp(otp: str, email: str = "", mobile: str = "") -> dict:
    """Verify OTP using pending session, save permanent session on success."""
    try:
        pending = _load_pending()
        if not pending:
            return {"success": False, "error": "Session expired — click Send OTP again"}

        s = _new_session(pending)
        resp = s.get(OTP_URL, timeout=20, verify=True)
        soup = BeautifulSoup(resp.text, "lxml")

        form = _hidden_fields(soup)

        # OTP field
        of = _find_field(soup, "otp", "verify", "pin", "code")
        if of:
            form[of] = otp.strip()
        else:
            form["ctl00$ContentPlaceHolder1$txtOTP"] = otp.strip()
            form["OTP"] = otp.strip()

        # Verify button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            if n:
                v = btn.get("value", "Verify")
                if any(k in v.lower() for k in ["verify", "submit", "confirm"]):
                    form[n] = v
                    break

        resp2 = s.post(
            OTP_URL, data=form, timeout=25, verify=True,
            headers={**HEADERS, "Referer": OTP_URL,
                     "Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )

        # Success = redirected to Home/Index
        success = (
            "home" in resp2.url.lower() or
            "index" in resp2.url.lower() or
            any(k in resp2.text.lower() for k in [
                "trade mark application", "registered mark",
                "logout", "home/index", "viewregistered"
            ])
        ) and "invalid" not in resp2.text.lower()

        if success:
            cookies = dict(s.cookies)
            save_session(cookies, email=email, mobile=mobile)
            return {
                "success": True,
                "message": "✅ Session saved permanently — full IP India data enabled",
                "redirect_url": resp2.url,
            }

        err = "OTP incorrect or expired"
        if "invalid" in resp2.text.lower():
            err = "Invalid OTP — check and retry"
        elif "expired" in resp2.text.lower():
            err = "OTP expired — click Send OTP again"

        return {"success": False, "message": err}

    except Exception as e:
        log.error(f"verify_otp: {e}")
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# STEP 3: Fetch application using saved session
# URL: estatus/TradeMarkApplication/ViewRegistered
# Has its OWN math captcha per request — auto-solved
# ═══════════════════════════════════════════════════════════════════════════════

def fetch_with_session(app_no: str) -> dict:
    """
    Fetch full trademark details using saved session.
    The ViewRegistered page has its own math captcha — auto-solved.
    """
    cookies = load_session()
    if not cookies:
        log.warning("No eStatus session saved")
        return {}

    try:
        s = _new_session(cookies)

        # GET the application view page
        resp = s.get(VIEW_URL, timeout=25, verify=True,
                     headers={**HEADERS, "Referer": HOME_URL})

        # Check session still valid
        if "otp" in resp.url.lower() or "login" in resp.url.lower():
            log.warning("eStatus session expired")
            clear_session()
            return {}

        # Solve the math captcha on this page
        expr, ans = _solve_captcha(resp.text)
        log.info(f"ViewRegistered captcha: {expr} → {ans}")

        soup = BeautifulSoup(resp.text, "lxml")
        form = _hidden_fields(soup)

        # Application number field
        af = _find_field(soup, "appno", "app_no", "application", "number", "appnumber")
        if af:
            form[af] = str(app_no).strip()
        else:
            form["ctl00$ContentPlaceHolder1$txtApplicationNo"] = str(app_no).strip()
            form["AppNo"] = str(app_no).strip()

        # Captcha field
        cf = _find_field(soup, "captcha", "answer", "code", "expression")
        if cf:
            form[cf] = str(ans) if ans is not None else ""
        else:
            form["ctl00$ContentPlaceHolder1$txtCaptcha"] = str(ans) if ans is not None else ""

        # View button
        for btn in soup.find_all("input", {"type": "submit"}):
            n = btn.get("name") or btn.get("id")
            v = btn.get("value", "")
            if n and "view" in v.lower():
                form[n] = v
                break

        resp2 = s.post(
            VIEW_URL, data=form, timeout=30, verify=True,
            headers={**HEADERS, "Referer": VIEW_URL,
                     "Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=True,
        )

        if resp2.status_code != 200 or len(resp2.text) < 500:
            return {}

        # Parse the result
        data = _parse_result(resp2.text, app_no)
        if data.get("trademark_name") or data.get("status"):
            # Update last_used
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

        return {}

    except Exception as e:
        log.error(f"fetch_with_session: {e}")
        return {}


def _parse_result(html: str, app_no: str) -> dict:
    """Parse the ViewRegistered result page."""
    from scrapers.ipindia_scraper import _parse_eregister_html
    data = _parse_eregister_html(html)
    data["app_no"] = str(app_no)
    data["source"] = "estatus_session"
    data["view_url"] = f"https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue={app_no}"
    return data
