import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import StatCard from "../components/StatCard"
import { fetchQueueList, fetchCauseList } from "../services/api"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

export default function Dashboard({ context }) {
  const navigate  = useNavigate()
  const name      = (context?.agentProfile?.fullName || context?.currentUser?.name || "").split(" ")[0]
  const tmaCode   = context?.tmaData?.tmaCode || context?.tmaData?.username || ""
  const agentName = context?.agentProfile?.fullName || ""

  const [stats,     setStats]     = useState({ total:0, hearings:0, alerts:0, registered:0, objected:0, pending:0 })
  const [hearings,  setHearings]  = useState([])
  const [queue,     setQueue]     = useState([])
  const [dbStats,   setDbStats]   = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [estatusOk, setEstatusOk] = useState(null)

  useEffect(() => { loadAll() }, [tmaCode])

  const loadAll = async () => {
    setLoading(true)
    await Promise.allSettled([
      loadDbStats(),
      loadQueue(),
      loadHearings(),
      checkEstatus(),
    ])
    setLoading(false)
  }

  const loadDbStats = async () => {
    try {
      const r = await fetch(API + "/db-stats").then(r => r.json())
      if (r.total_trademarks !== undefined) {
        setDbStats(r)
        setStats(s => ({
          ...s,
          total:      r.total_trademarks || 0,
          registered: r.by_status?.registered || 0,
          objected:   r.by_status?.objected   || 0,
          pending:    r.by_status?.pending     || 0,
        }))
      }
    } catch(_e) {}
  }

  const loadQueue = async () => {
    if (!tmaCode) return
    try {
      const r = await fetchQueueList({ username: tmaCode })
      const items = r.items || []
      setQueue(items.slice(0, 5))
      setStats(s => ({
        ...s,
        alerts: items.filter(i => ["overdue","critical"].includes(i.urgency)).length,
      }))
    } catch(_e) {}
  }

  const loadHearings = async () => {
    if (!agentName) return
    try {
      const today = new Date()
      const dd = String(today.getDate()).padStart(2,"0")
      const mm = String(today.getMonth()+1).padStart(2,"0")
      const yyyy = today.getFullYear()
      const r = await fetchCauseList({ date: `${dd}/${mm}/${yyyy}`, agent: agentName })
      const h = r.hearings || []
      setHearings(h.slice(0, 5))
      setStats(s => ({ ...s, hearings: r.total || h.length }))
    } catch(_e) {}
  }

  const checkEstatus = async () => {
    try {
      const r = await fetch(API + "/estatus/status").then(r => r.json())
      setEstatusOk(r.connected)
    } catch(_e) {}
  }

  const urgencyColor = u => u==="overdue"?"var(--rose)":u==="critical"?"#f0c842":u==="warning"?"#f59e0b":"var(--teal)"
  const isEmpty = stats.total === 0

  return (
    <>
      {/* Welcome bar */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
        marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <div style={{ fontSize:19, fontWeight:800, letterSpacing:"-.3px" }}>
            {name ? `Welcome back, ${name} 👋` : "Dashboard"}
          </div>
          <div style={{ fontSize:12.5, color:"var(--text3)", marginTop:2 }}>
            {tmaCode
              ? <>TMA: <b style={{ color:"#f0c842" }}>{tmaCode}</b> · {new Date().toLocaleDateString("en-IN",{weekday:"long",day:"numeric",month:"long"})}</>
              : "Overview of your trademark portfolio"}
          </div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          {estatusOk === false && (
            <button onClick={() => navigate("/settings")}
              className="topbar-btn btn-ghost"
              style={{ borderColor:"rgba(244,63,94,.4)", color:"var(--rose)", fontSize:12 }}>
              🔐 Connect eStatus
            </button>
          )}
          <button onClick={() => navigate("/import")} className="topbar-btn btn-primary">
            📥 Import Data
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-grid" style={{ marginBottom:20 }}>
        <StatCard accent="linear-gradient(90deg,#c9920a,#f0c842)"
          iconBg="rgba(201,146,10,.12)" iconColor="#f0c842"
          icon="◈" label="Total Trademarks" value={stats.total}
          delta=" in database" />
        <StatCard accent="linear-gradient(90deg,#00c4a0,#38bdf8)"
          iconBg="rgba(0,196,160,.1)" iconColor="var(--teal)"
          icon="✦" label="Registered" value={stats.registered}
          delta=" successfully registered" />
        <StatCard accent="linear-gradient(90deg,#f59e0b,#f43f5e)"
          iconBg="rgba(245,158,11,.12)" iconColor="#f59e0b"
          icon="⏣" label="Upcoming Hearings" value={stats.hearings}
          delta=" today" />
        <StatCard accent="linear-gradient(90deg,#f43f5e,#8b5cf6)"
          iconBg="rgba(244,63,94,.12)" iconColor="var(--rose)"
          icon="⊛" label="Active Alerts" value={stats.alerts}
          delta=" requiring action" />
      </div>

      {/* eStatus banner */}
      {estatusOk === false && (
        <div style={{ background:"rgba(244,63,94,.07)", border:"1px solid rgba(244,63,94,.2)",
          borderRadius:12, padding:"14px 20px", marginBottom:18,
          display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:10 }}>
          <div>
            <b style={{ color:"var(--rose)" }}>🔐 eStatus not connected</b>
            <span style={{ fontSize:12.5, color:"var(--text3)", marginLeft:10 }}>
              Connect once with OTP to enable full trademark data fetching from IP India
            </span>
          </div>
          <button onClick={() => navigate("/settings")} className="topbar-btn btn-primary"
            style={{ fontSize:12 }}>
            Connect Now →
          </button>
        </div>
      )}
      {estatusOk === true && (
        <div style={{ background:"rgba(0,196,160,.07)", border:"1px solid rgba(0,196,160,.15)",
          borderRadius:12, padding:"10px 18px", marginBottom:18,
          display:"flex", alignItems:"center", gap:10, fontSize:12.5 }}>
          <span style={{ color:"var(--teal)" }}>✅ eStatus connected</span>
          <span style={{ color:"var(--text3)" }}>— Full data fetching active. Application lookups return complete details.</span>
        </div>
      )}

      {isEmpty ? (
        // Empty state
        <div className="card">
          <div className="empty-state" style={{ padding:"60px 40px" }}>
            <div className="empty-icon">⚖️</div>
            <div className="empty-title">Your dashboard is ready</div>
            <div className="empty-sub" style={{ maxWidth:420 }}>
              Use <b>Bulk Import</b> to pull your trademark portfolio from IP India,
              or run the <b>Data Scraper</b> to fetch live cause list and queue data.
            </div>
            <div style={{ display:"flex", gap:10, marginTop:12, flexWrap:"wrap", justifyContent:"center" }}>
              <button className="topbar-btn btn-primary" onClick={() => navigate("/import")}>
                📥 Bulk Import
              </button>
              <button className="topbar-btn btn-ghost" onClick={() => navigate("/scraper")}>
                🔄 Data Scraper
              </button>
            </div>
          </div>
        </div>
      ) : (
        // Data loaded
        <div style={{ display:"grid", gridTemplateColumns:"1.6fr 1fr", gap:16, marginBottom:16 }}>
          {/* Hearings */}
          <div className="card">
            <div className="card-head">
              <h3>🏛 Today's Hearings</h3>
              <span className="sec-link" onClick={() => navigate("/calendar")}>View all →</span>
            </div>
            <div className="card-body">
              {hearings.length === 0 ? (
                <div style={{ padding:"28px 0", textAlign:"center", color:"var(--text3)", fontSize:13 }}>
                  No hearings today for {agentName || "your account"}
                </div>
              ) : (
                <table className="tbl">
                  <thead><tr><th>App No.</th><th>Mark</th><th>Time</th><th>Office</th></tr></thead>
                  <tbody>
                    {hearings.map((h,i) => (
                      <tr key={i}>
                        <td className="mono" style={{ fontSize:12 }}>{h.app_no||"—"}</td>
                        <td style={{ fontWeight:600, fontSize:12, maxWidth:120,
                          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
                          {h.tm_name||h.trademark_name||"—"}
                        </td>
                        <td className="mono" style={{ fontSize:11, color:"var(--text3)" }}>{h.time||"—"}</td>
                        <td style={{ fontSize:11, color:"var(--text3)" }}>{h.location||h.office||"—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* TLA Queue alerts */}
          <div className="card">
            <div className="card-head">
              <h3>⚡ Pending Alerts</h3>
              <span className="sec-link" onClick={() => navigate("/pending")}>View all →</span>
            </div>
            <div className="card-body">
              {queue.length === 0 ? (
                <div style={{ padding:"28px 0", textAlign:"center", color:"var(--text3)", fontSize:13 }}>
                  {tmaCode ? "Queue is clear ✅" : "Connect TMA code to see alerts"}
                </div>
              ) : (
                <div>
                  {queue.map((q,i) => (
                    <div key={i} style={{ padding:"10px 0",
                      borderBottom: i < queue.length-1 ? "1px solid var(--border)" : "none",
                      display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:600, fontFamily:"var(--mono)" }}>
                          {q.app_no}
                        </div>
                        <div style={{ fontSize:11, color:"var(--text3)", marginTop:2 }}>
                          {q.action_type||q.tm_name||"Pending action"}
                        </div>
                      </div>
                      <div style={{ fontSize:11, fontWeight:700, color: urgencyColor(q.urgency),
                        textTransform:"uppercase", letterSpacing:".05em" }}>
                        {q.urgency === "overdue"
                          ? `${Math.abs(q.days_left||0)}d overdue`
                          : q.days_left != null ? `${q.days_left}d left` : q.urgency||""}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* DB Stats */}
      {dbStats && dbStats.total_trademarks > 0 && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-head">
            <h3>🗄 Local Database</h3>
            <span style={{ fontSize:11, color:"var(--teal)" }}>
              Last sync: {dbStats.last_sync ? new Date(dbStats.last_sync).toLocaleString("en-IN") : "Never"}
            </span>
          </div>
          <div className="card-body" style={{ display:"flex", gap:20, flexWrap:"wrap", padding:"16px 20px" }}>
            {[
              ["Total",      dbStats.total_trademarks,        "var(--text)"],
              ["Registered", dbStats.by_status?.registered||0,"var(--teal)"],
              ["Objected",   dbStats.by_status?.objected||0,  "var(--rose)"],
              ["Pending",    dbStats.by_status?.pending||0,   "#f0c842"],
              ["Attorneys",  dbStats.total_attorneys||0,      "#8b5cf6"],
            ].map(([l,v,c]) => (
              <div key={l} style={{ textAlign:"center", minWidth:80 }}>
                <div style={{ fontFamily:"var(--mono)", fontSize:24, fontWeight:700, color:c }}>{v}</div>
                <div style={{ fontSize:11, color:"var(--text3)", textTransform:"uppercase",
                  letterSpacing:".08em", marginTop:3 }}>{l}</div>
              </div>
            ))}
            <div style={{ marginLeft:"auto", display:"flex", alignItems:"center" }}>
              <button onClick={() => navigate("/import")} className="topbar-btn btn-ghost" style={{ fontSize:12 }}>
                🔄 Sync Now
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="card">
        <div className="card-head"><h3>⚡ Quick Actions</h3></div>
        <div className="card-body" style={{ padding:20, display:"flex", gap:12, flexWrap:"wrap" }}>
          {[
            { icon:"📋", label:"Fetch Cause List",    sub:"Pull today's IP India hearings", path:"/scraper",  color:"#c9920a" },
            { icon:"🔍", label:"Search Trademarks",   sub:"Search IP India public database", path:"/search",  color:"#38bdf8" },
            { icon:"📥", label:"Bulk Import",         sub:"Import portfolio from IP India",  path:"/import",  color:"#00c4a0" },
            { icon:"⚖️", label:"TM Watch",            sub:"Monitor for conflicts",           path:"/monitoring",color:"#f43f5e"},
            { icon:"✍️", label:"Draft Reply",         sub:"AI-assisted hearing reply",       path:"/draft",   color:"#8b5cf6" },
          ].map((a) => (
            <div key={a.path} onClick={() => navigate(a.path)}
              style={{ background:"var(--s2)", border:"1px solid var(--border)", borderRadius:12,
                padding:"16px 20px", cursor:"pointer", flex:"1 1 150px", minWidth:140, transition:"all .2s" }}
              onMouseOver={e => { e.currentTarget.style.borderColor=a.color; e.currentTarget.style.transform="translateY(-2px)" }}
              onMouseOut={e  => { e.currentTarget.style.borderColor="var(--border)"; e.currentTarget.style.transform="" }}>
              <div style={{ fontSize:22, marginBottom:8 }}>{a.icon}</div>
              <div style={{ fontSize:13, fontWeight:700 }}>{a.label}</div>
              <div style={{ fontSize:11.5, color:"var(--text3)", marginTop:3 }}>{a.sub}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
