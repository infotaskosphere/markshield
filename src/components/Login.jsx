import React, { useState, useEffect } from "react"

// ─── Local account store (persists in browser localStorage) ───────────────────
const STORAGE_KEY = "markshield_accounts"

function loadAccounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {}
  // Seed one default admin account on first load
  const defaults = [
    { username: "admin", password: "admin123", name: "Admin", role: "IP Attorney", createdAt: new Date().toISOString() }
  ]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults))
  return defaults
}

function saveAccounts(accounts) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(accounts))
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Login({ onSuccess }) {
  const [mode, setMode] = useState("login") // "login" | "register"
  const [accounts, setAccounts] = useState([])

  // Login state
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError]       = useState("")
  const [loading, setLoading]   = useState(false)

  // Register state
  const [regName,     setRegName]     = useState("")
  const [regUsername, setRegUsername] = useState("")
  const [regEmail,    setRegEmail]    = useState("")
  const [regPassword, setRegPassword] = useState("")
  const [regConfirm,  setRegConfirm]  = useState("")
  const [regRole,     setRegRole]     = useState("IP Attorney")
  const [regError,    setRegError]    = useState("")
  const [regSuccess,  setRegSuccess]  = useState("")

  useEffect(() => { setAccounts(loadAccounts()) }, [])

  const switchMode = (m) => {
    setMode(m); setError(""); setRegError(""); setRegSuccess("")
  }

  // ── LOGIN ──────────────────────────────────────────────────────────────────
  const handleLogin = () => {
    setError("")
    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.")
      return
    }
    const acc = accounts.find(a => a.username === username && a.password === password)
    if (!acc) {
      setError("Invalid username or password.")
      setPassword("")
      return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSuccess({
        name:     acc.name,
        username: acc.username,
        role:     acc.role,
        initials: acc.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase(),
      })
    }, 800)
  }

  // ── REGISTER ───────────────────────────────────────────────────────────────
  const handleRegister = () => {
    setRegError(""); setRegSuccess("")

    if (!regName.trim() || !regUsername.trim() || !regPassword.trim()) {
      setRegError("Full name, username and password are required.")
      return
    }
    if (regPassword.length < 6) {
      setRegError("Password must be at least 6 characters.")
      return
    }
    if (regPassword !== regConfirm) {
      setRegError("Passwords do not match.")
      return
    }
    if (accounts.find(a => a.username === regUsername)) {
      setRegError("Username already taken. Please choose another.")
      return
    }
    if (regEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(regEmail)) {
      setRegError("Please enter a valid email address.")
      return
    }

    const newAcc = {
      username:  regUsername.trim(),
      password:  regPassword,
      name:      regName.trim(),
      email:     regEmail.trim(),
      role:      regRole,
      createdAt: new Date().toISOString(),
    }
    const updated = [...accounts, newAcc]
    setAccounts(updated)
    saveAccounts(updated)

    setRegSuccess(`Account created! You can now sign in as "${regUsername}".`)
    setRegName(""); setRegUsername(""); setRegEmail(""); setRegPassword(""); setRegConfirm("")

    // Auto-switch to login after 1.5 s
    setTimeout(() => { setMode("login"); setUsername(newAcc.username) }, 1500)
  }

  const handleKey = (e) => { if (e.key === "Enter") mode === "login" ? handleLogin() : handleRegister() }

  // ── Shared input style ─────────────────────────────────────────────────────
  const inp = {
    className: "auth-input",
    onFocus:  e => e.target.style.borderColor = "#c9920a",
    onBlur:   e => e.target.style.borderColor = "#1a2545",
    onKeyDown: handleKey,
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
        <div style={{ display: "flex", background: "#0d1530", borderRadius: 10, padding: 4, marginBottom: 28, border: "1px solid #1a2545" }}>
          {[["login", "Sign In"], ["register", "Create Account"]].map(([m, label]) => (
            <button key={m} onClick={() => switchMode(m)} style={{
              flex: 1, padding: "9px 0", borderRadius: 8, border: "none", cursor: "pointer",
              fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, fontWeight: 600,
              transition: "all .2s",
              background: mode === m ? "linear-gradient(135deg,#c9920a,#7a5800)" : "transparent",
              color:      mode === m ? "#fff" : "#3d4f78",
              boxShadow:  mode === m ? "0 2px 10px rgba(201,146,10,.25)" : "none",
            }}>{label}</button>
          ))}
        </div>

        {/* ── LOGIN FORM ── */}
        {mode === "login" && (
          <>
            <div className="auth-title">Welcome back</div>
            <div className="auth-sub">Sign in to manage your trademark portfolio.</div>

            {error && <div className="auth-error">⚠ {error}</div>}

            <div className="auth-field">
              <label>Username</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">👤</span>
                <input {...inp} type="text" placeholder="Enter your username"
                  value={username} onChange={e => setUsername(e.target.value)}
                  autoComplete="username" autoFocus style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div className="auth-field">
              <label>Password</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">🔒</span>
                <input {...inp} type="password" placeholder="••••••••"
                  value={password} onChange={e => setPassword(e.target.value)}
                  autoComplete="current-password" style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "12.5px", color: "#8898bf", cursor: "pointer" }}>
                <input type="checkbox" defaultChecked style={{ accentColor: "#c9920a" }} /> Remember me
              </label>
              <span style={{ fontSize: "12.5px", color: "#f0c842", cursor: "pointer" }}>Forgot password?</span>
            </div>

            <button className="auth-btn" onClick={handleLogin} disabled={loading}>
              {loading
                ? <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
                : "Sign In →"}
            </button>

            <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#3d4f78", lineHeight: 1.8 }}>
              No account?{" "}
              <span style={{ color: "#f0c842", cursor: "pointer", fontWeight: 600 }} onClick={() => switchMode("register")}>
                Create one →
              </span>
              <br />
              <span style={{ fontSize: 10.5, color: "#243060" }}>
                {accounts.length} account{accounts.length !== 1 ? "s" : ""} stored locally in this browser.
              </span>
            </div>
          </>
        )}

        {/* ── REGISTER FORM ── */}
        {mode === "register" && (
          <>
            <div className="auth-title" style={{ fontSize: 20 }}>Create Account</div>
            <div className="auth-sub">Set up your MarkShield attorney account.</div>

            {regError   && <div className="auth-error">⚠ {regError}</div>}
            {regSuccess && (
              <div style={{ background: "rgba(0,196,160,.1)", border: "1px solid rgba(0,196,160,.25)", borderRadius: 8, padding: "10px 14px", fontSize: 12.5, color: "#00c4a0", marginBottom: 16 }}>
                ✅ {regSuccess}
              </div>
            )}

            <div className="auth-field">
              <label>Full Name *</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">👤</span>
                <input {...inp} type="text" placeholder="e.g. Advocate Priya Sharma"
                  value={regName} onChange={e => setRegName(e.target.value)}
                  autoFocus style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Username *</div>
                <input {...inp} type="text" placeholder="e.g. priya_sharma"
                  value={regUsername} onChange={e => setRegUsername(e.target.value.toLowerCase().replace(/\s+/g, "_"))}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Role</div>
                <select value={regRole} onChange={e => setRegRole(e.target.value)}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none", cursor: "pointer" }}>
                  <option>IP Attorney</option>
                  <option>Paralegal</option>
                  <option>Clerk</option>
                  <option>Intern</option>
                </select>
              </div>
            </div>

            <div className="auth-field">
              <label>Email (optional)</label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">✉</span>
                <input {...inp} type="email" placeholder="advocate@firm.com"
                  value={regEmail} onChange={e => setRegEmail(e.target.value)}
                  style={{ paddingLeft: 40 }} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 22 }}>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Password * (min 6 chars)</div>
                <input {...inp} type="password" placeholder="••••••••"
                  value={regPassword} onChange={e => setRegPassword(e.target.value)}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none" }} />
              </div>
              <div>
                <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }}>Confirm Password *</div>
                <input {...inp} type="password" placeholder="••••••••"
                  value={regConfirm} onChange={e => setRegConfirm(e.target.value)}
                  style={{ width: "100%", background: "#020610", border: "1.5px solid #1a2545", borderRadius: 10, padding: "11px 13px", color: "#dde4f2", fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none" }} />
              </div>
            </div>

            <button className="auth-btn" onClick={handleRegister}>
              Create Account →
            </button>

            <div style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "#3d4f78" }}>
              Already have an account?{" "}
              <span style={{ color: "#f0c842", cursor: "pointer", fontWeight: 600 }} onClick={() => switchMode("login")}>
                Sign In →
              </span>
            </div>

            <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(201,146,10,.06)", border: "1px solid rgba(201,146,10,.15)", borderRadius: 8, fontSize: 11, color: "#3d4f78", lineHeight: 1.6 }}>
              ℹ Accounts are stored locally in your browser. For multi-device access, connect a backend authentication service.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
