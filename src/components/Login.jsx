import React, { useState } from "react"

const USERS = [
  { username: "admin", password: "mark1234", name: "Rajesh Sharma", initials: "RS", role: "Senior IP Attorney" },
  { username: "rajesh@example.com", password: "mark1234", name: "Rajesh Sharma", initials: "RS", role: "Senior IP Attorney" },
]

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setError("")
    const match = USERS.find((u) => u.username === username && u.password === password)
    if (!match) {
      setError("❌ Invalid username or password. Please try again.")
      setPassword("")
      return
    }
    setLoading(true)
    setTimeout(() => {
      setLoading(false)
      onSuccess(match)
    }, 1000)
  }

  const handleKey = (e) => { if (e.key === "Enter") handleLogin() }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-mark">M</div>
          <div>
            <div className="auth-logo-name">Mark<em>Shield</em></div>
            <div className="auth-logo-tag">AI Trademark Intelligence Platform</div>
          </div>
        </div>

        <div className="auth-title">Welcome back</div>
        <div className="auth-sub">Sign in to manage your trademark portfolio and hearing schedule.</div>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label>Username / Email</label>
          <div className="auth-field-wrap">
            <span className="auth-field-icon">👤</span>
            <input
              className="auth-input"
              type="text"
              placeholder="attorney@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="username"
            />
          </div>
        </div>

        <div className="auth-field">
          <label>Password</label>
          <div className="auth-field-wrap">
            <span className="auth-field-icon">🔒</span>
            <input
              className="auth-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="current-password"
            />
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "12.5px", color: "#94a3c8", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "#2563ff" }} /> Remember me
          </label>
          <span style={{ fontSize: "12.5px", color: "#2563ff", cursor: "pointer" }}>Forgot password?</span>
        </div>

        <button className="auth-btn" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
          ) : (
            "Sign In →"
          )}
        </button>

        <div style={{ marginTop: 22, textAlign: "center", fontSize: 12, color: "#4b5880", lineHeight: 1.8 }}>
          Demo credentials:<br />
          Username: <span style={{ color: "#7aa3ff", fontFamily: "JetBrains Mono, monospace" }}>admin</span>
          &nbsp;|&nbsp;
          Password: <span style={{ color: "#7aa3ff", fontFamily: "JetBrains Mono, monospace" }}>mark1234</span>
        </div>
      </div>
    </div>
  )
}
