import React, { useState, useEffect, useRef } from "react"
import { startPortfolioFetch, pollPortfolioJob } from "../services/api"

const STATUS_CHIP = {
  registered:        "chip-registered",
  accepted:          "chip-registered",
  advertised:        "chip-hearing",
  hearing_scheduled: "chip-hearing",
  objected:          "chip-objected",
  opposed:           "chip-opposed",
  under_examination: "chip-pending",
  formalities_check: "chip-pending",
  pending:           "chip-pending",
  refused:           "chip-refused",
  abandoned:         "chip-refused",
  withdrawn:         "chip-refused",
}

const STATUS_LABEL = {
  registered: "Registered", accepted: "Accepted", advertised: "Advertised",
  hearing_scheduled: "Hearing", objected: "Objected", opposed: "Opposed",
  under_examination: "Under Examination", formalities_check: "Formalities",
  pending: "Pending", refused: "Refused", abandoned: "Abandoned", withdrawn: "Withdrawn",
}

function StatBox({ label, value, color }) {
  return (
    <div style={{ background:"var(--s1)", border:"1px solid var(--border)", borderRadius:12,
      padding:"16px 18px", flex:1, minWidth:100 }}>
      <div style={{ fontSize:11, textTransform:"uppercase", letterSpacing:".1em",
        color:"var(--text3)", marginBottom:6 }}>{label}</div>
      <div style={{ fontFamily:"var(--mono)", fontSize:26, fontWeight:600, color: color||"var(--text)" }}>{value}</div>
    </div>
  )
}

