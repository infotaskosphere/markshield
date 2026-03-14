import React, { useState } from "react"
import { fetchPendingReplies as apiFetchPending } from "../services/api"
import StatCard from "../components/StatCard"

const SAMPLE = [
  { app_no: "7421462", tm_name: "SHIVAY", action_type: "Examination Report", date: "12/02/2026", reply_status: "Pending", agent: "VISHAL SHARMA", applicant: "MANJUL KUMAR SHUKLA", office: "Delhi", tm_class: "30", deadline_days: 30, days_left: 1, urgency: "critical" },
  { app_no: "6141022", tm_name: "SWISS BEAUTY", action_type: "Examination Report", date: "10/01/2026", reply_status: "Pending", agent: "LALJI ADVOCATES", applicant: "SWISS BEAUTY COSMETICS PVT. LTD.", office: "Delhi", tm_class: "3", deadline_days: 30, days_left: -32, urgency: "overdue" },
  { app_no: "5832570", tm_name: "MANKIND", action_type: "Opposition Reply", date: "20/01/2026", reply_status: "Pending", agent: "DASWANI & DASWANI", applicant: "MANKIND PHARMA LIMITED", office: "Mumbai", tm_class: "5", deadline_days: 60, days_left: 38, urgency: "warning" },
  { app_no: "7393199", tm_name: "KAMLESH ESTATE", action_type: "Sec 45 - Proof of Use", date: "15/02/2026", reply_status: "Pending", agent: "LALJI ADVOCATES", applicant: "LOKESH GARG", office: "Delhi", tm_class: "36", deadline_days: 60, days_left: 64, urgency: "ok" },
  { app_no: "7348801", tm_name: "MERCK", action_type: "Examination Report", date: "05/02/2026", reply_status: "Pending", agent: "LALL & SETHI", applicant: "Merck KGaA", office: "Delhi", tm_class: "5", deadline_days: 30, days_left: 7, urgency: "critical" },
  { app_no: "7430564", tm_name: "DRON", action_type: "Opposition Reply", date: "01/01/2026", reply_status: "Pending", agent: "SARVARTH LEGAL", applicant: "DRON", office: "Mumbai", tm_class: "12", deadline_days: 60, days_left: -11, urgency: "overdue" },
  { app_no: "6273059", tm_name: "DEEPAK NITRITE", action_type: "Examination Report (FER)", date: "28/01/2026", reply_status: "Pending", agent: "INFINVENT IP", applicant: "DEEPAK NITRITE LIMITED", office: "Ahmedabad", tm_class: "1", deadline_days: 30, days_left: 15, urgency: "warning" },
]

