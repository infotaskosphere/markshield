import React, { useState } from "react"

const TMA_CODES = {
  "25092": { name: "Rajesh Sharma", state: "Gujarat", city: "Surat", barNo: "25092", total: 24, registered: 17, hearings: 5, pending: 4, objected: 2, refused: 1, clients: 12 },
  "TMA/GJ/2847": { name: "Rajesh Sharma", state: "Gujarat", city: "Surat", barNo: "GJ-BAR-14729", total: 24, registered: 17, hearings: 5, pending: 4, objected: 2, refused: 1, clients: 12 },
}

const TMA_LOGS = [
  { t: "info", m: "Initializing secure connection to ipindia.gov.in..." },
  { t: "ok", m: "TLS handshake complete — connection established" },
  { t: "info", m: "Authenticating TMA credentials with CGPDTM registry..." },
  { t: "ok", m: "Attorney record verified — TMA code authenticated ✓" },
  { t: "data", m: "Fetching attorney registration details..." },
  { t: "ok", m: "Attorney profile loaded: {NAME} · {CITY}, {STATE}" },
  { t: "info", m: "Scanning linked trademark applications..." },
  { t: "data", m: "Found {TOTAL} trademark applications under TMA code" },
  { t: "info", m: "Fetching hearing schedules from CGPDTM portal..." },
  { t: "ok", m: "{HEARINGS} upcoming hearings detected and imported" },
  { t: "ok", m: "Sync complete — {REGISTERED} registered marks confirmed ✓" },
  { t: "ok", m: "✅ Portfolio ready — entering MarkShield dashboard" },
]

