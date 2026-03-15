"""
routes/efiling_login.py — eFiling Login + Portfolio Fetch
"""
import threading, uuid, logging
from flask import Blueprint, request, jsonify

bp_efiling_login = Blueprint("efiling_login", __name__)
log = logging.getLogger("markshield.efiling_login")
_jobs: dict = {}


@bp_efiling_login.route("/efiling-session/captcha")
def get_captcha():
    """
    GET /api/efiling-session/captcha
    Returns captcha image as base64 + session cookies.
    Frontend shows the image, user types the answer.
    """
    try:
        import base64, requests, urllib3
        from bs4 import BeautifulSoup
        urllib3.disable_warnings()

        LOGIN_URL   = "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"
        CAPTCHA_URL = "https://ipindiaonline.gov.in/trademarkefiling/CaptchaGenerator/captcha.aspx"
        HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"}

        s = requests.Session()
        s.headers.update(HEADERS)

        resp = s.get(LOGIN_URL, timeout=20, verify=True)
        soup = BeautifulSoup(resp.text, "lxml")

        # Find captcha image URL
        cap_img = soup.find("img", {"src": lambda x: x and "captcha" in x.lower()})
        cap_src = cap_img["src"] if cap_img else None

        import urllib.parse
        if cap_src:
            cap_url = urllib.parse.urljoin(LOGIN_URL, cap_src)
        else:
            cap_url = CAPTCHA_URL

        img_resp  = s.get(cap_url, timeout=15, verify=True)
        img_b64   = base64.b64encode(img_resp.content).decode()
        img_type  = img_resp.headers.get("Content-Type", "image/jpeg")

        # Save session cookies for later use
        import json
        session_cookies = dict(s.cookies)

        # Also get hidden form fields
        hidden = {
            inp.get("name",""):inp.get("value","")
            for inp in soup.find_all("input", {"type":"hidden"})
            if inp.get("name")
        }

        return jsonify({
            "success":         True,
            "captcha_image":   f"data:{img_type};base64,{img_b64}",
            "session_cookies": session_cookies,
            "hidden_fields":   hidden,
        })
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502


@bp_efiling_login.route("/efiling-session/fields")
def get_fields():
    """Debug: returns all form field names from IP India login page"""
    try:
        import requests, urllib3
        from bs4 import BeautifulSoup
        urllib3.disable_warnings()
        LOGIN_URL = "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"
        HEADERS   = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"}
        s = requests.Session()
        s.headers.update(HEADERS)
        resp = s.get(LOGIN_URL, timeout=20)
        soup = BeautifulSoup(resp.text, "lxml")
        fields = []
        for inp in soup.find_all("input"):
            fields.append({
                "name": inp.get("name",""),
                "id":   inp.get("id",""),
                "type": inp.get("type","text"),
                "placeholder": inp.get("placeholder",""),
            })
        return jsonify({"fields": fields, "url": resp.url})
    except Exception as e:
        return jsonify({"error": str(e)}), 502


@bp_efiling_login.route("/efiling-session/login-manual", methods=["POST"])
def login_manual():
    """
    POST { username, password, captcha_text, session_cookies, hidden_fields }
    Login with manually entered captcha.
    """
    body            = request.get_json(silent=True) or {}
    username        = body.get("username", "").strip()
    password        = body.get("password", "").strip()
    captcha_text    = body.get("captcha_text", "").strip().upper()
    session_cookies = body.get("session_cookies", {})
    hidden_fields   = body.get("hidden_fields", {})

    if not all([username, password, captcha_text]):
        return jsonify({"success": False, "error": "Username, password and captcha required"}), 400

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status":"running","progress":0,"message":"Logging in…","result":None,"error":None}

    def run():
        def cb(m,p): _jobs[job_id]["message"]=m; _jobs[job_id]["progress"]=p
        try:
            import requests, urllib3
            urllib3.disable_warnings()
            from bs4 import BeautifulSoup

            LOGIN_URL = "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"
            HEADERS   = {"User-Agent":"Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122.0.0.0 Safari/537.36"}

            s = requests.Session()
            s.headers.update(HEADERS)
            for k,v in session_cookies.items():
                s.cookies.set(k, v)

            form = dict(hidden_fields)

            # Re-fetch page to get fresh VIEWSTATE + EVENTVALIDATION
            resp_check = s.get(LOGIN_URL, timeout=15, verify=True)
            from bs4 import BeautifulSoup as BS
            soup_check = BS(resp_check.text, "lxml")

            # Update hidden fields with fresh values
            for inp in soup_check.find_all("input", {"type": "hidden"}):
                n = inp.get("name") or inp.get("id")
                if n:
                    form[n] = inp.get("value", "")

            # CONFIRMED field names from IP India eFiling login page
            # (ASP.NET WebForms with ContentPlaceHolder1)
            form["ctl00$ContentPlaceHolder1$txtUserName"] = username
            form["ctl00$ContentPlaceHolder1$txtPassword"] = password
            form["ctl00$ContentPlaceHolder1$txtCaptcha"]  = captcha_text
            form["ctl00$ContentPlaceHolder1$btnLogin"]    = "Login"
            # Login type: 0 = Password, 1 = Digital Signature
            form["ctl00$ContentPlaceHolder1$rdlLoginType"] = "0"

            # Also try alternate field names as fallback
            form["txtUserName"] = username
            form["txtPassword"] = password
            form["txtCaptcha"]  = captcha_text

            log.info(f"Submitting login for user: {username}, captcha: {captcha_text}")

            cb("Submitting login form…", 30)
            resp = s.post(
                LOGIN_URL, data=form, timeout=30, verify=True,
                headers={**HEADERS,"Referer":LOGIN_URL,"Content-Type":"application/x-www-form-urlencoded"},
                allow_redirects=True,
            )

            text_lower = resp.text.lower()
            logged_in = any(k in text_lower for k in [
                "logout","filing history","welcome","dashboard","my application","sign out","frmformfilinghistory"
            ]) and "invalid" not in text_lower

            if logged_in:
                from scrapers.efiling_session import save_efiling_session, fetch_filing_history
                save_efiling_session(dict(s.cookies), username)
                cb("Login successful — fetching filing history…", 50)
                apps = fetch_filing_history(username=username, cookies=dict(s.cookies))
                cb(f"Fetched {len(apps)} applications", 90)
                from database import get_attorney_portfolio, _classify
                all_apps = get_attorney_portfolio(tma_code=username, agent_name=username)
                summary = {
                    "total": len(all_apps),
                    "registered": sum(1 for a in all_apps if a.get("status_class")=="registered"),
                    "objected":   sum(1 for a in all_apps if a.get("status_class")=="objected"),
                    "pending":    sum(1 for a in all_apps if a.get("status_class") in ("pending","under_examination")),
                    "hearings_upcoming": sum(1 for a in all_apps if a.get("hearing_date") and a["hearing_date"] not in ("—","")),
                }
                cb(f"✅ Done — {len(all_apps)} applications", 100)
                _jobs[job_id]["status"] = "done"
                _jobs[job_id]["result"] = {"success":True,"username":username,"applications":all_apps,"summary":summary}
            else:
                err = "Invalid credentials or captcha"
                if "invalid captcha" in text_lower: err = "Wrong captcha — try again"
                elif "invalid" in text_lower:        err = "Invalid username or password"
                _jobs[job_id]["status"] = "error"
                _jobs[job_id]["error"]  = err
        except Exception as e:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"]  = str(e)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"job_id": job_id, "message": "Logging in…"})


