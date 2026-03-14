import React from "react"
import { Outlet } from "react-router-dom"
import Sidebar from "../components/Sidebar"
import Topbar from "../components/Topbar"

export default function MainLayout({ context }) {
  return (
    <div className="shell">
      <Sidebar context={context} />
      <div className="main">
        <Topbar context={context} />
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  )
}
