import React, { useState, useEffect } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const post = (path, body) => fetch(API+path, {
  method:"POST", headers:{"Content-Type":"application/json"},
  body: JSON.stringify(body)
}).then(r => r.json())
const get = (path) => fetch(API+path).then(r => r.json())

export default function EStatusSetup({ context, onComplete }) {
  const email  = context?.agentProfile?.email  || context?.currentUser?.email  || ""
  const mobile = context?.agentProfile?.mobile || context?.currentUser?.mobile || ""

  const [phase,   setPhase]   = useState("check")  // check|idle|sending|otp_sent|verifying|done
  const [useEmail,setUseEmail]= useState(!!email)
  const [otp,     setOtp]     = useState("")
  const [msg,     setMsg]     = useState("")
  const [loading, setLoading] = useState(false)
  const [captchaInfo, setCaptchaInfo] = useState(null)

  useEffect(() => { checkStatus() }, [])

  const checkStatus = async () => {
    try {
      const r = await get("/estatus/status")
      setPhase(r.connected ? "done" : "idle")
    } catch(_e) { setPhase("idle") }
  }

  const sendOtp = async () => {
    setLoading(true)
    setMsg("Connecting to IP India, solving captcha automatically…")
    setCaptchaInfo(null)
    try {
      const r = await post("/estatus/send-otp", {
        email:  useEmail ? email  : "",
        mobile: useEmail ? ""     : mobile,
      })
      if (r.success) {
        setPhase("otp_sent")
        setCaptchaInfo({ expr: r.captcha_expr, answer: r.captcha_answer })
        setMsg(`✅ OTP sent to your ${useEmail ? "email" : "mobile"} — check inbox/SMS`)
      } else {
        setMsg("❌ " + (r.message || r.error || "Failed to send OTP"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const verifyOtp = async () => {
    if (!otp.trim()) { setMsg("❌ Enter the OTP"); return }
    setLoading(true); setMsg("Verifying OTP…")
    try {
      const r = await post("/estatus/verify-otp", {
        otp,
        email:  useEmail ? email  : "",
        mobile: useEmail ? ""     : mobile,
      })
      if (r.success) {
        setPhase("done"); setMsg(r.message)
        if (onComplete) onComplete()
      } else {
        setMsg("❌ " + (r.message || "OTP incorrect — check and retry"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
    setLoading(false)
  }

  const card = { background:"var(--s1)", border:"1px solid var(--border)", borderRadius:14, padding:"28px 28px" }
  const inp  = { background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8,
    padding:"10px 14px", color:"var(--text)", fontFamily:"var(--head)", fontSize:14,
    outline:"none", boxSizing:"border-box" }

  // ── Done ──
  if (phase === "done") return (
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
        MarkShield now fetches complete trademark details from IP India eStatus —
        status, applicant, agent, goods &amp; services, hearing dates, certificates.
        Session is saved permanently.
      </div>
      <button onClick={async () => {
        await post("/estatus/disconnect",{})
        setPhase("idle"); setMsg(""); setOtp("")
      }} style={{ background:"none", border:"1px solid var(--border)", borderRadius:8,
        padding:"8px 16px", color:"var(--text3)", cursor:"pointer",
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
        Enter OTP once → MarkShield handles everything else automatically.
        <b style={{ color:"var(--text)" }}> No captcha solving needed</b> —
        the backend solves it automatically. This is a <b style={{ color:"#f0c842" }}>one-time setup</b>.
      </div>

      {/* How it works */}
      <div style={{ background:"var(--s2)", borderRadius:10, padding:"14px 18px", marginBottom:20,
        border:"1px solid var(--border)" }}>
        <div style={{ fontSize:12, fontWeight:700, marginBottom:10, color:"var(--text2)" }}>
          How it works:
        </div>
        {[
          ["🤖","Backend automatically fetches & solves the math captcha from IP India"],
          ["📨","IP India sends OTP to your email/mobile"],
          ["✅","You enter the OTP once → session saved permanently in database"],
          ["🚀","All future trademark lookups work instantly — no OTP ever again"],
        ].map(([icon, text]) => (
          <div key={icon} style={{ display:"flex", gap:10, marginBottom:8, alignItems:"flex-start" }}>
            <span style={{ fontSize:16, flexShrink:0 }}>{icon}</span>
            <span style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.5 }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Contact method */}
      <div style={{ marginBottom:18 }}>
        <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
          color:"var(--text3)", marginBottom:8 }}>Receive OTP via</div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          {[[true,"📧 Email",email],[false,"📱 Mobile",mobile]].map(([isEmail,label,val]) => val ? (
            <button key={label} onClick={() => setUseEmail(isEmail)}
              style={{ padding:"10px 20px", borderRadius:8, cursor:"pointer",
                border: useEmail===isEmail ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: useEmail===isEmail ? "rgba(201,146,10,.15)" : "var(--bg)",
                color: useEmail===isEmail ? "#f0c842" : "var(--text3)",
                fontFamily:"var(--head)", fontSize:13, fontWeight:600 }}>
              {label}: <span style={{ fontFamily:"var(--mono)", fontSize:12 }}>{val}</span>
            </button>
          ) : null)}
        </div>
      </div>

      {/* Step 1: Send OTP */}
      {(phase === "idle" || phase === "check") && (
        <button onClick={sendOtp} disabled={loading || (!email && !mobile)}
          className="topbar-btn btn-primary" style={{ fontSize:14, padding:"11px 24px" }}>
          {loading
            ? <><div style={{ width:16,height:16,border:"2px solid rgba(255,255,255,.4)",
                borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite",
                display:"inline-block",marginRight:8,verticalAlign:"middle" }} />
               Solving captcha &amp; sending OTP…</>
            : `🚀 Send OTP to ${useEmail ? "Email" : "Mobile"}`}
        </button>
      )}

      {/* Captcha solved info — shown after send */}
      {captchaInfo?.expr && (
        <div style={{ background:"rgba(0,196,160,.07)", border:"1px solid rgba(0,196,160,.15)",
          borderRadius:8, padding:"10px 14px", marginTop:14, marginBottom:4,
          fontSize:12, color:"var(--teal)" }}>
          🤖 Auto-solved: <b style={{ fontFamily:"var(--mono)" }}>{captchaInfo.expr}</b>
          {" "}= <b style={{ fontFamily:"var(--mono)" }}>{captchaInfo.answer}</b>
        </div>
      )}

      {/* Step 2: Enter OTP */}
      {phase === "otp_sent" && (
        <div style={{ marginTop:16 }}>
          <div style={{ background:"rgba(0,196,160,.08)", border:"1px solid rgba(0,196,160,.2)",
            borderRadius:10, padding:"14px 20px", marginBottom:18 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--teal)", marginBottom:4 }}>
              📲 OTP Sent Successfully!
            </div>
            <div style={{ fontSize:12.5, color:"var(--text3)" }}>
              Check your {useEmail
                ? <><b>{email}</b> — inbox + spam folder</>
                : <><b>{mobile}</b> — SMS</>}
            </div>
          </div>

          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
              color:"var(--text3)", marginBottom:8 }}>Enter OTP from IP India *</div>
            <input
              style={{ ...inp, width:220, textAlign:"center",
                fontFamily:"var(--mono)", fontSize:28, fontWeight:700,
                letterSpacing:"0.4em", borderColor:"var(--teal)" }}
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g,""))}
              placeholder="000000"
              maxLength={8}
              autoFocus
              onKeyDown={e => e.key === "Enter" && verifyOtp()}
            />
          </div>

          <div style={{ display:"flex", gap:10 }}>
            <button onClick={verifyOtp} disabled={loading || !otp}
              className="topbar-btn btn-primary" style={{ fontSize:14, padding:"11px 24px" }}>
              {loading ? "⏳ Verifying…" : "✅ Verify & Save Session"}
            </button>
            <button onClick={() => { setPhase("idle"); setOtp(""); setMsg(""); setCaptchaInfo(null) }}
              className="topbar-btn btn-ghost">
              ← Retry / Resend
            </button>
          </div>
        </div>
      )}

      {/* Status message */}
      {msg && (
        <div style={{ marginTop:16, padding:"11px 16px", borderRadius:8, fontSize:13,
          background: msg.startsWith("✅") ? "rgba(0,196,160,.08)" : "rgba(244,63,94,.08)",
          border: `1px solid ${msg.startsWith("✅") ? "rgba(0,196,160,.25)" : "rgba(244,63,94,.25)"}`,
          color: msg.startsWith("✅") ? "var(--teal)" : "var(--rose)" }}>
          {msg}
        </div>
      )}
    </div>
  )
}