export default function Pending() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter, setFilter] = useState("all")
  const [loaded, setLoaded] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const data = await apiFetchPending()
      setItems((data.items || []).sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999)))
    } catch {
      setItems(SAMPLE.sort((a, b) => (a.days_left ?? 9999) - (b.days_left ?? 9999)))
    }
    setLoaded(true)
    setLoading(false)
  }

  const overdue = items.filter((i) => i.urgency === "overdue").length
  const critical = items.filter((i) => i.urgency === "critical").length
  const warning = items.filter((i) => i.urgency === "warning").length

  const filtered = items.filter((i) => {
    if (filter === "examination") return /(examination|fer)/i.test(i.action_type || "")
    if (filter === "opposition") return /opposition/i.test(i.action_type || "")
    if (filter === "sec45") return /sec\s*(45|46)/i.test(i.action_type || "")
    return true
  })

  const computeDeadline = (item) => {
    if (!item.date || !item.deadline_days) return "—"
    try {
      const [d, m, y] = item.date.split("/")
      const base = new Date(+y, +m - 1, +d)
      base.setDate(base.getDate() + item.deadline_days)
      return base.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
    } catch { return "—" }
  }

  const exportCSV = () => {
    const hdr = "App No,TM Name,Class,Action Type,Date Issued,Deadline,Days Left,Agent,Applicant,Status"
    const rows = filtered.map((i) => `${i.app_no},${i.tm_name},${i.tm_class},${i.action_type},${i.date},${computeDeadline(i)},${i.days_left ?? "—"},${i.agent},${i.applicant},${i.reply_status}`)
    const blob = new Blob([[hdr, ...rows].join("\n")], { type: "text/csv" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "Pending_Replies.csv"; a.click()
  }

  const TABS = [
    { id: "all", label: "📋 All Pending" },
    { id: "examination", label: "🔍 Examination Report" },
    { id: "opposition", label: "⚔️ Opposition" },
    { id: "sec45", label: "§ Sec 45 / 46" },
  ]

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: "0 0 4px" }}>⚠ Pending Replies</h2>
          <div style={{ fontSize: 12, color: "var(--text3)" }}>Track all pending examination reports, opposition replies, and Sec 45/46 responses.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="topbar-btn btn-primary" onClick={fetchData} disabled={loading} style={{ fontSize: 12 }}>
            {loading ? "⌛ Loading..." : "🔄 Refresh from IP India"}
          </button>
          <button className="topbar-btn" onClick={exportCSV} disabled={!loaded} style={{ fontSize: 12, background: "rgba(33,163,70,.12)", color: "#4ade80", border: "1px solid rgba(33,163,70,.25)" }}>⬇ Export CSV</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 18 }}>
        <StatCard accent="#ef4444" iconBg="rgba(239,68,68,.1)" iconColor="#f87171" icon="⏰" label="Overdue" value={loaded ? overdue : "—"} delta="Reply deadline passed" />
        <StatCard accent="#f59e0b" iconBg="rgba(245,158,11,.1)" iconColor="var(--amber)" icon="⚡" label="Critical (≤7 days)" value={loaded ? critical : "—"} delta="File reply immediately" />
        <StatCard accent="#facc15" iconBg="rgba(250,204,21,.1)" iconColor="#fde047" icon="⚠" label="Warning (≤15 days)" value={loaded ? warning : "—"} delta="Action needed soon" />
        <StatCard accent="var(--teal)" iconBg="rgba(0,212,170,.1)" iconColor="var(--teal)" icon="📋" label="Total Pending" value={loaded ? items.length : "—"} delta="Across all categories" />
      </div>

      <div className="tabs">
        {TABS.map((t) => (
          <div key={t.id} className={`tab${filter === t.id ? " on" : ""}`} onClick={() => setFilter(t.id)}>{t.label}</div>
        ))}
      </div>

      {!loaded ? (
        <div style={{ padding: 40, textAlign: "center", color: "var(--text3)" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠</div>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>Load Pending Replies</div>
          <div style={{ fontSize: 12, marginBottom: 16 }}>Click "Refresh from IP India" to fetch the latest TLA Queue List with all pending reply deadlines.</div>
          <button className="topbar-btn btn-primary" onClick={fetchData}>🔄 Fetch Now</button>
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 24, textAlign: "center", color: "var(--text3)" }}>No pending replies found for this filter.</div>
      ) : (
        <div className="card">
          <div className="card-head"><h3>⚠ {filtered.length} Pending Repl{filtered.length !== 1 ? "ies" : "y"}</h3></div>
          <div className="card-body">
            <table className="tbl">
              <thead>
                <tr><th>App No.</th><th>TM / Mark</th><th>Class</th><th>Action Required</th><th>Date Issued</th><th>Deadline</th><th>Days Left</th><th>Agent</th><th>Applicant</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filtered.map((i) => {
                  const dl = i.days_left
                  const urg = i.urgency || "ok"
                  const rowStyle = urg === "overdue" ? { background: "rgba(239,68,68,.08)", borderLeft: "3px solid #ef4444" } : urg === "critical" ? { background: "rgba(245,158,11,.07)", borderLeft: "3px solid #f59e0b" } : urg === "warning" ? { background: "rgba(250,204,21,.05)", borderLeft: "3px solid #facc15" } : {}
                  const daysHtml = dl == null ? "—" : dl < 0 ? <span style={{ color: "#f87171", fontWeight: 800, fontSize: 13 }}>{Math.abs(dl)}d OVERDUE</span> : dl <= 7 ? <span style={{ color: "#fbbf24", fontWeight: 700 }}>{dl}d left ⚡</span> : dl <= 15 ? <span style={{ color: "#fde047", fontWeight: 600 }}>{dl}d left</span> : <span style={{ color: "var(--teal)" }}>{dl}d left</span>
                  return (
                    <tr key={i.app_no} style={rowStyle}>
                      <td className="mono"><a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${i.app_no}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{i.app_no} ↗</a></td>
                      <td style={{ fontWeight: 600, fontSize: 12 }}>{i.tm_name || "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--text3)" }}>{i.tm_class || "—"}</td>
                      <td style={{ fontSize: 12 }}>{i.action_type || "—"}</td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--text3)" }}>{i.date || "—"}</td>
                      <td className="mono" style={{ fontSize: 11, color: "var(--amber)" }}>{computeDeadline(i)}</td>
                      <td style={{ whiteSpace: "nowrap" }}>{daysHtml}</td>
                      <td style={{ fontSize: 11 }}>{i.agent || "—"}</td>
                      <td style={{ fontSize: 11, maxWidth: 160 }}>{i.applicant || "—"}</td>
                      <td><span className="chip chip-pending">{i.reply_status || "Pending"}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <div style={{ padding: "10px 16px", fontSize: "11.5px", color: "var(--text3)", borderTop: "1px solid var(--border)" }}>
              ⚖ Deadlines: Examination Report — 30 days · Opposition Reply — 60 days · Sec 45/46 — 60 days.
              Always verify on <a href="https://ipindiaonline.gov.in" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>ipindiaonline.gov.in</a>.
            </div>
          </div>
        </div>
      )}
    </>
  )
}
