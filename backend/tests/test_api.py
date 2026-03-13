"""
tests/test_api.py
==================
Run:  python tests/test_api.py
      (no pytest needed — pure unittest)

Tests cover:
  · All API endpoints with mock HTTP responses
  · HTML parser functions (cause list, e-register, public search)
  · Input validation and error handling
  · Cache behaviour
  · Bulk application fetch
"""

import sys, os, unittest, json
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from unittest.mock import patch, MagicMock
from datetime import datetime

# ── import app + scrapers ──────────────────────────────────
from app import create_app
import scrapers.ipindia as eng

# ── sample HTML fixtures ───────────────────────────────────

CAUSE_LIST_HTML = """
<html><body>
<table>
  <tr><th>App No</th><th>Room</th><th>Agent</th><th>Applicant</th>
      <th>Date</th><th>Slot</th><th>Type</th></tr>
  <tr><td>7421462</td><td>Hearing Room</td><td>LALJI ADVOCATES</td>
      <td>TEST APPLICANT LTD</td><td>16-03-2026</td>
      <td>Morning (10:30 AM TO 01:30 PM)</td>
      <td>National Application(Objected)</td></tr>
  <tr><td>7394353</td><td>Hearing Room</td><td>VISHAL SHARMA</td>
      <td>ANOTHER CO</td><td>16-03-2026</td>
      <td>Morning (10:30 AM TO 01:30 PM)</td>
      <td>National Application(Objected)</td></tr>
</table>
</body></html>
"""

EREGISTER_HTML = """
<html><body>
<table>
  <tr><td>Application No</td><td>7421462</td></tr>
  <tr><td>Trade Mark</td><td>FRESHMART</td></tr>
  <tr><td>Class</td><td>29</td></tr>
  <tr><td>Date Of Application</td><td>12/08/2024</td></tr>
  <tr><td>Applicant's Name/Address</td><td>RAJ FOODS PVT LTD</td></tr>
  <tr><td>Agent</td><td>LALJI ADVOCATES</td></tr>
  <tr><td>Status</td><td>Objected</td></tr>
  <tr><td>Next Date Of Hearing</td><td>17-03-2026</td></tr>
</table>
</body></html>
"""

PUBLIC_SEARCH_HTML = """
<html><body>
<table id="GridView1">
  <tr><th>App No</th><th>Mark</th><th>Class</th><th>Proprietor</th><th>Status</th><th>Valid</th></tr>
  <tr><td>5847291</td><td>FRESHMART</td><td>29</td><td>RAJ FOODS</td><td>Registered</td><td>2034</td></tr>
  <tr><td>5847292</td><td>FRESHMART PLUS</td><td>30</td><td>ANOTHER CO</td><td>Objected</td><td></td></tr>
</table>
</body></html>
"""


def _mock_response(html: str, status=200):
    m = MagicMock()
    m.status_code = status
    m.text        = html
    m.content     = html.encode()
    m.url         = "https://tmrsearch.ipindia.gov.in/test"
    m.raise_for_status = MagicMock()
    return m


# ══════════════════════════════════════════════════════════
class TestParsers(unittest.TestCase):
    """Unit-test the HTML parser functions directly."""

    def test_parse_cause_list(self):
        rows = eng._parse_cause_list(CAUSE_LIST_HTML)
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0]["app_no"], "7421462")
        self.assertEqual(rows[0]["agent"], "LALJI ADVOCATES")
        self.assertEqual(rows[0]["status"], "objected")
        self.assertIn("AppNosValue=7421462", rows[0]["view_url"])

    def test_parse_eregister(self):
        data = eng._parse_eregister(EREGISTER_HTML, "7421462")
        self.assertEqual(data["app_no"], "7421462")
        self.assertEqual(data.get("trademark_name"), "FRESHMART")
        self.assertEqual(data.get("tm_class"), "29")
        self.assertEqual(data.get("agent"), "LALJI ADVOCATES")

    def test_parse_public_search(self):
        results = eng._parse_public_search(PUBLIC_SEARCH_HTML)
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["app_no"], "5847291")
        self.assertEqual(results[0]["trademark"], "FRESHMART")
        self.assertEqual(results[1]["status"], "Objected")

    def test_parse_cause_list_empty(self):
        rows = eng._parse_cause_list("<html><body>No data</body></html>")
        self.assertEqual(rows, [])

    def test_parse_eregister_minimal(self):
        data = eng._parse_eregister("<html></html>", "999")
        self.assertEqual(data["app_no"], "999")


