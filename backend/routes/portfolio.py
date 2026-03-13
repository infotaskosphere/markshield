"""routes/portfolio.py — Attorney portfolio by TMA code"""

import re
from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from scrapers import fetch_cause_list

bp_portfolio = Blueprint("portfolio", __name__)

# ── TMA registry (in production: call CGPDTM API) ────────
TMA_REGISTRY = {
    "TMA/GJ/2847": {"name": "RAJESH SHARMA",                  "city": "Surat",     "state": "Gujarat",       "office": "Ahmedabad"},
    "TMA/GJ/1234": {"name": "H. K. ACHARYA & COMPANY",        "city": "Ahmedabad", "state": "Gujarat",       "office": "Ahmedabad"},
    "TMA/MH/1192": {"name": "PRIYA MEHTA",                    "city": "Mumbai",    "state": "Maharashtra",   "office": "Mumbai"},
    "TMA/MH/0891": {"name": "ANIL D. SAWANT",                 "city": "Mumbai",    "state": "Maharashtra",   "office": "Mumbai"},
    "TMA/MH/0234": {"name": "DASWANI & DASWANI",              "city": "Mumbai",    "state": "Maharashtra",   "office": "Mumbai"},
    "TMA/DL/4421": {"name": "AMIT KUMAR",                     "city": "New Delhi", "state": "Delhi",         "office": "Delhi"},
    "TMA/DL/0012": {"name": "S.S. RANA & CO.",                "city": "New Delhi", "state": "Delhi",         "office": "Delhi"},
    "TMA/DL/0088": {"name": "LALL & SETHI",                   "city": "New Delhi", "state": "Delhi",         "office": "Delhi"},
    "TMA/DL/0234": {"name": "ANAND AND ANAND",                "city": "New Delhi", "state": "Delhi",         "office": "Delhi"},
    "TMA/DL/0567": {"name": "AZB & PARTNERS",                 "city": "New Delhi", "state": "Delhi",         "office": "Delhi"},
    "TMA/CH/0111": {"name": "IPR LAW ASSOCIATES (CHENNAI)",   "city": "Chennai",   "state": "Tamil Nadu",    "office": "Chennai"},
    "TMA/CH/0222": {"name": "NADAR VENNILA",                  "city": "Chennai",   "state": "Tamil Nadu",    "office": "Chennai"},
    "TMA/KO/0445": {"name": "ANJAN SEN & ASSOCIATES",         "city": "Kolkata",   "state": "West Bengal",   "office": "Kolkata"},
    "TMA/GJ/0099": {"name": "LALJI ADVOCATES",                "city": "Ahmedabad", "state": "Gujarat",       "office": "Ahmedabad"},
    "TMA/MH/0777": {"name": "NEWTON REGINALD",                "city": "Mumbai",    "state": "Maharashtra",   "office": "Mumbai"},
    "TMA/DL/0321": {"name": "KHURANA & KHURANA",              "city": "New Delhi", "state": "Delhi",         "office": "Delhi"},
    "TMA/GJ/0501": {"name": "INFINVENT IP",                   "city": "Ahmedabad", "state": "Gujarat",       "office": "Ahmedabad"},
    "TMA/MH/0600": {"name": "BANANAIP COUNSELS",              "city": "Mumbai",    "state": "Maharashtra",   "office": "Mumbai"},
}

_TMA_RE = re.compile(r"^TMA/[A-Z]{2,3}/\d{3,6}$")


def _validate(code: str):
    code = code.upper().strip()
    if not _TMA_RE.match(code):
        return None, "Invalid TMA format — expected TMA/XX/NNNN (e.g. TMA/GJ/2847)"
    return code, None


@bp_portfolio.route("/portfolio/<path:tma_code>")
def portfolio(tma_code):
    """
    GET /api/portfolio/TMA/GJ/2847
    Returns attorney info + live upcoming hearings from IP India.
    """
    code, err = _validate(tma_code)
    if err:
        return jsonify({"error": err}), 400

    attorney = TMA_REGISTRY.get(code)
    if not attorney:
        # Soft fallback — still try to search by code substring
        attorney = {"name": code, "city": "India", "state": "Unknown", "office": "All"}

    agent_name = attorney["name"]
    today      = datetime.now()
    date_from  = today.strftime("%d/%m/%Y")
    date_to    = (today + timedelta(days=60)).strftime("%d/%m/%Y")

    result   = fetch_cause_list(agent_filter=agent_name)
    hearings = result.get("hearings", [])

    objected  = sum(1 for h in hearings if h["status"] == "objected")
    opposed   = sum(1 for h in hearings if h["status"] == "opposed")

    return jsonify({
        "tma_code": code,
        "attorney": attorney,
        "hearings": hearings,
        "summary": {
            "total_hearings":  len(hearings),
            "objected":        objected,
            "opposed":         opposed,
            "scheduled":       len(hearings) - objected - opposed,
            "next_hearing":    hearings[0] if hearings else None,
        },
        "date_range":  {"from": date_from, "to": date_to},
        "fetched_at":  datetime.utcnow().isoformat() + "Z",
        "source":      "IP India Cause List (live)",
    })


@bp_portfolio.route("/portfolio/<path:tma_code>/hearings")
def portfolio_hearings(tma_code):
    """GET /api/portfolio/TMA/GJ/2847/hearings"""
    code, err = _validate(tma_code)
    if err:
        return jsonify({"error": err}), 400
    attorney  = TMA_REGISTRY.get(code, {})
    agent     = attorney.get("name", code)
    result    = fetch_cause_list(agent_filter=agent)
    return jsonify(result)