@bp_efiling_login.route("/efiling-session/status")
def status():
    try:
        from scrapers.efiling_session import has_efiling_session, load_efiling_session
        username, cookies = load_efiling_session()
        return jsonify({
            "connected": bool(cookies),
            "username":  username,
            "message":   f"✅ Logged in as {username}" if cookies else "Not logged in",
        })
    except Exception as e:
        return jsonify({"connected": False, "error": str(e)})


@bp_efiling_login.route("/efiling-session/login", methods=["POST"])
def login():
    """
    POST { username, password }
    → Auto-solves CAPTCHA → logs in → saves session → fetches all applications
    """
    body     = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()
    password = body.get("password", "").strip()

    if not username or not password:
        return jsonify({"success": False, "error": "Username and password required"}), 400

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "progress": 0, "message": "Starting…",
                     "result": None, "error": None}

    def run():
        def cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct

        try:
            from scrapers.efiling_session import sync_efiling_portfolio
            result = sync_efiling_portfolio(
                username=username,
                password=password,
                progress_cb=cb,
            )
            if result["success"]:
                _jobs[job_id]["status"] = "done"
                _jobs[job_id]["result"] = result
            else:
                _jobs[job_id]["status"] = "error"
                _jobs[job_id]["error"]  = result.get("error", "Failed")
        except Exception as e:
            log.error(f"eFiling sync error: {e}")
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"]  = str(e)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"success": True, "job_id": job_id,
                    "message": "Login started — auto-solving captcha…"})


@bp_efiling_login.route("/efiling-session/status/<job_id>")
def job_status(job_id):
    job = _jobs.get(job_id)
    if not job:
        return jsonify({"error": "Job not found"}), 404
    resp = {"job_id": job_id, "status": job["status"],
            "progress": job["progress"], "message": job["message"]}
    if job["status"] == "done":
        resp["result"] = job["result"]
        del _jobs[job_id]
    elif job["status"] == "error":
        resp["error"] = job["error"]
        del _jobs[job_id]
    return jsonify(resp)


@bp_efiling_login.route("/efiling-session/sync", methods=["POST"])
def sync():
    """Re-sync portfolio using saved session (no password needed)."""
    body     = request.get_json(silent=True) or {}
    username = body.get("username", "").strip()

    job_id = str(uuid.uuid4())[:8]
    _jobs[job_id] = {"status": "running", "progress": 0, "message": "Syncing…",
                     "result": None, "error": None}

    def run():
        def cb(msg, pct):
            _jobs[job_id]["message"]  = msg
            _jobs[job_id]["progress"] = pct
        try:
            from scrapers.efiling_session import sync_efiling_portfolio
            result = sync_efiling_portfolio(username=username, progress_cb=cb)
            _jobs[job_id]["status"] = "done" if result["success"] else "error"
            _jobs[job_id]["result" if result["success"] else "error"] = \
                result if result["success"] else result.get("error")
        except Exception as e:
            _jobs[job_id]["status"] = "error"
            _jobs[job_id]["error"]  = str(e)

    threading.Thread(target=run, daemon=True).start()
    return jsonify({"job_id": job_id, "message": "Sync started"})


@bp_efiling_login.route("/efiling-session/logout", methods=["POST"])
def logout():
    try:
        from scrapers.efiling_session import clear_efiling_session
        clear_efiling_session()
        return jsonify({"success": True, "message": "eFiling session cleared"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 502
