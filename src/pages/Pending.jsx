import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { fetchPendingReplies, fetchQueueList } from "../services/api"

export default function Pending({ context }) {
  const navigate  = useNavigate()
  const tmaCode   = context?.tmaData?.tmaCode || context?.tmaData?.username || ""
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState("")

  useEffect(() => { if (tmaCode) loadPending() }, [tmaCode])

  const loadPending = async () => {
    setLoading(true); setError("")
    try {
      const data = await fetchQueueList({ username: tmaCode })
      const pending = (data.items || []).filter(i =>
        !["filed","complied","done","submitted","replied","completed"]
          .includes((i.reply_status||"").toLowerCase())
      ).sort((a,b) => (a.days_left??9999) - (b.days_left??9999))
      setItems(pending)
    } catch(e) { setError(e.message) }
    setLoading(false)
  }

  const urgencyColor = u => u === "overdue" ? "var(--rose)" : u === "critical" ? "#f0c842" : u === "warning" ? "#f59e0b" : "var(--teal)"
  const urgencyBg    = u => u === "overdue" ? "rgba(244,63,94,.08)" : u === "critical" ? "rgba(201,146,10,.08)" : ""

  return (
    <>
      <div style={{ marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:10 }}>
        <div style={{ fontSize:13, color:"var(--text3)" }}>
          Pending examination reports and opposition replies from IP India TLA Queue
          {tmaCode && <span style={{ color:"#f0c842", marginLeft:8 }}>· TMA: {tmaCode}</span>}
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="topbar-btn btn-ghost" onClick={loadPending} disabled={loading}>
            {loading ? "Loading…" : "🔄 Refresh"}
          </button>
          <button className="topbar-btn btn-primary" onClick={() => navigate("/draft")}>✍ Draft Reply</button>
        </div>
      </div>

      {error && (
        <div style={{ background:"rgba(244,63,94,.07)", border:"1px solid rgba(244,63,94,.2)",
          borderRadius:10, padding:"12px 16px", marginBottom:16, color:"var(--rose)", fontSize:13 }}>
          ❌ {error}
        </div>
      )}

      {/* Summary stats */}
      {items.length > 0 && (
        <div style={{ display:"flex", gap:12, marginBottom:18, flexWrap:"wrap" }}>
          {[
            ["Total Pending",  items.length,                                                     "var(--text)"],
            ["Overdue",        items.filter(i=>i.urgency==="overdue").length,                    "var(--rose)"],
            ["Critical (≤7d)", items.filter(i=>i.urgency==="critical").length,                   "#f0c842"],
            ["Warning (≤15d)", items.filter(i=>i.urgency==="warning").length,                    "#f59e0b"],
            ["On Track",       items.filter(i=>i.urgency==="ok"||!i.urgency).length,             "var(--teal)"],
          ].map(([l,v,c]) => (
            <div key={l} style={{ background:"var(--s1)", border:"1px solid var(--border)",
              borderRadius:12, padding:"14px 18px", flex:1, minWidth:100 }}>
              <div style={{ fontSize:10.5, textTransform:"uppercase", letterSpacing:".1em", color:"var(--text3)", marginBottom:5 }}>{l}</div>
              <div style={{ fontFamily:"var(--mono)", fontSize:24, fontWeight:600, color:c }}>{v}</div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="card-head">
          <h3>📬 Pending Replies — TLA Queue</h3>
          {items.length > 0 && <span style={{ fontSize:12, color:"var(--text3)" }}>{items.length} items</span>}
        </div>
        <div className="card-body">
          {loading ? (
            <div style={{ padding:40, textAlign:"center", color:"var(--text3)" }}>
              <div style={{ width:28,height:28,border:"3px solid var(--border)",borderTopColor:"var(--accent)",
                borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 12px" }} />
              Fetching TLA Queue from IP India…
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📬</div>
              <div style={{ fontSize:17, fontWeight:700 }}>
                {tmaCode ? "No pending replies found" : "TMA Code not connected"}
              </div>
              <div style={{ fontSize:13, color:"var(--text3)", maxWidth:380, lineHeight:1.6 }}>
                {tmaCode
                  ? "Your TLA Queue is clear — no pending examination reports or opposition replies."
                  : "Complete setup with your TMA code to see your pending replies."}
              </div>
              {!tmaCode && (
                <button className="topbar-btn btn-primary" style={{ marginTop:12 }}
                  onClick={() => navigate("/dashboard")}>Complete Setup</button>
              )}
            </div>
          ) : (
            <div style={{ overflowX:"auto" }}>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>App No.</th><th>Mark</th><th>Class</th>
                    <th>Action Type</th><th>Issue Date</th><th>Reply Status</th>
                    <th>Days Left</th><th>Urgency</th><th>Link</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((i,idx) => (
                    <tr key={idx} style={{ background: urgencyBg(i.urgency) }}>
                      <td className="mono" style={{ fontWeight:600 }}>
                        <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${i.app_no}`}
                          target="_blank" rel="noreferrer" style={{ color:"#f0c842", textDecoration:"none" }}>
                          {i.app_no} ↗
                        </a>
                      </td>
                      <td style={{ fontWeight:600, fontSize:12 }}>{i.tm_name||"—"}</td>
                      <td style={{ fontSize:12, color:"var(--text3)" }}>{i.tm_class||"—"}</td>
                      <td style={{ fontSize:12 }}>{i.action_type||"—"}</td>
                      <td className="mono" style={{ fontSize:12 }}>{i.date||"—"}</td>
                      <td>
                        <span className={`chip ${i.reply_status?.toLowerCase()==="pending"?"chip-pending":"chip-registered"}`}>
                          {i.reply_status||"—"}
                        </span>
                      </td>
                      <td className="mono" style={{ fontWeight:700, color: urgencyColor(i.urgency) }}>
                        {i.days_left != null
                          ? (i.days_left < 0 ? `${Math.abs(i.days_left)}d overdue` : `${i.days_left}d`)
                          : "—"}
                      </td>
                      <td>
                        <span style={{ fontSize:11, fontWeight:700, color: urgencyColor(i.urgency),
                          textTransform:"uppercase", letterSpacing:".05em" }}>
                          {i.urgency||"—"}
                        </span>
                      </td>
                      <td>
                        <button onClick={() => navigate("/draft")}
                          style={{ fontSize:11, padding:"4px 9px", borderRadius:6, border:"none",
                            background:"rgba(201,146,10,.15)", color:"#f0c842", cursor:"pointer",
                            fontFamily:"var(--head)", fontWeight:600 }}>
                          Draft ✍
                        </button>
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
  )
}
