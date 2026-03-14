import React, { useState, useEffect } from "react"
import { checkBackend, fetchCauseList as apiFetchCauseList, fetchAppsBulk, fetchAgentHearings as apiFetchAgentHearings, fetchQueueList as apiFetchQueueList } from "../services/api"

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
        ))
      }
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

export default function Scraper({ context }) {
  const [activeTab, setActiveTab] = useState("causelist")
  const [backendOk, setBackendOk] = useState(null)

  // Tab 1 — Cause List
  const [clAgent, setClAgent] = useState("")
  const [clLocation, setClLocation] = useState("")
  const [clDate, setClDate] = useState(new Date().toISOString().slice(0, 10))
  const [clLogs, setClLogs] = useState([])
  const [clProgress, setClProgress] = useState(0)
  const [clResults, setClResults] = useState(null)

  // Tab 2 — App Status
  const [appNos, setAppNos] = useState("")
  const [asLogs, setAsLogs] = useState([])
  const [asProgress, setAsProgress] = useState(0)
  const [asResults, setAsResults] = useState(null)

  // Tab 3 — Agent Search
  const [agentQ, setAgentQ] = useState("")
  const [agDateFrom, setAgDateFrom] = useState(new Date().toISOString().slice(0, 10))
  const [agDateTo, setAgDateTo] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
  })
  const [agLogs, setAgLogs] = useState([])
  const [agProgress, setAgProgress] = useState(0)
  const [agResults, setAgResults] = useState(null)

  // Tab 4 — Queue List
  const [qUsername, setQUsername] = useState("")
  const [qAppNo, setQAppNo] = useState("")
  const [qlLogs, setQlLogs] = useState([])
  const [qlProgress, setQlProgress] = useState(0)
  const [qlResults, setQlResults] = useState(null)

  const addLog = (setter, t, msg) => setter(l => [...l, { t, msg, ts: new Date().toLocaleTimeString() }])
  const fmtDate = (v) => { const [y, m, d] = v.split("-"); return `${d}/${m}/${y}` }

  useEffect(() => { checkBackend().then(setBackendOk) }, [])

  // TAB 1
  const doFetchCauseList = async () => {
    setClLogs([]); setClResults(null); setClProgress(5)
    addLog(setClLogs, "info", "Connecting to MarkShield Backend → IP India Cause List...")
    setClProgress(20)
    const ok = backendOk ?? await checkBackend()
    if (!ok) {
      addLog(setClLogs, "err", "Backend offline. Start the backend with: cd backend && python app.py")
      setClProgress(0); return
    }
    try {
      addLog(setClLogs, "info", `Fetching cause list: date=${fmtDate(clDate)}${clAgent ? ", agent=" + clAgent : ""}...`)
      setClProgress(50)
      const data = await apiFetchCauseList({ date: fmtDate(clDate), agent: clAgent || undefined, location: clLocation || undefined })
      const hearings = data.hearings || []
      addLog(setClLogs, "ok", `✅ Live data — ${hearings.length} hearing(s) found`)
      setClProgress(100)
      addLog(setClLogs, "data", `Showing ${hearings.length} hearing(s) for ${fmtDate(clDate)}`)
      setClResults(hearings)
    } catch (e) {
      addLog(setClLogs, "err", `Error: ${e.message}`)
      setClProgress(0)
    }
  }

  // TAB 2
  const doFetchAppStatus = async () => {
    if (!appNos.trim()) return
    setAsLogs([]); setAsResults(null); setAsProgress(5)
    const nos = appNos.split(/[,\s]+/).filter(Boolean)
    addLog(setAsLogs, "info", `Looking up ${nos.length} application(s): ${nos.join(", ")}`)
    setAsProgress(20)
    const ok = backendOk ?? await checkBackend()
    if (!ok) {
      addLog(setAsLogs, "err", "Backend offline. Start the backend server first.")
      setAsProgress(0); return
    }
    try {
      setAsProgress(50)
      const data = await fetchAppsBulk(nos)
      const results = (data.results || []).map(r => ({
        appNo: r.app_no, trademark: r.trademark_name || "—", status: r.status || "—",
        tmClass: r.tm_class || "—", applicant: r.applicant || "—", hearingDate: r.hearing_date || "—",
        link: r.source_url || `https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${r.app_no}`,
      }))
      addLog(setAsLogs, "ok", `✅ ${results.length} application(s) fetched from e-Register`)
      setAsProgress(100); setAsResults(results)
    } catch (e) {
      addLog(setAsLogs, "err", `Error: ${e.message}`)
      setAsProgress(0)
    }
  }

  // TAB 3
  const doFetchAgentHearings = async () => {
    if (!agentQ.trim()) return
    setAgLogs([]); setAgResults(null); setAgProgress(5)
    addLog(setAgLogs, "info", `Searching hearings for: "${agentQ}"`)
    setAgProgress(20)
    const ok = backendOk ?? await checkBackend()
    if (!ok) { addLog(setAgLogs, "err", "Backend offline."); setAgProgress(0); return }
    try {
      setAgProgress(50)
      const data = await apiFetchAgentHearings({ agent: agentQ, from: fmtDate(agDateFrom), to: fmtDate(agDateTo) })
      const hearings = data.hearings || []
      addLog(setAgLogs, "ok", `✅ ${hearings.length} hearing(s) found for "${agentQ}"`)
      setAgProgress(100)
      addLog(setAgLogs, "data", `Date range: ${fmtDate(agDateFrom)} — ${fmtDate(agDateTo)}`)
      setAgResults(hearings)
    } catch (e) {
      addLog(setAgLogs, "err", `Error: ${e.message}`)
      setAgProgress(0)
    }
  }

  // TAB 4
  const doFetchQueueList = async () => {
    setQlLogs([]); setQlResults(null); setQlProgress(5)
    addLog(setQlLogs, "info", "Connecting to IP India eFiling — TLA Queue List...")
    setQlProgress(20)
    const ok = backendOk ?? await checkBackend()
    if (!ok) { addLog(setQlLogs, "err", "Backend offline."); setQlProgress(0); return }
    try {
      setQlProgress(50)
      const data = await apiFetchQueueList({ username: qUsername || undefined, app_no: qAppNo || undefined })
      let items = data.items || []
      if (qUsername) items = items.filter(i => (i.agent || "").toUpperCase().includes(qUsername.toUpperCase()))
      if (qAppNo) items = items.filter(i => i.app_no === qAppNo)
      addLog(setQlLogs, "ok", `✅ ${items.length} item(s) in TLA Queue`)
      setQlProgress(100); setQlResults(items)
    } catch (e) {
      addLog(setQlLogs, "err", `Error: ${e.message}`)
      setQlProgress(0)
    }
  }

  const tabs = [
    { id: "causelist", label: "📋 Cause List" },
    { id: "appstatus", label: "🔍 Application Status" },
    { id: "agentsearch", label: "👤 Agent / TMA Search" },
    { id: "queuelist", label: "🗂 TLA Queue List" },
  ]

  return (
    <>
      {/* Source banner */}
      <div style={{ background: "rgba(201,146,10,.07)", border: "1px solid rgba(201,146,10,.18)", borderRadius: 10, padding: "12px 18px", marginBottom: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 18 }}>🔗</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#f0c842" }}>Live Data Sources — IP India</div>
          <div style={{ fontSize: "11.5px", color: "var(--text3)", marginTop: 2 }}>
            Cause List (Public) · e-Register (Public) · TM Public Search · eFiling Portal · TLA Queue List
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: backendOk === null ? "var(--text3)" : backendOk ? "var(--teal)" : "var(--rose)" }}>
            {backendOk === null ? "⏳ Checking backend..." : backendOk ? "🟢 Backend connected" : "🔴 Backend offline — run: cd backend && python app.py"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[
            ["Cause List", "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index"],
            ["e-Register", "https://tmrsearch.ipindia.gov.in/eregister/"],
            ["Public Search", "https://tmrsearch.ipindia.gov.in/tmrpublicsearch/"],
            ["eFiling Portal", "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"],
            ["TLA Queue List", "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx"],
          ].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, padding: "5px 11px", borderRadius: 7, background: "var(--s2)", border: "1px solid var(--border)", color: "var(--text2)", textDecoration: "none", transition: "color .18s" }}
              onMouseOver={e => e.currentTarget.style.color = "#f0c842"}
              onMouseOut={e => e.currentTarget.style.color = "var(--text2)"}
            >
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

      {/* CAUSE LIST */}
      {activeTab === "causelist" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">📋 Live Cause List — IP India Hearing Schedule</div>
            <div className="scraper-sub">Fetches today's and upcoming hearing cause list directly from <b>tmrsearch.ipindia.gov.in</b>.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Agent / Attorney Name (filter)</label>
                <input type="text" placeholder="e.g. LALJI ADVOCATES or leave blank for all" value={clAgent} onChange={e => setClAgent(e.target.value)} />
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
                <button className="topbar-btn btn-primary" onClick={doFetchCauseList}>🔄 Fetch Live</button>
              </div>
            </div>
            <LogTerminal logs={clLogs} />
            <ProgressBar value={clProgress} />
          </div>

          {clResults && (
            <div className="card">
              <div className="card-head">
                <h3>🏛 {clResults.length} Hearing{clResults.length !== 1 ? "s" : ""} Found
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--teal)", marginLeft: 8 }}>IP India Cause List · {fmtDate(clDate)}</span>
                </h3>
              </div>
              <div className="card-body">
                {clResults.length === 0 ? (
                  <div style={{ padding: "30px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No hearings found for this date/filter combination.</div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>App No.</th><th>Agent / Attorney</th><th>Applicant</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
                    <tbody>
                      {clResults.map(h => (
                        <tr key={h.app_no}>
                          <td className="mono">
                            <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${h.app_no}`} target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>
                              {h.app_no} ↗
                            </a>
                          </td>
                          <td style={{ fontSize: 12 }}>{h.agent}</td>
                          <td style={{ fontSize: 12, maxWidth: 200 }}>{h.applicant}</td>
                          <td className="mono" style={{ color: "#f0c842", fontWeight: 600 }}>{h.hearing_date}</td>
                          <td style={{ fontSize: 11, color: "var(--text3)" }}>{h.slot}</td>
                          <td><span className={`chip ${h.status === "objected" ? "chip-objected" : "chip-hearing"}`}>{h.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* APP STATUS */}
      {activeTab === "appstatus" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">🔍 Application Status Lookup</div>
            <div className="scraper-sub">Look up trademark application status via IP India e-Register (public access, no login required).</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Application Number(s)</label>
                <input type="text" placeholder="e.g. 5847291 or multiple: 5847291, 5821043" value={appNos} onChange={e => setAppNos(e.target.value)} style={{ fontFamily: "var(--mono)" }} />
              </div>
              <div className="sf-group" style={{ flex: 0, minWidth: "auto" }}>
                <label>&nbsp;</label>
                <button className="topbar-btn btn-primary" onClick={doFetchAppStatus}>🔄 Fetch Status</button>
              </div>
            </div>
            <LogTerminal logs={asLogs} />
            <ProgressBar value={asProgress} />
          </div>

          {asResults && (
            <div className="card">
              <div className="card-head"><h3>📄 Application Status Results</h3></div>
              <div className="card-body">
                {asResults.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No results returned.</div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>App No.</th><th>Trademark</th><th>Status</th><th>Class</th><th>Applicant</th><th>Hearing Date</th><th>IP India</th></tr></thead>
                    <tbody>
                      {asResults.map(r => (
                        <tr key={r.appNo}>
                          <td className="mono">{r.appNo}</td>
                          <td style={{ fontWeight: 600 }}>{r.trademark}</td>
                          <td><span className="chip chip-hearing">{r.status}</span></td>
                          <td style={{ fontSize: 12, color: "var(--text3)" }}>{r.tmClass}</td>
                          <td style={{ fontSize: 12 }}>{r.applicant}</td>
                          <td className="mono" style={{ color: "#f0c842" }}>{r.hearingDate}</td>
                          <td><a href={r.link} target="_blank" rel="noreferrer" style={{ color: "#f0c842", fontSize: 12, textDecoration: "none" }}>View ↗</a></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* AGENT SEARCH */}
      {activeTab === "agentsearch" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">👤 Agent / TMA Code Hearing Search</div>
            <div className="scraper-sub">Search all upcoming hearings for a specific agent name or TMA code across a date range.</div>
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
                <button className="topbar-btn btn-primary" onClick={doFetchAgentHearings}>🔄 Fetch Hearings</button>
              </div>
            </div>
            <LogTerminal logs={agLogs} />
            <ProgressBar value={agProgress} />
          </div>

          {agResults && (
            <div className="card">
              <div className="card-head"><h3>📅 {agResults.length} Hearing{agResults.length !== 1 ? "s" : ""} — {agentQ}</h3></div>
              <div className="card-body">
                {agResults.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No hearings found for "{agentQ}" in this date range.</div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>App No.</th><th>Applicant</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
                    <tbody>
                      {agResults.map(h => (
                        <tr key={h.app_no}>
                          <td className="mono">
                            <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${h.app_no}`} target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>
                              {h.app_no} ↗
                            </a>
                          </td>
                          <td style={{ fontSize: 12 }}>{h.applicant}</td>
                          <td className="mono" style={{ color: "#f0c842", fontWeight: 600 }}>{h.hearing_date}</td>
                          <td style={{ fontSize: 11, color: "var(--text3)" }}>{h.slot}</td>
                          <td><span className={`chip ${h.status === "objected" ? "chip-objected" : "chip-hearing"}`}>{h.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* QUEUE LIST */}
      {activeTab === "queuelist" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">🗂 TLA Queue List — IP India eFiling Portal</div>
            <div className="scraper-sub">Fetches pending application queue from <b>ipindiaonline.gov.in</b> eFiling portal. Backend must be authenticated.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Username / TMA Code (optional filter)</label>
                <input type="text" placeholder="e.g. TMA/GJ/2847 or leave blank" value={qUsername} onChange={e => setQUsername(e.target.value)} />
              </div>
              <div className="sf-group">
                <label>Application No. (optional)</label>
                <input type="text" placeholder="e.g. 5847291" value={qAppNo} onChange={e => setQAppNo(e.target.value)} style={{ fontFamily: "var(--mono)" }} />
              </div>
              <div className="sf-group" style={{ flex: 0, minWidth: "auto" }}>
                <label>&nbsp;</label>
                <button className="topbar-btn btn-primary" onClick={doFetchQueueList}>🔄 Fetch Queue</button>
              </div>
            </div>
            <LogTerminal logs={qlLogs} />
            <ProgressBar value={qlProgress} />
          </div>

          {qlResults && (
            <div className="card">
              <div className="card-head">
                <h3>🗂 {qlResults.length} Item{qlResults.length !== 1 ? "s" : ""} in TLA Queue</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  {qlResults.filter(i => i.urgency === "overdue").length > 0 && (
                    <span className="chip chip-refused">⏰ {qlResults.filter(i => i.urgency === "overdue").length} Overdue</span>
                  )}
                </div>
              </div>
              <div className="card-body">
                {qlResults.length === 0 ? (
                  <div style={{ padding: 30, textAlign: "center", color: "var(--text3)", fontSize: 13 }}>No items in queue.</div>
                ) : (
                  <table className="tbl">
                    <thead><tr><th>App No.</th><th>Mark</th><th>Class</th><th>Action Type</th><th>Date</th><th>Agent</th><th>Office</th><th>Reply Status</th><th>Days Left</th></tr></thead>
                    <tbody>
                      {qlResults.map(i => {
                        const bg = i.urgency === "overdue" ? { background: "rgba(244,63,94,.06)" } : i.urgency === "critical" ? { background: "rgba(201,146,10,.06)" } : {}
                        return (
                          <tr key={i.app_no} style={bg}>
                            <td className="mono">
                              <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${i.app_no}`} target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>{i.app_no} ↗</a>
                            </td>
                            <td style={{ fontWeight: 600, fontSize: 12 }}>{i.tm_name || "—"}</td>
                            <td style={{ fontSize: 12, color: "var(--text3)" }}>{i.tm_class || "—"}</td>
                            <td style={{ fontSize: 12 }}>{i.action_type || "—"}</td>
                            <td className="mono" style={{ color: "#f0c842", fontSize: 12 }}>{i.date || "—"}</td>
                            <td style={{ fontSize: 11 }}>{i.agent || "—"}</td>
                            <td style={{ fontSize: 11, color: "var(--text3)" }}>{i.office || "—"}</td>
                            <td><span className={`chip ${i.reply_status === "Pending" ? "chip-pending" : "chip-registered"}`}>{i.reply_status || "—"}</span></td>
                            <td>
                              {i.days_left != null ? (
                                <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: i.days_left <= 7 ? 700 : 400, color: i.days_left < 0 ? "var(--rose)" : i.days_left <= 7 ? "#f0c842" : "var(--teal)" }}>
                                  {i.days_left < 0 ? `${Math.abs(i.days_left)}d overdue` : `${i.days_left}d left`}
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
