import React from "react"
import { NavLink, useNavigate } from "react-router-dom"

const NAV = [
  { section: "Overview" },
  { to: "/dashboard", icon: "⬡", label: "Dashboard" },
  { to: "/portfolio", icon: "◈", label: "Portfolio", badge: "24", badgeCls: "blue" },
  { section: "Monitoring" },
  { to: "/monitoring", icon: "⊛", label: "TM Watch", badge: "3" },
  { to: "/search", icon: "⌕", label: "Smart Search" },
  { to: "/scraper", icon: "↻", label: "Data Scraper" },
  { to: "/pending", icon: "⚠", label: "Pending Replies" },
  { section: "Compliance" },
  { to: "/calendar", icon: "⏣", label: "Hearing Calendar", badge: "5" },
  { to: "/tasks", icon: "✦", label: "Task Manager" },
  { section: "Intelligence" },
  { to: "/ai", icon: "◉", label: "AI Assistant", badge: "AI", badgeCls: "teal" },
  { to: "/reports", icon: "▤", label: "Reports" },
  { section: "Drafting" },
  { to: "/draft", icon: "✍", label: "Draft a Reply", badge: "AI", badgeCls: "teal" },
  { section: "Team" },
  { to: "/team", icon: "👥", label: "Team Members" },
]

export default function Sidebar({ context }) {
  const { tmaData, agentProfile, currentUser } = context || {}

  const name =
    (tmaData && tmaData.name) ||
    (agentProfile && agentProfile.fullName) ||
    (currentUser && currentUser.name) ||
    "Rajesh Sharma"

  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const role =
    agentProfile?.firmName
      ? `IP Attorney · ${agentProfile.firmName}`
      : "IP Attorney · Pro Plan"

  return (
    <aside className="sidebar">
      <div className="logo-area">
        <div className="logo-mark">M</div>
        <div>
          <div className="logo-name">
            Mark<em>Shield</em>
          </div>
          <div className="logo-tag">AI Trademark Platform</div>
        </div>
      </div>

      <div className="nav-scroll">
        {NAV.map((item, i) => {
          if (item.section) {
            return (
              <div key={i} className="nav-section-label">
                {item.section}
              </div>
            )
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                "nav-item" + (isActive ? " active" : "")
              }
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge && (
                <span className={`nav-badge${item.badgeCls ? " " + item.badgeCls : ""}`}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          )
        })}
      </div>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar">{initials}</div>
          <div className="user-info">
            <div className="user-name">{name}</div>
            <div className="user-role">{role}</div>
          </div>
          <div className="user-settings">⚙</div>
        </div>
      </div>
    </aside>
  )
}
