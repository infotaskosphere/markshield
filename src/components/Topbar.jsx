import React, { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const PAGE_META = {
  "/dashboard":  { title: "Dashboard",             sub: "Overview of your trademark portfolio" },
  "/portfolio":  { title: "Portfolio",              sub: "Manage all trademark applications" },
  "/monitoring": { title: "TM Watch",               sub: "AI-powered conflict detection" },
  "/search":     { title: "Smart Search",           sub: "Search the IP India database" },
  "/scraper":    { title: "IP India Scraper",       sub: "Fetch live cause list & application data" },
  "/pending":    { title: "Pending Replies",        sub: "Examination reports & deadlines" },
  "/calendar":   { title: "Hearing Calendar",       sub: "Hearings, deadlines & renewals" },
  "/tasks":      { title: "Task Manager",           sub: "Track trademark-related work" },
  "/ai":         { title: "AI Legal Assistant",     sub: "Ask about trademark law & procedures" },
  "/reports":    { title: "Reports & Analytics",    sub: "Export reports and view analytics" },
  "/draft":      { title: "Draft a Reply",          sub: "AI-powered exam report & opposition drafts" },
  "/team":       { title: "Team Members",           sub: "Invite and manage your team" },
}

export default function Topbar({ context, onMenuClick }) {
  const location = useLocation()
  const navigate  = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem("ms_theme") || "dark")
  const meta = PAGE_META[location.pathname] || { title: "MarkShield", sub: "" }

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light")
    localStorage.setItem("ms_theme", theme)
  }, [theme])

  return (
    <div className="topbar">
      <div className="topbar-left">
        {/* Hamburger — visible on mobile */}
        <button className="hamburger-btn" onClick={onMenuClick} aria-label="Open menu">
          <span /><span /><span />
        </button>
        <div>
          <div className="page-title">{meta.title}</div>
          {meta.sub && <div className="page-sub">{meta.sub}</div>}
        </div>
      </div>

      <div className="topbar-right">
        <div className="search-bar">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Search trademarks..." />
        </div>
        <button className="topbar-btn btn-primary" onClick={() => navigate("/portfolio")}>
          + Add Trademark
        </button>
        <button
          className="topbar-btn btn-ghost"
          onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
          style={{ width: 34, height: 34, padding: 0, justifyContent: "center", fontSize: 16, flexShrink: 0 }}
          title="Toggle theme"
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
        <div className="notif-btn" onClick={() => navigate("/monitoring")}>🔔</div>
      </div>
    </div>
  )
}
