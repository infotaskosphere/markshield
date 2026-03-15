import React, { useState, useEffect } from "react"

const ACCOUNTS_KEY = "markshield_accounts"
const ADMIN_KEY    = "markshield_admin_code"

// ── Helpers ───────────────────────────────────────────────────────────────────
function loadAccounts() {
  try {
    const raw = localStorage.getItem(ACCOUNTS_KEY)
    if (raw) return JSON.parse(raw)
  } catch(_e) {}
  // First-ever load — seed the admin account with Manthan's email
  const defaults = [{
    id:        "admin_001",
    username:  "admin",
    email:     "",           // admin sets this during first login
    password:  "admin123",
    name:      "Admin",
    role:      "IP Attorney",
    isAdmin:   true,
    status:    "active",
    tmCode:    "",
    createdAt: new Date().toISOString(),
    lastLogin: null,
  }]
  localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(defaults))
  return defaults
}

function saveAccounts(accounts) {
  try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)) } catch(_e) {}
}

// Match by username OR email (case-insensitive)
function findAccount(accounts, identifier, password) {
  const id = identifier.trim().toLowerCase()
  return accounts.find(a =>
    (a.username.toLowerCase() === id || (a.email || "").toLowerCase() === id) &&
    a.password === password &&
    a.status !== "blocked"
  )
}

