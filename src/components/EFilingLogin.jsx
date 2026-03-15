import React, { useState, useEffect, useRef } from "react"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const post = (path, body) => fetch(API+path,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}).then(r=>r.json())
const get  = (path) => fetch(API+path).then(r=>r.json())

export default function EFilingLogin({ context, onComplete }) {
  const tmaCode = context?.tmaData?.tmaCode || context?.tmaData?.username || ""

  const [phase,          setPhase]          = useState("check")
  const [username,       setUsername]        = useState(tmaCode)
  const [password,       setPassword]        = useState("")
  const [showPass,       setShowPass]        = useState(false)
  const [captchaImg,     setCaptchaImg]      = useState("")
  const [captchaText,    setCaptchaText]     = useState("")
  const [sessionCookies, setSessionCookies]  = useState({})
  const [hiddenFields,   setHiddenFields]    = useState({})
  const [msg,            setMsg]             = useState("")
  const [progress,       setProgress]        = useState(0)
  const [logLines,       setLogLines]        = useState([])
  const [result,         setResult]          = useState(null)
  const pollRef = useRef(null)
  const logRef  = useRef(null)

  useEffect(() => { checkStatus() }, [])
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight }, [logLines])
  useEffect(() => () => clearInterval(pollRef.current), [])

  const checkStatus = async () => {
    try {
      const r = await get("/efiling-session/status")
      if (r.connected) { setPhase("done"); setMsg(`✅ Logged in as ${r.username}`) }
      else setPhase("idle")
    } catch(_e) { setPhase("idle") }
  }

  const addLog = (m) => setLogLines(l => [...l, {ts: new Date().toLocaleTimeString(), msg: m}])

  const loadCaptcha = async () => {
    setCaptchaImg(""); setCaptchaText(""); setMsg("Loading captcha…")
    try {
      const r = await get("/efiling-session/captcha")
      if (r.success) {
        setCaptchaImg(r.captcha_image)
        setSessionCookies(r.session_cookies || {})
        setHiddenFields(r.hidden_fields || {})
        setMsg("")
      } else {
        setMsg("❌ " + (r.error || "Could not load captcha"))
      }
    } catch(e) { setMsg("❌ " + e.message) }
  }

  const startLogin = async () => {
    if (!username || !password || !captchaText) {
      setMsg("❌ Fill username, password and captcha"); return
    }
    setPhase("logging_in"); setMsg(""); setLogLines([]); setProgress(0)
    addLog("🔐 Submitting login to IP India eFiling…")
    try {
      const r = await post("/efiling-session/login-manual", {
        username, password, captcha_text: captchaText.toUpperCase(),
        session_cookies: sessionCookies, hidden_fields: hiddenFields,
      })
      if (!r.job_id) { setMsg("❌ " + (r.error||"Failed")); setPhase("idle"); return }

      pollRef.current = setInterval(async () => {
        try {
          const s = await get(`/efiling-session/status/${r.job_id}`)
          if (s.progress) setProgress(s.progress)
          if (s.message)  addLog(s.message)
          if (s.status === "done") {
            clearInterval(pollRef.current)
            setPhase("done"); setResult(s.result)
            setMsg(`✅ Logged in! ${s.result?.applications?.length||0} applications fetched`)
            if (onComplete) onComplete(s.result)
          } else if (s.status === "error") {
            clearInterval(pollRef.current)
            setPhase("captcha"); setMsg("❌ " + (s.error||"Login failed"))
            addLog("❌ " + (s.error||""))
            // Refresh captcha on failure
            loadCaptcha()
          }
        } catch(_e) {}
      }, 2500)
    } catch(e) { setMsg("❌ " + e.message); setPhase("idle") }
  }

  const card = {background:"var(--s1)",border:"1px solid var(--border)",borderRadius:14,padding:"28px 28px"}
  const inp  = {background:"var(--bg)",border:"1px solid var(--border)",borderRadius:8,
    padding:"10px 14px",color:"var(--text)",fontFamily:"var(--head)",fontSize:14,
    outline:"none",width:"100%",boxSizing:"border-box"}

  const summary = result?.summary || {}

  // Done state
  if (phase === "done") return (
    <div style={card}>
      <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:16}}>
        <div style={{width:48,height:48,borderRadius:"50%",background:"rgba(0,196,160,.15)",
          display:"flex",alignItems:"center",justifyContent:"center",fontSize:24}}>✅</div>
        <div>
          <div style={{fontSize:16,fontWeight:800}}>eFiling Connected</div>
          <div style={{fontSize:12.5,color:"var(--teal)",marginTop:3}}>
            Portfolio fetched — no re-login needed
          </div>
        </div>
      </div>
      {summary.total > 0 && (
        <div style={{display:"flex",gap:18,flexWrap:"wrap",marginBottom:18}}>
          {[["Total",summary.total,"var(--text)"],["Registered",summary.registered,"var(--teal)"],
            ["Objected",summary.objected,"var(--rose)"],["Pending",summary.pending,"#f0c842"],
            ["Hearings",summary.hearings_upcoming,"#38bdf8"]].map(([l,v,c]) => (
            <div key={l} style={{textAlign:"center"}}>
              <div style={{fontFamily:"var(--mono)",fontSize:22,fontWeight:700,color:c}}>{v||0}</div>
              <div style={{fontSize:10.5,color:"var(--text3)",textTransform:"uppercase",letterSpacing:".08em"}}>{l}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{display:"flex",gap:10}}>
        <button onClick={async()=>{
          await post("/efiling-session/logout",{})
          setPhase("idle"); setMsg(""); setResult(null); setPassword("")
          setCaptchaImg(""); setCaptchaText("")
        }} style={{background:"none",border:"1px solid var(--border)",borderRadius:8,
          padding:"8px 16px",color:"var(--text3)",cursor:"pointer",fontSize:12,fontFamily:"var(--head)"}}>
          🔌 Logout
        </button>
      </div>
    </div>
  )

  return (
    <div style={card}>
      <div style={{fontSize:16,fontWeight:800,marginBottom:6}}>🏛 IP India eFiling Login</div>
      <div style={{fontSize:12.5,color:"var(--text3)",lineHeight:1.7,marginBottom:20}}>
        Login with your IP India eFiling credentials to fetch your
        <b style={{color:"var(--text)"}}> complete filing history</b> — every application with full status.
      </div>

      {/* Credentials */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:16}}>
        <div>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:".1em",color:"var(--text3)",marginBottom:6}}>
            eFiling Username *
          </div>
          <input style={inp} value={username} onChange={e=>setUsername(e.target.value)}
            placeholder="e.g. 25092"
            onFocus={e=>e.target.style.borderColor="var(--accent)"}
            onBlur={e=>e.target.style.borderColor="var(--border)"} />
        </div>
        <div>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:".1em",color:"var(--text3)",marginBottom:6}}>
            Password *
          </div>
          <div style={{position:"relative"}}>
            <input style={{...inp,paddingRight:40}}
              type={showPass?"text":"password"} value={password}
              onChange={e=>setPassword(e.target.value)}
              placeholder="Your IP India password"
              onFocus={e=>e.target.style.borderColor="var(--accent)"}
              onBlur={e=>e.target.style.borderColor="var(--border)"} />
            <button onClick={()=>setShowPass(!showPass)}
              style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",
                background:"none",border:"none",cursor:"pointer",color:"var(--text3)",fontSize:16}}>
              {showPass?"🙈":"👁"}
            </button>
          </div>
        </div>
      </div>

      {/* Captcha section */}
      {(phase === "idle" || phase === "captcha") && (
        <div style={{marginBottom:16}}>
          <div style={{fontSize:11,textTransform:"uppercase",letterSpacing:".1em",
            color:"var(--text3)",marginBottom:8}}>
            Captcha *
            <span style={{marginLeft:8,fontSize:10,textTransform:"none",letterSpacing:"normal",
              color:"var(--text3)"}}>
              — click "Load" to get image from IP India
            </span>
          </div>
          <div style={{display:"flex",gap:12,alignItems:"center",flexWrap:"wrap"}}>
            {/* Captcha image */}
            {captchaImg ? (
              <div style={{background:"#fff",borderRadius:8,padding:6,border:"2px solid var(--accent)"}}>
                <img src={captchaImg} alt="captcha"
                  style={{height:44,display:"block",imageRendering:"pixelated"}} />
              </div>
            ) : (
              <div style={{width:120,height:44,background:"var(--s2)",border:"1px dashed var(--border)",
                borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",
                fontSize:11,color:"var(--text3)"}}>
                No captcha loaded
              </div>
            )}

            {/* Refresh button */}
            <button onClick={loadCaptcha}
              style={{padding:"8px 14px",borderRadius:8,border:"1px solid var(--border)",
                background:"none",color:"var(--text3)",cursor:"pointer",
                fontSize:12,fontFamily:"var(--head)"}}>
              🔄 {captchaImg ? "Refresh" : "Load Captcha"}
            </button>

            {/* Captcha answer input */}
            {captchaImg && (
              <input
                style={{...inp,width:130,textAlign:"center",fontFamily:"var(--mono)",
                  fontSize:18,fontWeight:700,letterSpacing:"0.2em",
                  borderColor:captchaText?"var(--teal)":"var(--border)"}}
                value={captchaText}
                onChange={e=>setCaptchaText(e.target.value.toUpperCase())}
                placeholder="A3K9P"
                maxLength={8}
                autoFocus
                onKeyDown={e=>e.key==="Enter"&&startLogin()}
              />
            )}
          </div>
          {captchaImg && (
            <div style={{fontSize:11,color:"var(--text3)",marginTop:6}}>
              Type exactly what you see in the image (letters + numbers, not case-sensitive)
            </div>
          )}
        </div>
      )}

      {/* Security note */}
      <div style={{background:"rgba(240,200,66,.07)",border:"1px solid rgba(240,200,66,.15)",
        borderRadius:8,padding:"10px 14px",marginBottom:16,fontSize:12,color:"#f0c842"}}>
        🔒 Password is sent directly to IP India's server. MarkShield only saves the session cookie.
      </div>

      {/* Login button */}
      {(phase === "idle" || phase === "captcha") && (
        <button onClick={startLogin}
          disabled={!username||!password||!captchaText}
          className="topbar-btn btn-primary"
          style={{fontSize:14,padding:"12px 28px"}}>
          🚀 Login &amp; Fetch All Applications
        </button>
      )}

      {/* Progress */}
      {phase === "logging_in" && (
        <div>
          <div style={{display:"flex",alignItems:"center",gap:14,marginBottom:12}}>
            <div style={{width:36,height:36,border:"3px solid rgba(201,146,10,.3)",
              borderTopColor:"var(--accent)",borderRadius:"50%",
              animation:"spin .8s linear infinite",flexShrink:0}} />
            <div>
              <div style={{fontSize:13,fontWeight:700}}>Connecting to IP India…</div>
            </div>
            <div style={{marginLeft:"auto",fontFamily:"var(--mono)",fontSize:22,
              fontWeight:700,color:"#f0c842"}}>{progress}%</div>
          </div>
          <div style={{background:"var(--border)",borderRadius:4,height:6,overflow:"hidden",marginBottom:12}}>
            <div style={{height:"100%",background:"linear-gradient(90deg,#c9920a,#f0c842)",
              borderRadius:4,width:progress+"%",transition:"width .6s"}} />
          </div>
          <div ref={logRef} style={{background:"#010508",border:"1px solid #1a2545",
            borderRadius:8,padding:"10px 14px",height:120,overflowY:"auto",
            fontFamily:"var(--mono)",fontSize:11.5,lineHeight:2}}>
            {logLines.map((l,i)=>(
              <div key={i}>
                <span style={{color:"#1e2d50",marginRight:8}}>{l.ts}</span>
                <span style={{color:l.msg.startsWith("✅")?"#00c4a0":l.msg.startsWith("❌")?"#f43f5e":"#5b9ef8"}}>
                  {l.msg}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {msg && phase !== "logging_in" && (
        <div style={{marginTop:14,padding:"11px 16px",borderRadius:8,fontSize:13,
          background:msg.startsWith("✅")?"rgba(0,196,160,.08)":"rgba(244,63,94,.08)",
          border:`1px solid ${msg.startsWith("✅")?"rgba(0,196,160,.25)":"rgba(244,63,94,.25)"}`,
          color:msg.startsWith("✅")?"var(--teal)":"var(--rose)"}}>
          {msg}
        </div>
      )}
    </div>
  )
}
