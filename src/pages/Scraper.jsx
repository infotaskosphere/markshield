import React, { useState, useEffect } from "react"
import { checkBackend, fetchCauseList as apiFetchCauseList, fetchAppsBulk, fetchAgentHearings as apiFetchAgentHearings, fetchQueueList as apiFetchQueueList } from "../services/api"

// ── Backend status banner ──────────────────────────────────────────────────────
function BackendBanner({ status }) {
  if (status === null) return (
    <div className="backend-online-banner" style={{ background: "rgba(201,146,10,.07)", border: "1px solid rgba(201,146,10,.18)", color: "#f0c842" }}>
      <div style={{ width: 14, height: 14, border: "2px solid #f0c842", borderTopColor: "transparent", borderRadius: "50%", animation: "spin .8s linear infinite", flexShrink: 0 }} />
      Checking backend connection…
    </div>
  )
  if (status === true) return (
    <div className="backend-online-banner">
      <span style={{ fontSize: 16 }}>🟢</span>
      <span>Backend connected — live IP India scraping is active.</span>
    </div>
  )
  return (
    <div className="backend-offline-banner">
      <span style={{ fontSize: 16, flexShrink: 0 }}>🔴</span>
      <div>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Backend offline — scraper cannot reach IP India</div>
        <div style={{ color: "var(--text3)", lineHeight: 1.7 }}>
          <b style={{ color: "#ff8fa3" }}>To fix:</b> Start your backend service on Render, or run locally:
          <br />
          <code>cd backend &amp;&amp; pip install -r requirements.txt &amp;&amp; python app.py</code>
          <br />
          Then set <code>VITE_API_URL</code> in <code>.env.production</code> to your backend URL and redeploy.
        </div>
      </div>
    </div>
  )
}

// ── Log terminal ───────────────────────────────────────────────────────────────
function LogTerminal({ logs }) {
  const ref = React.useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  const cls = { info: "tfl-info", ok: "tfl-ok", warn: "tfl-warn", err: "tfl-err", data: "tfl-data" }
  return (
    <div className="log-terminal" ref={ref}>
      {logs.length === 0
        ? <div className="tfl"><span className="tfl-ts">--:--:--</span><span className="tfl-info">Ready. Click fetch to load live data from IP India.</span></div>
        : logs.map((l, i) => (
          <div key={i} className="tfl">
            <span className="tfl-ts">{l.ts}</span>
            <span className={cls[l.t] || "tfl-info"}>{l.msg}</span>
          </div>
        ))}
    </div>
  )
}

