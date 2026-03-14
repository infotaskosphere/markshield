import React, { useState } from "react"
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

export default function App() {
  const [authStage, setAuthStage] = useState("login") // "login" | "setup" | "app"
  const [currentUser, setCurrentUser] = useState(null)
  const [tmaData, setTmaData] = useState(null)
  const [agentProfile, setAgentProfile] = useState({})
  const [gcalConnected, setGcalConnected] = useState(false)

  const handleLoginSuccess = (user) => {
    setCurrentUser(user)
    setAuthStage("setup")
  }

  const handleSetupComplete = (profile, tma) => {
    setAgentProfile(profile)
    setTmaData(tma)
    setAuthStage("app")
  }

  const handleSkipToApp = () => {
    setAuthStage("app")
  }

  if (authStage === "login") {
    return <Login onSuccess={handleLoginSuccess} />
  }

  if (authStage === "setup") {
    return (
      <TMASetup
        currentUser={currentUser}
        onComplete={handleSetupComplete}
        onSkip={handleSkipToApp}
        gcalConnected={gcalConnected}
        setGcalConnected={setGcalConnected}
      />
    )
  }

  const appContext = { currentUser, tmaData, agentProfile, gcalConnected, setGcalConnected }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout context={appContext} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard context={appContext} />} />
          <Route path="portfolio" element={<Portfolio />} />
          <Route path="monitoring" element={<Monitoring context={appContext} />} />
          <Route path="search" element={<Search />} />
          <Route path="scraper" element={<Scraper context={appContext} />} />
          <Route path="pending" element={<Pending />} />
          <Route path="calendar" element={<CalendarPage context={appContext} />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="ai" element={<AI context={appContext} />} />
          <Route path="reports" element={<Reports context={appContext} />} />
          <Route path="draft" element={<Draft />} />
          <Route path="team" element={<Team context={appContext} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