export default function TMASetup({ currentUser, onComplete, onSkip, gcalConnected, setGcalConnected }) {
  const [step, setStep] = useState(2)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState({
    fullName: currentUser?.name || "",
    firmName: "", email: "", mobile: "", phone: "", barNo: "",
    address: "", city: "", state: "", pin: "", portalUser: "", years: "",
  })
  const [tmaCode, setTmaCode] = useState("")
  const [tmaPass, setTmaPass] = useState("")
  const [fetchLog, setFetchLog] = useState([])
  const [fetchProgress, setFetchProgress] = useState(0)
  const [tmaData, setTmaData] = useState(null)
  const [fetching, setFetching] = useState(false)
  const [notifLeadTime, setNotifLeadTime] = useState("3")
  const [connectingCal, setConnectingCal] = useState(false)

  const goToStep3 = () => {
    setError("")
    const { fullName, email, mobile, city, state } = profile
    if (!fullName || !email || !mobile || !city || !state) {
      setError("❌ Please fill in all required fields (Name, Email, Mobile, City, State).")
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("❌ Please enter a valid professional email address.")
      return
    }
    setStep(3)
  }

  const doTMAFetch = () => {
    const code = tmaCode.toUpperCase().trim()
    if (!code || code.length < 3) { setError("❌ Please enter your TMA attorney code."); return }
    if (!tmaPass) { setError("❌ Please enter your IP India portal password."); return }
    setError("")
    const data = TMA_CODES[code] || { name: profile.fullName || "Attorney", state: profile.state || "", city: profile.city || "", barNo: code, total: 0, registered: 0, hearings: 0, pending: 0, objected: 0, refused: 0, clients: 0 }
    setFetching(true)
    setFetchLog([])
    setFetchProgress(0)
    setTmaData(null)

    let i = 0
    const run = () => {
      if (i >= TMA_LOGS.length) {
        setFetching(false)
        setFetchProgress(100)
        setTmaData(data)
        return
      }
      const entry = TMA_LOGS[i]
      const msg = entry.m
        .replace("{NAME}", data.name).replace("{CITY}", data.city).replace("{STATE}", data.state)
        .replace("{TOTAL}", data.total).replace("{HEARINGS}", data.hearings).replace("{REGISTERED}", data.registered)
      setFetchLog((l) => [...l, { t: entry.t, msg, ts: new Date().toLocaleTimeString() }])
      setFetchProgress(Math.round(((i + 1) / TMA_LOGS.length) * 95))
      i++
      setTimeout(run, 250 + Math.random() * 200)
    }
    run()
  }

  const connectGcal = () => {
    setConnectingCal(true)
    setTimeout(() => {
      setConnectingCal(false)
      setGcalConnected(true)
    }, 1800)
  }

  const finishSetup = () => {
    onComplete(profile, tmaData)
  }

  const logCls = { info: "tfl-info", ok: "tfl-ok", warn: "tfl-warn", data: "tfl-data" }

  const stepDone = (n) => n < step
  const stepActive = (n) => n === step

  return (
    <div className="auth-screen">
      <div className="auth-box" style={{ width: 580, maxWidth: "calc(100vw - 32px)", maxHeight: "90vh", overflowY: "auto" }}>
        <div className="auth-logo">
          <div className="auth-logo-mark">M</div>
          <div>
            <div className="auth-logo-name">Mark<em>Shield</em></div>
            <div className="auth-logo-tag">Agent Registration & Portfolio Setup</div>
          </div>
        </div>

        {/* Step Indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          {[1, 2, 3, 4].map((n, i) => (
            <React.Fragment key={n}>
              {i > 0 && <div style={{ flex: 1, height: 1, background: "#1a2035" }} />}
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: stepActive(n) ? "#e2e8f8" : "#4b5880", fontWeight: stepActive(n) ? 600 : 400 }}>
                <div style={{
                  width: 22, height: 22, borderRadius: "50%", border: "1.5px solid #1a2035",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  background: stepDone(n) ? "#00d4aa" : stepActive(n) ? "#2563ff" : "transparent",
                  borderColor: stepDone(n) ? "#00d4aa" : stepActive(n) ? "#2563ff" : "#1a2035",
                  color: stepDone(n) ? "#000" : stepActive(n) ? "#fff" : "#4b5880",
                }}>
                  {stepDone(n) ? "✓" : n}
                </div>
                {["Login", "Agent Profile", "TMA & Sync", "Notifications"][n - 1]}
              </div>
            </React.Fragment>
          ))}
        </div>

        {error && <div className="auth-error">{error}</div>}

        {/* STEP 2: Agent Profile */}
        {step === 2 && (
          <>
            <div className="auth-title">TM Agent Profile</div>
            <div className="auth-sub">Enter your professional details for email reminders and calendar invites.</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="auth-field">
                <label>Full Name <span style={{ color: "#f43f5e" }}>*</span></label>
                <div className="auth-field-wrap">
                  <span className="auth-field-icon">👤</span>
                  <input className="auth-input" type="text" placeholder="e.g. Rajesh Sharma" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value })} />
                </div>
              </div>
              <div className="auth-field">
                <label>Firm / Organisation</label>
                <div className="auth-field-wrap">
                  <span className="auth-field-icon">🏢</span>
                  <input className="auth-input" type="text" placeholder="e.g. Sharma IP Associates" value={profile.firmName} onChange={(e) => setProfile({ ...profile, firmName: e.target.value })} />
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="auth-field">
                <label>Professional Email <span style={{ color: "#f43f5e" }}>*</span></label>
                <div className="auth-field-wrap">
                  <span className="auth-field-icon">📧</span>
                  <input className="auth-input" type="email" placeholder="rajesh@firmname.com" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} />
                </div>
              </div>
              <div className="auth-field">
                <label>Mobile Number <span style={{ color: "#f43f5e" }}>*</span></label>
                <div className="auth-field-wrap">
                  <span className="auth-field-icon">📱</span>
                  <input className="auth-input" type="tel" placeholder="+91 98765 43210" value={profile.mobile} onChange={(e) => setProfile({ ...profile, mobile: e.target.value })} />
                </div>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <div className="auth-field">
                <label>City <span style={{ color: "#f43f5e" }}>*</span></label>
                <input className="auth-input" type="text" placeholder="Surat" style={{ paddingLeft: 14 }} value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.target.value })} />
              </div>
              <div className="auth-field">
                <label>State <span style={{ color: "#f43f5e" }}>*</span></label>
                <select className="auth-input" style={{ paddingLeft: 14 }} value={profile.state} onChange={(e) => setProfile({ ...profile, state: e.target.value })}>
                  <option value="">Select State</option>
                  {["Gujarat", "Maharashtra", "Delhi", "Karnataka", "Tamil Nadu", "Rajasthan", "Uttar Pradesh", "West Bengal", "Telangana", "Kerala", "Punjab", "Madhya Pradesh", "Other"].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="auth-field">
                <label>PIN Code</label>
                <input className="auth-input" type="text" placeholder="395001" style={{ paddingLeft: 14, fontFamily: "var(--mono)" }} maxLength={6} value={profile.pin} onChange={(e) => setProfile({ ...profile, pin: e.target.value })} />
              </div>
            </div>
            <button className="auth-btn" onClick={goToStep3}>Continue to TMA Code Setup →</button>
            <div style={{ marginTop: 14, textAlign: "center", fontSize: 12, color: "#4b5880" }}>
              <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={onSkip}>Skip setup and use demo →</span>
            </div>
          </>
        )}

        {/* STEP 3: TMA Code */}
        {step === 3 && (
          <>
            <div className="auth-title">Connect TMA Code & Sync Portfolio</div>
            <div className="auth-sub">Link your IP India TMA code to automatically import your portfolio.</div>
            <div style={{ background: "rgba(37,99,255,.07)", border: "1px solid rgba(37,99,255,.2)", borderRadius: 10, padding: "14px 16px", marginBottom: 20, fontSize: "12.5px", color: "#94a3c8", lineHeight: 1.6 }}>
              🔑 <strong style={{ color: "#7aa3ff" }}>What is a TMA Code?</strong><br />
              Your unique identifier from CGPDTM. Enter as numeric (e.g. <strong>25092</strong>) or <strong>TMA/GJ/2847</strong>.
            </div>
            <div className="auth-field">
              <label>TMA Attorney Code <span style={{ color: "#f43f5e" }}>*</span></label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">⚖️</span>
                <input className="auth-input" style={{ fontFamily: "var(--mono)", letterSpacing: ".04em" }} type="text" placeholder="e.g. 25092 or TMA/GJ/2847" value={tmaCode} onChange={(e) => setTmaCode(e.target.value.toUpperCase())} onKeyDown={(e) => e.key === "Enter" && doTMAFetch()} />
              </div>
            </div>
            <div className="auth-field">
              <label>IP India Portal Password <span style={{ color: "#f43f5e" }}>*</span></label>
              <div className="auth-field-wrap">
                <span className="auth-field-icon">🔐</span>
                <input className="auth-input" type="password" placeholder="Your ipindia.gov.in login password" value={tmaPass} onChange={(e) => setTmaPass(e.target.value)} />
              </div>
            </div>
            <button className="auth-btn" onClick={doTMAFetch} disabled={fetching}>
              {fetching ? <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} /> : "🔄 Fetch My Portfolio from IP India"}
            </button>

            {fetchLog.length > 0 && (
              <div style={{ marginTop: 18 }}>
                <div style={{ height: 4, background: "#1a2035", borderRadius: 2, overflow: "hidden" }}>
                  <div style={{ height: "100%", background: "linear-gradient(90deg,#2563ff,#00d4aa)", borderRadius: 2, width: fetchProgress + "%", transition: "width .35s ease" }} />
                </div>
                <div style={{ background: "#020408", border: "1px solid #1a2035", borderRadius: 9, padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 11, lineHeight: 1.9, height: 130, overflowY: "auto", marginTop: 10 }}>
                  {fetchLog.map((l, i) => (
                    <div key={i} className="tfl">
                      <span className="tfl-ts">{l.ts}</span>
                      <span className={logCls[l.t] || "tfl-info"}>{l.msg}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {tmaData && (
              <div style={{ marginTop: 16 }}>
                <div style={{ background: "#0c1018", border: "1px solid rgba(0,212,170,.2)", borderRadius: 10, padding: "14px 16px", display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "linear-gradient(135deg,#2563ff,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: "#fff", flexShrink: 0 }}>
                    {tmaData.name.split(" ").map((w) => w[0]).join("").toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#e2e8f8" }}>{tmaData.name}</div>
                    <div style={{ fontSize: "11.5px", color: "#4b5880" }}>{tmaData.barNo} · {tmaData.city}, {tmaData.state}</div>
                  </div>
                  <div style={{ marginLeft: "auto", background: "rgba(0,212,170,.12)", border: "1px solid rgba(0,212,170,.25)", borderRadius: 20, padding: "4px 12px", fontSize: 11, fontWeight: 700, color: "#00d4aa" }}>✓ Verified</div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
                  {[["Total TMs", tmaData.total], ["Registered", tmaData.registered], ["Hearings", tmaData.hearings], ["Pending", tmaData.pending], ["Objected", tmaData.objected], ["Clients", tmaData.clients]].map(([l, v]) => (
                    <div key={l} style={{ background: "#0c1018", border: "1px solid #1a2035", borderRadius: 9, padding: "12px 14px", textAlign: "center" }}>
                      <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 500, color: "#e2e8f8" }}>{v}</div>
                      <div style={{ fontSize: 10, color: "#4b5880", textTransform: "uppercase", letterSpacing: ".1em", marginTop: 3 }}>{l}</div>
                    </div>
                  ))}
                </div>
                <button className="auth-btn" onClick={() => setStep(4)}>✅ Continue to Notification Setup →</button>
              </div>
            )}

            <div style={{ marginTop: 12, textAlign: "center", fontSize: 12, color: "#4b5880" }}>
              Demo TMA: <span style={{ color: "#7aa3ff", fontFamily: "monospace" }}>TMA/GJ/2847</span> or <span style={{ color: "#7aa3ff", fontFamily: "monospace" }}>25092</span> · Any password
              &nbsp;|&nbsp; <span style={{ cursor: "pointer", textDecoration: "underline" }} onClick={() => setStep(4)}>Skip sync →</span>
            </div>
          </>
        )}

        {/* STEP 4: Notifications */}
        {step === 4 && (
          <>
            <div className="auth-title">Notification & Calendar Setup</div>
            <div className="auth-sub">Configure how MarkShield sends automated reminders.</div>

            <div style={{ background: "rgba(66,133,244,.07)", border: "1px solid rgba(66,133,244,.35)", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 20 }}>📅</span>
                <div>
                  <strong style={{ color: "#7aa3ff" }}>Google Calendar Auto-Sync</strong>
                  <div style={{ fontSize: "11.5px", marginTop: 2, color: "#94a3c8" }}>Every hearing date is automatically added as a calendar event.</div>
                </div>
              </div>
              {!gcalConnected ? (
                <button className="auth-btn" onClick={connectGcal} disabled={connectingCal} style={{ background: "linear-gradient(135deg,#4285f4,#34a853)", marginTop: 8, padding: 11 }}>
                  {connectingCal ? "Connecting..." : "🔗 Connect Google Calendar"}
                </button>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", background: "rgba(52,168,83,.12)", border: "1px solid rgba(52,168,83,.3)", borderRadius: 8, marginTop: 8 }}>
                  <span style={{ color: "#34a853", fontSize: 16 }}>✅</span>
                  <div style={{ fontSize: 13, color: "#34a853", fontWeight: 600 }}>Google Calendar Connected</div>
                </div>
              )}
            </div>

            <div style={{ background: "rgba(12,16,24,.6)", border: "1px solid #1a2035", borderRadius: 10, padding: "14px 16px", marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#94a3c8", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12 }}>Auto-Notifications</div>
              {["🏛 Hearing Scheduled / Date Change", "⚠️ New Examination Report / Objection", "🔄 Hearing Adjournment / Rescheduling", "📊 Status Change (Registered / Refused)"].map((item) => (
                <label key={item} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: "#2563ff", width: 15, height: 15 }} />
                  <span>{item}</span>
                </label>
              ))}
            </div>

            <button className="auth-btn" onClick={finishSetup} style={{ background: "linear-gradient(135deg,#2563ff,#00d4aa)" }}>
              🚀 Launch MarkShield Dashboard →
            </button>
          </>
        )}
      </div>
    </div>
  )
}
