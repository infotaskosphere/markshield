#!/usr/bin/env bash
# MarkShield Backend — Startup Script
# Usage:  bash start.sh [dev|prod]

set -e
MODE=${1:-dev}
PORT=${PORT:-5000}

echo ""
echo "  ███╗   ███╗ █████╗ ██████╗ ██╗  ██╗███████╗██╗  ██╗██╗███████╗██╗     ██████╗ "
echo "  ████╗ ████║██╔══██╗██╔══██╗██║ ██╔╝██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗"
echo "  ██╔████╔██║███████║██████╔╝█████╔╝ ███████╗███████║██║█████╗  ██║     ██║  ██║"
echo "  ██║╚██╔╝██║██╔══██║██╔══██╗██╔═██╗ ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║"
echo "  ██║ ╚═╝ ██║██║  ██║██║  ██║██║  ██╗███████║██║  ██║██║███████╗███████╗██████╔╝"
echo "  ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝ "
echo ""
echo "  IP India Trademark Intelligence Backend"
echo "  Mode: $MODE  |  Port: $PORT"
echo ""

# Check Python
python3 --version || { echo "ERROR: python3 not found"; exit 1; }

# Install dependencies if needed
if ! python3 -c "import flask, bs4, requests, lxml" 2>/dev/null; then
    echo "Installing dependencies..."
    pip install -r requirements.txt --break-system-packages -q
fi

if [ "$MODE" = "prod" ]; then
    echo "Starting production server (gunicorn, 4 workers)..."
    gunicorn -w 4 -b "0.0.0.0:$PORT" \
             --timeout 60 \
             --access-logfile - \
             --error-logfile - \
             app:app
else
    echo "Starting development server..."
    echo "  API:    http://localhost:$PORT/api/health"
    echo "  Docs:   http://localhost:$PORT/"
    echo ""
    export DEBUG=true
    python3 app.py
fi
