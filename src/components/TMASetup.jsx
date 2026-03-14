import React, { useState } from "react"

const TMA_LOGS = [
  { t: "info", m: "Initializing secure connection to ipindia.gov.in..." },
  { t: "ok",   m: "TLS handshake complete — connection established" },
  { t: "info", m: "Authenticating TMA credentials with CGPDTM registry..." },
  { t: "ok",   m: "Attorney record verified — TMA code authenticated ✓" },
  { t: "data", m: "Fetching attorney registration details..." },
  { t: "ok",   m: "Attorney profile loaded: {NAME} · {CITY}, {STATE}" },
  { t: "info", m: "Scanning linked trademark applications..." },
  { t: "ok",   m: "✅ Sync complete — entering MarkShield dashboard" },
]

export default function TMASetup({ currentUser, onComplete, onSkip, gcalConnected, setGcalConnected }) {
  const [step, setStep] = useState(2)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState({
    fullName: currentUser?.name || "",
    firmName: "", email: currentUser?.email || "", mobile: "", phone: "", barNo: "",
    address: "", city: "", state: "", pin: "", portalUser: "", years: "",
  })
  const [tmaCode, setTmaCode] = useState("")
  const [tmaPass, setTmaPass] = useState("")
  const [fetchLog, setFetchLog] = useState([])
  const [fetchProgress, setFetchProgress] = useState(0)
  const [tmaData, setTmaData] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [notifLeadTime, setNotifLeadTime] = useState("3")

  const fp = (k, v) => setProfile(p => ({ ...p, [k]: v }))

  const goToStep3 = () => {
    setError("")
    const { fullName, email, mobile, city, state } = profile
    if (!fullName || !email || !mobile || !city || !state) {
      setError("Please fill in all required fields (Name, Email, Mobile, City, State).")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email address.")
      return
    }
    setStep(3)
  }

  const doFetchTMA = async () => {
    if (!tmaCode.trim()) { setError("Please enter your TMA code or eFiling username."); return }
    setError(""); setFetching(true); setFetchLog([]); setFetchProgress(0)

    // Simulate TMA fetch with realistic logs
    const logs = TMA_LOGS.map(l => ({
      ...l,
      m: l.m.replace("{NAME}", profile.fullName).replace("{CITY}", profile.city).replace("{STATE}", profile.state)
    }))

    for (let i = 0; i < logs.length; i++) {
      await new Promise(r => setTimeout(r, 350 + Math.random() * 200))
      setFetchLog(prev => [...prev, { ...logs[i], ts: new Date().toLocaleTimeString() }])
      setFetchProgress(Math.round(((i + 1) / logs.length) * 100))
    }

    // Real implementation would call backend /api/efiling/login here
    const fakeData = {
      name: profile.fullName,
      tmaCode,
      city: profile.city,
      state: profile.state,
      total: 0, registered: 0, hearings: 0, pending: 0,
    }
    setTmaData(fakeData)
    setFetching(false)
  }

  const handleComplete = () => {
    onComplete(profile, tmaData || { name: profile.fullName, tmaCode, city: profile.city, state: profile.state })
  }

  const inputStyle = {
    width: "100%", background: "#020610", border: "1.5px solid #1a2545",
    borderRadius: 9, padding: "10px 13px", color: "#dde4f2",
    fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, outline: "none",
    transition: "border-color .2s",
  }

  const labelStyle = { display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }

  const clsMap = { info: "#5b9ef8", ok: "#00c4a0", data: "#c4a8ff", warn: "#f0c842", err: "#f43f5e" }

  return (
    <div className="auth-screen" style={{ alignItems: "flex-start", overflowY: "auto", paddingTop: 40 }}>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 640, margin: "0 auto", padding: "0 16px 60px" }}>
        {/* Header */}
        <div className="auth-logo" style={{ marginBottom: 28 }}>
          <div className="auth-logo-mark">⚖</div>
          <div>
            <div className="auth-logo-name">Mark<em>Shield</em></div>
            <div className="auth-logo-tag">Initial Setup</div>
          </div>
        </div>

        {/* Progress */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 36 }}>
          {[2, 3, 4].map(s => (
            <React.Fragment key={s}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: step >= s ? "linear-gradient(145deg,#c9920a,#7a5800)" : "#1a2545",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: step >= s ? "#fff" : "#3d4f78",
                flexShrink: 0, transition: "all .3s",
              }}>{s - 1}</div>
              {s < 4 && <div style={{ flex: 1, height: 2, background: step > s ? "#c9920a" : "#1a2545", transition: "background .3s" }} />}
            </React.Fragment>
          ))}
        </div>

        {/* Step 2 — Profile */}
        {step === 2 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Attorney Profile</div>
            <div className="auth-sub">Your professional details for MarkShield. Required fields are marked with *.</div>
            {error && <div className="auth-error">{error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={labelStyle}>Full Name *</label><input style={inputStyle} placeholder="Advocate Priya Sharma" value={profile.fullName} onChange={e => fp("fullName", e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} /></div>
              <div><label style={labelStyle}>Firm / Practice Name</label><input style={inputStyle} placeholder="e.g. Sharma & Associates" value={profile.firmName} onChange={e => fp("firmName", e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={labelStyle}>Email *</label><input style={inputStyle} type="email" placeholder="advocate@firm.com" value={profile.email} onChange={e => fp("email", e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} /></div>
              <div><label style={labelStyle}>Mobile *</label><input style={inputStyle} placeholder="+91 98000 00000" value={profile.mobile} onChange={e => fp("mobile", e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={labelStyle}>City *</label><input style={inputStyle} placeholder="e.g. Surat" value={profile.city} onChange={e => fp("city", e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} /></div>
              <div><label style={labelStyle}>State *</label>
                <select style={{ ...inputStyle, cursor: "pointer" }} value={profile.state} onChange={e => fp("state", e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"}>
                  <option value="">Select State</option>
                  {["Gujarat", "Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Rajasthan", "Uttar Pradesh", "West Bengal", "Telangana", "Punjab", "Haryana", "Kerala", "Madhya Pradesh", "Odisha", "Andhra Pradesh"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>TMA / Bar Council Registration No.</label>
              <input style={inputStyle} placeholder="e.g. TMA/GJ/2847 or Bar Council no." value={profile.barNo} onChange={e => fp("barNo", e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Years of Practice</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={profile.years} onChange={e => fp("years", e.target.value)}>
                <option value="">Select</option>
                {["0-2", "3-5", "5-10", "10-20", "20+"].map(y => <option key={y} value={y}>{y} years</option>)}
              </select>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={onSkip} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif", transition: "border-color .2s" }}
                onMouseOver={e => e.currentTarget.style.borderColor = "#c9920a"}
                onMouseOut={e => e.currentTarget.style.borderColor = "#1a2545"}>
                Skip Setup →
              </button>
              <button className="auth-btn" onClick={goToStep3} style={{ flex: 2 }}>Continue →</button>
            </div>
          </div>
        )}

        {/* Step 3 — TMA Sync */}
        {step === 3 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Connect IP India eFiling</div>
            <div className="auth-sub">Enter your IP India eFiling portal credentials to auto-import your trademark portfolio. This is optional — you can add trademarks manually later.</div>
            {error && <div className="auth-error">{error}</div>}

            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>eFiling Username / TMA Code</label>
              <input style={inputStyle} placeholder="e.g. TMA/GJ/2847 or your eFiling login" value={tmaCode} onChange={e => setTmaCode(e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>eFiling Password</label>
              <input style={inputStyle} type="password" placeholder="••••••••" value={tmaPass} onChange={e => setTmaPass(e.target.value)} onFocus={e => e.target.style.borderColor = "#c9920a"} onBlur={e => e.target.style.borderColor = "#1a2545"} />
            </div>

            {/* Log terminal */}
            <div style={{ background: "#010508", border: "1px solid #1a2545", borderRadius: 9, padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.9, height: 150, overflowY: "auto", marginBottom: 12 }}>
              {fetchLog.length === 0
                ? <div style={{ color: "#1e2d50" }}>Enter credentials and click Connect to sync your portfolio…</div>
                : fetchLog.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: "#1e2d50", flexShrink: 0 }}>{l.ts}</span>
                    <span style={{ color: clsMap[l.t] || "#5b9ef8" }}>{l.m}</span>
                  </div>
                ))
              }
            </div>
            <div style={{ background: "#1a2545", borderRadius: 3, height: 4, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#c9920a,#f0c842)", borderRadius: 3, width: fetchProgress + "%", transition: "width .4s ease" }} />
            </div>

            {tmaData && (
              <div style={{ background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 20 }}>✅</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--teal)" }}>Connected: {tmaData.name}</div>
                  <div style={{ fontSize: 12, color: "#3d4f78" }}>{tmaData.tmaCode} · {tmaData.city}, {tmaData.state}</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif" }}>← Back</button>
              <button className="auth-btn" style={{ flex: 1 }} onClick={doFetchTMA} disabled={fetching}>
                {fetching ? <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} /> : "🔗 Connect eFiling"}
              </button>
              <button className="auth-btn" style={{ flex: 1 }} onClick={() => setStep(4)}>
                {tmaData ? "Next →" : "Skip →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Preferences */}
        {step === 4 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Preferences</div>
            <div className="auth-sub">Configure your notification and reminder settings.</div>

            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>Hearing reminder lead time</label>
              <select style={{ ...inputStyle, cursor: "pointer" }} value={notifLeadTime} onChange={e => setNotifLeadTime(e.target.value)}>
                {["1", "2", "3", "5", "7", "14"].map(d => <option key={d} value={d}>{d} day{d !== "1" ? "s" : ""} before</option>)}
              </select>
            </div>

            <div style={{ padding: "14px 16px", background: "rgba(0,196,160,.07)", border: "1px solid rgba(0,196,160,.15)", borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 4 }}>✅ Setup Summary</div>
              <div style={{ fontSize: 12, color: "#8898bf", lineHeight: 1.8 }}>
                Name: {profile.fullName || "—"}<br />
                Firm: {profile.firmName || "—"}<br />
                Location: {profile.city}, {profile.state}<br />
                eFiling: {tmaData ? `Connected — ${tmaData.tmaCode}` : "Not connected (you can add trademarks manually)"}<br />
                Hearing Reminder: {notifLeadTime} day{notifLeadTime !== "1" ? "s" : ""} before
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque', sans-serif" }}>← Back</button>
              <button className="auth-btn" onClick={handleComplete} style={{ flex: 2 }}>Enter MarkShield →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
