"""routes/ai.py — LexAI proxy: routes Claude API calls through backend to avoid CORS"""

import os, logging, requests
from flask import Blueprint, request, jsonify

bp_ai = Blueprint("ai", __name__)
log   = logging.getLogger("markshield.ai")

ANTHROPIC_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_KEY = os.getenv("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are LexAI, an expert AI trademark attorney assistant for the MarkShield platform.
You have deep knowledge of Indian trademark law, IP India procedures, the Trademarks Act 1999, and trademark prosecution.
The user is a registered IP attorney using MarkShield to manage their trademark portfolio.
Be concise, actionable, and use specific legal knowledge. Format clearly with bullet points where helpful.
When asked about specific trademarks in the user's portfolio, note that portfolio data is loaded separately — answer generally if no context is provided."""


@bp_ai.route("/ai/chat", methods=["POST"])
def ai_chat():
    """
    POST /api/ai/chat
    Body: { "messages": [{ "role": "user"|"assistant", "content": "..." }], "system": "..." }
    Returns: { "reply": "..." }
    Proxies to Anthropic API server-side — avoids browser CORS restrictions.
    """
    if not ANTHROPIC_KEY:
        return jsonify({
            "error": "ANTHROPIC_API_KEY not set on backend.",
            "reply": "⚠️ AI is not configured. Ask your admin to add ANTHROPIC_API_KEY in Render environment variables."
        }), 503

    body = request.get_json(silent=True) or {}
    messages = body.get("messages", [])
    system   = body.get("system", SYSTEM_PROMPT)

    if not messages:
        return jsonify({"error": "messages required"}), 400

    try:
        resp = requests.post(
            ANTHROPIC_URL,
            headers={
                "x-api-key":         ANTHROPIC_KEY,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json={
                "model":      "claude-haiku-4-5-20251001",
                "max_tokens": 1024,
                "system":     system,
                "messages":   messages,
            },
            timeout=45,
        )
        data  = resp.json()
        reply = data.get("content", [{}])[0].get("text", "")
        if not reply:
            log.warning(f"Empty Anthropic response: {data}")
            return jsonify({"reply": "Sorry, no response received. Please try again."}), 200

        return jsonify({"reply": reply})

    except requests.exceptions.Timeout:
        return jsonify({"reply": "⏳ Request timed out. Please try again."}), 504
    except Exception as e:
        log.error(f"AI chat error: {e}")
        return jsonify({"reply": f"Connection error: {str(e)}"}), 500
