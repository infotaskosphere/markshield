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
    try { localStorage.setItem(key, JSON.stringify(value)) } catch(_e) {}
  },
  del: (key) => { try { localStorage.removeItem(key) } catch(_e) {} },
}

const KEYS = {
  session:  "ms_session",   // { currentUser, authStage } — cleared on logout
  profiles: "ms_profiles",  // { [username]: { agentProfile, tmaData } } — NEVER cleared on logout
}

export default function App() {
  // ── Restore session from localStorage on first load ──────────────────────
  const saved = LS.get(KEYS.session, {})

  const [authStage,    setAuthStage]    = useState(saved.authStage    || "login")
  const [currentUser,  setCurrentUser]  = useState(saved.currentUser  || null)
  const [tmaData,      setTmaData]      = useState(() => {
    // If session is active, restore tmaData from per-user profiles store
    if (saved.authStage === "app" && saved.currentUser?.username) {
      const profiles = LS.get(KEYS.profiles, {})
      return profiles[saved.currentUser.username]?.tmaData || null
    }
    return null
  })
  const [agentProfile, setAgentProfile] = useState(() => {
    if (saved.authStage === "app" && saved.currentUser?.username) {
      const profiles = LS.get(KEYS.profiles, {})
      return profiles[saved.currentUser.username]?.agentProfile || {}
    }
    return {}
  })

  // ── Persist session whenever it changes ──────────────────────────────────
  useEffect(() => {
    if (authStage === "app" && currentUser) {
      // Save lightweight session (just who is logged in + stage)
      LS.set(KEYS.session, { authStage, currentUser })
      // Save setup data keyed by username so it survives logout
      const profiles = LS.get(KEYS.profiles, {})
      profiles[currentUser.username] = { agentProfile, tmaData }
      LS.set(KEYS.profiles, profiles)
    } else if (authStage === "login") {
      // Only clear the session token — NOT the profiles store
      LS.del(KEYS.session)
    }
  }, [authStage, currentUser, tmaData, agentProfile])

  // ── Auth handlers ─────────────────────────────────────────────────────────
  const handleLoginSuccess = (user) => {
    setCurrentUser(user)
    // Check per-user profiles store (survives logout)
    const profiles = LS.get(KEYS.profiles, {})
    const userProfile = profiles[user.username]
    if (userProfile) {
      // User has completed setup before — restore their data and go straight to app
      setAgentProfile(userProfile.agentProfile || {})
      setTmaData(userProfile.tmaData || null)
      setAuthStage("app")
    } else {
      // First time for this user — run setup
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
    // Clear session but KEEP profiles so setup isn't repeated on next login
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
