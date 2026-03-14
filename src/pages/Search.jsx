import React, { useState } from "react"

const mockResults = [
  { name: "FRESHMART", app: "5847291", cls: "29, 30", similarity: 100, status: "registered", owner: "Raj Foods Pvt Ltd", colorVar: "var(--rose)" },
  { name: "FRESHKART", app: "5912341", cls: "29, 30", similarity: 94, status: "pending", owner: "Unknown Applicant", colorVar: "var(--rose)" },
  { name: "FRESH MARKET", app: "5734891", cls: "35", similarity: 81, status: "registered", owner: "Fresh Market India", colorVar: "var(--amber)" },
  { name: "FRESHWAY", app: "5621043", cls: "29", similarity: 72, status: "registered", owner: "Freshway Exports", colorVar: "var(--amber)" },
  { name: "FRESH BASKET", app: "5512334", cls: "30", similarity: 60, status: "registered", owner: "Basket Foods", colorVar: "var(--sky)" },
  { name: "FRESHMADE", app: "5489231", cls: "43", similarity: 53, status: "pending", owner: "FreshMade Kitchen", colorVar: "var(--text3)" },
]

const chipMap = { registered: "chip-registered", pending: "chip-pending" }

export default function Search() {
  const [searchName, setSearchName] = useState("")
  const [searchClass, setSearchClass] = useState("")
  const [searching, setSearching] = useState(false)
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState(null)

  const runSearch = () => {
    setSearching(true)
    setProgress(0)
    setResults(null)
    let w = 0
    const iv = setInterval(() => {
      w += 15
      setProgress(Math.min(w, 100))
      if (w >= 100) {
        clearInterval(iv)
        setSearching(false)
        setResults(mockResults)
      }
    }, 100)
  }

  return (
    <>
      <div className="search-panel">
        <h3>🔍 AI-Powered Trademark Search</h3>
        <div className="search-form">
          <div className="sf-group" style={{ flex: 2 }}>
            <label>Trademark Name</label>
            <input type="text" placeholder="e.g. FRESHMART" value={searchName} onChange={(e) => setSearchName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && runSearch()} />
          </div>
          <div className="sf-group">
            <label>Class</label>
            <select value={searchClass} onChange={(e) => setSearchClass(e.target.value)}>
              <option value="">All Classes</option>
              <option>Class 29 — Food</option>
              <option>Class 35 — Retail</option>
              <option>Class 9 — Electronics</option>
              <option>Class 42 — Software</option>
              <option>Class 25 — Clothing</option>
            </select>
          </div>
          <div className="sf-group">
            <label>Type</label>
            <select>
              <option>Word Mark</option>
              <option>Device Mark</option>
              <option>Combined</option>
            </select>
          </div>
          <div className="sf-group" style={{ flex: 0, minWidth: "auto", justifyContent: "flex-end" }}>
            <label>&nbsp;</label>
            <button className="topbar-btn btn-primary" onClick={runSearch} disabled={searching}>
              {searching ? "Searching..." : "Search →"}
            </button>
          </div>
        </div>

        {searching && (
          <div className="progress-bar-wrap">
            <div className="progress-bar-fill" style={{ width: progress + "%" }} />
          </div>
        )}
      </div>

      {results && (
        <>
          <div style={{ marginBottom: 14, fontSize: 13, color: "var(--text2)" }}>
            Found <b>{results.length} results</b> for <b>"{searchName || "FRESHMART"}"</b> — AI similarity scores calculated
          </div>
          <div className="results-grid">
            {results.map((r) => (
              <div key={r.app} className="result-card">
                <div className="rc-head">
                  <div>
                    <div className="rc-name">{r.name}</div>
                    <div className="rc-num">{r.app}</div>
                  </div>
                  <span className={`chip ${chipMap[r.status] || "chip-pending"}`}>{r.status}</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text3)" }}>{r.owner}</div>
                <div className="rc-meta">
                  <span className="rc-tag">Class {r.cls}</span>
                </div>
                <div className="rc-footer">
                  <div className="rc-owner" style={{ fontSize: 11 }}>Similarity Score</div>
                  <div className="rc-similarity" style={{ color: r.colorVar }}>{r.similarity}%</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
