import React from "react"
import { useNavigate } from "react-router-dom"
import StatCard from "../components/StatCard"

export default function Dashboard({ context }) {
  const navigate = useNavigate()
  const name = (context?.tmaData?.name || context?.agentProfile?.fullName || context?.currentUser?.name || "").split(" ")[0]

  // Stats will be 0 until real data is added
  const stats = {
    total: 0,
    hearings: 0,
    alerts: 0,
    registered: 0,
  }

  const isEmpty = stats.total === 0

  return (
    <>
      <div className="stats-grid">
        <StatCard
          accent="linear-gradient(90deg,#c9920a,#f0c842)"
          iconBg="rgba(201,146,10,.12)" iconColor="#f0c842"
          icon="◈" label="Total Trademarks" value={stats.total}
          delta=" in your portfolio"
        />
        <StatCard
          accent="linear-gradient(90deg,#f59e0b,#f43f5e)"
          iconBg="rgba(245,158,11,.12)" iconColor="#f59e0b"
          icon="⏣" label="Upcoming Hearings" value={stats.hearings}
          delta=" scheduled"
        />
        <StatCard
          accent="linear-gradient(90deg,#f43f5e,#8b5cf6)"
          iconBg="rgba(244,63,94,.12)" iconColor="#f43f5e"
          icon="⊛" label="Active Alerts" value={stats.alerts}
          delta=" requiring action"
        />
        <StatCard
          accent="linear-gradient(90deg,#00c4a0,#c9920a)"
          iconBg="rgba(0,196,160,.1)" iconColor="#00c4a0"
          icon="✦" label="Registered" value={stats.registered}
          delta=" successfully registered"
        />
      </div>

      {isEmpty ? (
        <div className="card" style={{ marginTop: 0 }}>
          <div className="empty-state" style={{ padding: "80px 40px" }}>
            <div className="empty-icon">⚖️</div>
            <div className="empty-title">Your dashboard is ready</div>
            <div className="empty-sub">
              Start by adding trademarks to your portfolio or run the data scraper to pull live data from IP India.
              Your hearings, alerts and activity will appear here automatically.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="topbar-btn btn-primary" onClick={() => navigate("/portfolio")}>
                + Add Trademark
              </button>
              <button className="topbar-btn btn-ghost" onClick={() => navigate("/scraper")}>
                🔄 Run Scraper
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 16 }}>
          <div className="card">
            <div className="card-head">
              <h3>🏛 Upcoming Hearings</h3>
              <span className="sec-link" onClick={() => navigate("/calendar")}>View Calendar →</span>
            </div>
            <div className="card-body">
              <div className="empty-state" style={{ padding: 40 }}>
                <div style={{ fontSize: 28 }}>📅</div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>No upcoming hearings</div>
              </div>
            </div>
          </div>
          <div className="card">
            <div className="card-head">
              <h3>⚡ Live Activity</h3>
              <span style={{ fontSize: 11, color: "var(--teal)" }}><span className="live-dot" />Real-time</span>
            </div>
            <div className="card-body">
              <div className="empty-state" style={{ padding: 40 }}>
                <div style={{ fontSize: 28 }}>📋</div>
                <div style={{ fontSize: 13, color: "var(--text3)" }}>No recent activity</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card" style={{ marginTop: isEmpty ? 16 : 16 }}>
        <div className="card-head"><h3>⚡ Quick Actions</h3></div>
        <div className="card-body" style={{ padding: 20, display: "flex", gap: 12, flexWrap: "wrap" }}>
          {[
            { icon: "📋", label: "Fetch Cause List", sub: "Pull today's IP India hearings", path: "/scraper", color: "#c9920a" },
            { icon: "🔍", label: "Search Trademarks", sub: "Search IP India public database", path: "/search", color: "#38bdf8" },
            { icon: "⚖️", label: "TM Watch", sub: "Monitor for conflicts", path: "/monitoring", color: "#f43f5e" },
            { icon: "✍️", label: "Draft Reply", sub: "AI-assisted hearing reply", path: "/draft", color: "#00c4a0" },
            { icon: "📊", label: "Reports", sub: "Generate portfolio report", path: "/reports", color: "#8b5cf6" },
          ].map((a) => (
            <div key={a.path}
              onClick={() => navigate(a.path)}
              style={{
                background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 12,
                padding: "16px 20px", cursor: "pointer", flex: "1 1 160px", minWidth: 160,
                transition: "all .2s",
              }}
              onMouseOver={e => { e.currentTarget.style.borderColor = a.color; e.currentTarget.style.transform = "translateY(-2px)" }}
              onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.transform = "" }}
            >
              <div style={{ fontSize: 22, marginBottom: 8 }}>{a.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{a.label}</div>
              <div style={{ fontSize: 11.5, color: "var(--text3)", marginTop: 3 }}>{a.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
