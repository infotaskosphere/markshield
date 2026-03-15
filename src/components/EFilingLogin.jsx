import React, { useState, useEffect, useRef } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const post = (path, body) => fetch(API+path, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json())
const get  = (path) => fetch(API+path).then(r=>r.json())

export default function EFilingLogin({ context, onComplete }) {
  const tmaCode = context?.tmaData?.tmaCode || context?.tmaData?.username || ""

  const [phase,     setPhase]     = useState("check")  // check|idle|logging_in|done|error
  const [username,  setUsername]  = useState(tmaCode)
  const [password,  setPassword]  = useState("")
  const [showPass,  setShowPass]  = useState(false)
  const [msg,       setMsg]       = useState("")
  const [progress,  setProgress]  = useState(0)
  const [logLines,  setLogLines]  = useState([])
  const [result,    setResult]    = useState(null)
  const pollRef = useRef(null)
  const logRef  = useRef(null)

  useEffect(() => { checkStatus() }, [])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logLines])
  useEffect(() => () => clearInterval(pollRef.current), [])

  const checkStatus = async () => {
    try {
      const r = await get("/efiling-session/status")
      setPhase(r.connected ? "done" : "idle")
      if (r.connected) setMsg(`✅ Logged in as ${r.username}`)
    } catch(_e) { setPhase("idle") }
  }

  const addLog = (msg) => setLogLines(l => [...l, { ts: new Date().toLocaleTimeString(), msg }])

  const startLogin = async () => {
    if (!username || !password) { setMsg("❌ Enter username and password"); return }
    setPhase("logging_in"); setMsg(""); setLogLines([]); setProgress(0)
    addLog("🔐 Connecting to IP India eFiling portal…")

    try {
      const r = await post("/efiling-session/login", { username, password })
      if (!r.job_id) { setMsg("❌ " + (r.error || "Failed")); setPhase("idle"); return }

      addLog("🤖 Automatically solving image captcha…")

      pollRef.current = setInterval(async () => {
        try {
          const s = await get(`/efiling-session/status/${r.job_id}`)
          if (s.progress) setProgress(s.progress)
          if (s.message)  addLog(s.message)
          if (s.status === "done") {
            clearInterval(pollRef.current)
            setPhase("done"); setResult(s.result)
            setMsg(`✅ Logged in! ${s.result?.applications?.length || 0} applications found`)
            if (onComplete) onComplete(s.result)
          } else if (s.status === "error") {
            clearInterval(pollRef.current)
            setPhase("error"); setMsg("❌ " + (s.error || "Login failed"))
            addLog("❌ " + (s.error || "Login failed"))
          }
        } catch(_e) {}
      }, 2500)
    } catch(e) { setMsg("❌ " + e.message); setPhase("idle") }
  }

  const logout = async () => {
    await post("/efiling-session/logout", {})
    setPhase("idle"); setMsg(""); setResult(null); setPassword("")
  }

  const card = { background:"var(--s1)", border:"1px solid var(--border)", borderRadius:14, padding:"28px 28px" }
  const inp  = { background:"var(--bg)", border:"1px solid var(--border)", borderRadius:8,
    padding:"10px 14px", color:"var(--text)", fontFamily:"var(--head)", fontSize:14,
    outline:"none", width:"100%", boxSizing:"border-box" }

  const summary = result?.summary || {}

  return (
    <div style={card}>
      <div style={{ fontSize:16, fontWeight:800, marginBottom:6 }}>
        🏛 IP India eFiling Login
      </div>
      <div style={{ fontSize:12.5, color:"var(--text3)", lineHeight:1.7, marginBottom:20 }}>
        Login once with your eFiling credentials.
        MarkShield will <b style={{ color:"var(--text)" }}>automatically solve the CAPTCHA</b> and
        fetch your <b style={{ color:"#f0c842" }}>complete filing history</b> — every application
        you've ever filed, with full eRegister status for each one.
      </div>

      {/* What you get */}
      <div style={{ background:"var(--s2)", borderRadius:10, padding:"14px 18px",
        marginBottom:20, border:"1px solid var(--border)" }}>
        <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color:"var(--text2)" }}>
          After login you get:
        </div>
        {[
          ["📋","ALL applications from your eFiling account (complete list)"],
          ["🔍","Full eRegister details — status, applicant, goods & services, certificate"],
          ["⚡","Instant portfolio loads from local database (no re-login needed)"],
          ["🔄","One-click re-sync to refresh all statuses from IP India"],
        ].map(([icon, text]) => (
          <div key={icon} style={{ display:"flex", gap:10, marginBottom:6 }}>
            <span style={{ fontSize:15, flexShrink:0 }}>{icon}</span>
            <span style={{ fontSize:12.5, color:"var(--text3)" }}>{text}</span>
          </div>
        ))}
      </div>

      {/* Connected state */}
      {phase === "done" && (
        <div>
          <div style={{ background:"rgba(0,196,160,.08)", border:"1px solid rgba(0,196,160,.2)",
            borderRadius:10, padding:"16px 20px", marginBottom:16 }}>
            <div style={{ fontSize:14, fontWeight:700, color:"var(--teal)", marginBottom:8 }}>
              ✅ eFiling Session Active
            </div>
            {summary.total > 0 && (
              <div style={{ display:"flex", gap:18, flexWrap:"wrap" }}>
                {[["Total",summary.total,"var(--text)"],["Registered",summary.registered,"var(--teal)"],
                  ["Objected",summary.objected,"var(--rose)"],["Pending",summary.pending,"#f0c842)"],
                  ["Hearings",summary.hearings_upcoming,"#38bdf8"]].map(([l,v,c]) => (
                  <div key={l} style={{ textAlign:"center" }}>
                    <div style={{ fontFamily:"var(--mono)", fontSize:22, fontWeight:700, color:c }}>{v||0}</div>
                    <div style={{ fontSize:10.5, color:"var(--text3)", textTransform:"uppercase",
                      letterSpacing:".08em" }}>{l}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            <button onClick={async () => {
              setPhase("logging_in"); setLogLines([]); setProgress(0)
              addLog("🔄 Re-syncing from eFiling portal…")
              const r = await post("/efiling-session/sync", { username })
              if (r.job_id) {
                pollRef.current = setInterval(async () => {
                  const s = await get(`/efiling-session/status/${r.job_id}`)
                  if (s.progress) setProgress(s.progress)
                  if (s.message) addLog(s.message)
                  if (s.status === "done") {
                    clearInterval(pollRef.current)
                    setPhase("done"); setResult(s.result)
                    setMsg("✅ Re-synced successfully")
                  } else if (s.status === "error") {
                    clearInterval(pollRef.current)
                    setPhase("done"); setMsg("❌ " + s.error)
                  }
                }, 2500)
              }
            }} className="topbar-btn btn-ghost">🔄 Re-sync Portfolio</button>
            <button onClick={logout} style={{ background:"none", border:"1px solid var(--border)",
              borderRadius:8, padding:"8px 16px", color:"var(--text3)", cursor:"pointer",
              fontSize:12, fontFamily:"var(--head)" }}>
              🔌 Logout
            </button>
          </div>
        </div>
      )}

      {/* Login form */}
      {(phase === "idle" || phase === "error") && (
        <div>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
                color:"var(--text3)", marginBottom:6 }}>eFiling Username / TMA Code *</div>
              <input style={inp} value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="e.g. manthan15"
                onFocus={e => e.target.style.borderColor="var(--accent)"}
                onBlur={e  => e.target.style.borderColor="var(--border)"} />
            </div>
            <div>
              <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
                color:"var(--text3)", marginBottom:6 }}>eFiling Password *</div>
              <div style={{ position:"relative" }}>
                <input style={{ ...inp, paddingRight:40 }}
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Your IP India password"
                  onKeyDown={e => e.key === "Enter" && startLogin()}
                  onFocus={e => e.target.style.borderColor="var(--accent)"}
                  onBlur={e  => e.target.style.borderColor="var(--border)"} />
                <button onClick={() => setShowPass(!showPass)}
                  style={{ position:"absolute", right:10, top:"50%", transform:"translateY(-50%)",
                    background:"none", border:"none", cursor:"pointer", color:"var(--text3)",
                    fontSize:16 }}>
                  {showPass ? "🙈" : "👁"}
                </button>
              </div>
            </div>
          </div>

          <div style={{ background:"rgba(240,200,66,.07)", border:"1px solid rgba(240,200,66,.15)",
            borderRadius:8, padding:"10px 14px", marginBottom:14, fontSize:12, color:"#f0c842" }}>
            🔒 Your password is sent directly to IP India's server and is never stored by MarkShield.
            Only the session cookie is saved (same as how your browser remembers you).
          </div>

          <button onClick={startLogin} disabled={!username || !password}
            className="topbar-btn btn-primary" style={{ fontSize:14, padding:"12px 28px" }}>
            🚀 Login &amp; Fetch All Applications
          </button>
        </div>
      )}

      {/* Progress */}
      {phase === "logging_in" && (
        <div>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:14 }}>
            <div style={{ width:36, height:36, border:"3px solid rgba(201,146,10,.3)",
              borderTopColor:"var(--accent)", borderRadius:"50%",
              animation:"spin .8s linear infinite", flexShrink:0 }} />
            <div>
              <div style={{ fontSize:13, fontWeight:700 }}>Connecting to IP India…</div>
              <div style={{ fontSize:11.5, color:"var(--text3)" }}>
                Auto-solving captcha → logging in → fetching applications
              </div>
            </div>
            <div style={{ marginLeft:"auto", fontFamily:"var(--mono)", fontSize:22,
              fontWeight:700, color:"#f0c842" }}>{progress}%</div>
          </div>
          <div style={{ background:"var(--border)", borderRadius:4, height:6,
            overflow:"hidden", marginBottom:12 }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#c9920a,#f0c842)",
              borderRadius:4, width:progress+"%", transition:"width .6s" }} />
          </div>
          <div ref={logRef} style={{ background:"#010508", border:"1px solid #1a2545",
            borderRadius:8, padding:"10px 14px", height:140, overflowY:"auto",
            fontFamily:"var(--mono)", fontSize:11.5, lineHeight:2 }}>
            {logLines.map((l,i) => (
              <div key={i}>
                <span style={{ color:"#1e2d50", marginRight:8 }}>{l.ts}</span>
                <span style={{ color: l.msg.startsWith("✅")?"#00c4a0":l.msg.startsWith("❌")?"#f43f5e":"#5b9ef8" }}>
                  {l.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && phase !== "logging_in" && (
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