function ProgressBar({ value }) {
  return (
    <div className="progress-bar-wrap" style={{ marginTop: 8 }}>
      <div className="progress-bar-fill" style={{ width: value + "%" }} />
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Scraper({ context }) {
  const [activeTab,  setActiveTab]  = useState("causelist")
  const [backendOk,  setBackendOk]  = useState(null)

  // Cause List
  // Auto-fill from saved attorney profile
  const savedAgentName = context?.agentProfile?.fullName?.toUpperCase() || ""
  const savedTmaCode   = context?.tmaData?.username || context?.agentProfile?.portalUser || ""

  const [clAgent,    setClAgent]    = useState(savedAgentName)
  const [clLocation, setClLocation] = useState("")
  const [clDate,     setClDate]     = useState(new Date().toISOString().slice(0, 10))
  const [clLogs,     setClLogs]     = useState([])
  const [clProgress, setClProgress] = useState(0)
  const [clResults,  setClResults]  = useState(null)

  // App Status
  const [appNos,     setAppNos]     = useState("")
  const [asLogs,     setAsLogs]     = useState([])
  const [asProgress, setAsProgress] = useState(0)
  const [asResults,  setAsResults]  = useState(null)

  // Agent Search
  const [agentQ,     setAgentQ]     = useState(savedAgentName)
  const [agDateFrom, setAgDateFrom] = useState(new Date().toISOString().slice(0, 10))
  const [agDateTo,   setAgDateTo]   = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
  })
  const [agLogs,     setAgLogs]     = useState([])
  const [agProgress, setAgProgress] = useState(0)
  const [agResults,  setAgResults]  = useState(null)

  // Queue List
  const [qUsername,  setQUsername]  = useState(savedTmaCode)
  const [qAppNo,     setQAppNo]     = useState("")
  const [qlLogs,     setQlLogs]     = useState([])
  const [qlProgress, setQlProgress] = useState(0)
  const [qlResults,  setQlResults]  = useState(null)

  const addLog = (setter, t, msg) => setter(l => [...l, { t, msg, ts: new Date().toLocaleTimeString() }])
  const fmtDate = v => { const [y, m, d] = v.split("-"); return `${d}/${m}/${y}` }

  useEffect(() => {
    // Pass a retry callback so Render cold-start (~30-60s) is handled gracefully
    checkBackend(() => setBackendOk(null)).then(setBackendOk)
  }, [])

  const requireBackend = (setter) => {
    if (!backendOk) {
      addLog(setter, "err", "❌ Backend offline. Cannot reach IP India.")
      addLog(setter, "warn", "Fix: Deploy your backend or run: cd backend && python app.py")
      return false
    }
    return true
  }

  // ── Cause List ──
  const doFetchCauseList = async () => {
    setClLogs([]); setClResults(null); setClProgress(5)
    addLog(setClLogs, "info", "Connecting to MarkShield Backend → IP India Cause List...")
    if (!requireBackend(setClLogs)) { setClProgress(0); return }
    try {
      addLog(setClLogs, "info", `Fetching cause list for ${fmtDate(clDate)}${clAgent ? ` — agent: ${clAgent}` : ""}`)
      setClProgress(40)
      const data = await apiFetchCauseList({ date: fmtDate(clDate), agent: clAgent || undefined, location: clLocation || undefined })
      const hearings = data.hearings || []
      addLog(setClLogs, "ok", `✅ ${hearings.length} hearing(s) found from IP India`)
      setClProgress(100); setClResults(hearings)
    } catch (e) {
      addLog(setClLogs, "err", `Error: ${e.message}`)
      setClProgress(0)
    }
  }

  // ── App Status ──
  const doFetchAppStatus = async () => {
    if (!appNos.trim()) return
    setAsLogs([]); setAsResults(null); setAsProgress(5)
    const nos = appNos.split(/[,\s]+/).filter(Boolean)
    addLog(setAsLogs, "info", `Looking up ${nos.length} application(s): ${nos.join(", ")}`)
    if (!requireBackend(setAsLogs)) { setAsProgress(0); return }
    try {
      setAsProgress(40)
      const data = await fetchAppsBulk(nos)
      const results = (data.results || []).map(r => ({
        appNo: r.app_no, trademark: r.trademark_name || "—", status: r.status || "—",
        tmClass: r.tm_class || "—", applicant: r.applicant || "—", hearingDate: r.hearing_date || "—",
        link: r.source_url || `https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${r.app_no}`,
      }))
      addLog(setAsLogs, "ok", `✅ ${results.length} application(s) fetched`)
      setAsProgress(100); setAsResults(results)
    } catch (e) { addLog(setAsLogs, "err", `Error: ${e.message}`); setAsProgress(0) }
  }

  // ── Agent Search ──
  const doFetchAgentHearings = async () => {
    if (!agentQ.trim()) return
    setAgLogs([]); setAgResults(null); setAgProgress(5)
    addLog(setAgLogs, "info", `Searching hearings for: "${agentQ}"`)
    if (!requireBackend(setAgLogs)) { setAgProgress(0); return }
    try {
      setAgProgress(40)
      const data = await apiFetchAgentHearings({ agent: agentQ, from: fmtDate(agDateFrom), to: fmtDate(agDateTo) })
      const hearings = data.hearings || []
      addLog(setAgLogs, "ok", `✅ ${hearings.length} hearing(s) found`)
      setAgProgress(100); setAgResults(hearings)
    } catch (e) { addLog(setAgLogs, "err", `Error: ${e.message}`); setAgProgress(0) }
  }

  // ── Queue List ──
  const doFetchQueueList = async () => {
    setQlLogs([]); setQlResults(null); setQlProgress(5)
    addLog(setQlLogs, "info", "Connecting to IP India eFiling — TLA Queue List...")
    if (!requireBackend(setQlLogs)) { setQlProgress(0); return }
    try {
      setQlProgress(40)
      const data = await apiFetchQueueList({ username: qUsername || undefined, app_no: qAppNo || undefined })
      let items = data.items || []
      if (qUsername) items = items.filter(i => (i.agent || "").toUpperCase().includes(qUsername.toUpperCase()))
      if (qAppNo)    items = items.filter(i => i.app_no === qAppNo)
      addLog(setQlLogs, "ok", `✅ ${items.length} item(s) in TLA Queue`)
      setQlProgress(100); setQlResults(items)
    } catch (e) { addLog(setQlLogs, "err", `Error: ${e.message}`); setQlProgress(0) }
  }

  const tabs = [
    { id: "causelist",   label: "📋 Cause List" },
    { id: "appstatus",   label: "🔍 Application Status" },
    { id: "agentsearch", label: "👤 Agent / TMA Search" },
    { id: "queuelist",   label: "🗂 TLA Queue List" },
  ]

  const chipMap = { objected: "chip-objected", hearing: "chip-hearing", pending: "chip-pending", registered: "chip-registered" }

  return (
    <>
      {/* Backend status */}
      <BackendBanner status={backendOk} />

      {/* Source links */}
      <div style={{ background: "rgba(201,146,10,.06)", border: "1px solid rgba(201,146,10,.16)", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0c842", marginBottom: 3 }}>🔗 Live Data Sources — IP India</div>
          <div style={{ fontSize: 11.5, color: "var(--text3)" }}>Cause List (Public) · e-Register · TM Public Search · eFiling Portal · TLA Queue List</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["Cause List",    "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index"],
            ["e-Register",    "https://tmrsearch.ipindia.gov.in/eregister/"],
            ["Public Search", "https://tmrsearch.ipindia.gov.in/tmrpublicsearch/"],
            ["eFiling",       "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"],
            ["TLA Queue",     "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx"],
          ].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" style={{ fontSize: 11, padding: "5px 11px", borderRadius: 7, background: "var(--s2)", border: "1px solid var(--border)", color: "var(--text2)", textDecoration: "none" }}
              onMouseOver={e => e.currentTarget.style.color = "#f0c842"}
              onMouseOut={e => e.currentTarget.style.color = "var(--text2)"}>
              {label} ↗
            </a>
          ))}
        </div>
      </div>

      <div className="tabs">
        {tabs.map(t => (
          <div key={t.id} className={`tab${activeTab === t.id ? " on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {/* ── CAUSE LIST ── */}
      {activeTab === "causelist" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">📋 Live Cause List — IP India Hearing Schedule</div>
            <div className="scraper-sub">Fetches today's and upcoming hearing cause list from <b>tmrsearch.ipindia.gov.in</b>.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Agent / Attorney Name</label>
                <input type="text" placeholder="e.g. LALJI ADVOCATES (leave blank for all)" value={clAgent} onChange={e => setClAgent(e.target.value)} />
              </div>
              <div className="sf-group">
                <label>Location</label>
                <select value={clLocation} onChange={e => setClLocation(e.target.value)}>
                  <option value="">All Locations</option>
                  {["Delhi", "Mumbai", "Chennai", "Kolkata", "Ahmedabad"].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="sf-group">
                <label>Hearing Date</label>
                <input type="date" value={clDate} onChange={e => setClDate(e.target.value)} />
              </div>
              <div className="sf-group" style={{ flex: 0, minWidth: "auto" }}>
                <label>&nbsp;</label>
                <button className="topbar-btn btn-primary" onClick={doFetchCauseList} disabled={backendOk === false}>
                  🔄 Fetch Live
                </button>
              </div>
            </div>
            <LogTerminal logs={clLogs} />
            <ProgressBar value={clProgress} />
          </div>
          {clResults && (
            <div className="card">
              <div className="card-head">
                <h3>🏛 {clResults.length} Hearing{clResults.length !== 1 ? "s" : ""} — {fmtDate(clDate)}</h3>
              </div>
              <div className="card-body">
                {clResults.length === 0
                  ? <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No hearings found for this date / filter.</div>
                  : <table className="tbl">
                      <thead><tr><th>App No.</th><th>Agent</th><th>Applicant</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
                      <tbody>
                        {clResults.map(h => (
                          <tr key={h.app_no}>
                            <td className="mono">
                              <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${h.app_no}`} target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>{h.app_no} ↗</a>
                            </td>
                            <td style={{ fontSize: 12 }}>{h.agent}</td>
                            <td style={{ fontSize: 12 }}>{h.applicant}</td>
                            <td className="mono" style={{ color: "#f0c842", fontWeight: 600 }}>{h.hearing_date}</td>
                            <td style={{ fontSize: 11, color: "var(--text3)" }}>{h.slot}</td>
                            <td><span className={`chip ${chipMap[h.status] || "chip-hearing"}`}>{h.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            </div>
          )}
        </>
      )}

      {/* ── APP STATUS ── */}
      {activeTab === "appstatus" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">🔍 Application Status Lookup</div>
            <div className="scraper-sub">Look up trademark status via IP India e-Register (public, no login required).</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Application Number(s)</label>
                <input type="text" placeholder="e.g. 6001234 or multiple: 6001234, 6005678" value={appNos} onChange={e => setAppNos(e.target.value)} style={{ fontFamily: "var(--mono)" }} />
              </div>
              <div className="sf-group" style={{ flex: 0, minWidth: "auto" }}>
                <label>&nbsp;</label>
                <button className="topbar-btn btn-primary" onClick={doFetchAppStatus} disabled={backendOk === false}>🔄 Fetch</button>
              </div>
            </div>
            <LogTerminal logs={asLogs} />
            <ProgressBar value={asProgress} />
          </div>
          {asResults && (
            <div className="card">
              <div className="card-head"><h3>📄 Application Status Results</h3></div>
              <div className="card-body">
                <table className="tbl">
                  <thead><tr><th>App No.</th><th>Trademark</th><th>Status</th><th>Class</th><th>Applicant</th><th>Hearing</th><th>Link</th></tr></thead>
                  <tbody>
                    {asResults.map(r => (
                      <tr key={r.appNo}>
                        <td className="mono">{r.appNo}</td>
                        <td style={{ fontWeight: 600 }}>{r.trademark}</td>
                        <td><span className={`chip ${chipMap[r.status?.toLowerCase()] || "chip-pending"}`}>{r.status}</span></td>
                        <td style={{ fontSize: 12, color: "var(--text3)" }}>{r.tmClass}</td>
                        <td style={{ fontSize: 12 }}>{r.applicant}</td>
                        <td className="mono" style={{ color: "#f0c842", fontSize: 12 }}>{r.hearingDate}</td>
                        <td><a href={r.link} target="_blank" rel="noreferrer" style={{ color: "#f0c842", fontSize: 12, textDecoration: "none" }}>View ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── AGENT SEARCH ── */}
      {activeTab === "agentsearch" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">👤 Agent / TMA Hearing Search</div>
            <div className="scraper-sub">Search all hearings for a specific agent name or TMA code across a date range.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Agent Name or TMA Code</label>
                <input type="text" placeholder="e.g. LALJI ADVOCATES or TMA/GJ/2847" value={agentQ} onChange={e => setAgentQ(e.target.value.toUpperCase())} />
              </div>
              <div className="sf-group">
                <label>From Date</label>
                <input type="date" value={agDateFrom} onChange={e => setAgDateFrom(e.target.value)} />
              </div>
              <div className="sf-group">
                <label>To Date</label>
                <input type="date" value={agDateTo} onChange={e => setAgDateTo(e.target.value)} />
              </div>
              <div className="sf-group" style={{ flex: 0, minWidth: "auto" }}>
                <label>&nbsp;</label>
                <button className="topbar-btn btn-primary" onClick={doFetchAgentHearings} disabled={backendOk === false}>🔄 Fetch</button>
              </div>
            </div>
            <LogTerminal logs={agLogs} />
            <ProgressBar value={agProgress} />
          </div>
          {agResults && (
            <div className="card">
              <div className="card-head"><h3>📅 {agResults.length} Hearing{agResults.length !== 1 ? "s" : ""} — {agentQ}</h3></div>
              <div className="card-body">
                {agResults.length === 0
                  ? <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No hearings found.</div>
                  : <table className="tbl">
                      <thead><tr><th>App No.</th><th>Applicant</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
                      <tbody>
                        {agResults.map(h => (
                          <tr key={h.app_no}>
                            <td className="mono"><a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${h.app_no}`} target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>{h.app_no} ↗</a></td>
                            <td style={{ fontSize: 12 }}>{h.applicant}</td>
                            <td className="mono" style={{ color: "#f0c842", fontWeight: 600 }}>{h.hearing_date}</td>
                            <td style={{ fontSize: 11, color: "var(--text3)" }}>{h.slot}</td>
                            <td><span className={`chip ${chipMap[h.status] || "chip-hearing"}`}>{h.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            </div>
          )}
        </>
      )}

      {/* ── QUEUE LIST ── */}
      {activeTab === "queuelist" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">🗂 TLA Queue List — eFiling Portal</div>
            <div className="scraper-sub">Fetches pending application queue from <b>ipindiaonline.gov.in</b>. Backend must be running.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>TMA Code / Username (optional filter)</label>
                <input type="text" placeholder="e.g. TMA/GJ/2847 or leave blank" value={qUsername} onChange={e => setQUsername(e.target.value)} />
              </div>
              <div className="sf-group">
                <label>Application No. (optional)</label>
                <input type="text" placeholder="e.g. 6001234" value={qAppNo} onChange={e => setQAppNo(e.target.value)} style={{ fontFamily: "var(--mono)" }} />
              </div>
              <div className="sf-group" style={{ flex: 0, minWidth: "auto" }}>
                <label>&nbsp;</label>
                <button className="topbar-btn btn-primary" onClick={doFetchQueueList} disabled={backendOk === false}>🔄 Fetch</button>
              </div>
            </div>
            <LogTerminal logs={qlLogs} />
            <ProgressBar value={qlProgress} />
          </div>
          {qlResults && (
            <div className="card">
              <div className="card-head">
                <h3>🗂 {qlResults.length} Item{qlResults.length !== 1 ? "s" : ""} in TLA Queue</h3>
                {qlResults.filter(i => i.urgency === "overdue").length > 0 && (
                  <span className="chip chip-refused">⏰ {qlResults.filter(i => i.urgency === "overdue").length} Overdue</span>
                )}
              </div>
              <div className="card-body">
                {qlResults.length === 0
                  ? <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No items in queue.</div>
                  : <table className="tbl">
                      <thead><tr><th>App No.</th><th>Mark</th><th>Class</th><th>Action</th><th>Date</th><th>Agent</th><th>Office</th><th>Reply</th><th>Days Left</th></tr></thead>
                      <tbody>
                        {qlResults.map(i => (
                          <tr key={i.app_no} style={i.urgency === "overdue" ? { background: "rgba(244,63,94,.05)" } : i.urgency === "critical" ? { background: "rgba(201,146,10,.05)" } : {}}>
                            <td className="mono"><a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${i.app_no}`} target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>{i.app_no} ↗</a></td>
                            <td style={{ fontWeight: 600, fontSize: 12 }}>{i.tm_name || "—"}</td>
                            <td style={{ fontSize: 12, color: "var(--text3)" }}>{i.tm_class || "—"}</td>
                            <td style={{ fontSize: 12 }}>{i.action_type || "—"}</td>
                            <td className="mono" style={{ color: "#f0c842", fontSize: 12 }}>{i.date || "—"}</td>
                            <td style={{ fontSize: 11 }}>{i.agent || "—"}</td>
                            <td style={{ fontSize: 11, color: "var(--text3)" }}>{i.office || "—"}</td>
                            <td><span className={`chip ${i.reply_status === "Pending" ? "chip-pending" : "chip-registered"}`}>{i.reply_status || "—"}</span></td>
                            <td>
                              {i.days_left != null
                                ? <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: i.days_left <= 7 ? 700 : 400, color: i.days_left < 0 ? "var(--rose)" : i.days_left <= 7 ? "#f0c842" : "var(--teal)" }}>
                                    {i.days_left < 0 ? `${Math.abs(i.days_left)}d overdue` : `${i.days_left}d left`}
                                  </span>
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                }
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
