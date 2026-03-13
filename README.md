# MarkShield Backend — IP India Trademark Intelligence API

A Flask backend that scrapes all four IP India trademark portals and serves structured JSON to the MarkShield frontend.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Start development server
bash start.sh dev
# OR
python app.py

# 3. Test it's working
curl http://localhost:5000/api/health
```

For production:
```bash
bash start.sh prod
# OR
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

---

## 📡 API Endpoints

### Health
```
GET /api/health
```

---

### 1. Cause List (Live Hearings)
Fetches the IP India hearing cause list — the most important endpoint.

```
GET /api/cause-list
  ?date=DD/MM/YYYY      default: today
  &agent=AGENT_NAME     optional — filters by agent name (partial match)
  &location=Delhi       optional — Delhi | Mumbai | Chennai | Kolkata | Ahmedabad
```

**Example:**
```bash
curl "http://localhost:5000/api/cause-list?date=16/03/2026&agent=LALJI+ADVOCATES"
```

**Response:**
```json
{
  "hearings": [
    {
      "app_no": "7393199",
      "agent": "LALJI ADVOCATES",
      "applicant": "LOKESH GARG PROPRIETOR OF KAMLESH MULTI ESTATE",
      "hearing_date": "16-03-2026",
      "slot": "🌅 Morning (10:30 AM – 1:30 PM)",
      "status": "objected",
      "view_url": "https://tmrsearch.ipindia.gov.in/eregister/..."
    }
  ],
  "total": 350,
  "filtered": 5,
  "date": "16/03/2026",
  "fetched_at": "2026-03-13T07:00:00Z"
}
```

**Shortcuts:**
```
GET /api/cause-list/today              # Today's hearings
GET /api/cause-list/upcoming?days=30   # Next 30 days (skips weekends)
GET /api/hearings/upcoming?days=30     # Alias
```

---

### 2. Application Status (e-Register)
```
GET /api/application/<app_no>
```

**Example:**
```bash
curl http://localhost:5000/api/application/5847291
```

**Response:**
```json
{
  "app_no": "5847291",
  "trademark_name": "FRESHMART",
  "tm_class": "29",
  "filing_date": "12/08/2024",
  "applicant": "RAJ FOODS PVT LTD",
  "agent": "LALJI ADVOCATES",
  "status": "Objected",
  "hearing_date": "17-03-2026",
  "source_url": "https://tmrsearch.ipindia.gov.in/eregister/...",
  "fetched_at": "2026-03-13T07:00:00Z"
}
```

**Bulk fetch (up to 50):**
```bash
curl -X POST http://localhost:5000/api/applications/bulk \
  -H "Content-Type: application/json" \
  -d '{"app_nos": ["5847291", "5821043", "5798432"]}'
```

---

### 3. Agent / Attorney Hearings
```
GET /api/agent/hearings
  ?agent=AGENT_NAME     required
  &from=DD/MM/YYYY      default: today
  &to=DD/MM/YYYY        default: today + 30 days
```

**Example:**
```bash
curl "http://localhost:5000/api/agent/hearings?agent=LALJI+ADVOCATES&from=13/03/2026&to=13/04/2026"
```

---

### 4. Public Search
```
GET /api/public-search
  ?q=TRADEMARK_NAME     required
  &class=29             optional TM class
  &type=wordmark        wordmark | proprietor | application
```

**Example:**
```bash
curl "http://localhost:5000/api/public-search?q=FRESHMART&class=29"
```

---

### 5. eFiling Portal (Authenticated)

Login to IP India eFiling portal with your credentials:
```bash
# Login
curl -X POST http://localhost:5000/api/efiling/login \
  -H "Content-Type: application/json" \
  -d '{"username": "your_ipindia_user", "password": "your_password"}'

# Fetch your portfolio (after login)
curl http://localhost:5000/api/efiling/portfolio

# Check auth status
curl http://localhost:5000/api/efiling/status
```

---

### 6. Portfolio by TMA Code
```
GET /api/portfolio/TMA/GJ/2847
GET /api/portfolio/TMA/GJ/2847/hearings
```

**Example:**
```bash
curl http://localhost:5000/api/portfolio/TMA/GJ/2847
```

