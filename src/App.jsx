import React, { useState, useEffect } from "react"
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import Login from "./components/Login"
import TMASetup from "./components/TMASetup"
import MainLayout from "./layouts/MainLayout"
import Dashboard from "./pages/Dashboard"
import Portfolio from "./pages/Portfolio"
import Monitoring from "./pages/Monitoring"
import Search from "./pages/Search"
import Scraper from "./pages/Scraper"
import CalendarPage from "./pages/CalendarPage"
import Tasks from "./pages/Tasks"
import AI from "./pages/AI"
import Reports from "./pages/Reports"
import Team from "./pages/Team"
import Draft from "./pages/Draft"
import Pending from "./pages/Pending"

// ── localStorage helpers ───────────────────────────────────────────────────
const LS = {
  get: (key, fallback = null) => {
    try {
      const v = localStorage.getItem(key)
      return v ? JSON.parse(v) : fallback
    } catch { return fallback }
  },
  set: (key, value) => {
    try { localStorage.setItem(key, JSON.stringify(value)) } catch {}
  },
  del: (key) => { try { localStorage.removeItem(key) } catch {} },
}

const KEYS = {
  session:     "ms_session",      // { currentUser, agentProfile, tmaData, authStage }
  setupDone:   "ms_setup_done",   // boolean — skip setup if already completed
}

export default function App() {
  // ── Restore session from localStorage on first load ──────────────────────
  const saved = LS.get(KEYS.session, {})

  const [authStage,    setAuthStage]    = useState(saved.authStage    || "login")
  const [currentUser,  setCurrentUser]  = useState(saved.currentUser  || null)
  const [tmaData,      setTmaData]      = useState(saved.tmaData      || null)
  const [agentProfile, setAgentProfile] = useState(saved.agentProfile || {})

  // ── Persist session whenever it changes ──────────────────────────────────
  useEffect(() => {
    if (authStage === "app" && currentUser) {
      LS.set(KEYS.session, { authStage, currentUser, tmaData, agentProfile })
    } else if (authStage === "login") {
      // Clear session on logout
      LS.del(KEYS.session)
    }
  }, [authStage, currentUser, tmaData, agentProfile])

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLoginSuccess = (user) => {
    setCurrentUser(user)
    // If this user has already completed setup before, go straight to app
    const prevSession = LS.get(KEYS.session, {})
    if (prevSession.authStage === "app" && prevSession.currentUser?.username === user.username) {
      setAgentProfile(prevSession.agentProfile || {})
      setTmaData(prevSession.tmaData || null)
      setAuthStage("app")
    } else {
      setAuthStage("setup")
    }
  }

  const handleSetupComplete = (profile, tma) => {
    setAgentProfile(profile)
    setTmaData(tma)
    setAuthStage("app")
  }

  const handleSkipToApp = () => {
    setAuthStage("app")
  }

  const handleLogout = () => {
    LS.del(KEYS.session)
    setAuthStage("login")
    setCurrentUser(null)
    setTmaData(null)
    setAgentProfile({})
  }

  // ── Render ────────────────────────────────────────────────────────────────
  if (authStage === "login") {
    return <Login onSuccess={handleLoginSuccess} />
  }

  if (authStage === "setup") {
    return (
      <TMASetup
        currentUser={currentUser}
        onComplete={handleSetupComplete}
        onSkip={handleSkipToApp}
      />
    )
  }

  const appContext = {
    currentUser,
    tmaData,
    agentProfile,
    efilingUser:      agentProfile?.efilingUser || "",
    efilingConnected: !!(agentProfile?.efilingUser && tmaData?.connectedAt),
    onLogout:         handleLogout,
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout context={appContext} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"  element={<Dashboard    context={appContext} />} />
          <Route path="portfolio"  element={<Portfolio    context={appContext} />} />
          <Route path="monitoring" element={<Monitoring   context={appContext} />} />
          <Route path="search"     element={<Search       context={appContext} />} />
          <Route path="scraper"    element={<Scraper      context={appContext} />} />
          <Route path="pending"    element={<Pending      context={appContext} />} />
          <Route path="calendar"   element={<CalendarPage context={appContext} />} />
          <Route path="tasks"      element={<Tasks        context={appContext} />} />
          <Route path="ai"         element={<AI           context={appContext} />} />
          <Route path="reports"    element={<Reports      context={appContext} />} />
          <Route path="draft"      element={<Draft        context={appContext} />} />
          <Route path="team"       element={<Team         context={appContext} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
