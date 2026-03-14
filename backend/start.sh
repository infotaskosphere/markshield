#!/bin/bash
# MarkShield Backend — Start Script (for Render or local)
echo "Starting MarkShield Backend..."
pip install -r requirements.txt --quiet
exec gunicorn app:app \
  --bind 0.0.0.0:${PORT:-5000} \
  --workers 2 \
  --timeout 120 \
  --log-level info \
  --access-logfile - \
  --error-logfile -
