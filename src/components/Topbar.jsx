import React, { useState, useEffect } from "react"
import { useLocation, useNavigate } from "react-router-dom"
import Modal from "./Modal"

const PAGE_META = {
  "/dashboard": { title: "Dashboard", sub: "Welcome back — 3 hearings this week" },
  "/portfolio": { title: "Portfolio", sub: "24 trademarks across 8 clients" },
  "/monitoring": { title: "TM Watch & Monitoring", sub: "AI-powered conflict detection & real-time alerts" },
  "/search": { title: "Smart Trademark Search", sub: "Reduce duplication risk before filing" },
  "/scraper": { title: "IP India Scraper", sub: "Fetch live data from IP India database" },
  "/pending": { title: "Pending Replies", sub: "Examination reports, opposition replies & deadlines" },
  "/calendar": { title: "Hearing Calendar", sub: "All your hearings, deadlines & renewals" },
  "/tasks": { title: "Task Manager", sub: "Track all IP-related work" },
  "/ai": { title: "AI Legal Assistant", sub: "Ask anything about trademark law & your portfolio" },
  "/reports": { title: "Analytics & Reports", sub: "Monthly filing reports & analytics" },
  "/draft": { title: "Draft a Reply", sub: "AI-powered replies to Examination Reports & Opposition Notices" },
  "/team": { title: "Team Members", sub: "Manage your team — attorneys, clerks & paralegals" },
}

export default function Topbar({ context }) {
  const location = useLocation()
  const navigate = useNavigate()
  const [theme, setTheme] = useState(() => localStorage.getItem("ms_theme") || "dark")
  const [addModalOpen, setAddModalOpen] = useState(false)

  const meta = PAGE_META[location.pathname] || { title: "MarkShield", sub: "" }

  useEffect(() => {
    if (theme === "light") {
      document.documentElement.classList.add("light")
    } else {
      document.documentElement.classList.remove("light")
    }
    localStorage.setItem("ms_theme", theme)
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === "dark" ? "light" : "dark"))

  return (
    <>
      <div className="topbar">
        <div className="topbar-left">
          <div>
            <div className="page-title">{meta.title}</div>
            <div className="page-sub">{meta.sub}</div>
          </div>
        </div>
        <div className="topbar-right">
          <div className="search-bar">
            <span className="search-icon">⌕</span>
            <input type="text" placeholder="Search trademarks, classes, clients..." />
          </div>
          <button className="topbar-btn btn-primary" onClick={() => setAddModalOpen(true)}>
            + Add Trademark
          </button>
          <button
            className="topbar-btn btn-ghost"
            onClick={toggleTheme}
            title="Toggle light/dark mode"
            style={{ width: 34, height: 34, padding: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}
          >
            {theme === "dark" ? "🌙" : "☀️"}
          </button>
          <div className="notif-btn" onClick={() => navigate("/monitoring")}>
            🔔<div className="notif-dot"></div>
          </div>
        </div>
      </div>

      <Modal isOpen={addModalOpen} onClose={() => setAddModalOpen(false)} title="Add Trademark" sub="Add a new trademark to your portfolio for tracking">
        <div className="mf"><label>Trademark Name</label><input type="text" placeholder="e.g. FRESHMART" /></div>
        <div className="mf"><label>Application Number</label><input type="text" placeholder="e.g. 5847291" style={{ fontFamily: "var(--mono)" }} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="mf"><label>Class</label><select><option>Class 29</option><option>Class 35</option><option>Class 9</option><option>Class 42</option></select></div>
          <div className="mf"><label>Status</label><select><option>Pending</option><option>Hearing</option><option>Objected</option><option>Registered</option></select></div>
        </div>
        <div className="mf"><label>Filing Date</label><input type="date" /></div>
        <div className="mf"><label>Next Hearing Date</label><input type="date" /></div>
        <div className="mf"><label>Notes</label><textarea placeholder="Any additional notes..." /></div>
        <div className="modal-btns">
          <button className="topbar-btn btn-ghost" onClick={() => setAddModalOpen(false)}>Cancel</button>
          <button className="topbar-btn btn-primary" onClick={() => setAddModalOpen(false)}>Save Trademark</button>
        </div>
      </Modal>
    </>
  )
}
