import React, { useState, useEffect } from "react"
import { checkBackend, verifyTMA } from "../services/api"

export default function TMASetup({ currentUser, onComplete, onSkip, rerunMode, existingProfile, mustConnect }) {
  const [step, setStep] = useState(rerunMode ? 3 : 2)
  const [error, setError] = useState("")

  const [profile, setProfile] = useState({
    fullName:   existingProfile?.fullName   || currentUser?.name  || "",
    firmName:   existingProfile?.firmName   || "",
    email:      existingProfile?.email      || currentUser?.email || "",
    mobile:     existingProfile?.mobile     || "",
    barNo:      existingProfile?.barNo      || "",
    city:       existingProfile?.city       || "",
    state:      existingProfile?.state      || "",
    years:      existingProfile?.years      || "",
    portalUser: existingProfile?.portalUser || "",
  })

  // Step 3 — TMA Verify
  const [tmaCode,    setTmaCode]    = useState(existingProfile?.barNo || existingProfile?.portalUser || currentUser?.tmCode || "")
  const [verifyLog,  setVerifyLog]  = useState([])
  const [progress,   setProgress]   = useState(0)
  const [tmaData,    setTmaData]    = useState(null)
  const [verifying,  setVerifying]  = useState(false)
  const [wakeMsg,    setWakeMsg]    = useState("")

  // Step 4 — Preferences
  const [notifLeadTime, setNotifLeadTime] = useState("3")

  const fp  = (k, v) => setProfile(p => ({ ...p, [k]: v }))
  const log = (t, m) => setVerifyLog(l => [...l, { t, m, ts: new Date().toLocaleTimeString() }])

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

  const doVerifyTMA = async () => {
    if (!tmaCode.trim()) { setError("Please enter your TMA code (e.g. TMA/GJ/2847)."); return }
    setError(""); setVerifying(true); setVerifyLog([]); setProgress(0); setTmaData(null)

    log("info", "⏳ Connecting to backend…")
    setProgress(8)

    // Wake up Render backend with retry
    const backendUp = await checkBackend((attempt, max) => {
      setWakeMsg(`Backend waking up (Render free tier)… attempt ${attempt}/${max}`)
      log("warn", `🔄 Backend cold start — retry ${attempt}/${max}`)
      setProgress(8 + attempt * 6)
    })
    setWakeMsg("")

    if (!backendUp) {
      log("err", "❌ Backend unreachable. Check Render service.")
      setProgress(0); setVerifying(false)
      setError("Backend offline — check your Render service or run backend locally.")
      return
    }

    log("ok",   "✅ Backend connected")
    log("info", `🔍 Looking up TMA code: ${tmaCode.trim()} on IP India…`)
    setProgress(40)

    try {
      const res = await verifyTMA(tmaCode.trim())
      setProgress(100)

      if (res?.success) {
        log("ok",   `✅ ${res.message}`)
        if (res.attorney_name) log("data", `👤 Attorney: ${res.attorney_name}`)
        if (res.items_found)   log("data", `📋 ${res.items_found} matter(s) found in TLA queue`)
        if (res.pending)       log("warn", `⚠️ ${res.pending} pending replies`)

        setTmaData({
          tmaCode:      tmaCode.trim(),
          username:     tmaCode.trim(),
          name:         res.attorney_name || profile.fullName,
          city:         profile.city,
          state:        profile.state,
          itemsFound:   res.items_found || 0,
          pending:      res.pending     || 0,
          connectedAt:  res.connected_at || new Date().toISOString(),
        })
      } else {
        log("err",  `❌ ${res?.message || "Verification failed"}`)
        log("warn", "Check TMA code format: e.g. TMA/GJ/2847")
        setProgress(0)
        setError(res?.message || "Could not verify TMA code. Check format and try again.")
      }
    } catch (e) {
      log("err", `❌ ${e?.message || "Connection error"}`)
      setProgress(0)
      setError("Connection error — please try again.")
    }

    setVerifying(false)
  }

  const handleComplete = () => {
    onComplete(
      { ...profile, portalUser: tmaCode.trim() },
      tmaData || { name: profile.fullName, tmaCode: tmaCode.trim(), city: profile.city, state: profile.state }
    )
  }

  const inp = {
    width: "100%", background: "#020610", border: "1.5px solid #1a2545",
    borderRadius: 9, padding: "10px 13px", color: "#dde4f2",
    fontFamily: "'Bricolage Grotesque',sans-serif", fontSize: 13, outline: "none", transition: "border-color .2s",
  }
  const lbl  = { display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }
  const clsMap = { info: "#5b9ef8", ok: "#00c4a0", data: "#c4a8ff", warn: "#f0c842", err: "#f43f5e" }

  return (
    <div className="auth-screen" style={{ alignItems: "flex-start", overflowY: "auto", paddingTop: 40 }}>
      <div style={{ position: "relative", zIndex: 1, width: "100%", maxWidth: 640, margin: "0 auto", padding: "0 16px 60px" }}>

        {/* Header */}
        <div className="auth-logo" style={{ marginBottom: 28 }}>
          <div className="auth-logo-mark" style={{ overflow: "hidden", padding: 0 }}>
            <img src="/logo.png" alt="MarkShield" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: 12 }}
              onError={e => { e.target.style.display="none" }} />
          </div>
          <div>
            <div className="auth-logo-name">Mark<em>Shield</em></div>
            <div className="auth-logo-tag">Initial Setup</div>
          </div>
        </div>

        {/* Step indicator */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 36 }}>
          {[2, 3, 4].map(s => (
            <React.Fragment key={s}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, transition: "all .3s",
                background: step >= s ? "linear-gradient(145deg,#c9920a,#7a5800)" : "#1a2545",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700, color: step >= s ? "#fff" : "#3d4f78" }}>{s - 1}</div>
              {s < 4 && <div style={{ flex: 1, height: 2, background: step > s ? "#c9920a" : "#1a2545", transition: "background .3s" }} />}
            </React.Fragment>
          ))}
        </div>

        {/* ── STEP 2: Profile ── */}
        {step === 2 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Attorney Profile</div>
            <div className="auth-sub">Your professional details. Required fields marked *.</div>
            {error && <div className="auth-error">⚠ {error}</div>}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Full Name *</label><input style={inp} placeholder="Advocate Manthan Desai" value={profile.fullName} onChange={e => fp("fullName", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              <div><label style={lbl}>Firm / Practice</label><input style={inp} placeholder="e.g. Desai & Associates" value={profile.firmName} onChange={e => fp("firmName", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Email *</label><input style={inp} type="email" placeholder="advocate@firm.com" value={profile.email} onChange={e => fp("email", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              <div><label style={lbl}>Mobile *</label><input style={inp} placeholder="+91 98000 00000" value={profile.mobile} onChange={e => fp("mobile", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>City *</label><input style={inp} placeholder="e.g. Surat" value={profile.city} onChange={e => fp("city", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              <div><label style={lbl}>State *</label>
                <select style={{ ...inp, cursor: "pointer" }} value={profile.state} onChange={e => fp("state", e.target.value)}>
                  <option value="">Select State</option>
                  {["Gujarat","Maharashtra","Delhi","Karnataka","Tamil Nadu","Rajasthan","Uttar Pradesh","West Bengal","Telangana","Punjab","Haryana","Kerala","Madhya Pradesh","Odisha","Andhra Pradesh"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
              <div><label style={lbl}>Bar Council No.</label><input style={inp} placeholder="e.g. GJ/1234/2020" value={profile.barNo} onChange={e => fp("barNo", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              <div><label style={lbl}>Years of Practice</label>
                <select style={{ ...inp, cursor: "pointer" }} value={profile.years} onChange={e => fp("years", e.target.value)}>
                  <option value="">Select</option>
                  {["0-2","3-5","5-10","10-20","20+"].map(y => <option key={y} value={y}>{y} years</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              {onSkip ? (
                <button onClick={onSkip} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque',sans-serif", transition: "border-color .2s" }}
                  onMouseOver={e => e.currentTarget.style.borderColor="#c9920a"} onMouseOut={e => e.currentTarget.style.borderColor="#1a2545"}>Skip Setup →</button>
              ) : (
                <div style={{ flex: 1, fontSize: 11, color: "#3d4f78", display: "flex", alignItems: "center", gap: 6 }}>
                  ⚖️ IP Attorneys must complete setup to access MarkShield.
                </div>
              )}
              <button className="auth-btn" onClick={goToStep3} style={{ flex: 2 }}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: TMA Code Verification ── */}
        {step === 3 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Connect via TMA Code</div>
            <div className="auth-sub">
              Enter your TMA / eFiling code to connect to IP India. This pulls your matter list directly from the public TLA Queue — <b style={{ color: "#f0c842" }}>no password or CAPTCHA required.</b>
            </div>

            {error && <div className="auth-error">⚠ {error}</div>}
            {wakeMsg && !error && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(201,146,10,.08)", border: "1px solid rgba(201,146,10,.22)", borderRadius: 9, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#f0c842" }}>
                <div style={{ width: 14, height: 14, border: "2px solid #f0c842", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
                {wakeMsg}
              </div>
            )}

            {/* Info box */}
            <div style={{ background: "rgba(0,196,160,.06)", border: "1px solid rgba(0,196,160,.16)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", gap: 12 }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>ℹ️</span>
              <div style={{ fontSize: 12, color: "#8898bf", lineHeight: 1.7 }}>
                Your <b style={{ color: "#dde4f2" }}>TMA Code</b> is your IP India eFiling username (e.g. <code style={{ background: "#1a2545", padding: "1px 6px", borderRadius: 4, fontSize: 11, color: "#f0c842" }}>TMA/GJ/2847</code> or just <code style={{ background: "#1a2545", padding: "1px 6px", borderRadius: 4, fontSize: 11, color: "#f0c842" }}>manthan15</code>).
                We use the <b style={{ color: "#dde4f2" }}>public TLA Queue</b> to verify it — no password needed.
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>TMA Code / eFiling Username *</label>
              <input style={{ ...inp, fontSize: 15, fontWeight: 600, letterSpacing: "0.05em" }}
                placeholder="e.g. TMA/GJ/2847 or manthan15"
                value={tmaCode}
                onChange={e => setTmaCode(e.target.value)}
                onFocus={e => e.target.style.borderColor="#c9920a"}
                onBlur={e => e.target.style.borderColor="#1a2545"}
                onKeyDown={e => { if (e.key === "Enter") doVerifyTMA() }} />
            </div>

            {/* Log terminal */}
            <div style={{ background: "#010508", border: "1px solid #1a2545", borderRadius: 9, padding: "12px 14px", fontFamily: "'JetBrains Mono',monospace", fontSize: 11.5, lineHeight: 1.9, height: 130, overflowY: "auto", marginBottom: 10 }}>
              {verifyLog.length === 0
                ? <div style={{ color: "#1e2d50" }}>Enter your TMA code and click Verify to connect…</div>
                : verifyLog.map((l, i) => (
                    <div key={i} style={{ display: "flex", gap: 12 }}>
                      <span style={{ color: "#1e2d50", flexShrink: 0 }}>{l.ts}</span>
                      <span style={{ color: clsMap[l.t] || "#5b9ef8" }}>{l.m}</span>
                    </div>
                  ))}
            </div>
            <div style={{ background: "#1a2545", borderRadius: 3, height: 4, overflow: "hidden", marginBottom: 18 }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#c9920a,#f0c842)", borderRadius: 3, width: progress + "%", transition: "width .4s ease" }} />
            </div>

            {/* Success card */}
            {tmaData && (
              <div style={{ background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ fontSize: 22 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#00c4a0" }}>Connected: {tmaData.tmaCode}</div>
                  <div style={{ fontSize: 12, color: "#3d4f78" }}>
                    {tmaData.name && `${tmaData.name} · `}{tmaData.city}, {tmaData.state}
                    {tmaData.itemsFound > 0 && ` · ${tmaData.itemsFound} matters found`}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque',sans-serif" }}>← Back</button>
              <button className="auth-btn" style={{ flex: 1.5 }} onClick={doVerifyTMA} disabled={verifying}>
                {verifying
                  ? <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
                  : "🔍 Verify & Connect"}
              </button>
              {tmaData ? (
                <button className="auth-btn" style={{ flex: 1 }} onClick={() => setStep(4)}>Next →</button>
              ) : mustConnect ? (
                <div style={{ flex: 1, background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.2)", borderRadius: 10, padding: "10px 12px", fontSize: 11, color: "#f43f5e", display: "flex", alignItems: "center", gap: 6 }}>
                  🔒 Verify TMA code to continue
                </div>
              ) : (
                <button className="auth-btn" style={{ flex: 1, background: "rgba(61,79,120,.3)" }} onClick={() => setStep(4)}>Skip →</button>
              )}
            </div>
          </div>
        )}

        {/* ── STEP 4: Preferences ── */}
        {step === 4 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Preferences</div>
            <div className="auth-sub">Configure your notification settings.</div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Hearing reminder lead time</label>
              <select style={{ ...inp, cursor: "pointer" }} value={notifLeadTime} onChange={e => setNotifLeadTime(e.target.value)}>
                {["1","2","3","5","7","14"].map(d => <option key={d} value={d}>{d} day{d !== "1" ? "s" : ""} before</option>)}
              </select>
            </div>
            <div style={{ padding: "14px 16px", background: "rgba(0,196,160,.07)", border: "1px solid rgba(0,196,160,.15)", borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 6 }}>✅ Setup Summary</div>
              <div style={{ fontSize: 12, color: "#8898bf", lineHeight: 1.9 }}>
                Name: {profile.fullName || "—"}<br />
                Firm: {profile.firmName || "—"}<br />
                Location: {profile.city}, {profile.state}<br />
                TMA Code: {tmaData ? <span style={{ color: "#00c4a0", fontWeight: 600 }}>{tmaData.tmaCode} ✅</span> : <span style={{ color: "#f43f5e" }}>Not connected</span>}<br />
                Hearing Reminder: {notifLeadTime} day{notifLeadTime !== "1" ? "s" : ""} before
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(3)} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque',sans-serif" }}>← Back</button>
              <button className="auth-btn" onClick={handleComplete} style={{ flex: 2 }}>Enter MarkShield →</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
