import React, { useState, useEffect } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const post = (path, body) => fetch(API+path, {
  method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify(body)
}).then(r => r.json())
const get  = (path) => fetch(API+path).then(r => r.json())

export default function EStatusSetup({ context, onComplete }) {
  const email  = context?.agentProfile?.email  || context?.currentUser?.email  || ""
  const mobile = context?.agentProfile?.mobile || context?.currentUser?.mobile || ""

  const [phase,           setPhase]           = useState("check")
  const [captchaExpr,     setCaptchaExpr]     = useState("")
  const [captchaAnswer,   setCaptchaAnswer]   = useState("")
  const [sessionCookies,  setSessionCookies]  = useState({})
  const [formFields,      setFormFields]      = useState([])
  const [otp,             setOtp]             = useState("")
  const [msg,             setMsg]             = useState("")
  const [loading,         setLoading]         = useState(false)
  const [connected,       setConnected]       = useState(false)
  const [useEmail,        setUseEmail]        = useState(!mobile || !!email)
  const [manualAnswer,    setManualAnswer]    = useState(false)

  useEffect(() => { checkStatus() }, [])

  const checkStatus = async () => {
    try {
      const r = await get("/estatus/status")
      setConnected(r.connected)
      setPhase(r.connected ? "done" : "captcha")
    } catch(_e) { setPhase("captcha") }
  }

  const loadCaptcha = async () => {
    setLoading(true); setMsg("Loading captcha from IP India…")
    try {
      const r = await get(`/estatus/captcha?email=${encodeURIComponent(email)}&mobile=${encodeURIComponent(mobile)}`)
      if (r.success) {
        setCaptchaExpr(r.captcha_expr || "")
        setSessionCookies(r.session_cookies || {})
        setFormFields(r.form_fields || [])

        if (r.captcha_answer !== null && r.captcha_answer !== undefined) {
          setCaptchaAnswer(r.captcha_answer.toString())
          setManualAnswer(false)
          setMsg("✅ Captcha auto-solved — answer filled below")
        } else {
          // Auto-solve failed — show manual entry
          setManualAnswer(true)
          setMsg("⚠️ Could not auto-solve captcha — enter the answer manually below")
        }
      } else {
        setMsg("❌ " + (r.error || "Could not reach IP India — try again"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const sendOtp = async () => {
    if (!captchaAnswer.trim()) { setMsg("❌ Enter the captcha answer first"); return }
    setLoading(true); setMsg("Sending OTP…")
    try {
      const r = await post("/estatus/send-otp", {
        email:           useEmail ? email  : "",
        mobile:          useEmail ? ""     : mobile,
        captcha_answer:  parseInt(captchaAnswer) || captchaAnswer,
        session_cookies: sessionCookies,
      })
      if (r.success) {
        setPhase("otp_sent")
        setSessionCookies(r.session_cookies || sessionCookies)
        setMsg(`✅ OTP sent to your ${useEmail ? "email" : "mobile"}`)
      } else {
        setMsg("❌ " + (r.message || r.error || "Failed"))
        setManualAnswer(true) // let user correct captcha
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const verifyOtp = async () => {
    if (!otp.trim()) { setMsg("❌ Enter OTP"); return }
    setLoading(true); setMsg("Verifying OTP…")
    try {
      const r = await post("/estatus/verify-otp", {
        otp,
        email:           useEmail ? email  : "",
        mobile:          useEmail ? ""     : mobile,
        session_cookies: sessionCookies,
      })
      if (r.success) {
        setConnected(true); setPhase("done")
        setMsg(r.message)
        if (onComplete) onComplete()
      } else {
        setMsg("❌ " + (r.message || "OTP failed — try again"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const disconnect = async () => {
    await post("/estatus/disconnect", {})
    setConnected(false); setPhase("captcha")
    setCaptchaExpr(""); setCaptchaAnswer(""); setOtp(""); setMsg("")
  }

  const card = { background:"var(--s1)", border:"1px solid var(--border)",
    borderRadius:14, padding:"28px 28px" }
  const inp  = { background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8,
    padding:"10px 14px", color:"var(--text)", fontFamily:"var(--head)", fontSize:14,
    outline:"none", width:"100%", boxSizing:"border-box" }

  if (phase === "done" && connected) return (
    <div style={card}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
        <div style={{ width:48, height:48, borderRadius:"50%", background:"rgba(0,196,160,.15)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:24 }}>✅</div>
        <div>
          <div style={{ fontSize:16, fontWeight:800 }}>eStatus Connected</div>
          <div style={{ fontSize:12.5, color:"var(--teal)", marginTop:3 }}>
            Full trademark data fetching enabled — no OTP needed again
          </div>
        </div>
      </div>
      <div style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.8, marginBottom:18 }}>
        MarkShield now fetches complete trademark details from IP India's eStatus portal
        — status, applicant, goods/services, hearing dates, certificates.
        Session is saved permanently in the database.
      </div>
      <button onClick={disconnect} style={{ background:"none", border:"1px solid var(--border)",
        borderRadius:8, padding:"8px 16px", color:"var(--text3)", cursor:"pointer",
        fontSize:12, fontFamily:"var(--head)" }}>
        🔌 Disconnect & Reset
      </button>
    </div>
  )

  return (
    <div style={card}>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:6 }}>
        🔐 Connect eStatus — One-Time OTP Setup
      </div>
      <div style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.7, marginBottom:20 }}>
        IP India's eStatus requires a one-time OTP.
        After this, <b style={{ color:"var(--text)" }}>MarkShield fetches complete trademark data automatically</b> — 
        status, applicant, agent, goods & services, hearings, certificates.
        No OTP ever again.
      </div>

      {/* Contact method selector */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
          color:"var(--text3)", marginBottom:8 }}>Send OTP via</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {[[true,"📧 Email",email],[false,"📱 Mobile",mobile]].map(([isEmail,label,val]) => val && (
            <button key={label} onClick={() => setUseEmail(isEmail)}
              style={{ padding:"9px 18px", borderRadius:8, cursor:"pointer",
                border: useEmail===isEmail ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: useEmail===isEmail ? "rgba(201,146,10,.15)" : "var(--bg)",
                color: useEmail===isEmail ? "#f0c842" : "var(--text3)",
                fontFamily:"var(--head)", fontSize:13, fontWeight:600 }}>
              {label}: <span style={{ fontFamily:"var(--mono)", fontSize:12 }}>{val}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Captcha phase */}
      {phase === "captcha" && (
        <>
          <button onClick={loadCaptcha} disabled={loading}
            className="topbar-btn btn-ghost" style={{ marginBottom:16 }}>
            {loading ? "⏳ Loading…" : "📋 Load Captcha from IP India"}
          </button>

          {/* Captcha expression display */}
          {captchaExpr && (
            <div style={{ background:"rgba(240,200,66,.07)", border:"1px solid rgba(240,200,66,.2)",
              borderRadius:10, padding:"14px 18px", marginBottom:14 }}>
              <div style={{ fontSize:11, color:"var(--text3)", marginBottom:6 }}>
                CAPTCHA EXPRESSION FROM IP INDIA:
              </div>
              <div style={{ fontFamily:"var(--mono)", fontSize:20, fontWeight:700, color:"#f0c842" }}>
                {captchaExpr}
              </div>
            </div>
          )}

          {/* Answer input - auto-filled or manual */}
          {(captchaExpr || manualAnswer) && (
            <div style={{ marginBottom:16 }}>
              <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
                color:"var(--text3)", marginBottom:6 }}>
                {manualAnswer ? "Enter captcha answer manually *" : "Captcha answer (auto-solved) *"}
              </div>
              <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                <input
                  style={{ ...inp, width:120, textAlign:"center",
                    fontFamily:"var(--mono)", fontSize:20, fontWeight:700,
                    borderColor: captchaAnswer ? "var(--teal)" : "var(--border)" }}
                  value={captchaAnswer}
                  onChange={e => setCaptchaAnswer(e.target.value)}
                  placeholder="?"
                  type="number"
                />
                {!manualAnswer && (
                  <button onClick={() => setManualAnswer(true)}
                    style={{ fontSize:11, color:"var(--text3)", background:"none",
                      border:"none", cursor:"pointer", textDecoration:"underline" }}>
                    Enter manually
                  </button>
                )}
              </div>
            </div>
          )}

          {(captchaExpr || manualAnswer) && captchaAnswer && (
            <button onClick={sendOtp} disabled={loading}
              className="topbar-btn btn-primary">
              {loading ? "⏳ Sending…" : `📨 Send OTP to ${useEmail ? "Email" : "Mobile"}`}
            </button>
          )}
        </>
      )}

      {/* OTP entry phase */}
      {phase === "otp_sent" && (
        <div>
          <div style={{ background:"rgba(0,196,160,.08)", border:"1px solid rgba(0,196,160,.2)",
            borderRadius:10, padding:"14px 20px", marginBottom:18 }}>
            <div style={{ fontSize:13, fontWeight:700, color:"var(--teal)", marginBottom:4 }}>
              📲 OTP Sent!
            </div>
            <div style={{ fontSize:12.5, color:"var(--text3)" }}>
              Check your {useEmail ? <>inbox at <b>{email}</b> (also check spam)</> : <>SMS at <b>{mobile}</b></>}
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
              color:"var(--text3)", marginBottom:8 }}>Enter OTP *</div>
            <input
              style={{ ...inp, width:200, textAlign:"center",
                fontFamily:"var(--mono)", fontSize:24, fontWeight:700, letterSpacing:"0.3em" }}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g,""))}
              placeholder="• • • • • •"
              maxLength={8}
              autoFocus
              onKeyDown={e => e.key === "Enter" && verifyOtp()}
            />
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={verifyOtp} disabled={loading || !otp}
              className="topbar-btn btn-primary">
              {loading ? "⏳ Verifying…" : "✅ Verify & Save Session"}
            </button>
            <button onClick={() => { setPhase("captcha"); setOtp(""); setMsg("") }}
              className="topbar-btn btn-ghost">
              ← Resend OTP
            </button>
          </div>
        </div>
      )}

      {/* Status message */}
      {msg && (
        <div style={{ marginTop:16, padding:"10px 14px", borderRadius:8, fontSize:13,
          background: msg.startsWith("✅") ? "rgba(0,196,160,.08)"
                    : msg.startsWith("⚠") ? "rgba(240,200,66,.08)"
                    : "rgba(244,63,94,.08)",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(0,196,160,.2)"
                              : msg.startsWith("⚠") ? "rgba(240,200,66,.2)"
                              : "rgba(244,63,94,.2)"}`,
          color: msg.startsWith("✅") ? "var(--teal)"
               : msg.startsWith("⚠") ? "#f0c842"
               : "var(--rose)" }}>
          {msg}
        </div>
      )}

      {/* Debug info when there are issues */}
      {formFields.length > 0 && !connected && (
        <div style={{ marginTop:12, fontSize:11, color:"var(--text3)" }}>
          Form fields found: {formFields.join(", ")}
        </div>
      )}
    </div>
  )
}
