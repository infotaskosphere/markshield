import React, { useState, useRef, useEffect } from "react"
import { NavLink, useNavigate } from "react-router-dom"

const NAV = [
  { section: "Overview" },
  { to: "/dashboard", icon: "⬡", label: "Dashboard" },
  { to: "/portfolio", icon: "◈", label: "Portfolio" },
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
  { to: "/team",   icon: "👥", label: "Team Members" },
  { section: "Data" },
  { to: "/import", icon: "📥", label: "Bulk Import",  badge: "DB", badgeCls: "blue" },
]

// ── Profile Edit Modal ────────────────────────────────────────────────────────
function ProfileModal({ context, onClose }) {
  const { agentProfile, tmaData, currentUser, onProfileUpdate } = context || {}

  const [tab, setTab] = useState("profile") // profile | efiling | account
  const [saved, setSaved] = useState(false)

  // Profile fields
  const [fullName, setFullName] = useState(agentProfile?.fullName || currentUser?.name || "")
  const [firmName, setFirmName] = useState(agentProfile?.firmName || "")
  const [email,    setEmail]    = useState(agentProfile?.email    || currentUser?.email || "")
  const [mobile,   setMobile]   = useState(agentProfile?.mobile   || "")
  const [city,     setCity]     = useState(agentProfile?.city     || "")
  const [state,    setState2]   = useState(agentProfile?.state    || "")
  const [barNo,    setBarNo]    = useState(agentProfile?.barNo    || "")
  const [years,    setYears]    = useState(agentProfile?.years    || "")

  const inp = {
    width: "100%", background: "#020610", border: "1.5px solid #1a2545",
    borderRadius: 9, padding: "9px 12px", color: "#dde4f2",
    fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none",
  }
  const lbl = { display: "block", fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 5 }

  const saveProfile = () => {
    const updated = { ...agentProfile, fullName, firmName, email, mobile, city, state: state, barNo, years }
    onProfileUpdate?.(updated, tmaData)
    setSaved(true)
    setTimeout(() => { setSaved(false); onClose() }, 1200)
  }

  const efilingConnected = !!(tmaData?.connectedAt)

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.75)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ background: "#070d1e", border: "1px solid rgba(201,146,10,.2)", borderRadius: 18, width: 520, maxWidth: "100%", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", animation: "authIn .3s cubic-bezier(.16,1,.3,1)" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px 0", borderBottom: "1px solid #1a2545", display: "flex", alignItems: "center", justifyContent: "space-between", paddingBottom: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-.3px", color: "#dde4f2" }}>⚙ Account Settings</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#3d4f78", cursor: "pointer", fontSize: 20, lineHeight: 1, padding: "0 0 4px" }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1a2545", padding: "0 24px" }}>
          {[["profile","👤 Profile"], ["efiling","🔗 eFiling"], ["account","🔐 Account"]].map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)} style={{
              background: "none", border: "none", borderBottom: `2px solid ${tab === t ? "#c9920a" : "transparent"}`,
              color: tab === t ? "#f0c842" : "#3d4f78", fontSize: 12.5, fontWeight: tab === t ? 700 : 500,
              fontFamily: "'Bricolage Grotesque',sans-serif", cursor: "pointer", padding: "12px 14px 10px", transition: "all .18s"
            }}>{label}</button>
          ))}
        </div>

        {/* Body */}
        <div style={{ overflowY: "auto", flex: 1, padding: "20px 24px" }}>

          {/* ── Profile Tab ── */}
          {tab === "profile" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>Full Name *</label><input style={inp} value={fullName} onChange={e => setFullName(e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
                <div><label style={lbl}>Firm / Practice</label><input style={inp} value={firmName} onChange={e => setFirmName(e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>Email</label><input style={inp} type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
                <div><label style={lbl}>Mobile</label><input style={inp} value={mobile} onChange={e => setMobile(e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>City</label><input style={inp} value={city} onChange={e => setCity(e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
                <div><label style={lbl}>State</label>
                  <select style={{ ...inp, cursor: "pointer" }} value={state} onChange={e => setState2(e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"}>
                    <option value="">Select State</option>
                    {["Gujarat","Maharashtra","Delhi","Karnataka","Tamil Nadu","Rajasthan","Uttar Pradesh","West Bengal","Telangana","Punjab","Haryana","Kerala","Madhya Pradesh","Odisha","Andhra Pradesh"].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div><label style={lbl}>TMA / Bar Council No.</label><input style={inp} value={barNo} onChange={e => setBarNo(e.target.value)} placeholder="e.g. TMA/GJ/2847" onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
                <div><label style={lbl}>Years of Practice</label>
                  <select style={{ ...inp, cursor: "pointer" }} value={years} onChange={e => setYears(e.target.value)}>
                    <option value="">Select</option>
                    {["0-2","3-5","5-10","10-20","20+"].map(y => <option key={y} value={y}>{y} years</option>)}
                  </select>
                </div>
              </div>
              <button onClick={saveProfile} style={{ background: saved ? "rgba(0,196,160,.2)" : "linear-gradient(135deg,#c9920a,#7a5800)", border: "none", borderRadius: 9, padding: "11px", color: "#fff", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", transition: "all .2s" }}>
                {saved ? "✅ Saved!" : "Save Profile"}
              </button>
            </div>
          )}

          {/* ── eFiling Tab ── */}
          {tab === "efiling" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ background: efilingConnected ? "rgba(0,196,160,.08)" : "rgba(244,63,94,.07)", border: `1px solid ${efilingConnected ? "rgba(0,196,160,.2)" : "rgba(244,63,94,.18)"}`, borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 22 }}>{efilingConnected ? "✅" : "⚠️"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: efilingConnected ? "#00c4a0" : "#f43f5e" }}>
                    {efilingConnected ? `Connected — ${tmaData?.tmaCode || tmaData?.username || ""}` : "Not Connected"}
                  </div>
                  <div style={{ fontSize: 11.5, color: "#3d4f78", marginTop: 2 }}>
                    {efilingConnected
                      ? `Last connected: ${tmaData?.connectedAt ? new Date(tmaData.connectedAt).toLocaleDateString() : "—"}`
                      : "Connect your IP India eFiling account to auto-import trademarks"}
                  </div>
                </div>
              </div>

              <div style={{ background: "rgba(201,146,10,.06)", border: "1px solid rgba(201,146,10,.15)", borderRadius: 10, padding: "14px 16px", fontSize: 12.5, color: "#8898bf", lineHeight: 1.8 }}>
                ℹ To reconnect or change eFiling credentials, sign out and sign back in — the setup wizard will run again with your new credentials.
              </div>

              <button onClick={() => { onClose(); context?.onRerunSetup?.() }}
                style={{ background: "rgba(201,146,10,.12)", border: "1px solid rgba(201,146,10,.25)", borderRadius: 9, padding: "11px", color: "#f0c842", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 600, cursor: "pointer", width: "100%" }}>
                🔁 Re-run eFiling Setup
              </button>
            </div>
          )}

          {/* ── Account Tab ── */}
          {tab === "account" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* User info card */}
              <div style={{ background: "#0d1530", border: "1px solid #1a2545", borderRadius: 10, padding: "14px 16px", display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ width: 42, height: 42, borderRadius: "50%", background: "linear-gradient(145deg,#c9920a,#7a5800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {(currentUser?.name || "?").split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#dde4f2" }}>{currentUser?.name}</div>
                  <div style={{ fontSize: 12, color: "#3d4f78" }}>{currentUser?.username} · {currentUser?.role}</div>
                  <div style={{ fontSize: 11, color: "#3d4f78", marginTop: 1 }}>{currentUser?.email}</div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#3d4f78", background: "#0d1530", border: "1px solid #1a2545", borderRadius: 8, padding: "10px 14px", lineHeight: 1.7 }}>
                To change your <b style={{ color: "#8898bf" }}>password</b>, go to the Login screen → Forgot Password → Admin Panel.
              </div>

              {/* Sign out */}
              <button onClick={() => { onClose(); if (window.confirm("Sign out of MarkShield?")) context?.onLogout?.() }}
                style={{ background: "rgba(244,63,94,.1)", border: "1px solid rgba(244,63,94,.25)", borderRadius: 9, padding: "12px", color: "#f43f5e", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all .18s" }}
                onMouseOver={e => e.currentTarget.style.background="rgba(244,63,94,.18)"}
                onMouseOut={e => e.currentTarget.style.background="rgba(244,63,94,.1)"}>
                ⎋ Sign Out of MarkShield
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────
export default function Sidebar({ context, mobileOpen, onClose }) {
  const { tmaData, agentProfile, currentUser, onLogout } = context || {}
  const navigate = useNavigate()
  const [showProfile, setShowProfile] = useState(false)

  const name     = agentProfile?.fullName || tmaData?.name || currentUser?.name || "MarkShield User"
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase()
  const role     = agentProfile?.firmName || agentProfile?.role || currentUser?.role || "IP Attorney"
  const city     = agentProfile?.city ? ` · ${agentProfile.city}` : ""

  return (
    <>
      {mobileOpen && (
        <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.55)", zIndex: 98, backdropFilter: "blur(2px)" }} />
      )}

      <aside className={`sidebar${mobileOpen ? " sidebar-mobile-open" : ""}`}>
        <div className="logo-area" style={{ justifyContent: "center", position: "relative", padding: "16px 18px" }}>
          <button onClick={onClose} className="sidebar-close-btn" style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)" }}>✕</button>
          <img
            src="/logo.png"
            alt="MarkShield"
            style={{ height: 52, width: "auto", objectFit: "contain", display: "block" }}
            onError={e => {
              e.target.style.display = "none"
              e.target.nextSibling.style.display = "flex"
            }}
          />
          <div style={{ display: "none", alignItems: "center", gap: 10 }}>
            <div className="logo-mark">⚖</div>
            <div className="logo-name">Mark<em>Shield</em></div>
          </div>
        </div>

        <div className="nav-scroll">
          {NAV.map((item, i) => {
            if (item.section) return <div key={i} className="nav-section-label">{item.section}</div>
            return (
              <NavLink key={item.to} to={item.to} onClick={onClose}
                className={({ isActive }) => "nav-item" + (isActive ? " active" : "")}>
                <span className="nav-icon">{item.icon}</span>
                {item.label}
                {item.badge && <span className={`nav-badge${item.badgeCls ? " " + item.badgeCls : ""}`}>{item.badge}</span>}
              </NavLink>
            )
          })}
        </div>

        <div className="sidebar-footer">
          {/* User card — click opens profile modal */}
          <div className="user-card" onClick={() => setShowProfile(true)} title="Edit profile & settings">
            <div className="user-avatar">{initials}</div>
            <div className="user-info">
              <div className="user-name">{name}</div>
              <div className="user-role">{role}{city}</div>
            </div>
            <div className="user-settings" title="Settings">⚙</div>
          </div>

          {/* Quick sign-out button */}
          {onLogout && (
            <button
              onClick={() => { if (window.confirm("Sign out of MarkShield?")) onLogout() }}
              style={{ width: "100%", marginTop: 8, background: "none", border: "1px solid var(--border)", borderRadius: 8, padding: "8px", cursor: "pointer", color: "var(--text3)", fontSize: 12, fontFamily: "var(--head)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, transition: "all .18s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor="var(--rose)"; e.currentTarget.style.color="var(--rose)" }}
              onMouseOut={e => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.color="var(--text3)" }}>
              ⎋ Sign Out
            </button>
          )}
        </div>
      </aside>

      {/* Profile modal */}
      {showProfile && <ProfileModal context={context} onClose={() => setShowProfile(false)} />}
    </>
  )
}
