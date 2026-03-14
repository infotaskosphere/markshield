import React, { useState } from "react"
import { fetchPublicSearch } from "../services/api"

const chipMap = { hearing: "chip-hearing", objected: "chip-objected", pending: "chip-pending", registered: "chip-registered", refused: "chip-refused" }

export default function Search() {
  const [query, setQuery] = useState("")
  const [tmClass, setTmClass] = useState("")
  const [searchType, setSearchType] = useState("wordmark")
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSearch = async () => {
    if (!query.trim()) return
    setLoading(true)
    setError("")
    setResults(null)
    try {
      const data = await fetchPublicSearch({ q: query, class: tmClass, type: searchType })
      setResults(data.results || [])
    } catch (e) {
      setError("Could not reach the backend. Make sure the MarkShield backend server is running.")
      setResults([])
    } finally {
      setLoading(false)
    }
  }

  const handleKey = (e) => { if (e.key === "Enter") handleSearch() }

  return (
    <>
      <div className="search-panel">
        <h3>🔍 IP India Public Trademark Search</h3>
        <div className="search-form">
          <div className="sf-group" style={{ flex: 2 }}>
            <label>Trademark / Word Mark</label>
            <input
              type="text"
              placeholder="e.g. FRESHMART"
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              onKeyDown={handleKey}
              autoFocus
            />
          </div>
          <div className="sf-group">
            <label>Nice Class</label>
            <select value={tmClass} onChange={e => setTmClass(e.target.value)}>
              <option value="">All Classes</option>
              {Array.from({length: 45}, (_, i) => i + 1).map(c => (
                <option key={c} value={String(c)}>Class {c}</option>
              ))}
            </select>
          </div>
          <div className="sf-group">
            <label>Search Type</label>
            <select value={searchType} onChange={e => setSearchType(e.target.value)}>
              <option value="wordmark">Word Mark</option>
              <option value="proprietor">Proprietor</option>
              <option value="application">Application No.</option>
            </select>
          </div>
          <div className="sf-group" style={{ flex: 0, minWidth: "auto" }}>
            <label>&nbsp;</label>
            <button className="topbar-btn btn-primary" onClick={handleSearch} disabled={loading || !query.trim()}>
              {loading ? "Searching..." : "🔍 Search"}
            </button>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 4 }}>
          {["FRESHMART", "TECHVEDA", "ZENSPA", "ROYALE"].map(q => (
            <button key={q} className="qchip" onClick={() => { setQuery(q); }}>
              {q}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "var(--rose)" }}>
          ⚠ {error}
        </div>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "var(--text3)", fontSize: 14 }}>
          <div style={{ width: 32, height: 32, border: "3px solid var(--border)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 16px" }} />
          Searching IP India database...
        </div>
      )}

      {results !== null && !loading && (
        results.length === 0 ? (
          <div className="card">
            <div className="empty-state">
              <div style={{ fontSize: 36 }}>🔍</div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>No results found</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>
                Try a different search term or check the backend connection.
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 14, fontSize: 13, color: "var(--text3)" }}>
              {results.length} result{results.length !== 1 ? "s" : ""} found for <b style={{ color: "var(--text)" }}>"{query}"</b>
              {tmClass && ` in Class ${tmClass}`}
            </div>
            <div className="results-grid">
              {results.map((r, i) => (
                <div key={i} className="result-card"
                  onClick={() => window.open(`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${r.app_no}`, "_blank")}
                >
                  <div className="rc-head">
                    <div>
                      <div className="rc-name">{r.trademark || r.app_no}</div>
                      <div className="rc-num">App: {r.app_no}</div>
                    </div>
                    {r.status && (
                      <span className={`chip ${chipMap[r.status?.toLowerCase()] || "chip-pending"}`}>
                        {r.status}
                      </span>
                    )}
                  </div>
                  <div className="rc-meta">
                    {r.class && <span className="rc-tag">Class {r.class}</span>}
                    {r.valid_upto && <span className="rc-tag">Valid: {r.valid_upto}</span>}
                  </div>
                  <div className="rc-footer">
                    <span className="rc-owner">{r.proprietor}</span>
                    <span style={{ fontSize: 11, color: "var(--accent-light)" }}>View ↗</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )
      )}

      {results === null && !loading && (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>Search the IP India Database</div>
            <div style={{ fontSize: 13, color: "var(--text3)", maxWidth: 360, lineHeight: 1.6 }}>
              Enter a trademark name, proprietor name, or application number above to search
              the live IP India public trademark database.
            </div>
          </div>
        </div>
      )}

      {/* Backend notice */}
      <div style={{ marginTop: 16, padding: "10px 14px", background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text3)", display: "flex", alignItems: "center", gap: 8 }}>
        <span>🔗</span>
        <span>Search is live — powered by the MarkShield backend scraping <b style={{ color: "var(--text2)" }}>tmrsearch.ipindia.gov.in</b>.
        Start the backend with <code style={{ fontFamily: "var(--mono)", color: "#f0c842" }}>cd backend && python app.py</code>.</span>
      </div>
    </>
  )
}