**Response:**
```json
{
  "tma_code": "TMA/GJ/2847",
  "attorney": {
    "name": "RAJESH SHARMA",
    "city": "Surat",
    "state": "Gujarat",
    "office": "Ahmedabad"
  },
  "hearings": [...],
  "summary": {
    "total_hearings": 5,
    "objected": 4,
    "opposed": 0,
    "scheduled": 1,
    "next_hearing": {...}
  }
}
```

---

## 🏗 Project Structure

```
markshield-backend/
├── app.py                  ← Flask app factory + entry point
├── requirements.txt
├── start.sh                ← One-click startup
├── .env.example            ← Environment variable template
├── scrapers/
│   ├── __init__.py
│   └── ipindia.py          ← Core scraping engine (all 4 IP India sources)
├── routes/
│   ├── __init__.py
│   ├── cause_list.py       ← /api/cause-list endpoints
│   ├── application.py      ← /api/application endpoints
│   ├── agent.py            ← /api/agent/hearings
│   ├── search.py           ← /api/public-search
│   ├── efiling.py          ← /api/efiling/* (authenticated)
│   └── portfolio.py        ← /api/portfolio/<tma_code>
└── tests/
    └── test_api.py         ← 33 unit tests (run: python tests/test_api.py)
```

---

## 🔒 Data Sources

| Source | URL | Auth | What it gives |
|--------|-----|------|---------------|
| Cause List | tmrsearch.ipindia.gov.in/TMRDynamicUtility/... | None (public) | All hearing schedules by date/agent |
| e-Register | tmrsearch.ipindia.gov.in/eregister/ | None (public) | Full application details by number |
| Public Search | tmrsearch.ipindia.gov.in/tmrpublicsearch/ | None (public) | Search by mark name / proprietor |
| eFiling Portal | ipindiaonline.gov.in/trademarkefiling/ | Username + Password | Attorney portfolio, filed applications |

---

## ⚙️ How It Works

### Cause List Fetch
The Cause List page is fully public and returns a complete HTML table of all hearings for a given date or agent name. The scraper:
1. Sends a GET request with `SearchField=Hearing Date` and `SearchText=DD/MM/YYYY`
2. Parses the `<table>` with BeautifulSoup + lxml
3. Applies agent name filter (case-insensitive substring match)
4. Caches the result for 5 minutes

### e-Register Fetch
Each application has a public URL: `eregister/Application_View_Trademark.aspx?AppNosValue=XXXXXXX`
The scraper parses the label/value table structure and normalises field names.

### Public Search
Uses ASP.NET form POST with `__VIEWSTATE` and `__EVENTVALIDATION` tokens extracted from the initial GET.

### eFiling Portal
Full authenticated session flow — GET login page → extract ASP.NET tokens → POST credentials → maintain session cookie. After login, the `/efiling/portfolio` endpoint fetches all applications associated with that account.

---

## 🛡 Polite Scraping

- **0.9s minimum delay** between requests (no hammering)
- **Exponential back-off** on failures (2s, 4s, 8s)
- **In-memory cache** (5 min cause list, 10 min applications, 30 min search)
- Realistic browser `User-Agent` and `Accept` headers

---

## 🧪 Running Tests

```bash
python tests/test_api.py
```

All 33 tests run in < 2 seconds using mock HTTP responses — no actual network calls required.

---

## 🌐 Connecting Frontend

Set the backend URL in your frontend:

```javascript
const API = "http://localhost:5000";  // or your server IP

// Fetch cause list
const r = await fetch(`${API}/api/cause-list?agent=LALJI+ADVOCATES`);
const data = await r.json();

// Fetch application
const r2 = await fetch(`${API}/api/application/5847291`);
const app = await r2.json();
```

---

## 🚢 Deployment

### Basic (VPS / Cloud VM)
```bash
# Install Python 3.10+
apt install python3 python3-pip -y
pip install -r requirements.txt gunicorn

# Run
PORT=5000 bash start.sh prod
```

### With Nginx (recommended for production)
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Docker
```dockerfile
FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "-w", "4", "-b", "0.0.0.0:5000", "app:app"]
```
