import React, { useState } from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Topbar from "../components/Topbar"

export default function MainLayout({ context }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="shell">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed", inset: 0, background: "rgba(0,0,0,.6)",
            zIndex: 99, display: "none"
          }}
          className="sidebar-overlay"
        />
      )}

      <Sidebar context={context} mobileOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main">
        <Topbar context={context} onMenuClick={() => setSidebarOpen(o => !o)} />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
