"""
MarkShield Backend — Flask Application
"""
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
    bp_portfolio,
    bp_queue,
    bp_ai,
    bp_import,
    bp_estatus,
    bp_efiling_login,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("markshield")


def create_app():
    app = Flask(__name__)
    app.secret_key = os.getenv("SECRET_KEY", "markshield-dev-2026")

    # ── CORS — allow frontend on any origin ───────────────────────────────────
    @app.after_request
    def cors(r):
        r.headers["Access-Control-Allow-Origin"]  = "*"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type,Authorization"
        r.headers["Access-Control-Allow-Methods"] = "GET,POST,PUT,DELETE,OPTIONS"
        return r

    @app.before_request
    def preflight():
        if request.method == "OPTIONS":
            return Response(status=200)

    # ── Register all blueprints ───────────────────────────────────────────────
    for bp in [bp_cause, bp_app, bp_agent, bp_search, bp_efiling, bp_portfolio, bp_queue, bp_ai, bp_import, bp_estatus, bp_efiling_login]:
        app.register_blueprint(bp, url_prefix="/api")

    # ── Health check ──────────────────────────────────────────────────────────
    @app.route("/api/health")
    def health():
        return jsonify({
            "status":  "ok",
            "service": "MarkShield IP India Backend",
            "version": "4.0.0",
            "time":    datetime.utcnow().isoformat() + "Z",
            "endpoints": {
                "cause_list":    "/api/cause-list?date=DD/MM/YYYY&agent=NAME&location=Delhi",
                "application":   "/api/application/<app_no>",
                "bulk":          "/api/applications/bulk  [POST]",
                "public_search": "/api/public-search?q=MARK&class=29&type=wordmark",
                "agent_search":  "/api/agent/hearings?agent=NAME&from=DD/MM/YYYY&to=DD/MM/YYYY",
                "queue_list":    "/api/queue-list?username=TMA_CODE&app_no=NUMBER",
                "pending":       "/api/queue-list/pending-replies",
                "efiling_login": "/api/efiling/login  [POST] {username, password}",
                "efiling_port":  "/api/efiling/portfolio",
            }
        })

    @app.route("/")
    def root():
        return jsonify({"message": "MarkShield API v4", "health": "/api/health"})

    @app.errorhandler(404)
    def e404(e):
        return jsonify({"error": "Endpoint not found", "available": "/api/health"}), 404

    @app.errorhandler(500)
    def e500(e):
        log.error(f"Internal server error: {e}")
        return jsonify({"error": "Internal server error"}), 500

    return app


app = create_app()

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    log.info(f"MarkShield Backend starting on http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False, use_reloader=False)