# ══════════════════════════════════════════════════════════
class TestCauseListRoute(unittest.TestCase):

    def setUp(self):
        self.app    = create_app()
        self.client = self.app.test_client()
        eng._cache.clear()

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_cause_list_default(self, _):
        r = self.client.get("/api/cause-list")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIn("hearings", data)
        self.assertEqual(len(data["hearings"]), 2)

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_cause_list_date(self, _):
        r = self.client.get("/api/cause-list?date=16/03/2026")
        self.assertEqual(r.status_code, 200)

    def test_cause_list_bad_date(self):
        r = self.client.get("/api/cause-list?date=2026-03-16")
        self.assertEqual(r.status_code, 400)
        self.assertIn("error", r.get_json())

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_cause_list_agent_filter(self, _):
        r = self.client.get("/api/cause-list?agent=LALJI")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["filtered"], 1)
        self.assertEqual(data["hearings"][0]["agent"], "LALJI ADVOCATES")

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_cause_list_today(self, _):
        r = self.client.get("/api/cause-list/today")
        self.assertEqual(r.status_code, 200)


# ══════════════════════════════════════════════════════════
class TestApplicationRoute(unittest.TestCase):

    def setUp(self):
        self.app    = create_app()
        self.client = self.app.test_client()
        eng._cache.clear()

    @patch.object(eng._sess, "get", return_value=_mock_response(EREGISTER_HTML))
    def test_get_application(self, _):
        r = self.client.get("/api/application/7421462")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["app_no"], "7421462")
        self.assertEqual(data.get("trademark_name"), "FRESHMART")

    def test_get_application_invalid(self):
        r = self.client.get("/api/application/INVALID")
        self.assertEqual(r.status_code, 400)

    @patch.object(eng._sess, "get", return_value=_mock_response(EREGISTER_HTML))
    def test_bulk(self, _):
        r = self.client.post(
            "/api/applications/bulk",
            data=json.dumps({"app_nos": ["7421462", "7394353"]}),
            content_type="application/json",
        )
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["total"], 2)

    def test_bulk_empty(self):
        r = self.client.post("/api/applications/bulk",
            data=json.dumps({}), content_type="application/json")
        self.assertEqual(r.status_code, 400)

    def test_bulk_too_many(self):
        r = self.client.post("/api/applications/bulk",
            data=json.dumps({"app_nos": [str(i) for i in range(51)]}),
            content_type="application/json")
        self.assertEqual(r.status_code, 400)

    def test_bulk_non_numeric(self):
        r = self.client.post("/api/applications/bulk",
            data=json.dumps({"app_nos": ["123", "ABC"]}),
            content_type="application/json")
        self.assertEqual(r.status_code, 400)


# ══════════════════════════════════════════════════════════
class TestAgentRoute(unittest.TestCase):

    def setUp(self):
        self.app    = create_app()
        self.client = self.app.test_client()
        eng._cache.clear()

    def test_agent_missing(self):
        r = self.client.get("/api/agent/hearings")
        self.assertEqual(r.status_code, 400)

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_agent_found(self, _):
        r = self.client.get("/api/agent/hearings?agent=LALJI+ADVOCATES")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertIn("hearings", data)
        self.assertEqual(data["agent"], "LALJI ADVOCATES")

    def test_agent_bad_date(self):
        r = self.client.get("/api/agent/hearings?agent=TEST&from=2026-01-01")
        self.assertEqual(r.status_code, 400)


