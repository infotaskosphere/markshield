import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"

const chipMap    = { hearing: "chip-hearing", objected: "chip-objected", pending: "chip-pending", registered: "chip-registered", refused: "chip-refused", opposed: "chip-opposed" }
const statusLabel = { hearing: "Hearing", objected: "Objected", pending: "Pending", registered: "Registered", refused: "Refused", opposed: "Opposed" }
const CLASSES    = Array.from({length: 45}, (_, i) => i + 1)
const LS_KEY     = "ms_portfolio"

export default function Portfolio({ context }) {
  const navigate = useNavigate()

  // ── Load from localStorage on mount ──────────────────────────────────────
  const [trademarks,    setTrademarks]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") } catch { return [] }
  })
  const [search,        setSearch]        = useState("")
  const [filterClass,   setFilterClass]   = useState("")
  const [filterStatus,  setFilterStatus]  = useState("")
  const [showAdd,       setShowAdd]       = useState(false)
  const [form,          setForm]          = useState({ name: "", app: "", cls: "", filed: "", status: "pending", next: "", owner: "" })

  // ── Save to localStorage whenever trademarks change ───────────────────────
  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(trademarks)) } catch {}
  }, [trademarks])

  // ── If eFiling portfolio was imported during setup, merge it ──────────────
  useEffect(() => {
    const imported = context?.tmaData?.applications || []
    if (imported.length > 0 && trademarks.length === 0) {
      const mapped = imported.map(a => ({
        id:     a.app_no + "_imported",
        name:   a.trademark_name || a.tm_name || "—",
        app:    a.app_no,
        cls:    a.class || a.tm_class || "",
        filed:  a.filing_date || "",
        status: (a.status || "pending").toLowerCase(),
        next:   "",
        owner:  a.applicant || context?.agentProfile?.fullName || "",
      }))
      setTrademarks(mapped)
    }
  }, [context?.tmaData?.applications])

  const filtered = trademarks.filter(r => {
    const q      = search.toLowerCase()
    const matchQ = !q || r.name.toLowerCase().includes(q) || r.app.includes(q) || (r.owner || "").toLowerCase().includes(q)
    const matchC = !filterClass   || r.cls === filterClass
    const matchS = !filterStatus  || r.status === filterStatus
    return matchQ && matchC && matchS
  })

  const handleAdd = () => {
    if (!form.name || !form.app) return
    setTrademarks(prev => [...prev, { ...form, id: Date.now() }])
    setForm({ name: "", app: "", cls: "", filed: "", status: "pending", next: "", owner: "" })
    setShowAdd(false)
  }

  const handleRemove = (id) => setTrademarks(prev => prev.filter(t => t.id !== id))

  return (
    <>
      <div className="portfolio-filters">
        <input className="filter-input" placeholder="🔍  Search by name, class, app number..."
          value={search} onChange={e => setSearch(e.target.value)} />
        <select className="filter-select" value={filterClass} onChange={e => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {CLASSES.map(c => <option key={c} value={String(c)}>Class {c}</option>)}
        </select>
        <select className="filter-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">All Status</option>
          <option value="registered">Registered</option>
          <option value="pending">Pending</option>
          <option value="hearing">Hearing</option>
          <option value="objected">Objected</option>
          <option value="opposed">Opposed</option>
          <option value="refused">Refused</option>
        </select>
        <button className="topbar-btn btn-ghost" style={{ marginLeft: "auto" }}
          onClick={() => {
            const csv = "Name,App No,Class,Filed,Status,Next Action,Owner\n" +
              trademarks.map(r => `${r.name},${r.app},${r.cls},${r.filed},${r.status},${r.next},${r.owner}`).join("\n")
            const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], {type:"text/csv"}))
            a.download = "MarkShield_Portfolio.csv"; a.click()
          }}>
          ⬇ Export CSV
        </button>
        <button className="topbar-btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Trademark</button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>All Trademarks ({filtered.length})</h3>
          {trademarks.length > 0 && (
            <span style={{ fontSize: 11.5, color: "var(--text3)" }}>
              {trademarks.filter(t => t.status === "registered").length} registered ·{" "}
              {trademarks.filter(t => t.status === "hearing").length} hearings ·{" "}
              {trademarks.filter(t => t.status === "objected").length} objected
            </span>
          )}
        </div>
        <div className="card-body">
          {trademarks.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>No trademarks yet</div>
              <div style={{ fontSize: 13, color: "var(--text3)", maxWidth: 340, lineHeight: 1.6 }}>
                Add trademark applications manually or use the Data Scraper to import from IP India eFiling.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
                <button className="topbar-btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Manually</button>
                <button className="topbar-btn btn-ghost"   onClick={() => navigate("/scraper")}>🔄 Import from IP India</button>
              </div>
            </div>
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 28 }}>🔍</div>
              <div style={{ fontSize: 15, fontWeight: 700 }}>No results</div>
              <div style={{ fontSize: 13, color: "var(--text3)" }}>Try adjusting your search or filters.</div>
            </div>
          ) : (
            <table className="tbl">
              <thead>
                <tr><th>Mark</th><th>Application No.</th><th>Class</th><th>Filed On</th><th>Status</th><th>Next Action</th><th>Owner / Applicant</th><th></th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id || r.app}>
                    <td><b>{r.name}</b></td>
                    <td className="mono">
                      <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${r.app}`}
                        target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>
                        {r.app} ↗
                      </a>
                    </td>
                    <td><span style={{ fontSize: 12, color: "var(--text3)" }}>Class {r.cls}</span></td>
                    <td className="mono">{r.filed}</td>
                    <td><span className={`chip ${chipMap[r.status] || "chip-pending"}`}>{statusLabel[r.status] || r.status}</span></td>
                    <td style={{ fontSize: 12, color: "var(--text2)" }}>{r.next}</td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>{r.owner}</td>
                    <td style={{ display: "flex", gap: 6 }}>
                      <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => navigate("/draft")}>Draft</button>
                      <button onClick={() => handleRemove(r.id)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "var(--text3)", padding: "0 4px" }} title="Remove">✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Trademark Modal */}
      {showAdd && (
        <div className="overlay open" onClick={e => e.target.classList.contains("overlay") && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">Add Trademark</div>
            <div className="modal-sub">Enter the trademark application details.</div>
            <div className="mf"><label>Trademark Name *</label>
              <input placeholder="e.g. MYBRAND" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value.toUpperCase()}))} autoFocus />
            </div>
            <div className="mf"><label>Application Number *</label>
              <input placeholder="e.g. 5738719" value={form.app} onChange={e => setForm(p => ({...p, app: e.target.value}))} style={{ fontFamily: "var(--mono)" }} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="mf"><label>Class</label>
                <select value={form.cls} onChange={e => setForm(p => ({...p, cls: e.target.value}))}>
                  <option value="">Select class</option>
                  {CLASSES.map(c => <option key={c} value={String(c)}>Class {c}</option>)}
                </select>
              </div>
              <div className="mf"><label>Status</label>
                <select value={form.status} onChange={e => setForm(p => ({...p, status: e.target.value}))}>
                  <option value="pending">Pending</option>
                  <option value="hearing">Hearing</option>
                  <option value="objected">Objected</option>
                  <option value="registered">Registered</option>
                  <option value="opposed">Opposed</option>
                  <option value="refused">Refused</option>
                </select>
              </div>
            </div>
            <div className="mf"><label>Filing Date</label>
              <input type="date" value={form.filed} onChange={e => setForm(p => ({...p, filed: e.target.value}))} />
            </div>
            <div className="mf"><label>Next Action / Hearing Date</label>
              <input placeholder="e.g. Hearing on 15 Apr 2026" value={form.next} onChange={e => setForm(p => ({...p, next: e.target.value}))} />
            </div>
            <div className="mf"><label>Owner / Applicant</label>
              <input placeholder="e.g. Rohit Bhartia" value={form.owner} onChange={e => setForm(p => ({...p, owner: e.target.value}))} />
            </div>
            <div className="modal-btns">
              <button className="topbar-btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="topbar-btn btn-primary" onClick={handleAdd}>Add Trademark</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
