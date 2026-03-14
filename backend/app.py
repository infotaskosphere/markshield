import os
import logging
from flask import Flask, jsonify, request, Response
from datetime import datetime

from routes import (
    bp_cause,
    bp_app,
    bp_agent,
    bp_search,
    bp_efiling,
    bp_portfolio
)
# ── logging ───────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("markshield")


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "markshield-dev-2026")

    # ── CORS (manual, no extra dep) ───────────────────────
    @app.after_request
    def cors(r):
        r.headers["Access-Control-Allow-Origin"]  = "*"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        r.headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        return r

    @app.before_request
    def preflight():
        if request.method == "OPTIONS":
            return Response(status=200)

    # ── blueprints ────────────────────────────────────────
    for bp in [bp_cause, bp_app, bp_agent, bp_search, bp_efiling, bp_portfolio, bp_auth, bp_notify, bp_queue, bp_export]:
        app.register_blueprint(bp, url_prefix="/api")

    # ── health ────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({
            "status":  "ok",
            "service": "MarkShield IP India Backend",
            "version": "3.0.0",
            "time":    datetime.utcnow().isoformat() + "Z",
            "features": {
                "scraper":            True,
                "agent_registration": True,
                "google_calendar":    bool(os.getenv("GOOGLE_CLIENT_ID")),
                "gmail_reminders":    bool(os.getenv("GOOGLE_CLIENT_ID")),
            },
            "sources": {
                "cause_list":    "tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index",
                "eregister":     "tmrsearch.ipindia.gov.in/eregister/",
                "public_search": "tmrsearch.ipindia.gov.in/tmrpublicsearch/",
                "efiling":       "ipindiaonline.gov.in/trademarkefiling/",
                "tla_queue":     "ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx",
            },
        })

    @app.route("/")
    def root():
        return jsonify({"message": "MarkShield API", "health": "/api/health"})

    @app.errorhandler(404)
    def e404(e): return jsonify({"error": "Not found"}), 404

    @app.errorhandler(500)
    def e500(e): return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    log.info(f"Starting MarkShield Backend on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)
