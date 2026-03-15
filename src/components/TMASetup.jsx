import React, { useState, useEffect } from "react"
import { checkBackend, fetchCaptcha, efilingLogin } from "../services/api"

const LOG_PREFIX = [
  { t: "info", m: "Initializing secure connection to ipindia.gov.in..." },
  { t: "ok",   m: "TLS handshake complete — connection established" },
  { t: "info", m: "Authenticating TMA credentials with CGPDTM registry..." },
]
const LOG_SUCCESS_SUFFIX = [
  { t: "ok",   m: "Attorney record verified — TMA code authenticated ✓" },
  { t: "data", m: "Fetching attorney registration details..." },
  { t: "ok",   m: "Attorney profile loaded: {NAME} · {CITY}, {STATE}" },
  { t: "info", m: "Scanning linked trademark applications..." },
  { t: "ok",   m: "✅ Sync complete — entering MarkShield dashboard" },
]

export default function TMASetup({ currentUser, onComplete, onSkip, rerunMode, existingProfile, mustConnect }) {
  // If rerunMode, jump straight to step 3 (eFiling) — profile already filled
  const [step, setStep] = useState(rerunMode ? 3 : 2)
  const [error, setError] = useState("")
  const [profile, setProfile] = useState({
    fullName: existingProfile?.fullName || currentUser?.name || "",
    firmName: existingProfile?.firmName || "",
    email:    existingProfile?.email    || currentUser?.email || "",
    mobile:   existingProfile?.mobile   || "",
    phone:    existingProfile?.phone    || "",
    barNo:    existingProfile?.barNo    || "",
    address:  existingProfile?.address  || "",
    city:     existingProfile?.city     || "",
    state:    existingProfile?.state    || "",
    pin:      existingProfile?.pin      || "",
    portalUser: existingProfile?.portalUser || "",
    years:    existingProfile?.years    || "",
  })
  const [tmaCode,       setTmaCode]       = useState("")
  const [tmaPass,       setTmaPass]       = useState("")
  const [captchaImg,    setCaptchaImg]    = useState("")   // base64 PNG
  const [captchaInput,  setCaptchaInput]  = useState("")   // what user types
  const [captchaLoading,setCaptchaLoading]= useState(false)
  const [fetchLog,      setFetchLog]      = useState([])
  const [fetchProgress, setFetchProgress] = useState(0)
  const [tmaData,       setTmaData]       = useState(null)
  const [fetching,      setFetching]      = useState(false)
  const [wakeMsg,       setWakeMsg]       = useState("")
  const [notifLeadTime, setNotifLeadTime] = useState("3")

  const fp = (k, v) => setProfile(p => ({ ...p, [k]: v }))

  // Auto-load captcha when user reaches step 3
  const [autoSolved,    setAutoSolved]    = useState(false)
  const [solveMethod,   setSolveMethod]   = useState("")

  // silent=true → used by auto-load on step entry; never shows error to user
  const loadCaptcha = async (silent = false) => {
    setCaptchaLoading(true)
    setCaptchaImg("")
    setCaptchaInput("")
    setAutoSolved(false)
    setSolveMethod("")
    if (!silent) setError("")   // only clear error on manual refresh
    try {
      const res = await fetchCaptcha()
      if (res?.success && res.captcha) {
        setCaptchaImg(res.captcha)
        if (!silent) setError("")   // clear any previous error on success
        if (res.auto_solved && res.solved_text) {
          setCaptchaInput(res.solved_text)
          setAutoSolved(true)
          setSolveMethod(res.solve_method || "auto")
        }
      } else if (!silent) {
        // Only show error if user explicitly clicked Refresh
        setError("Could not load CAPTCHA — backend may still be waking up. Try again in 30s.")
      }
    } catch(_e) {
      if (!silent) {
        setError("Could not load CAPTCHA. Backend may be waking up — wait 30s and click Refresh.")
      }
    }
    setCaptchaLoading(false)
  }

  // Auto-load silently when step 3 opens — no error shown on failure
  useEffect(() => {
    if (step === 3 && !captchaImg) {
      loadCaptcha(true)   // silent=true: backend sleeping → no scary error
    }
  }, [step])

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

  const addLog = (t, m) =>
    setFetchLog(prev => [...prev, {
      t,
      m: m.replace("{NAME}", profile.fullName).replace("{CITY}", profile.city).replace("{STATE}", profile.state),
      ts: new Date().toLocaleTimeString()
    }])

  const doFetchTMA = async () => {
    if (!tmaCode.trim())   { setError("Please enter your eFiling username."); return }
    if (!tmaPass.trim())   { setError("Please enter your eFiling password."); return }
    if (!captchaInput.trim()) { setError("Please enter the CAPTCHA code shown in the image."); return }

    setError(""); setFetching(true); setFetchLog([]); setFetchProgress(0); setTmaData(null)

    // Step 1 — Check backend is reachable (handles Render cold-start)
    addLog("info", "⏳ Waking up backend server (Render free tier may take ~30s)…")
    setFetchProgress(5)

    const backendUp = await checkBackend((attempt, max) => {
      const msgs = [
        "Still waking up… Render free tier takes ~30-60s on first request.",
        "Almost there… backend is starting up.",
        "One more moment… nearly ready.",
      ]
      setWakeMsg(msgs[attempt - 1] || "Still connecting…")
      addLog("warn", `🔄 Retry ${attempt}/${max} — backend is warming up, please wait…`)
      setFetchProgress(5 + attempt * 8)
    })
    setWakeMsg("")

    if (!backendUp) {
      addLog("err", "❌ Backend unreachable after multiple attempts.")
      addLog("warn", "Check your Render dashboard — service may be paused or crashed.")
      setFetchProgress(0)
      setFetching(false)
      setError("Cannot reach backend. Check your Render service or run it locally.")
      return
    }
    addLog("ok", "✅ Backend is online — connected successfully.")

    // Step 2 — Show prefix logs
    for (const entry of LOG_PREFIX) {
      await new Promise(r => setTimeout(r, 300 + Math.random() * 150))
      addLog(entry.t, entry.m)
      setFetchProgress(prev => prev + 10)
    }
    setFetchProgress(50)

    // Step 3 — Real login with captcha
    try {
      const result = await efilingLogin(tmaCode.trim(), tmaPass, captchaInput.trim())

      if (result?.success) {
        for (const entry of LOG_SUCCESS_SUFFIX) {
          await new Promise(r => setTimeout(r, 280 + Math.random() * 150))
          addLog(entry.t, entry.m)
          setFetchProgress(prev => Math.min(prev + 10, 100))
        }
        setFetchProgress(100)
        setTmaData({
          name: profile.fullName,
          tmaCode: result.username || tmaCode.trim(),
          username: tmaCode.trim(),
          city: profile.city, state: profile.state,
          total: 0, registered: 0, hearings: 0, pending: 0,
          connectedAt: new Date().toISOString(),
        })
      } else {
        const msg = result?.message || "Login failed."
        const isCaptchaErr = /captcha/i.test(msg)
        addLog("err", `❌ ${msg}`)
        if (isCaptchaErr) {
          addLog("warn", "🔁 Loading a fresh CAPTCHA — please try again.")
          await loadCaptcha()
        } else {
          addLog("warn", "Please check your IP India eFiling credentials and try again.")
        }
        setFetchProgress(0)
        setError(msg + (isCaptchaErr ? " A new CAPTCHA has been loaded." : ""))
      }
    } catch (err) {
      const msg = err?.message || "Connection error"
      addLog("err", `❌ ${msg}`)
      setFetchProgress(0)
      setError(msg)
    }

    setFetching(false)
  }

  const handleComplete = () => {
    onComplete(profile, tmaData || { name: profile.fullName, tmaCode, city: profile.city, state: profile.state })
  }

  const inp = {
    width: "100%", background: "#020610", border: "1.5px solid #1a2545",
    borderRadius: 9, padding: "10px 13px", color: "#dde4f2",
    fontFamily: "'Bricolage Grotesque', sans-serif", fontSize: 13, outline: "none",
    transition: "border-color .2s",
  }
  const lbl = { display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "#3d4f78", marginBottom: 6 }
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

        {/* Steps */}
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

        {/* ── STEP 2: Attorney Profile ── */}
        {step === 2 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Attorney Profile</div>
            <div className="auth-sub">Your professional details for MarkShield. Required fields marked *.</div>
            {error && <div className="auth-error">{error}</div>}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Full Name *</label><input style={inp} placeholder="Advocate Manthan Desai" value={profile.fullName} onChange={e => fp("fullName", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              <div><label style={lbl}>Firm / Practice Name</label><input style={inp} placeholder="e.g. Desai & Associates" value={profile.firmName} onChange={e => fp("firmName", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>Email *</label><input style={inp} type="email" placeholder="advocate@firm.com" value={profile.email} onChange={e => fp("email", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              <div><label style={lbl}>Mobile *</label><input style={inp} placeholder="+91 98000 00000" value={profile.mobile} onChange={e => fp("mobile", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
              <div><label style={lbl}>City *</label><input style={inp} placeholder="e.g. Surat" value={profile.city} onChange={e => fp("city", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} /></div>
              <div><label style={lbl}>State *</label>
                <select style={{ ...inp, cursor: "pointer" }} value={profile.state} onChange={e => fp("state", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"}>
                  <option value="">Select State</option>
                  {["Gujarat","Maharashtra","Delhi","Karnataka","Tamil Nadu","Rajasthan","Uttar Pradesh","West Bengal","Telangana","Punjab","Haryana","Kerala","Madhya Pradesh","Odisha","Andhra Pradesh"].map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>TMA / Bar Council Registration No.</label>
              <input style={inp} placeholder="e.g. TMA/GJ/2847" value={profile.barNo} onChange={e => fp("barNo", e.target.value)} onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Years of Practice</label>
              <select style={{ ...inp, cursor: "pointer" }} value={profile.years} onChange={e => fp("years", e.target.value)}>
                <option value="">Select</option>
                {["0-2","3-5","5-10","10-20","20+"].map(y => <option key={y} value={y}>{y} years</option>)}
              </select>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              {onSkip ? (
                <button onClick={onSkip} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque',sans-serif", transition: "border-color .2s" }}
                  onMouseOver={e => e.currentTarget.style.borderColor="#c9920a"} onMouseOut={e => e.currentTarget.style.borderColor="#1a2545"}>
                  Skip Setup →
                </button>
              ) : (
                <div style={{ flex: 1, fontSize: 11, color: "#3d4f78", display: "flex", alignItems: "center", gap: 6 }}>
                  <span>⚖️</span> IP Attorneys must complete setup to access MarkShield.
                </div>
              )}
              <button className="auth-btn" onClick={goToStep3} style={{ flex: 2 }}>Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: eFiling Login with CAPTCHA ── */}
        {step === 3 && (
          <div className="auth-box" style={{ width: "100%", maxWidth: "100%" }}>
            <div className="auth-title" style={{ fontSize: 20 }}>Connect IP India eFiling</div>
            <div className="auth-sub">Enter your IP India eFiling credentials. This is optional — you can skip and add trademarks manually.</div>

            {error && <div className="auth-error">⚠ {error}</div>}
            {wakeMsg && !error && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: "rgba(201,146,10,.08)", border: "1px solid rgba(201,146,10,.22)", borderRadius: 9, padding: "10px 14px", marginBottom: 12, fontSize: 12.5, color: "#f0c842" }}>
                <div style={{ width: 14, height: 14, border: "2px solid #f0c842", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
                {wakeMsg}
              </div>
            )}

            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>eFiling Username / TMA Code</label>
              <input style={inp} placeholder="e.g. manthan15" value={tmaCode} onChange={e => setTmaCode(e.target.value)}
                onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={lbl}>eFiling Password</label>
              <input style={inp} type="password" placeholder="••••••••" value={tmaPass} onChange={e => setTmaPass(e.target.value)}
                onFocus={e => e.target.style.borderColor="#c9920a"} onBlur={e => e.target.style.borderColor="#1a2545"} />
            </div>

            {/* CAPTCHA block */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <label style={{ ...lbl, marginBottom: 0 }}>CAPTCHA — Enter code from image *</label>
                <button onClick={loadCaptcha} disabled={captchaLoading} style={{
                  background: "none", border: "1px solid #1a2545", borderRadius: 7, padding: "4px 11px",
                  color: "#f0c842", fontSize: 11.5, cursor: "pointer", fontFamily: "'Bricolage Grotesque',sans-serif",
                  display: "flex", alignItems: "center", gap: 5, transition: "border-color .2s"
                }} onMouseOver={e => e.currentTarget.style.borderColor="#c9920a"} onMouseOut={e => e.currentTarget.style.borderColor="#1a2545"}>
                  {captchaLoading
                    ? <><div style={{ width: 11, height: 11, border: "2px solid #f0c842", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> Loading…</>
                    : "🔁 Refresh"}
                </button>
              </div>

              {/* Captcha image box */}
              <div style={{ background: "#010508", border: "1px solid #1a2545", borderRadius: 9, padding: 14, marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 72 }}>
                {captchaLoading ? (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#3d4f78", fontSize: 12 }}>
                    <div style={{ width: 20, height: 20, border: "2px solid #f0c842", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .7s linear infinite" }} />
                    <span>Connecting to IP India<span style={{ animation: "pulse 1.2s infinite" }}>…</span></span>
                  </div>
                ) : captchaImg ? (
                  <img src={`data:image/png;base64,${captchaImg}`} alt="CAPTCHA"
                    style={{ maxHeight: 60, borderRadius: 6, filter: "contrast(1.2) brightness(1.1)", imageRendering: "pixelated" }} />
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#3d4f78", fontSize: 12, textAlign: "center" }}>
                    <span style={{ fontSize: 22 }}>🔒</span>
                    <span>Enter your credentials above,<br/>then click <b style={{ color: "#f0c842" }}>🔁 Refresh</b> to load CAPTCHA</span>
                    <span style={{ fontSize: 10.5, color: "#1e2d50" }}>Backend may take ~30s to wake up on first use</span>
                  </div>
                )}
              </div>

              {autoSolved && (
                <div style={{ display: "flex", alignItems: "center", gap: 7, background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.22)", borderRadius: 8, padding: "7px 12px", marginBottom: 8, fontSize: 12 }}>
                  <span style={{ fontSize: 15 }}>🤖</span>
                  <span style={{ color: "#00c4a0" }}>Auto-solved by AI (<b>{solveMethod}</b>) — verify below or click Connect</span>
                </div>
              )}
              <input style={{ ...inp, letterSpacing: "0.2em", fontWeight: 700, fontSize: 15, textTransform: "uppercase",
                borderColor: autoSolved ? "rgba(0,196,160,.5)" : "#1a2545" }}
                placeholder="e.g. 26HD4"
                value={captchaInput}
                onChange={e => { setCaptchaInput(e.target.value.toUpperCase()); setAutoSolved(false) }}
                onFocus={e => e.target.style.borderColor="#c9920a"}
                onBlur={e => e.target.style.borderColor= autoSolved ? "rgba(0,196,160,.5)" : "#1a2545"}
                onKeyDown={e => { if (e.key === "Enter") doFetchTMA() }} />
              <div style={{ fontSize: 11, color: "#3d4f78", marginTop: 5 }}>
                {autoSolved
                  ? "✅ AI filled this automatically. If login fails, get a new CAPTCHA."
                  : "ℹ Capital letters + numbers only (e.g. 26HD4). Case-sensitive."}
              </div>
            </div>

            {/* Log terminal */}
            <div style={{ background: "#010508", border: "1px solid #1a2545", borderRadius: 9, padding: "12px 14px", fontFamily: "'JetBrains Mono', monospace", fontSize: 11.5, lineHeight: 1.9, height: 140, overflowY: "auto", marginBottom: 10 }}>
              {fetchLog.length === 0
                ? <div style={{ color: "#1e2d50" }}>Enter credentials, solve CAPTCHA, and click Connect…</div>
                : fetchLog.map((l, i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <span style={{ color: "#1e2d50", flexShrink: 0 }}>{l.ts}</span>
                    <span style={{ color: clsMap[l.t] || "#5b9ef8" }}>{l.m}</span>
                  </div>
                ))}
            </div>
            <div style={{ background: "#1a2545", borderRadius: 3, height: 4, overflow: "hidden", marginBottom: 20 }}>
              <div style={{ height: "100%", background: "linear-gradient(90deg,#c9920a,#f0c842)", borderRadius: 3, width: fetchProgress + "%", transition: "width .4s ease" }} />
            </div>

            {tmaData && (
              <div style={{ background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 20, display: "flex", gap: 12, alignItems: "center" }}>
                <div style={{ fontSize: 20 }}>✅</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#00c4a0" }}>Connected: {tmaData.name}</div>
                  <div style={{ fontSize: 12, color: "#3d4f78" }}>{tmaData.tmaCode} · {tmaData.city}, {tmaData.state}</div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setStep(2)} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque',sans-serif" }}>← Back</button>
              <button className="auth-btn" style={{ flex: 1.5 }} onClick={doFetchTMA} disabled={fetching || !captchaImg}>
                {fetching
                  ? <div style={{ width: 18, height: 18, border: "2.5px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
                  : "🔗 Connect eFiling"}
              </button>
              {tmaData ? (
                <button className="auth-btn" style={{ flex: 1 }} onClick={() => setStep(4)}>Next →</button>
              ) : mustConnect ? (
                <div style={{ flex: 1, background: "rgba(244,63,94,.08)", border: "1px solid rgba(244,63,94,.2)", borderRadius: 10, padding: "10px 12px", fontSize: 11.5, color: "#f43f5e", display: "flex", alignItems: "center", gap: 7, lineHeight: 1.4 }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>🔒</span>
                  <span>IP Attorneys must connect to continue. Connect above or contact admin.</span>
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
            <div className="auth-sub">Configure your notification and reminder settings.</div>
            <div style={{ marginBottom: 20 }}>
              <label style={lbl}>Hearing reminder lead time</label>
              <select style={{ ...inp, cursor: "pointer" }} value={notifLeadTime} onChange={e => setNotifLeadTime(e.target.value)}>
                {["1","2","3","5","7","14"].map(d => <option key={d} value={d}>{d} day{d !== "1" ? "s" : ""} before</option>)}
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
              <button onClick={() => setStep(3)} style={{ flex: 1, background: "none", border: "1.5px solid #1a2545", borderRadius: 10, padding: 13, color: "#3d4f78", cursor: "pointer", fontSize: 14, fontFamily: "'Bricolage Grotesque',sans-serif" }}>← Back</button>
              <button className="auth-btn" onClick={handleComplete} style={{ flex: 2 }}>Enter MarkShield →</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
