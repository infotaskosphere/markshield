import React from "react"
import StatCard from "../components/StatCard"

const months6 = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
const vals = [3, 5, 2, 4, 6, 4]
const maxVal = Math.max(...vals)

export default function Reports({ context }) {
  const exportCSV = (label) => {
    const csv = "App No.,TM Name,Status,Class,Applicant,Filing Date,Hearing Date\n5847291,FRESHMART,Objected,29,Fresh Mart Pvt Ltd,15/01/2023,01 Apr 2026\n5821043,INDIGO NEST,Pending,43,Indigo Hospitality,02/03/2023,—"
    const blob = new Blob([csv], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `MarkShield_${label}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const reportRows = [
    { icon: "📂", title: "Portfolio Summary", sub: "All tracked trademarks with current status", label: "portfolio" },
    { icon: "📅", title: "Hearing Calendar Report", sub: "Upcoming hearings — next 30 days", label: "hearings" },
    { icon: "⚠", title: "Pending Replies Report", sub: "Overdue & upcoming reply deadlines", label: "pending" },
  ]

  return (
    <>
      <div className="stats-grid">
        <StatCard accent="var(--accent)" iconBg="rgba(37,99,255,.12)" iconColor="var(--accent)" icon="📋" label="Monthly Filings" value="538K" delta="IP India FY 2024-25" />
        <StatCard accent="var(--teal)" iconBg="rgba(0,212,170,.1)" iconColor="var(--teal)" icon="✦" label="Your Filings YTD" value="12" deltaUp="↑4" delta=" vs last year" />
        <StatCard accent="var(--amber)" iconBg="rgba(245,158,11,.12)" iconColor="var(--amber)" icon="📊" label="Success Rate" value="71%" delta="Industry avg: 58%" />
        <StatCard accent="var(--rose)" iconBg="rgba(244,63,94,.12)" iconColor="var(--rose)" icon="⏱" label="Hours Saved" value="240h" delta="vs manual tracking" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Bar Chart */}
        <div className="card">
          <div className="card-head"><h3>📈 Monthly Filing Reports</h3></div>
          <div className="card-body" style={{ padding: 20 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
              {vals.map((v, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text3)" }}>{v}</div>
                  <div style={{ width: "100%", background: i === 5 ? "var(--accent)" : "rgba(37,99,255,.3)", borderRadius: "5px 5px 0 0", height: Math.round((v / maxVal) * 100) + "px", transition: "height .5s" }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              {months6.map((m) => (
                <div key={m} style={{ flex: 1, textAlign: "center", fontSize: "10.5px", color: "var(--text3)" }}>{m}</div>
              ))}
            </div>
          </div>
        </div>

        {/* Export Panel */}
        <div className="card">
          <div className="card-head"><h3>📑 Export TM Reports</h3></div>
          <div className="card-body" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>

            {/* Custom TM Report */}
            <div style={{ padding: 14, background: "var(--s2)", borderRadius: 9, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🔖 Custom TM Report</div>
              <div style={{ fontSize: "11.5px", color: "var(--text3)", marginBottom: 10 }}>Enter one or more application numbers to generate a targeted report.</div>
              <input
                id="exportAppNos"
                type="text"
                placeholder="e.g. 5847291, 5821043, 5798432"
                style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12, outline: "none", marginBottom: 8, fontFamily: "var(--mono)" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="topbar-btn" onClick={() => exportCSV("Custom_PDF")} style={{ fontSize: 12, background: "rgba(239,68,68,.12)", color: "#f87171", border: "1px solid rgba(239,68,68,.25)" }}>⬇ PDF Report</button>
                <button className="topbar-btn" onClick={() => exportCSV("Custom_Excel")} style={{ fontSize: 12, background: "rgba(33,163,70,.12)", color: "#4ade80", border: "1px solid rgba(33,163,70,.25)" }}>⬇ Excel Report</button>
              </div>
            </div>

            {reportRows.map((r) => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--s2)", borderRadius: 9, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.icon} {r.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.sub}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="topbar-btn" onClick={() => exportCSV(r.label + "_PDF")} style={{ fontSize: "11.5px", padding: "5px 10px", background: "rgba(239,68,68,.12)", color: "#f87171", border: "1px solid rgba(239,68,68,.25)" }}>⬇ PDF</button>
                  <button className="topbar-btn" onClick={() => exportCSV(r.label + "_Excel")} style={{ fontSize: "11.5px", padding: "5px 10px", background: "rgba(33,163,70,.12)", color: "#4ade80", border: "1px solid rgba(33,163,70,.25)" }}>⬇ Excel</button>
                </div>
              </div>
            ))}

            <div style={{ fontSize: "10.5px", color: "var(--text3)", padding: "4px 2px" }}>
              💡 Reports include: App No., TM name, status, pending cases count, hearing dates, examiner notes, and days left for replies.
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
