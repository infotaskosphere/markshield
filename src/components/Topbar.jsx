import React, { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"

const PAGE_META = {
  "/dashboard":  { title: "Dashboard",              sub: "Overview of your trademark portfolio" },
  "/portfolio":  { title: "Portfolio",               sub: "Manage and track all trademark applications" },
  "/monitoring": { title: "TM Watch & Monitoring",   sub: "AI-powered conflict detection & real-time alerts" },
  "/search":     { title: "Smart Trademark Search",  sub: "Search the IP India public trademark database" },
  "/scraper":    { title: "IP India Scraper",        sub: "Fetch live cause list and application data" },
  "/pending":    { title: "Pending Replies",         sub: "Examination reports, opposition replies & deadlines" },
  "/calendar":   { title: "Hearing Calendar",        sub: "All hearings, deadlines & renewals" },
  "/tasks":      { title: "Task Manager",            sub: "Track all trademark-related work" },
  "/ai":         { title: "AI Legal Assistant",      sub: "Ask anything about trademark law and procedures" },
  "/reports":    { title: "Analytics & Reports",     sub: "Export reports and view portfolio analytics" },
  "/draft":      { title: "Draft a Reply",           sub: "AI-powered drafting for examination reports & opposition" },
  "/team":       { title: "Team Members",            sub: "Invite and manage your firm's team" },
}

export default function Topbar({ context }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem("ms_theme") || "dark")

  const meta = PAGE_META[location.pathname] || { title: "MarkShield", sub: "" }

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light")
    localStorage.setItem("ms_theme", theme)
  }, [theme])

  return (
    <div className="topbar">
      <div className="topbar-left">
        <div>
          <div className="page-title">{meta.title}</div>
          {meta.sub && <div className="page-sub">{meta.sub}</div>}
        </div>
      </div>
      <div className="topbar-right">
        <div className="search-bar">
          <span className="search-icon">⌕</span>
          <input type="text" placeholder="Search trademarks, app numbers..." />
        </div>
        <button
          className="topbar-btn btn-primary"
          onClick={() => navigate("/portfolio")}
        >
          + Add Trademark
        </button>
        <button
          className="topbar-btn btn-ghost"
          onClick={() => setTheme(t => t === "dark" ? "light" : "dark")}
          title="Toggle light/dark mode"
          style={{ width: 34, height: 34, padding: 0, justifyContent: "center", fontSize: 16, flexShrink: 0 }}
        >
          {theme === "dark" ? "🌙" : "☀️"}
        </button>
        <div className="notif-btn" onClick={() => navigate("/monitoring")}>
          🔔
        </div>
      </div>
    </div>
  )
}