# ══════════════════════════════════════════════════════════
class TestSearchRoute(unittest.TestCase):

    def setUp(self):
        self.app    = create_app()
        self.client = self.app.test_client()
        eng._cache.clear()

    def test_search_missing_q(self):
        r = self.client.get("/api/public-search")
        self.assertEqual(r.status_code, 400)

    def test_search_bad_type(self):
        r = self.client.get("/api/public-search?q=TEST&type=badtype")
        self.assertEqual(r.status_code, 400)

    @patch.object(eng._sess, "get",  return_value=_mock_response(PUBLIC_SEARCH_HTML))
    @patch.object(eng._sess, "post", return_value=_mock_response(PUBLIC_SEARCH_HTML))
    def test_search_ok(self, *_):
        r = self.client.get("/api/public-search?q=FRESHMART&class=29")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["query"], "FRESHMART")
        self.assertEqual(data["total"], 2)


# ══════════════════════════════════════════════════════════
class TestPortfolioRoute(unittest.TestCase):

    def setUp(self):
        self.app    = create_app()
        self.client = self.app.test_client()
        eng._cache.clear()

    def test_invalid_tma(self):
        r = self.client.get("/api/portfolio/NOTVALID")
        self.assertEqual(r.status_code, 400)

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_valid_tma(self, _):
        r = self.client.get("/api/portfolio/TMA/GJ/2847")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["tma_code"], "TMA/GJ/2847")
        self.assertIn("attorney", data)
        self.assertIn("hearings", data)
        self.assertIn("summary", data)

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_unknown_tma_still_tries(self, _):
        r = self.client.get("/api/portfolio/TMA/XX/9999")
        self.assertEqual(r.status_code, 200)   # graceful fallback


# ══════════════════════════════════════════════════════════
class TestHealthAndRoot(unittest.TestCase):

    def setUp(self):
        self.client = create_app().test_client()

    def test_health(self):
        r = self.client.get("/api/health")
        self.assertEqual(r.status_code, 200)
        data = r.get_json()
        self.assertEqual(data["status"], "ok")
        self.assertIn("sources", data)

    def test_root(self):
        r = self.client.get("/")
        self.assertEqual(r.status_code, 200)


# ══════════════════════════════════════════════════════════
class TestCache(unittest.TestCase):

    def test_cache_set_get(self):
        eng._cache.clear()
        eng._cset("test_key", {"x": 1}, ttl=60)
        v = eng._cget("test_key")
        self.assertEqual(v, {"x": 1})

    def test_cache_miss(self):
        eng._cache.clear()
        v = eng._cget("nonexistent")
        self.assertIsNone(v)

    def test_cache_expiry(self):
        from datetime import timedelta
        eng._cache.clear()
        # Set with a past expiry
        eng._cache["exptest"] = {
            "v": "old",
            "exp": datetime.utcnow() - timedelta(seconds=1)
        }
        v = eng._cget("exptest")
        self.assertIsNone(v)

    @patch.object(eng._sess, "get", return_value=_mock_response(CAUSE_LIST_HTML))
    def test_cause_list_cached(self, mock_get):
        eng._cache.clear()
        fetch = eng.fetch_cause_list
        fetch(date="16/03/2026")
        fetch(date="16/03/2026")   # second call — should hit cache
        # requests.get should only have been called once
        self.assertEqual(mock_get.call_count, 1)


# ══════════════════════════════════════════════════════════
class TestCORS(unittest.TestCase):

    def test_cors_headers(self):
        client = create_app().test_client()
        r = client.get("/api/health")
        self.assertEqual(r.headers.get("Access-Control-Allow-Origin"), "*")

    def test_options_preflight(self):
        client = create_app().test_client()
        r = client.options("/api/cause-list")
        self.assertEqual(r.status_code, 200)


# ══════════════════════════════════════════════════════════
if __name__ == "__main__":
    print("=" * 60)
    print("  MarkShield Backend — Test Suite")
    print("=" * 60)
    loader = unittest.TestLoader()
    suite  = loader.loadTestsFromModule(sys.modules[__name__])
    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)
    sys.exit(0 if result.wasSuccessful() else 1)