export default function Portfolio({ context }) {
  const tmaCode   = context?.tmaData?.tmaCode || context?.tmaData?.username || ""
  const agentName = context?.agentProfile?.fullName || context?.tmaData?.name || ""

  const [phase,     setPhase]     = useState("idle")
  const [progress,  setProgress]  = useState(0)
  const [logMsg,    setLogMsg]    = useState("")
  const [portfolio, setPortfolio] = useState(null)
  const [filter,    setFilter]    = useState("all")
  const [search,    setSearch]    = useState("")
  const [sortBy,    setSortBy]    = useState("default")
  const pollRef = useRef(null)
  const jobRef  = useRef(null)

  useEffect(() => {
    if (tmaCode && phase === "idle" && !portfolio) startFetch()
  }, [tmaCode])

  useEffect(() => () => clearInterval(pollRef.current), [])

  const startFetch = async (force = false) => {
    if (!tmaCode) return
    setPhase("fetching"); setProgress(0); setLogMsg("Connecting…"); setPortfolio(null)
    try {
      const res = await startPortfolioFetch(tmaCode, agentName, force)
      if (res?.status === "cached" && res.result) {
        setPortfolio(res.result); setPhase("done"); return
      }
      if (!res?.job_id) throw new Error(res?.error || "Failed to start")
      jobRef.current  = res.job_id
      pollRef.current = setInterval(async () => {
        try {
          const r = await pollPortfolioJob(jobRef.current)
          if (r.progress) setProgress(r.progress)
          if (r.message)  setLogMsg(r.message)
          if (r.status === "done") {
            clearInterval(pollRef.current)
            setPortfolio(r.result); setPhase("done")
          } else if (r.status === "error") {
            clearInterval(pollRef.current)
            setLogMsg("❌ " + (r.error || "Failed")); setPhase("error")
          }
        } catch(_e) {}
      }, 3000)
    } catch (e) { setLogMsg("❌ " + e.message); setPhase("error") }
  }

  const apps    = portfolio?.applications || []
  const summary = portfolio?.summary || {}

  const filtered = apps.filter(a => {
    const mf = filter === "all" || a.status_class === filter ||
      (filter === "active" && ["registered","accepted","advertised","pending",
       "under_examination","objected","opposed","hearing_scheduled"].includes(a.status_class))
    const q  = search.toLowerCase()
    const ms = !q || a.app_no?.includes(q) || (a.trademark_name||"").toLowerCase().includes(q) ||
               (a.applicant||"").toLowerCase().includes(q)
    return mf && ms
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "status")  return (a.status_class||"").localeCompare(b.status_class||"")
    if (sortBy === "app_no")  return (a.app_no||"").localeCompare(b.app_no||"")
    if (sortBy === "tm_name") return (a.trademark_name||"").localeCompare(b.trademark_name||"")
    if (sortBy === "filing")  return (a.filing_date||"").localeCompare(b.filing_date||"")
    return 0
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:20, flexWrap:"wrap", gap:12 }}>
        <div>
          <div style={{ fontSize:17, fontWeight:800, letterSpacing:"-.3px" }}>Trademark Portfolio</div>
          <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>
            {tmaCode
              ? <>TMA: <b style={{ color:"#f0c842" }}>{tmaCode}</b> · {agentName}</>
              : <span style={{ color:"var(--rose)" }}>No TMA connected — complete setup first</span>}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={() => startFetch(false)} disabled={phase==="fetching"||!tmaCode}
            className="topbar-btn btn-ghost">
            📋 Load from DB
          </button>
          <button onClick={() => startFetch(true)} disabled={phase==="fetching"||!tmaCode}
            className="topbar-btn btn-primary">
            {phase==="fetching"
              ? <><div style={{ width:14,height:14,border:"2px solid rgba(255,255,255,.4)",borderTopColor:"#fff",borderRadius:"50%",animation:"spin .7s linear infinite" }} /> Fetching…</>
              : "🔄 Sync from IP India"}
          </button>
        </div>
      </div>

      {/* No TMA */}
      {!tmaCode && (
        <div style={{ background:"rgba(244,63,94,.07)", border:"1px solid rgba(244,63,94,.2)",
          borderRadius:12, padding:"28px 24px", textAlign:"center" }}>
          <div style={{ fontSize:32, marginBottom:12 }}>🔒</div>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:6 }}>TMA Code Not Connected</div>
          <div style={{ fontSize:13, color:"var(--text3)", lineHeight:1.7 }}>
            Go to your profile (click your name in sidebar) → Settings → eFiling → Re-run Setup
          </div>
        </div>
      )}

      {/* Fetching progress */}
      {phase === "fetching" && (
        <div style={{ background:"var(--s1)", border:"1px solid var(--border)", borderRadius:14,
          padding:"24px 28px", marginBottom:20 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
            <div style={{ width:36,height:36,border:"3px solid rgba(201,146,10,.3)",borderTopColor:"#c9920a",
              borderRadius:"50%",animation:"spin .8s linear infinite",flexShrink:0 }} />
            <div>
              <div style={{ fontSize:14, fontWeight:700 }}>Syncing from IP India…</div>
              <div style={{ fontSize:12, color:"var(--text3)", marginTop:2 }}>
                TLA Queue + Cause List + eRegister
              </div>
            </div>
            <div style={{ marginLeft:"auto", fontFamily:"var(--mono)", fontSize:22,
              fontWeight:600, color:"#f0c842" }}>{progress}%</div>
          </div>
          <div style={{ background:"var(--border)", borderRadius:4, height:6, overflow:"hidden", marginBottom:12 }}>
            <div style={{ height:"100%", background:"linear-gradient(90deg,#c9920a,#f0c842)",
              borderRadius:4, width:progress+"%", transition:"width .6s ease" }} />
          </div>
          <div style={{ fontFamily:"var(--mono)", fontSize:11.5, color:"#5b9ef8" }}>{logMsg}</div>
          <div style={{ fontSize:11, color:"var(--text3)", marginTop:10 }}>
            ℹ First sync takes 2–5 minutes. Subsequent loads are instant from local database.
          </div>
        </div>
      )}

      {/* Error */}
      {phase === "error" && (
        <div style={{ background:"rgba(244,63,94,.07)", border:"1px solid rgba(244,63,94,.2)",
          borderRadius:12, padding:"20px 24px", marginBottom:20 }}>
          <div style={{ fontWeight:700, color:"var(--rose)", marginBottom:6 }}>
            ❌ Sync failed
          </div>
          <div style={{ fontSize:12, color:"var(--text3)", marginBottom:14 }}>{logMsg}</div>
          <div style={{ fontSize:12, color:"var(--text3)", marginBottom:14 }}>
            💡 Try using the <b style={{ color:"#f0c842" }}>📥 Bulk Import</b> page in the sidebar
            to import your applications manually.
          </div>
          <button onClick={() => startFetch(true)} className="topbar-btn btn-primary">🔄 Retry</button>
        </div>
      )}

      {/* Summary */}
      {portfolio && (
        <>
          <div style={{ display:"flex", gap:12, flexWrap:"wrap", marginBottom:20 }}>
            <StatBox label="Total"      value={summary.total||0} />
            <StatBox label="Registered" value={summary.registered||0}  color="var(--teal)" />
            <StatBox label="Accepted"   value={summary.accepted||0}    color="#00c4a0" />
            <StatBox label="Objected"   value={summary.objected||0}    color="var(--rose)" />
            <StatBox label="Opposed"    value={summary.opposed||0}     color="var(--violet)" />
            <StatBox label="Pending"    value={summary.pending||0}     color="#f0c842" />
            <StatBox label="Hearings"   value={summary.hearings_upcoming||0} color="var(--sky)" />
          </div>

          {portfolio.from_cache && (
            <div style={{ background:"rgba(0,196,160,.07)", border:"1px solid rgba(0,196,160,.15)",
              borderRadius:9, padding:"9px 16px", marginBottom:14, fontSize:12,
              color:"var(--teal)", display:"flex", gap:8, alignItems:"center" }}>
              ✅ Loaded from local database instantly · Click 🔄 Sync to refresh from IP India
            </div>
          )}

          {/* Filters */}
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:16, alignItems:"center" }}>
            <input type="text" placeholder="🔍 Search trademark, app no, applicant…"
              value={search} onChange={e => setSearch(e.target.value)}
              className="filter-input"
              onFocus={e => e.target.style.borderColor="var(--accent)"}
              onBlur={e => e.target.style.borderColor="var(--border)"} />
            <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="registered">Registered</option>
              <option value="objected">Objected</option>
              <option value="opposed">Opposed</option>
              <option value="pending">Pending</option>
              <option value="refused">Refused</option>
              <option value="hearing_scheduled">Hearing Scheduled</option>
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="filter-select">
              <option value="default">Sort: Hearings First</option>
              <option value="status">Sort: Status</option>
              <option value="app_no">Sort: App No.</option>
              <option value="tm_name">Sort: TM Name</option>
              <option value="filing">Sort: Filing Date</option>
            </select>
            <span style={{ fontSize:12, color:"var(--text3)", whiteSpace:"nowrap" }}>
              {sorted.length} of {apps.length} shown
            </span>
          </div>

          {/* Table */}
          <div className="card">
            <div className="card-head">
              <h3>📋 All Trademark Applications — {tmaCode}</h3>
              <span style={{ fontSize:11, color:"var(--text3)" }}>
                {portfolio.sources?.join(" · ")}
              </span>
            </div>
            <div className="card-body">
              {sorted.length === 0 ? (
                <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>
                  No applications found.
                  {apps.length === 0 && (
                    <div style={{ marginTop:12, fontSize:12 }}>
                      Use <b style={{ color:"#f0c842" }}>📥 Bulk Import</b> in the sidebar to import your trademark data.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>App No.</th><th>Trademark</th><th>Class</th>
                        <th>Applicant</th><th>Status</th><th>Filing Date</th>
                        <th>Hearing</th><th>Action</th><th>Link</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sorted.map(a => (
                        <tr key={a.app_no}
                          style={a.hearing_date && a.hearing_date !== "—"
                            ? { borderLeft:"2px solid var(--accent)" } : {}}>
                          <td className="mono" style={{ fontWeight:600 }}>{a.app_no}</td>
                          <td style={{ fontWeight:600, maxWidth:160, overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                            title={a.trademark_name}>{a.trademark_name || "—"}</td>
                          <td style={{ fontSize:12, color:"var(--text3)" }}>{a.tm_class || "—"}</td>
                          <td style={{ fontSize:12, maxWidth:140, overflow:"hidden",
                            textOverflow:"ellipsis", whiteSpace:"nowrap" }}
                            title={a.applicant}>{a.applicant || "—"}</td>
                          <td>
                            <span className={`chip ${STATUS_CHIP[a.status_class]||"chip-pending"}`}>
                              {STATUS_LABEL[a.status_class] || a.status || "Pending"}
                            </span>
                          </td>
                          <td className="mono" style={{ fontSize:12 }}>{a.filing_date || "—"}</td>
                          <td className="mono" style={{ fontSize:12,
                            color: a.hearing_date && a.hearing_date!=="—" ? "#f0c842":"var(--text3)",
                            fontWeight: a.hearing_date && a.hearing_date!=="—" ? 700 : 400 }}>
                            {a.hearing_date || "—"}
                          </td>
                          <td style={{ fontSize:11, color:"var(--text2)" }}>
                            {a.action_type && a.action_type!=="—" ? a.action_type
                             : a.reply_status && a.reply_status!=="—" ? a.reply_status : "—"}
                          </td>
                          <td>
                            <a href={a.view_url} target="_blank" rel="noreferrer"
                              style={{ color:"#f0c842", fontSize:12, textDecoration:"none" }}>
                              View ↗
                            </a>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