// ── Main Login Component ──────────────────────────────────────────────────────
export default function Login({ onSuccess }) {
  const [mode,     setMode]     = useState("login") // login | register | admin
  const [accounts, setAccounts] = useState([])

  // Login
  const [identifier, setIdentifier] = useState("")
  const [password,   setPassword]   = useState("")
  const [error,      setError]      = useState("")
  const [loading,    setLoading]    = useState(false)

  // Register
  const [regName,     setRegName]     = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [regEmail,    setRegEmail]    = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm,  setRegConfirm]  = useState("")
  const [regRole,     setRegRole]     = useState("IP Attorney")
  const [regTmCode,   setRegTmCode]   = useState("")
  const [regError,    setRegError]    = useState("")
  const [regSuccess,  setRegSuccess]  = useState("")

  // Admin panel
  const [adminPass,   setAdminPass]   = useState("")
  const [adminOpen,   setAdminOpen]   = useState(false)
  const [adminError,  setAdminError]  = useState("")

  useEffect(() => { setAccounts(loadAccounts()) }, [])

  const switchMode = (m) => {
    setMode(m); setError(""); setRegError(""); setRegSuccess(""); setAdminError("")
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = () => {
    setError("")
    if (!identifier.trim() || !password.trim()) {
      setError("Please enter your username/email and password.")
      return
    }
    const acc = findAccount(accounts, identifier, password)
    if (!acc) {
      // Give helpful hint if email looks correct but wrong password
      const emailMatch = accounts.find(a => (a.email || "").toLowerCase() === identifier.toLowerCase() || a.username.toLowerCase() === identifier.toLowerCase())
      if (emailMatch && emailMatch.status === "blocked") {
        setError("Your account has been blocked by the admin. Please contact your administrator.")
      } else {
        setError("Invalid username/email or password.")
      }
      setPassword("")
      return
    }

    setLoading(true)

    // Update last login time
    const updated = accounts.map(a => a.id === acc.id ? { ...a, lastLogin: new Date().toISOString() } : a)
    setAccounts(updated)
    saveAccounts(updated)

    setTimeout(() => {
      setLoading(false)
      onSuccess({
        id:       acc.id,
        name:     acc.name,
        username: acc.username,
        email:    acc.email,
        role:     acc.role,
        isAdmin:  acc.isAdmin || false,
        tmCode:   acc.tmCode || "",
        initials: acc.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase(),
      })
    }, 700)
  }

  // ── REGISTER ──────────────────────────────────────────────────────────────
  const handleRegister = () => {
    setRegError(""); setRegSuccess("")
    if (!regName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setRegError("Full name, username and password are required."); return
    }
    if (regPassword.length < 6) { setRegError("Password must be at least 6 characters."); return }
    if (regPassword !== regConfirm) { setRegError("Passwords do not match."); return }
    if (accounts.find(a => a.username.toLowerCase() === regUsername.toLowerCase())) {
      setRegError("Username already taken."); return
    }
    if (regEmail && accounts.find(a => a.email && a.email.toLowerCase() === regEmail.toLowerCase())) {
      setRegError("An account with this email already exists."); return
    }
    if (regEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setRegError("Please enter a valid email address."); return
    }

    const newAcc = {
      id:        `user_${Date.now()}`,
      username:  regUsername.trim().toLowerCase(),
      email:     regEmail.trim().toLowerCase(),
      password:  regPassword,
      name:      regName.trim(),
      role:      regRole,
      tmCode:    regTmCode.trim(),
      isAdmin:   false,
      status:    "active",
      createdAt: new Date().toISOString(),
      lastLogin: null,
    }
    const updated = [...accounts, newAcc]
    setAccounts(updated)
    saveAccounts(updated)
    setRegSuccess(`Account created! You can now sign in as "${newAcc.username}" or with your email.`)
    setRegName(""); setRegUsername(""); setRegEmail(""); setRegPassword(""); setRegConfirm(""); setRegTmCode("")
    setTimeout(() => { setMode("login"); setIdentifier(newAcc.username) }, 1800)
  }

  // ── ADMIN LOGIN ────────────────────────────────────────────────────────────
  const handleAdminLogin = () => {
    setAdminError("")
    const admin = accounts.find(a => a.isAdmin && a.password === adminPass)
    if (!admin) { setAdminError("Incorrect admin password."); return }
    setAdminOpen(true)
    setAdminPass("")
  }

  const blockUser   = (id) => { const u = accounts.map(a => a.id === id ? {...a, status: a.status === "blocked" ? "active" : "blocked"} : a); setAccounts(u); saveAccounts(u) }
  const deleteUser  = (id) => { if (!window.confirm("Delete this account?")) return; const u = accounts.filter(a => a.id !== id); setAccounts(u); saveAccounts(u) }
  const resetPass   = (id) => {
    const np = prompt("Enter new password for this user (min 6 chars):")
    if (!np || np.length < 6) { alert("Password too short"); return }
    const u = accounts.map(a => a.id === id ? {...a, password: np} : a)
    setAccounts(u); saveAccounts(u); alert("Password updated.")
  }
  const promoteAdmin = (id) => {
    if (!window.confirm("Make this user an admin? They will have full control.")) return
    const u = accounts.map(a => a.id === id ? {...a, isAdmin: true} : a)
    setAccounts(u); saveAccounts(u)
  }

  const nonAdmins = accounts.filter(a => !a.isAdmin)

  // Shared input style
  const inp = {
    onFocus: e => e.target.style.borderColor = "#c9920a",
    onBlur:  e => e.target.style.borderColor = "#1a2545",
    onKeyDown: e => { if (e.key === "Enter") mode === "login" ? handleLogin() : mode === "register" ? handleRegister() : null },
  }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        {/* Logo */}
        <div className="auth-logo">
          <div className="auth-logo-mark">⚖</div>
          <div>
            <div className="auth-logo-name">Mark<em>Shield</em></div>
            <div className="auth-logo-tag">AI Trademark Intelligence Platform</div>
          </div>
        </div>

        {/* Mode toggle */}
        <div style={{ display: "flex", background: "#0d1530", borderRadius: 10, padding: 4, marginBottom: 26, border: "1px solid #1a2545" }}>
          {[["login","Sign In"],["register","Create Account"]].map(([m, label]) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, fontWeight: 600,
              background: mode === m ? "linear-gradient(135deg,#c9920a,#7a5800)" : "transparent",
              color:      mode === m ? "#fff" : "#3d4f78",
              transition: "all .2s",
            }}>{label}</button>
          ))}
        </div>

        {/* ── LOGIN ── */}
        {mode === "login" && !adminOpen && (
          <>
            <div className="auth-title">Welcome back</div>
            <div className="auth-sub">Sign in with your username or email address.</div>
            {error && <div className="auth-error">⚠ {error}</div>}

            <div className="auth-field">
              <label>Username or Email</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">👤</span>
                <input {...inp} className="auth-input" type="text"
                  placeholder="username or email@example.com"
                  value={identifier} onChange={e => setIdentifier(e.target.value)}
                  autoComplete="username" autoFocus style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">🔒</span>
                <input {...inp} className="auth-input" type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "12.5px", color: "#8898bf", cursor: "pointer" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "#c9920a" }} /> Remember me
              </label>
              <span style={{ fontSize: "12.5px", color: "#f0c842", cursor: "pointer" }} onClick={() => switchMode("admin_forgot")}>
                Forgot password?
              </span>
            </div>

            <button className="auth-btn" onClick={handleLogin} disabled={loading}>
              {loading
                ? <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
                : "Sign In →"}
            </button>

            <div style={{ marginTop: 18, textAlign: "center", fontSize: 12, color: "#3d4f78", lineHeight: 1.8 }}>
              No account?{" "}
              <span style={{ color: "#f0c842", cursor: "pointer", fontWeight: 600 }} onClick={() => switchMode("register")}>Create one →</span>
              <br />
              <span style={{ fontSize: 10.5, color: "#243060" }}>
                {accounts.length} account{accounts.length !== 1 ? "s" : ""} in this browser ·{" "}
              </span>
              <span style={{ fontSize: 10.5, color: "#c9920a", cursor: "pointer" }} onClick={() => switchMode("admin_panel")}>
                Admin Panel
              </span>
            </div>
          </>
        )}

        {/* ── REGISTER ── */}
        {mode === "register" && (
          <>
            <div className="auth-title" style={{ fontSize: 20 }}>Create Account</div>
            <div className="auth-sub">Set up your MarkShield attorney account.</div>
            {regError   && <div className="auth-error">⚠ {regError}</div>}
            {regSuccess && <div style={{ background: "rgba(0,196,160,.1)", border: "1px solid rgba(0,196,160,.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#00c4a0", marginBottom: 16 }}>✅ {regSuccess}</div>}

            <div className="auth-field">
              <label>Full Name *</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">👤</span>
                <input {...inp} className="auth-input" type="text" placeholder="e.g. Advocate Manthan Desai"
                  value={regName} onChange={e => setRegName(e.target.value)} autoFocus style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div className="auth-field">
              <label>Email Address *</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">✉</span>
                <input {...inp} className="auth-input" type="email" placeholder="csmanthandesai@gmail.com"
                  value={regEmail} onChange={e => setRegEmail(e.target.value)} style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Username *</div>
                <input {...inp} type="text" placeholder="e.g. manthan_desai"
                  value={regUsername} onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g,"_"))}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Role</div>
                <select value={regRole} onChange={e => setRegRole(e.target.value)}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  <option>IP Attorney</option><option>Paralegal</option><option>Clerk</option><option>Intern</option>
                </select>
              </div>
            </div>

            <div className="auth-field">
              <label>TMA / Bar Council Code (optional)</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">🏛</span>
                <input {...inp} className="auth-input" type="text" placeholder="e.g. TMA/GJ/2847"
                  value={regTmCode} onChange={e => setRegTmCode(e.target.value)} style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Password * (min 6)</div>
                <input {...inp} type="password" placeholder="••••••••" value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Confirm Password *</div>
                <input {...inp} type="password" placeholder="••••••••" value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none" }} />
              </div>
            </div>

            <button className="auth-btn" onClick={handleRegister}>Create Account →</button>
            <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#3d4f78" }}>
              Already have an account?{" "}
              <span style={{ color: "#f0c842", cursor: "pointer", fontWeight: 600 }} onClick={() => switchMode("login")}>Sign In →</span>
            </div>
          </>
        )}

        {/* ── ADMIN PANEL GATE ── */}
        {mode === "admin_panel" && !adminOpen && (
          <>
            <div className="auth-title" style={{ fontSize: 20 }}>🛡 Admin Panel</div>
            <div className="auth-sub">Enter the admin password to manage all user accounts.</div>
            {adminError && <div className="auth-error">⚠ {adminError}</div>}
            <div className="auth-field">
              <label>Admin Password</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">🔑</span>
                <input className="auth-input" type="password" placeholder="Admin password"
                  value={adminPass} onChange={e => setAdminPass(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAdminLogin()}
                  style={{ paddingLeft: 40 }} autoFocus
                  onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} />
              </div>
            </div>
            <button className="auth-btn" onClick={handleAdminLogin}>Enter Admin Panel →</button>
            <div style={{ marginTop: 14, textAlign: "center" }}>
              <span style={{ fontSize: 12, color: "#f0c842", cursor: "pointer" }} onClick={() => switchMode("login")}>← Back to Login</span>
            </div>
          </>
        )}

        {/* ── ADMIN PANEL ── */}
        {adminOpen && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <div>
                <div className="auth-title" style={{ fontSize: 18, marginBottom: 2 }}>🛡 Admin Panel</div>
                <div style={{ fontSize: 12, color: "#3d4f78" }}>{nonAdmins.length} registered user{nonAdmins.length !== 1 ? "s" : ""}</div>
              </div>
              <button onClick={() => { setAdminOpen(false); switchMode("login") }}
                style={{ background: "none", border: "1px solid #1a2545", borderRadius: 8, padding: "6px 12px", color: "#3d4f78", cursor: "pointer", fontSize: 12, fontFamily: "'Bricolage Grotesque',sans-serif" }}>
                ✕ Close
              </button>
            </div>

            {/* Admin account info */}
            {accounts.filter(a => a.isAdmin).map(a => (
              <div key={a.id} style={{ background: "rgba(201,146,10,.08)", border: "1px solid rgba(201,146,10,.2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(145deg,#c9920a,#7a5800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                  {a.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#f0c842" }}>{a.name} <span style={{ fontSize: 10, background: "rgba(201,146,10,.2)", padding: "2px 7px", borderRadius: 10, color: "#f0c842" }}>ADMIN</span></div>
                  <div style={{ fontSize: 11, color: "#3d4f78" }}>{a.username}{a.email ? ` · ${a.email}` : ""} · Last login: {a.lastLogin ? new Date(a.lastLogin).toLocaleDateString() : "Never"}</div>
                </div>
              </div>
            ))}

            {/* All users table */}
            {nonAdmins.length === 0 ? (
              <div style={{ textAlign: "center", padding: "30px 20px", color: "#3d4f78", fontSize: 13 }}>
                No other users registered yet.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                {nonAdmins.map(u => (
                  <div key={u.id} style={{
                    background: u.status === "blocked" ? "rgba(244,63,94,.07)" : "#0d1530",
                    border: `1px solid ${u.status === "blocked" ? "rgba(244,63,94,.3)" : "#1a2545"}`,
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <div style={{ width: 26, height: 26, borderRadius: "50%", background: u.status === "blocked" ? "#2a1520" : "linear-gradient(145deg,#1a3060,#0d1a40)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: u.status === "blocked" ? "#f43f5e" : "#7aa3ff", flexShrink: 0 }}>
                            {u.name.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 700, color: u.status === "blocked" ? "#f43f5e" : "#dde4f2" }}>
                              {u.name}
                              {u.status === "blocked" && <span style={{ fontSize: 10, background: "rgba(244,63,94,.2)", padding: "1px 6px", borderRadius: 8, color: "#f43f5e", marginLeft: 6 }}>BLOCKED</span>}
                            </div>
                            <div style={{ fontSize: 11, color: "#3d4f78" }}>
                              @{u.username}
                              {u.email && ` · ${u.email}`}
                              {u.tmCode && ` · TMA: ${u.tmCode}`}
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: 11, color: "#2a3a60", paddingLeft: 34 }}>
                          Role: {u.role} · Joined: {new Date(u.createdAt).toLocaleDateString()} · Last login: {u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "Never"}
                        </div>
                      </div>
                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: 5, flexShrink: 0, flexWrap: "wrap", justifyContent: "flex-end" }}>
                        <button onClick={() => blockUser(u.id)}
                          style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 600, background: u.status === "blocked" ? "rgba(0,196,160,.15)" : "rgba(244,63,94,.15)", color: u.status === "blocked" ? "#00c4a0" : "#f43f5e" }}>
                          {u.status === "blocked" ? "Unblock" : "Block"}
                        </button>
                        <button onClick={() => resetPass(u.id)}
                          style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 600, background: "rgba(201,146,10,.15)", color: "#f0c842" }}>
                          Reset PW
                        </button>
                        <button onClick={() => promoteAdmin(u.id)}
                          style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 600, background: "rgba(37,99,255,.15)", color: "#7aa3ff" }}>
                          Make Admin
                        </button>
                        <button onClick={() => deleteUser(u.id)}
                          style={{ fontSize: 10, padding: "4px 9px", borderRadius: 6, border: "none", cursor: "pointer", fontFamily: "'Bricolage Grotesque',sans-serif", fontWeight: 600, background: "rgba(244,63,94,.12)", color: "#f43f5e" }}>
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ marginTop: 14, padding: "10px 14px", background: "rgba(201,146,10,.06)", border: "1px solid rgba(201,146,10,.14)", borderRadius: 8, fontSize: 11, color: "#3d4f78", lineHeight: 1.6 }}>
              ℹ Accounts are stored locally in this browser. To share access across devices, users must register on each device.
            </div>
          </>
        )}

        {/* Forgot password mode */}
        {mode === "admin_forgot" && (
          <>
            <div className="auth-title" style={{ fontSize: 20 }}>Reset Password</div>
            <div className="auth-sub">Contact your admin to reset your password, or access the Admin Panel.</div>
            <button className="auth-btn" onClick={() => switchMode("admin_panel")} style={{ marginBottom: 12 }}>Open Admin Panel →</button>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontSize: 12, color: "#f0c842", cursor: "pointer" }} onClick={() => switchMode("login")}>← Back to Login</span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
