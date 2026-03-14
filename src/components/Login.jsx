import React, { useState } from "react"

// Default credentials — change in production or connect a real auth backend
const USERS = [
  { username: "admin", password: "admin123", name: "Admin User", initials: "A", role: "IP Attorney" },
]

export default function Login({ onSuccess }) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleLogin = () => {
    setError("")
    if (!username.trim() || !password.trim()) {
      setError("Please enter your username and password.")
      return
    }
    const match = USERS.find((u) => u.username === username && u.password === password)
    if (!match) {
      setError("Invalid username or password.")
      setPassword("")
      return
    }
    setLoading(true)
    setTimeout(() => { setLoading(false); onSuccess(match) }, 900)
  }

  const handleKey = (e) => { if (e.key === "Enter") handleLogin() }

  return (
    <div className="auth-screen">
      <div className="auth-box">
        <div className="auth-logo">
          <div className="auth-logo-mark">⚖</div>
          <div>
            <div className="auth-logo-name">Mark<em>Shield</em></div>
            <div className="auth-logo-tag">AI Trademark Intelligence Platform</div>
          </div>
        </div>

        <div className="auth-title">Welcome back</div>
        <div className="auth-sub">Sign in to manage your trademark portfolio and hearing schedule.</div>

        {error && <div className="auth-error">{error}</div>}

        <div className="auth-field">
          <label>Username</label>
          <div className="auth-field-wrap">
            <span className="auth-field-icon">👤</span>
            <input
              className="auth-input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKey}
              autoComplete="username"
              autoFocus
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
          <label style={{ display: "flex", alignItems: "center", gap: 7, fontSize: "12.5px", color: "#8898bf", cursor: "pointer" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "#c9920a" }} /> Remember me
          </label>
          <span style={{ fontSize: "12.5px", color: "#f0c842", cursor: "pointer" }}>Forgot password?</span>
        </div>

        <button className="auth-btn" onClick={handleLogin} disabled={loading}>
          {loading ? (
            <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
          ) : "Sign In →"}
        </button>

        <div style={{ marginTop: 24, textAlign: "center", fontSize: 11.5, color: "#3d4f78", lineHeight: 1.8 }}>
          Default: <span style={{ color: "#f0c842", fontFamily: "JetBrains Mono, monospace" }}>admin</span>
          {" / "}
          <span style={{ color: "#f0c842", fontFamily: "JetBrains Mono, monospace" }}>admin123</span>
          <br />
          <span style={{ fontSize: 10.5, color: "#2a3a60" }}>Change credentials in Login.jsx for production use.</span>
        </div>
      </div>
    </div>
  )
}
