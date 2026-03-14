import React from "react"
import { NavLink, useNavigate } from "react-router-dom"

const NAV = [
  { section: "Overview" },
  { to: "/dashboard", icon: "⬡", label: "Dashboard" },
  { to: "/portfolio", icon: "◈", label: "Portfolio", badge: null },
  { section: "Monitoring" },
  { to: "/monitoring", icon: "⊛", label: "TM Watch" },
  { to: "/search",    icon: "⌕", label: "Smart Search" },
  { to: "/scraper",   icon: "↻", label: "Data Scraper" },
  { to: "/pending",   icon: "⚠", label: "Pending Replies" },
  { section: "Compliance" },
  { to: "/calendar",  icon: "⏣", label: "Hearing Calendar" },
  { to: "/tasks",     icon: "✦", label: "Task Manager" },
  { section: "Intelligence" },
  { to: "/ai",      icon: "◉", label: "AI Assistant",  badge: "AI", badgeCls: "teal" },
  { to: "/reports", icon: "▤", label: "Reports" },
  { section: "Drafting" },
  { to: "/draft", icon: "✍", label: "Draft a Reply", badge: "AI", badgeCls: "teal" },
  { section: "Team" },
  { to: "/team", icon: "👥", label: "Team Members" },
]

export default function Sidebar({ context, mobileOpen, onClose }) {
  const { tmaData, agentProfile, currentUser } = context || {}
  const navigate = useNavigate()

  const name     = tmaData?.name || agentProfile?.fullName || currentUser?.name || "MarkShield User"
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const role     = agentProfile?.firmName ? `IP Attorney · ${agentProfile.firmName}` : "IP Attorney"

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobileOpen && (
        <div onClick={onClose} style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.55)",
          zIndex: 98, backdropFilter: "blur(2px)"
        }} />
      )}

      <aside className={`sidebar${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <div className="logo-area">
          {/* Mobile close button */}
          <button onClick={onClose} className="sidebar-close-btn" aria-label="Close menu">✕</button>
          <div className="logo-mark">⚖</div>
          <div>
            <div className="logo-name">Mark<em>Shield</em></div>
            <div className="logo-tag">AI Trademark Platform</div>
          </div>
        </div>

        <div className="nav-scroll">
          {NAV.map((item, i) => {
            if (item.section) return <div key={i} className="nav-section-label">{item.section}</div>
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}
              >
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && (
                  <span className={`nav-badge${item.badgeCls ? " " + item.badgeCls : ""}`}>{item.badge}</span>
                )}
              </NavLink>
            )
          })}
        </div>

        <div className="sidebar-footer">
          <div className="user-card" onClick={() => { navigate("/team"); onClose?.() }}>
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{name}</div>
              <div className="user-role">{role}</div>
            </div>
            <div className="user-settings">⚙</div>
          </div>
        </div>
      </aside>
    </>
  )
}
