import React, { useState } from "react"
import StatCard from "../components/StatCard"

export default function Reports({ context }) {
  const [appNosInput, setAppNosInput] = useState("")
  const [reportData] = useState({
    total: 0, registered: 0, hearings: 0, successRate: 0,
    monthly: [0, 0, 0, 0, 0, 0],
  })

  const months6 = ["Oct", "Nov", "Dec", "Jan", "Feb", "Mar"]
  const maxVal = Math.max(...reportData.monthly, 1)

  const exportCSV = (label, rows = []) => {
    const header = "App No.,TM Name,Status,Class,Applicant,Filing Date,Hearing Date\n"
    const body = rows.length
      ? rows.map(r => Object.values(r).join(",")).join("\n")
      : "(No data yet)"
    const blob = new Blob([header + body], { type: "text/csv" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `MarkShield_${label}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const reportTypes = [
    { icon: "📂", title: "Portfolio Summary", sub: "All tracked trademarks with current status", label: "Portfolio" },
    { icon: "📅", title: "Hearing Calendar Report", sub: "Upcoming hearings — next 30 days", label: "Hearings" },
    { icon: "⚠", title: "Pending Replies Report", sub: "Overdue & upcoming reply deadlines", label: "Pending" },
    { icon: "📊", title: "Status Breakdown", sub: "Registered / Pending / Objected breakdown", label: "Status" },
  ]

  return (
    <>
      <div className="stats-grid">
        <StatCard
          accent="linear-gradient(90deg,#c9920a,#f0c842)"
          iconBg="rgba(201,146,10,.12)" iconColor="#f0c842"
          icon="📋" label="Total Trademarks" value={reportData.total}
          delta=" in portfolio"
        />
        <StatCard
          accent="linear-gradient(90deg,#00c4a0,#38bdf8)"
          iconBg="rgba(0,196,160,.1)" iconColor="var(--teal)"
          icon="✦" label="Registered" value={reportData.registered}
          deltaUp={reportData.successRate > 0 ? `${reportData.successRate}%` : "—"}
          delta=" success rate"
        />
        <StatCard
          accent="linear-gradient(90deg,#f59e0b,#f43f5e)"
          iconBg="rgba(245,158,11,.12)" iconColor="var(--amber)"
          icon="⏣" label="Upcoming Hearings" value={reportData.hearings}
          delta=" scheduled"
        />
        <StatCard
          accent="linear-gradient(90deg,#8b5cf6,#c9920a)"
          iconBg="rgba(139,92,246,.1)" iconColor="var(--violet)"
          icon="⏱" label="Data Syncs" value="0"
          delta=" IP India syncs"
        />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Monthly Bar Chart */}
        <div className="card">
          <div className="card-head"><h3>📈 Monthly Filing Activity</h3></div>
          <div className="card-body" style={{ padding: 20 }}>
            {reportData.monthly.every(v => v === 0) ? (
              <div style={{ textAlign: "center", padding: "40px 20px", color: "var(--text3)", fontSize: 13 }}>
                No filing activity recorded yet.<br />
                <span style={{ fontSize: 11.5 }}>Add trademarks to see monthly charts.</span>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 120 }}>
                  {reportData.monthly.map((v, i) => (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--text3)" }}>{v}</div>
                      <div style={{
                        width: "100%",
                        background: i === 5 ? "linear-gradient(180deg,#f0c842,#c9920a)" : "rgba(201,146,10,.3)",
                        borderRadius: "5px 5px 0 0",
                        height: Math.round((v / maxVal) * 100) + "px",
                      }} />
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
                  {months6.map(m => (
                    <div key={m} style={{ flex: 1, textAlign: "center", fontSize: "10.5px", color: "var(--text3)" }}>{m}</div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Export Panel */}
        <div className="card">
          <div className="card-head"><h3>📑 Export Reports</h3></div>
          <div className="card-body" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Custom TM Report */}
            <div style={{ padding: 14, background: "var(--s2)", borderRadius: 9, border: "1px solid var(--border)" }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>🔖 Custom TM Report</div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginBottom: 10 }}>Enter application numbers to generate a targeted report.</div>
              <input
                type="text"
                placeholder="e.g. 5847291, 5821043"
                value={appNosInput}
                onChange={e => setAppNosInput(e.target.value)}
                style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 10px", color: "var(--text)", fontSize: 12, outline: "none", marginBottom: 8, fontFamily: "var(--mono)" }}
              />
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button className="topbar-btn" onClick={() => exportCSV("Custom")}
                  style={{ fontSize: 12, background: "rgba(201,146,10,.12)", color: "#f0c842", border: "1px solid rgba(201,146,10,.25)" }}>
                  ⬇ Export CSV
                </button>
              </div>
            </div>

            {reportTypes.map(r => (
              <div key={r.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", background: "var(--s2)", borderRadius: 9, border: "1px solid var(--border)" }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{r.icon} {r.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{r.sub}</div>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="topbar-btn btn-ghost" onClick={() => exportCSV(r.label)} style={{ fontSize: 11, padding: "5px 10px" }}>
                    ⬇ CSV
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Status Breakdown */}
      <div className="card">
        <div className="card-head"><h3>📊 Portfolio Status Breakdown</h3></div>
        <div className="card-body" style={{ padding: 24, display: "flex", gap: 32, alignItems: "center", flexWrap: "wrap" }}>
          {reportData.total === 0 ? (
            <div style={{ flex: 1, textAlign: "center", color: "var(--text3)", fontSize: 13, padding: "24px 0" }}>
              No trademark data yet. Add trademarks to your portfolio to see the breakdown.
            </div>
          ) : (
            <>
              <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
                <svg viewBox="0 0 36 36" style={{ width: 130, height: 130, transform: "rotate(-90deg)" }}>
                  <circle r="15.9" cx="18" cy="18" fill="none" stroke="#1a2545" strokeWidth="3.8" />
                  <circle r="15.9" cx="18" cy="18" fill="none" stroke="#00c4a0" strokeWidth="3.8"
                    strokeDasharray={`${(reportData.registered / reportData.total * 100).toFixed(1)} 100`} />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "#f0c842" }}>{reportData.total}</div>
                  <div style={{ fontSize: 9, color: "var(--text3)" }}>TOTAL</div>
                </div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  ["var(--teal)", "Registered", reportData.registered],
                  ["#f0c842", "Hearing", 0],
                  ["var(--sky)", "Pending", 0],
                  ["var(--rose)", "Objected", 0],
                ].map(([color, label, count]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }} />
                      <span style={{ fontSize: 13 }}>{label}</span>
                    </div>
                    <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600 }}>{count}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
