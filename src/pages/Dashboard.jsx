import React from "react"
import { useNavigate } from "react-router-dom"
import StatCard from "../components/StatCard"

const portfolioData = [
  { name: "FRESHMART", app: "5847291", filed: "12 Aug 2024", status: "hearing", next: "17 Mar 2026", owner: "Raj Foods Pvt" },
  { name: "TECHVEDA", app: "5821043", filed: "05 Jun 2024", status: "objected", next: "19 Mar 2026", owner: "Veda Tech" },
  { name: "ZENSPA", app: "5798432", filed: "18 Apr 2024", status: "hearing", next: "24 Mar 2026", owner: "Zen Wellness" },
  { name: "INDIGO NEST", app: "5765210", filed: "02 Feb 2024", status: "pending", next: "01 Apr 2026", owner: "Indigo Hospitality" },
  { name: "CLOUDPATH", app: "5741889", filed: "15 Dec 2023", status: "hearing", next: "05 Apr 2026", owner: "CloudPath Inc" },
]

const activities = [
  { icon: "🚨", text: "Conflict alert: FRESHKART filed (Class 29)", time: "2h ago" },
  { icon: "📋", text: "TECHVEDA hearing reminder sent", time: "5h ago" },
  { icon: "✅", text: "NEXLEARN registration confirmed", time: "1d ago" },
  { icon: "📥", text: "Examination report: ZENSPA received", time: "2d ago" },
  { icon: "📤", text: "Reply filed for CLOUDPATH objection", time: "3d ago" },
  { icon: "🔄", text: "Auto-sync with IP India completed", time: "4d ago" },
]

const chipMap = { hearing: "chip-hearing", objected: "chip-objected", pending: "chip-pending", registered: "chip-registered", refused: "chip-refused" }
const statusLabel = { hearing: "Hearing", objected: "Objected", pending: "Pending", registered: "Registered", refused: "Refused" }

const urgColor = { hearing: "var(--rose)", objected: "var(--amber)", pending: "var(--sky)" }
const urgWidth = { hearing: "85%", objected: "70%", pending: "40%" }

export default function Dashboard({ context }) {
  const navigate = useNavigate()
  const name = (context?.tmaData?.name || context?.agentProfile?.fullName || context?.currentUser?.name || "Rajesh").split(" ")[0]

  return (
    <>
      <div className="stats-grid">
        <StatCard accent="linear-gradient(90deg,var(--accent),var(--sky))" iconBg="rgba(37,99,255,.12)" iconColor="var(--accent)" icon="◈" label="Total Trademarks" value="24" deltaUp="↑ 3" delta=" added this month" />
        <StatCard accent="linear-gradient(90deg,var(--amber),var(--rose))" iconBg="rgba(245,158,11,.12)" iconColor="var(--amber)" icon="⏣" label="Upcoming Hearings" value="5" deltaDown="⚠ 2" delta=" within 7 days" />
        <StatCard accent="linear-gradient(90deg,var(--rose),var(--violet))" iconBg="rgba(244,63,94,.12)" iconColor="var(--rose)" icon="⊛" label="Active Alerts" value="3" deltaDown="1" delta=" high-risk conflict" />
        <StatCard accent="linear-gradient(90deg,var(--teal),var(--accent))" iconBg="rgba(0,212,170,.1)" iconColor="var(--teal)" icon="✦" label="Registered" value="17" deltaUp="71%" delta=" success rate" />
      </div>

      {/* Alert Banner */}
      <div className="alert-banner">
        <div className="ab-icon">⚠️</div>
        <div className="ab-text">
          <div className="ab-title">High-Risk Conflict Detected — FRESHMART vs FRESHKART</div>
          <div className="ab-sub">Filed on 08 Mar 2026 · Class 29, 30 · Similar phonetics & visual appearance detected by AI</div>
        </div>
        <button className="topbar-btn btn-primary" style={{ fontSize: 12, padding: "6px 14px" }} onClick={() => navigate("/monitoring")}>Review →</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
        {/* Upcoming Hearings */}
        <div className="card">
          <div className="card-head">
            <h3>🏛 Upcoming Hearings</h3>
            <span className="sec-link" onClick={() => navigate("/calendar")}>View Calendar →</span>
          </div>
          <div className="card-body">
            <table className="tbl">
              <thead><tr><th>Trademark</th><th>Application</th><th>Date</th><th>Status</th><th>Days Left</th></tr></thead>
              <tbody>
                {portfolioData.map((r) => (
                  <tr key={r.app} onClick={() => navigate("/calendar")} style={{ cursor: "pointer" }}>
                    <td><b>{r.name}</b></td>
                    <td className="mono">{r.app}</td>
                    <td className="mono">{r.next}</td>
                    <td><span className={`chip ${chipMap[r.status]}`}>{statusLabel[r.status]}</span></td>
                    <td>
                      <div className="urg-row">
                        <span className="urg-days" style={{ color: urgColor[r.status] || "var(--text3)" }}>—</span>
                        <div className="urg-bar"><div className="urg-fill" style={{ width: urgWidth[r.status] || "20%", background: urgColor[r.status] || "var(--accent)" }}></div></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Activity Feed */}
        <div className="card">
          <div className="card-head">
            <h3>⚡ Live Activity</h3>
            <span style={{ fontSize: 11, color: "var(--teal)" }}><span className="live-dot"></span>Real-time</span>
          </div>
          <div className="card-body">
            {activities.map((a, i) => (
              <div key={i} style={{ display: "flex", gap: 10, padding: "9px 16px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
                <span style={{ fontSize: 16, flexShrink: 0 }}>{a.icon}</span>
                <div style={{ flex: 1, fontSize: "12.5px" }}>{a.text}</div>
                <div style={{ fontSize: "10.5px", color: "var(--text3)", whiteSpace: "nowrap" }}>{a.time}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Portfolio Status Chart */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-head"><h3>📊 Portfolio Status Breakdown</h3></div>
        <div className="card-body" style={{ padding: 20, display: "flex", gap: 30, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative", width: 130, height: 130, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ width: 130, height: 130, transform: "rotate(-90deg)" }}>
              <circle r="15.9" cx="18" cy="18" fill="none" stroke="#1a2035" strokeWidth="3.8" />
              <circle r="15.9" cx="18" cy="18" fill="none" stroke="#00d4aa" strokeWidth="3.8" strokeDasharray="44.6 55.4" strokeDashoffset="0" />
              <circle r="15.9" cx="18" cy="18" fill="none" stroke="#f59e0b" strokeWidth="3.8" strokeDasharray="18.8 81.2" strokeDashoffset="-44.6" />
              <circle r="15.9" cx="18" cy="18" fill="none" stroke="#38bdf8" strokeWidth="3.8" strokeDasharray="12.6 87.4" strokeDashoffset="-63.4" />
              <circle r="15.9" cx="18" cy="18" fill="none" stroke="#f43f5e" strokeWidth="3.8" strokeDasharray="6.3 93.7" strokeDashoffset="-76" />
            </svg>
            <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500 }}>24</div>
              <div style={{ fontSize: 9, color: "var(--text3)" }}>TOTAL</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {[["var(--teal)", "Registered", "17", "71%"], ["var(--amber)", "Hearing Scheduled", "3", "12%"], ["var(--sky)", "Pending", "2", "8%"], ["var(--rose)", "Objected / Refused", "2", "9%"]].map(([color, label, count, pct]) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: color }}></div>
                  <span style={{ fontSize: 13 }}>{label}</span>
                </div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 13, fontWeight: 600 }}>
                  {count} <span style={{ color: "var(--text3)", fontWeight: 400 }}>({pct})</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
