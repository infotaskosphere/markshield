import React, { useState, useEffect } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const post = (path, body) => fetch(API+path, {
  method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify(body)
}).then(r=>r.json())
const get = (path) => fetch(API+path).then(r=>r.json())

export default function EStatusSetup({ context, onComplete }) {
  const email  = context?.agentProfile?.email  || context?.currentUser?.email  || ""
  const mobile = context?.agentProfile?.mobile || context?.currentUser?.mobile || ""

  const [phase,          setPhase]          = useState("check")  // check|captcha|otp_sent|done
  const [captchaExpr,    setCaptchaExpr]    = useState("")
  const [captchaAnswer,  setCaptchaAnswer]  = useState("")
  const [sessionCookies, setSessionCookies] = useState({})
  const [otp,            setOtp]            = useState("")
  const [msg,            setMsg]            = useState("")
  const [loading,        setLoading]        = useState(false)
  const [connected,      setConnected]      = useState(false)
  const [useEmail,       setUseEmail]       = useState(true)

  useEffect(() => { checkStatus() }, [])

  const checkStatus = async () => {
    try {
      const r = await get("/estatus/status")
      setConnected(r.connected)
      setPhase(r.connected ? "done" : "captcha")
      if (r.connected) setMsg(r.message)
    } catch(_e) { setPhase("captcha") }
  }

  const loadCaptcha = async () => {
    setLoading(true); setMsg("")
    try {
      const r = await get(`/estatus/captcha?email=${encodeURIComponent(email)}&mobile=${encodeURIComponent(mobile)}`)
      if (r.success) {
        setCaptchaExpr(r.captcha_expr)
        setCaptchaAnswer(r.captcha_answer?.toString() || "")
        setSessionCookies(r.session_cookies || {})
        setMsg("✅ Captcha loaded — answer auto-filled below")
      } else {
        setMsg("❌ " + (r.error || "Could not load captcha"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const sendOtp = async () => {
    setLoading(true); setMsg("")
    try {
      const r = await post("/estatus/send-otp", {
        email:          useEmail ? email : "",
        mobile:         useEmail ? "" : mobile,
        captcha_answer: parseInt(captchaAnswer),
        session_cookies: sessionCookies,
      })
      if (r.success) {
        setPhase("otp_sent")
        setSessionCookies(r.session_cookies || sessionCookies)
        setMsg(`✅ OTP sent to your ${useEmail ? "email" : "mobile"}`)
      } else {
        setMsg("❌ " + (r.message || r.error || "Failed to send OTP"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const verifyOtp = async () => {
    if (!otp.trim()) { setMsg("❌ Please enter OTP"); return }
    setLoading(true); setMsg("")
    try {
      const r = await post("/estatus/verify-otp", {
        otp,
        email:          useEmail ? email : "",
        mobile:         useEmail ? "" : mobile,
        session_cookies: sessionCookies,
      })
      if (r.success) {
        setConnected(true); setPhase("done")
        setMsg(r.message)
        if (onComplete) onComplete()
      } else {
        setMsg("❌ " + (r.message || "OTP verification failed — try again"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const disconnect = async () => {
    await post("/estatus/disconnect", {})
    setConnected(false); setPhase("captcha"); setMsg("")
  }

  const card = {
    background: "var(--s1)", border: "1px solid var(--border)",
    borderRadius: 14, padding: "28px 28px", marginBottom: 20,
  }
  const inp = {
    width: "100%", background: "var(--bg)", border: "1px solid var(--border)",
    borderRadius: 8, padding: "10px 14px", color: "var(--text)",
    fontFamily: "var(--head)", fontSize: 14, outline: "none", boxSizing: "border-box",
  }

  if (phase === "done" && connected) return (
    <div style={card}>
      <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
        <div style={{ width:44, height:44, borderRadius:"50%", background:"rgba(0,196,160,.15)",
          display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>✅</div>
        <div>
          <div style={{ fontSize:15, fontWeight:800 }}>eStatus Connected</div>
          <div style={{ fontSize:12, color:"var(--teal)", marginTop:2 }}>
            Full trademark data fetching enabled — session saved permanently
          </div>
        </div>
      </div>
      <div style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.8, marginBottom:16 }}>
        MarkShield can now fetch complete trademark details from IP India's eStatus portal
        including status, applicant, goods/services, hearing dates, and more.
        No OTP required again — session is saved.
      </div>
      <button onClick={disconnect} style={{ background:"none", border:"1px solid var(--border)",
        borderRadius:8, padding:"8px 16px", color:"var(--text3)", cursor:"pointer",
        fontSize:12, fontFamily:"var(--head)" }}>
        🔌 Disconnect
      </button>
    </div>
  )

  return (
    <div style={card}>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:6 }}>
        🔐 Connect eStatus — One-Time OTP Setup
      </div>
      <div style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.7, marginBottom:20 }}>
        IP India's eStatus requires a one-time OTP verification. After this,
        <b style={{ color:"var(--text)" }}> MarkShield will fetch complete trademark data automatically</b> — 
        status, applicant, agent, goods & services, hearing dates, certificates — everything.
        No OTP needed again.
      </div>

      {/* Contact method */}
      <div style={{ marginBottom:16 }}>
        <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
          color:"var(--text3)", marginBottom:8 }}>Send OTP via</div>
        <div style={{ display:"flex", gap:10 }}>
          {[["📧 Email", true], ["📱 Mobile", false]].map(([label, isEmail]) => (
            <button key={label} onClick={() => setUseEmail(isEmail)}
              style={{ padding:"8px 18px", borderRadius:8, cursor:"pointer",
                border: useEmail===isEmail ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: useEmail===isEmail ? "rgba(201,146,10,.15)" : "transparent",
                color: useEmail===isEmail ? "#f0c842" : "var(--text3)",
                fontFamily:"var(--head)", fontSize:13, fontWeight:600 }}>
              {label}: {isEmail ? (email || "not set") : (mobile || "not set")}
            </button>
          ))}
        </div>
      </div>

      {/* Captcha section */}
      {phase === "captcha" && (
        <>
          <button onClick={loadCaptcha} disabled={loading}
            className="topbar-btn btn-ghost" style={{ marginBottom:16 }}>
            {loading ? "Loading captcha…" : "📋 Load Captcha from IP India"}
          </button>

          {captchaExpr && (
            <div style={{ marginBottom:16 }}>
              <div style={{ background:"rgba(240,200,66,.08)", border:"1px solid rgba(240,200,66,.2)",
                borderRadius:10, padding:"14px 18px", marginBottom:12,
                display:"flex", alignItems:"center", gap:16 }}>
                <span style={{ fontSize:22, fontFamily:"var(--mono)", fontWeight:700,
                  color:"#f0c842" }}>{captchaExpr}</span>
                <span style={{ fontSize:12, color:"var(--text3)" }}>
                  (auto-solved: <b style={{ color:"var(--teal)" }}>{captchaAnswer}</b>)
                </span>
              </div>
              <div style={{ fontSize:11.5, color:"var(--text3)", marginBottom:12 }}>
                Verify captcha answer (auto-filled):
              </div>
              <input style={{ ...inp, width:120, textAlign:"center",
                fontFamily:"var(--mono)", fontSize:18, fontWeight:700 }}
                value={captchaAnswer} onChange={e => setCaptchaAnswer(e.target.value)}
                placeholder="Answer" />
            </div>
          )}

          {captchaExpr && (
            <button onClick={sendOtp} disabled={loading || !captchaAnswer}
              className="topbar-btn btn-primary">
              {loading ? "Sending…" : `📨 Send OTP to ${useEmail ? "Email" : "Mobile"}`}
            </button>
          )}
        </>
      )}

      {/* OTP entry */}
      {phase === "otp_sent" && (
        <div>
          <div style={{ background:"rgba(0,196,160,.08)", border:"1px solid rgba(0,196,160,.2)",
            borderRadius:10, padding:"14px 18px", marginBottom:16, fontSize:13 }}>
            📲 OTP sent to <b style={{ color:"var(--teal)" }}>{useEmail ? email : mobile}</b> — 
            check your {useEmail ? "inbox (also spam folder)" : "SMS"}
          </div>
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
              color:"var(--text3)", marginBottom:6 }}>Enter OTP *</div>
            <input style={{ ...inp, width:180, textAlign:"center",
              fontFamily:"var(--mono)", fontSize:22, fontWeight:700,
              letterSpacing:"0.3em" }}
              value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g,""))}
              placeholder="• • • • • •" maxLength={8}
              onKeyDown={e => e.key === "Enter" && verifyOtp()} />
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={verifyOtp} disabled={loading || !otp}
              className="topbar-btn btn-primary">
              {loading ? "Verifying…" : "✅ Verify & Save Session"}
            </button>
            <button onClick={() => { setPhase("captcha"); setOtp("") }}
              className="topbar-btn btn-ghost">
              ← Resend OTP
            </button>
          </div>
        </div>
      )}

      {msg && (
        <div style={{ marginTop:14, padding:"10px 14px", borderRadius:8, fontSize:13,
          background: msg.startsWith("✅") ? "rgba(0,196,160,.08)" : "rgba(244,63,94,.08)",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(0,196,160,.2)" : "rgba(244,63,94,.2)"}`,
          color: msg.startsWith("✅") ? "var(--teal)" : "var(--rose)" }}>
          {msg}
        </div>
      )}
    </div>
  )
}
