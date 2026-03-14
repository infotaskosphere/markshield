# MarkShield — Deployment Guide

## Why the old site still shows demo data
The live site at `frontend-markshield.onrender.com` has the **old code** deployed.
You need to push this updated code to your GitHub repo, and Render will auto-redeploy.

## Steps to update your live site

### 1. Replace your GitHub repo files with this updated zip
```bash
# Unzip this archive
unzip markshield-updated.zip

# Go into your existing repo folder (wherever you cloned it)
cd your-markshield-repo

# Copy all updated src/ files over your old ones
cp -r markshield-updated/src/* src/
cp markshield-updated/src/styles/global.css src/styles/global.css
```

### 2. Commit and push to GitHub
```bash
git add -A
git commit -m "feat: navy+gold theme, remove demo data, add account creation"
git push origin main
```

### 3. Render will auto-redeploy
- Render watches your GitHub repo and redeploys automatically on every push
- Wait ~2-3 minutes for the build to complete
- Open `frontend-markshield.onrender.com` — new UI will be live

---

## Account System
Accounts are stored in **browser localStorage** (no backend needed).
- Default account: `admin` / `admin123`
- Users can create new accounts via the "Create Account" tab on the login page
- Each browser/device has its own account store

## Running locally
```bash
# Frontend
npm install
npm run dev   # opens at http://localhost:5173

# Backend (separate terminal)
cd backend
pip install -r requirements.txt
python app.py  # runs at http://localhost:5000
```
