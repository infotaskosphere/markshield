"""
database.py — MarkShield Local Trademark Database
===================================================
SQLite database that stores all trademark data locally.
This is exactly what BinBash/MarkSimpl does — they scraped IP India
and stored everything in their own DB. We do the same.

Tables:
  trademarks     — full trademark records
  sync_log       — track what has been synced
  attorney_codes — registered attorneys for nightly sync

Once populated, ALL queries run against this DB — instant, no IP India calls.
"""

import sqlite3, os, logging
from pathlib import Path
from datetime import datetime
from contextlib import contextmanager

log = logging.getLogger("markshield.db")

DB_PATH = Path(os.getenv("DB_PATH", "/tmp/markshield_data/markshield.db"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)


def _now():
    return datetime.utcnow().isoformat() + "Z"


@contextmanager
def get_conn():
    conn = sqlite3.connect(str(DB_PATH), timeout=30)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA synchronous=NORMAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    """Create all tables if they don't exist."""
    with get_conn() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS trademarks (
            app_no              TEXT PRIMARY KEY,
            trademark_name      TEXT,
            tm_class            TEXT,
            class_detail        TEXT,
            mark_type           TEXT,
            tm_category         TEXT,
            applicant           TEXT,
            applicant_address   TEXT,
            agent               TEXT,
            agent_address       TEXT,
            tma_code            TEXT,
            state               TEXT,
            office              TEXT,
            status              TEXT,
            status_class        TEXT,
            alert               TEXT,
            filing_date         TEXT,
            valid_upto          TEXT,
            registration_date   TEXT,
            hearing_date        TEXT,
            user_since          TEXT,
            certificate_no      TEXT,
            publication         TEXT,
            image_url           TEXT,
            filing_mode         TEXT,
            goods_services      TEXT,
            view_url            TEXT,
            source              TEXT,
            created_at          TEXT,
            updated_at          TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_tm_agent    ON trademarks(agent);
        CREATE INDEX IF NOT EXISTS idx_tm_tma_code ON trademarks(tma_code);
        CREATE INDEX IF NOT EXISTS idx_tm_status   ON trademarks(status_class);
        CREATE INDEX IF NOT EXISTS idx_tm_name     ON trademarks(trademark_name);
        CREATE INDEX IF NOT EXISTS idx_tm_applicant ON trademarks(applicant);
        CREATE INDEX IF NOT EXISTS idx_tm_class    ON trademarks(tm_class);

        CREATE TABLE IF NOT EXISTS attorney_codes (
            tma_code    TEXT PRIMARY KEY,
            agent_name  TEXT,
            registered_at TEXT,
            last_sync   TEXT,
            total_apps  INTEGER DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS sync_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            tma_code    TEXT,
            action      TEXT,
            records     INTEGER,
            status      TEXT,
            message     TEXT,
            started_at  TEXT,
            finished_at TEXT
        );
        """)
    log.info(f"Database initialized: {DB_PATH}")


# ── Write operations ──────────────────────────────────────────────────────────

def upsert_trademark(data: dict):
    """Insert or update a single trademark record."""
    now = _now()
    with get_conn() as conn:
        conn.execute("""
        INSERT INTO trademarks (
            app_no, trademark_name, tm_class, class_detail, mark_type, tm_category,
            applicant, applicant_address, agent, agent_address, tma_code,
            state, office, status, status_class, alert,
            filing_date, valid_upto, registration_date, hearing_date,
            user_since, certificate_no, publication, image_url, filing_mode,
            goods_services, view_url, source, created_at, updated_at
        ) VALUES (
            :app_no, :trademark_name, :tm_class, :class_detail, :mark_type, :tm_category,
            :applicant, :applicant_address, :agent, :agent_address, :tma_code,
            :state, :office, :status, :status_class, :alert,
            :filing_date, :valid_upto, :registration_date, :hearing_date,
            :user_since, :certificate_no, :publication, :image_url, :filing_mode,
            :goods_services, :view_url, :source, :created_at, :updated_at
        )
        ON CONFLICT(app_no) DO UPDATE SET
            trademark_name=excluded.trademark_name,
            tm_class=excluded.tm_class,
            class_detail=excluded.class_detail,
            applicant=excluded.applicant,
            agent=excluded.agent,
            tma_code=excluded.tma_code,
            status=excluded.status,
            status_class=excluded.status_class,
            alert=excluded.alert,
            filing_date=excluded.filing_date,
            valid_upto=excluded.valid_upto,
            hearing_date=excluded.hearing_date,
            image_url=excluded.image_url,
            goods_services=excluded.goods_services,
            updated_at=excluded.updated_at
        """, {
            "app_no":           str(data.get("app_no","") or data.get("application_number","")),
            "trademark_name":   data.get("trademark_name") or data.get("word_mark",""),
            "tm_class":         str(data.get("tm_class") or data.get("class_number","")),
            "class_detail":     data.get("class_detail",""),
            "mark_type":        data.get("mark_type") or data.get("tm_type",""),
            "tm_category":      data.get("tm_category",""),
            "applicant":        data.get("applicant") or data.get("proprietor_name",""),
            "applicant_address":data.get("applicant_address") or data.get("proprietor_address",""),
            "agent":            data.get("agent") or data.get("attorney_name",""),
            "agent_address":    data.get("agent_address") or data.get("attorney_address",""),
            "tma_code":         data.get("tma_code",""),
            "state":            data.get("state",""),
            "office":           data.get("office") or data.get("appropriate_office",""),
            "status":           data.get("status",""),
            "status_class":     data.get("status_class") or _classify(data.get("status","")),
            "alert":            data.get("alert",""),
            "filing_date":      data.get("filing_date") or data.get("application_date",""),
            "valid_upto":       data.get("valid_upto") or data.get("expire_at",""),
            "registration_date":data.get("registration_date",""),
            "hearing_date":     data.get("hearing_date",""),
            "user_since":       data.get("user_since") or data.get("user_detail",""),
            "certificate_no":   data.get("certificate_no") or data.get("certificate_detail",""),
            "publication":      data.get("publication") or data.get("publication_details",""),
            "image_url":        data.get("image_url") or data.get("image",""),
            "filing_mode":      data.get("filing_mode",""),
            "goods_services":   data.get("goods_services",""),
            "view_url":         data.get("view_url",""),
            "source":           data.get("source","ipindia"),
            "created_at":       now,
            "updated_at":       now,
        })


def upsert_many(records: list):
    """Bulk upsert multiple trademark records."""
    for r in records:
        try:
            upsert_trademark(r)
        except Exception as e:
            log.warning(f"Failed to upsert {r.get('app_no','?')}: {e}")


def register_attorney(tma_code: str, agent_name: str = ""):
    with get_conn() as conn:
        conn.execute("""
        INSERT INTO attorney_codes (tma_code, agent_name, registered_at, total_apps)
        VALUES (?, ?, ?, 0)
        ON CONFLICT(tma_code) DO UPDATE SET
            agent_name = CASE WHEN excluded.agent_name != '' THEN excluded.agent_name ELSE agent_name END
        """, (tma_code, agent_name, _now()))


def update_attorney_sync(tma_code: str, total_apps: int):
    with get_conn() as conn:
        conn.execute("""
        UPDATE attorney_codes SET last_sync=?, total_apps=? WHERE tma_code=?
        """, (_now(), total_apps, tma_code))


def log_sync(tma_code: str, action: str, records: int, status: str, message: str = "", started_at: str = ""):
    with get_conn() as conn:
        conn.execute("""
        INSERT INTO sync_log (tma_code, action, records, status, message, started_at, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (tma_code, action, records, status, message, started_at or _now(), _now()))


# ── Read operations ───────────────────────────────────────────────────────────

def get_by_appno(app_no: str) -> dict | None:
    """Get a single trademark by application number."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM trademarks WHERE app_no = ?", (str(app_no),)
        ).fetchone()
        return dict(row) if row else None


def get_attorney_portfolio(tma_code: str = "", agent_name: str = "") -> list:
    """
    Get all trademarks for an attorney from local DB.
    Searches by tma_code OR agent name substring.
    """
    with get_conn() as conn:
        if tma_code and agent_name:
            rows = conn.execute("""
                SELECT * FROM trademarks
                WHERE tma_code = ? OR agent LIKE ?
                ORDER BY
                    CASE status_class
                        WHEN 'registered' THEN 1
                        WHEN 'accepted' THEN 2
                        WHEN 'objected' THEN 3
                        WHEN 'opposed' THEN 4
                        WHEN 'under_examination' THEN 5
                        ELSE 6
                    END, filing_date DESC
            """, (tma_code, f"%{agent_name}%")).fetchall()
        elif tma_code:
            rows = conn.execute(
                "SELECT * FROM trademarks WHERE tma_code = ? ORDER BY filing_date DESC",
                (tma_code,)
            ).fetchall()
        elif agent_name:
            rows = conn.execute(
                "SELECT * FROM trademarks WHERE agent LIKE ? ORDER BY filing_date DESC",
                (f"%{agent_name}%",)
            ).fetchall()
        else:
            return []
        return [dict(r) for r in rows]


def search_trademarks(
    word_mark: str = "",
    app_no: str = "",
    applicant: str = "",
    agent: str = "",
    tm_class: str = "",
    status: str = "",
    limit: int = 50,
    offset: int = 0,
) -> dict:
    """
    Full-text search on local database.
    Returns results matching any combination of filters.
    """
    conditions = []
    params = []

    if app_no:
        conditions.append("app_no = ?")
        params.append(str(app_no))
    if word_mark:
        conditions.append("trademark_name LIKE ?")
        params.append(f"%{word_mark}%")
    if applicant:
        conditions.append("applicant LIKE ?")
        params.append(f"%{applicant}%")
    if agent:
        conditions.append("agent LIKE ?")
        params.append(f"%{agent}%")
    if tm_class:
        conditions.append("tm_class = ?")
        params.append(str(tm_class))
    if status:
        conditions.append("status_class = ?")
        params.append(status.lower())

    where = f"WHERE {' AND '.join(conditions)}" if conditions else ""

    with get_conn() as conn:
        total = conn.execute(
            f"SELECT COUNT(*) FROM trademarks {where}", params
        ).fetchone()[0]

        rows = conn.execute(
            f"SELECT * FROM trademarks {where} ORDER BY updated_at DESC LIMIT ? OFFSET ?",
            params + [limit, offset]
        ).fetchall()

    return {
        "results":  [dict(r) for r in rows],
        "total":    total,
        "limit":    limit,
        "offset":   offset,
        "from_cache": True,
    }


def get_all_attorneys() -> list:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM attorney_codes ORDER BY registered_at DESC").fetchall()
        return [dict(r) for r in rows]


def get_db_stats() -> dict:
    with get_conn() as conn:
        total = conn.execute("SELECT COUNT(*) FROM trademarks").fetchone()[0]
        attorneys = conn.execute("SELECT COUNT(*) FROM attorney_codes").fetchone()[0]
        last_sync = conn.execute(
            "SELECT MAX(finished_at) FROM sync_log WHERE status='success'"
        ).fetchone()[0]
        by_status = conn.execute("""
            SELECT status_class, COUNT(*) as cnt
            FROM trademarks GROUP BY status_class ORDER BY cnt DESC
        """).fetchall()
    return {
        "total_trademarks": total,
        "total_attorneys":  attorneys,
        "last_sync":        last_sync,
        "by_status":        {r["status_class"]: r["cnt"] for r in by_status},
        "db_path":          str(DB_PATH),
    }


def _classify(status: str) -> str:
    s = (status or "").lower()
    if "registered" in s:  return "registered"
    if "objected" in s:    return "objected"
    if "opposed" in s:     return "opposed"
    if "refused" in s:     return "refused"
    if "accepted" in s:    return "accepted"
    if "advertised" in s:  return "advertised"
    if "examination" in s: return "under_examination"
    if "formalities" in s: return "formalities_check"
    if "abandoned" in s:   return "abandoned"
    if "withdrawn" in s:   return "withdrawn"
    return "pending"


# Initialize DB on import
try:
    init_db()
except Exception as e:
    log.warning(f"DB init warning: {e}")
