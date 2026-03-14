import React, { useState, useEffect } from "react"
import { checkBackend, fetchCauseList as apiFetchCauseList, fetchAppsBulk, fetchAgentHearings as apiFetchAgentHearings, fetchQueueList as apiFetchQueueList } from "../services/api"

const SAMPLE_CL = [
  { app_no: "7421462", agent: "VISHAL SHARMA", applicant: "MANJUL KUMAR SHUKLA, PROP. OF SHIVAY ENTERPRISES", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
  { app_no: "7393199", agent: "LALJI ADVOCATES", applicant: "LOKESH GARG PROPRIETOR OF KAMLESH MULTI ESTATE", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
  { app_no: "6141022", agent: "LALJI ADVOCATES", applicant: "SWISS BEAUTY COSMETICS PVT. LTD.", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
  { app_no: "6288120", agent: "LALJI ADVOCATES", applicant: "KSC HOMENEEDS PRIVATE LIMITED", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
  { app_no: "7451442", agent: "DARSHIT NAVINBHAI AHYA", applicant: "BALAJI WAFERS PRIVATE LIMITED", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
  { app_no: "5832570", agent: "DASWANI & DASWANI", applicant: "MANKIND PHARMA LIMITED", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
  { app_no: "7348801", agent: "LALL & SETHI", applicant: "Merck KGaA", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
  { app_no: "6273059", agent: "INFINVENT IP", applicant: "DEEPAK NITRITE LIMITED", hearing_date: "16-03-2026", slot: "🌅 Morning (10:30 AM – 1:30 PM)", status: "objected" },
]

const SAMPLE_QUEUE = [
  { app_no: "7421462", tm_name: "SHIVAY", action_type: "Examination Report", date: "12/02/2026", reply_status: "Pending", agent: "VISHAL SHARMA", applicant: "MANJUL KUMAR SHUKLA", office: "Delhi", tm_class: "30", deadline_days: 30, days_left: 1, urgency: "critical" },
  { app_no: "6141022", tm_name: "SWISS BEAUTY", action_type: "Examination Report", date: "10/01/2026", reply_status: "Pending", agent: "LALJI ADVOCATES", applicant: "SWISS BEAUTY COSMETICS PVT. LTD.", office: "Delhi", tm_class: "3", deadline_days: 30, days_left: -32, urgency: "overdue" },
  { app_no: "5832570", tm_name: "MANKIND", action_type: "Opposition Reply", date: "20/01/2026", reply_status: "Pending", agent: "DASWANI & DASWANI", applicant: "MANKIND PHARMA LIMITED", office: "Mumbai", tm_class: "5", deadline_days: 60, days_left: 38, urgency: "warning" },
  { app_no: "7348801", tm_name: "MERCK", action_type: "Examination Report", date: "05/02/2026", reply_status: "Pending", agent: "LALL & SETHI", applicant: "Merck KGaA", office: "Delhi", tm_class: "5", deadline_days: 30, days_left: 7, urgency: "critical" },
  { app_no: "6273059", tm_name: "DEEPAK NITRITE", action_type: "Examination Report (FER)", date: "28/01/2026", reply_status: "Pending", agent: "INFINVENT IP", applicant: "DEEPAK NITRITE LIMITED", office: "Ahmedabad", tm_class: "1", deadline_days: 30, days_left: 15, urgency: "warning" },
]

function LogTerminal({ logs, logId }) {
  const ref = React.useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  const clsMap = { info: "tfl-info", ok: "tfl-ok", warn: "tfl-warn", err: "tfl-err", data: "tfl-data" }
  return (
    <div className="log-terminal" ref={ref} id={logId}>
      {logs.map((l, i) => (
        <div key={i} className="tfl">
          <span className="tfl-ts">{l.ts}</span>
          <span className={clsMap[l.t] || "tfl-info"}>{l.msg}</span>
        </div>
      ))}
      {logs.length === 0 && (
        <div className="tfl"><span className="tfl-ts">--:--:--</span><span className="tfl-info">Ready. Click fetch to load data.</span></div>
      )}
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
  const [clDate, setClDate] = useState("2026-03-16")
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
  const [agDateFrom, setAgDateFrom] = useState("2026-03-13")
  const [agDateTo, setAgDateTo] = useState("2026-04-13")
  const [agLogs, setAgLogs] = useState([])
  const [agProgress, setAgProgress] = useState(0)
  const [agResults, setAgResults] = useState(null)

  // Tab 4 — Queue List
  const [qUsername, setQUsername] = useState("")
  const [qAppNo, setQAppNo] = useState("")
  const [qlLogs, setQlLogs] = useState([])
  const [qlProgress, setQlProgress] = useState(0)
  const [qlResults, setQlResults] = useState(null)

  const addLog = (setter, t, msg) => setter((l) => [...l, { t, msg, ts: new Date().toLocaleTimeString() }])
  const ts = () => new Date().toLocaleTimeString()
  const fmtDate = (v) => { const [y, m, d] = v.split("-"); return `${d}/${m}/${y}` }

  useEffect(() => {
    checkBackend().then(setBackendOk)
  }, [])

  // ── TAB 1: Cause List ──
  const doFetchCauseList = async () => {
    setClLogs([])
    setClResults(null)
    setClProgress(5)
    addLog(setClLogs, "info", "Connecting to MarkShield Backend → IP India Cause List...")
    setClProgress(20)

    const ok = backendOk ?? await checkBackend()
    let hearings = []

    if (ok) {
      try {
        addLog(setClLogs, "info", `Fetching cause list: date=${fmtDate(clDate)}${clAgent ? ", agent=" + clAgent : ""}...`)
        setClProgress(40)
        const data = await apiFetchCauseList({ date: fmtDate(clDate), agent: clAgent || undefined, location: clLocation || undefined })
        hearings = (data.hearings || [])
        addLog(setClLogs, "ok", `✅ Live data — ${hearings.length} hearing(s)`)
      } catch (e) {
        addLog(setClLogs, "err", `Backend error: ${e.message}`)
        addLog(setClLogs, "warn", "Using demo data...")
        hearings = SAMPLE_CL.filter((h) => !clAgent || h.agent.toUpperCase().includes(clAgent.toUpperCase()))
      }
    } else {
      addLog(setClLogs, "warn", "Backend offline — using demo data...")
      await new Promise((r) => setTimeout(r, 600))
      hearings = SAMPLE_CL.filter((h) => !clAgent || h.agent.toUpperCase().includes(clAgent.toUpperCase()))
    }

    setClProgress(100)
    addLog(setClLogs, "data", `Loaded ${hearings.length} hearing(s)`)
    setClResults(hearings)
  }

  // ── TAB 2: App Status ──
  const doFetchAppStatus = async () => {
    if (!appNos.trim()) return
    setAsLogs([])
    setAsResults(null)
    setAsProgress(5)
    const nos = appNos.split(/[,\s]+/).filter(Boolean)
    addLog(setAsLogs, "info", `Looking up ${nos.length} application(s): ${nos.join(", ")}`)
    setAsProgress(20)

    const ok = backendOk ?? await checkBackend()
    let results = []

    if (ok) {
      try {
        setAsProgress(40)
        const data = await fetchAppsBulk(nos)
        results = (data.results || []).map((r) => ({
          appNo: r.app_no, trademark: r.trademark_name || "—", status: r.status || "—",
          tmClass: r.tm_class || "—", applicant: r.applicant || "—", hearingDate: r.hearing_date || "—",
          link: r.source_url || `https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${r.app_no}`,
        }))
        addLog(setAsLogs, "ok", `✅ ${results.length} application(s) fetched`)
      } catch (e) {
        addLog(setAsLogs, "err", `Error: ${e.message}`)
        results = nos.map((no) => ({ appNo: no, trademark: "—", status: "See IP India", tmClass: "—", applicant: "—", hearingDate: "—", link: `https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${no}` }))
      }
    } else {
      addLog(setAsLogs, "warn", "Backend offline — showing IP India links...")
      await new Promise((r) => setTimeout(r, 500))
      results = nos.map((no) => ({ appNo: no, trademark: "—", status: "See IP India", tmClass: "—", applicant: "—", hearingDate: "—", link: `https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${no}` }))
    }

    setAsProgress(100)
    setAsResults(results)
  }

  // ── TAB 3: Agent Search ──
  const doFetchAgentHearings = async () => {
    if (!agentQ.trim()) return
    setAgLogs([])
    setAgResults(null)
    setAgProgress(5)
    addLog(setAgLogs, "info", `Searching hearings for: "${agentQ}"`)
    setAgProgress(20)

    const ok = backendOk ?? await checkBackend()
    let hearings = []

    if (ok) {
      try {
        setAgProgress(45)
        const data = await apiFetchAgentHearings({ agent: agentQ, from: fmtDate(agDateFrom), to: fmtDate(agDateTo) })
        hearings = data.hearings || []
        addLog(setAgLogs, "ok", `✅ ${hearings.length} hearing(s) found`)
      } catch (e) {
        addLog(setAgLogs, "err", `Error: ${e.message}`)
        hearings = SAMPLE_CL.filter((h) => h.agent.toUpperCase().includes(agentQ.toUpperCase()))
      }
    } else {
      addLog(setAgLogs, "warn", "Backend offline — filtering demo data...")
      await new Promise((r) => setTimeout(r, 700))
      hearings = SAMPLE_CL.filter((h) => h.agent.toUpperCase().includes(agentQ.toUpperCase()))
    }

    setAgProgress(100)
    addLog(setAgLogs, "data", `Showing ${hearings.length} hearing(s)`)
    setAgResults(hearings)
  }

  // ── TAB 4: Queue List ──
  const doFetchQueueList = async () => {
    setQlLogs([])
    setQlResults(null)
    setQlProgress(5)
    addLog(setQlLogs, "info", "Connecting to IP India eFiling — TLA Queue List...")
    setQlProgress(20)

    const ok = backendOk ?? await checkBackend()
    let items = []

    if (ok) {
      try {
        setQlProgress(40)
        const data = await apiFetchQueueList({ username: qUsername || undefined, app_no: qAppNo || undefined })
        items = data.items || []
        addLog(setQlLogs, "ok", `✅ ${items.length} item(s) from IP India`)
      } catch (e) {
        addLog(setQlLogs, "err", `Error: ${e.message}`)
        items = SAMPLE_QUEUE
      }
    } else {
      addLog(setQlLogs, "warn", "Backend offline — using demo data...")
      await new Promise((r) => setTimeout(r, 500))
      items = SAMPLE_QUEUE
    }

    if (qUsername) items = items.filter((i) => (i.agent || "").toUpperCase().includes(qUsername.toUpperCase()))
    if (qAppNo) items = items.filter((i) => i.app_no === qAppNo)
    setQlProgress(100)
    setQlResults(items)
  }

  const tabs = [
    { id: "causelist", label: "📋 Cause List — Live Hearings" },
    { id: "appstatus", label: "🔍 Application Status" },
    { id: "agentsearch", label: "👤 Agent / TMA Search" },
    { id: "queuelist", label: "🗂 TLA Queue List" },
  ]

  return (
    <>
      {/* Source banner */}
      <div style={{ background: "rgba(37,99,255,.07)", border: "1px solid rgba(37,99,255,.18)", borderRadius: 10, padding: "12px 18px", marginBottom: 18, display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 18 }}>🔗</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#7aa3ff" }}>Live Data Sources — IP India</div>
          <div style={{ fontSize: "11.5px", color: "var(--text3)", marginTop: 2 }}>
            Cause List (Public) · e-Register (Public) · TM Public Search · eFiling Portal (Login) · <span style={{ color: "#f87171" }}>TLA Queue List (eFiling)</span>
          </div>
          <div style={{ fontSize: 11, marginTop: 4, color: backendOk === null ? "var(--text3)" : backendOk ? "var(--teal)" : "var(--rose)" }}>
            {backendOk === null ? "⏳ Checking backend..." : backendOk ? "🟢 Backend connected" : "🔴 Backend offline — using demo data"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[["Cause List", "var(--teal)", "https://tmrsearch.ipindia.gov.in/TMRDynamicUtility/CauseListForHearingCase/Index"],
            ["e-Register", "var(--text2)", "https://tmrsearch.ipindia.gov.in/eregister/"],
            ["Public Search", "var(--text2)", "https://tmrsearch.ipindia.gov.in/tmrpublicsearch/"],
            ["eFiling Portal", "var(--text2)", "https://ipindiaonline.gov.in/trademarkefiling/user/frmLoginNew.aspx"],
            ["TLA Queue List", "#f87171", "https://ipindiaonline.gov.in/trademarkefiling/DynamicUtilities/TLA_QueueList_new.aspx"]].map(([label, color, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer"
              style={{ fontSize: 11, padding: "5px 11px", borderRadius: 7, background: "var(--s2)", border: "1px solid var(--border)", color, textDecoration: "none" }}>
              {label} ↗
            </a>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {tabs.map((t) => (
          <div key={t.id} className={`tab${activeTab === t.id ? " on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {/* ── TAB 1: CAUSE LIST ── */}
      {activeTab === "causelist" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">📋 Live Cause List — IP India Hearing Schedule</div>
            <div className="scraper-sub">Fetches today's and upcoming hearing cause list directly from <b>tmrsearch.ipindia.gov.in</b>.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Agent / Attorney Name (filter)</label>
                <input type="text" placeholder="e.g. LALJI ADVOCATES or leave blank for all" value={clAgent} onChange={(e) => setClAgent(e.target.value)} />
              </div>
              <div className="sf-group">
                <label>Location</label>
                <select value={clLocation} onChange={(e) => setClLocation(e.target.value)}>
                  <option value="">All Locations</option>
                  {["Delhi", "Mumbai", "Chennai", "Kolkata", "Ahmedabad"].map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div className="sf-group">
                <label>Hearing Date</label>
                <input type="date" value={clDate} onChange={(e) => setClDate(e.target.value)} />
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
                <table className="tbl">
                  <thead><tr><th>App No.</th><th>Agent / Attorney</th><th>Applicant</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
                  <tbody>
                    {clResults.map((h) => (
                      <tr key={h.app_no || h.appNo}>
                        <td className="mono">
                          <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${h.app_no || h.appNo}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                            {h.app_no || h.appNo} ↗
                          </a>
                        </td>
                        <td style={{ fontSize: 12 }}>{h.agent || h.agent_name}</td>
                        <td style={{ fontSize: 12, maxWidth: 200 }}>{h.applicant || h.applicant_name}</td>
                        <td className="mono" style={{ color: "var(--amber)", fontWeight: 600 }}>{h.hearing_date || h.date}</td>
                        <td style={{ fontSize: 11, color: "var(--text3)" }}>{h.slot}</td>
                        <td><span className={`chip ${h.status === "objected" ? "chip-objected" : "chip-hearing"}`}>{h.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: APP STATUS ── */}
      {activeTab === "appstatus" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">🔍 Application Status Lookup</div>
            <div className="scraper-sub">Look up trademark application status via IP India e-Register.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Application Number(s)</label>
                <input type="text" placeholder="e.g. 5847291 or multiple: 5847291,5821043" value={appNos} onChange={(e) => setAppNos(e.target.value)} style={{ fontFamily: "var(--mono)" }} />
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
                <table className="tbl">
                  <thead><tr><th>App No.</th><th>Trademark</th><th>Status</th><th>Class</th><th>Applicant</th><th>Hearing Date</th><th>IP India</th></tr></thead>
                  <tbody>
                    {asResults.map((r) => (
                      <tr key={r.appNo}>
                        <td className="mono">{r.appNo}</td>
                        <td style={{ fontWeight: 600 }}>{r.trademark}</td>
                        <td><span className="chip chip-hearing">{r.status}</span></td>
                        <td style={{ fontSize: 12, color: "var(--text3)" }}>{r.tmClass}</td>
                        <td style={{ fontSize: 12 }}>{r.applicant}</td>
                        <td className="mono" style={{ color: "var(--amber)" }}>{r.hearingDate}</td>
                        <td><a href={r.link} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", fontSize: 12, textDecoration: "none" }}>View ↗</a></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 3: AGENT SEARCH ── */}
      {activeTab === "agentsearch" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">👤 Agent / TMA Code Hearing Search</div>
            <div className="scraper-sub">Search all upcoming hearings for a specific agent name or TMA code.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Agent Name or TMA Code</label>
                <input type="text" placeholder="e.g. LALJI ADVOCATES or TMA/GJ/2847" value={agentQ} onChange={(e) => setAgentQ(e.target.value.toUpperCase())} />
              </div>
              <div className="sf-group">
                <label>Date Range — From</label>
                <input type="date" value={agDateFrom} onChange={(e) => setAgDateFrom(e.target.value)} />
              </div>
              <div className="sf-group">
                <label>To</label>
                <input type="date" value={agDateTo} onChange={(e) => setAgDateTo(e.target.value)} />
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
                <table className="tbl">
                  <thead><tr><th>App No.</th><th>Applicant</th><th>Date</th><th>Slot</th><th>Status</th></tr></thead>
                  <tbody>
                    {agResults.map((h) => (
                      <tr key={h.app_no || h.appNo}>
                        <td className="mono">
                          <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${h.app_no || h.appNo}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>
                            {h.app_no || h.appNo} ↗
                          </a>
                        </td>
                        <td style={{ fontSize: 12 }}>{h.applicant || h.applicant_name}</td>
                        <td className="mono" style={{ color: "var(--amber)", fontWeight: 600 }}>{h.hearing_date || h.date}</td>
                        <td style={{ fontSize: 11, color: "var(--text3)" }}>{h.slot}</td>
                        <td><span className={`chip ${h.status === "objected" ? "chip-objected" : "chip-hearing"}`}>{h.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── TAB 4: QUEUE LIST ── */}
      {activeTab === "queuelist" && (
        <>
          <div className="scraper-card">
            <div className="scraper-title">🗂 TLA Queue List — IP India eFiling Portal</div>
            <div className="scraper-sub">Fetches pending application queue from ipindiaonline.gov.in eFiling portal.</div>
            <div className="scraper-form">
              <div className="sf-group" style={{ flex: 2 }}>
                <label>Username / TMA Code (optional filter)</label>
                <input type="text" placeholder="e.g. TMA/GJ/2847 or leave blank" value={qUsername} onChange={(e) => setQUsername(e.target.value)} />
              </div>
              <div className="sf-group">
                <label>Application No. (optional)</label>
                <input type="text" placeholder="e.g. 5847291" value={qAppNo} onChange={(e) => setQAppNo(e.target.value)} style={{ fontFamily: "var(--mono)" }} />
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
                <h3>🗂 {qlResults.length} Item{qlResults.length !== 1 ? "s" : ""} in TLA Queue
                  <span style={{ fontSize: 11, fontWeight: 400, color: "var(--teal)", marginLeft: 8 }}>IP India eFiling Portal</span>
                </h3>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {qlResults.filter((i) => i.urgency === "overdue").length > 0 && <span className="chip" style={{ background: "rgba(239,68,68,.15)", color: "#f87171", border: "1px solid rgba(239,68,68,.3)" }}>⏰ {qlResults.filter((i) => i.urgency === "overdue").length} Overdue</span>}
                  {qlResults.filter((i) => i.urgency === "critical").length > 0 && <span className="chip" style={{ background: "rgba(245,158,11,.15)", color: "#fbbf24", border: "1px solid rgba(245,158,11,.3)" }}>⚠ {qlResults.filter((i) => i.urgency === "critical").length} Critical</span>}
                </div>
              </div>
              <div className="card-body">
                <table className="tbl">
                  <thead><tr><th>App No.</th><th>TM / Mark</th><th>Class</th><th>Action Type</th><th>Date Issued</th><th>Agent</th><th>Office</th><th>Reply Status</th><th>Days Left</th></tr></thead>
                  <tbody>
                    {qlResults.map((i) => {
                      const urg = i.urgency || "ok"
                      const rowStyle = urg === "overdue" ? { background: "rgba(239,68,68,.07)" } : urg === "critical" ? { background: "rgba(245,158,11,.07)" } : {}
                      const daysLabel = i.days_left != null
                        ? i.days_left < 0
                          ? <span style={{ color: "#f87171", fontWeight: 700 }}>{Math.abs(i.days_left)}d overdue</span>
                          : <span style={{ color: i.days_left <= 7 ? "#fbbf24" : i.days_left <= 15 ? "#fde047" : "var(--teal)", fontWeight: i.days_left <= 15 ? 700 : 400 }}>{i.days_left}d left</span>
                        : "—"
                      return (
                        <tr key={i.app_no} style={rowStyle}>
                          <td className="mono"><a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${i.app_no}`} target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "none" }}>{i.app_no} ↗</a></td>
                          <td style={{ fontWeight: 600, fontSize: 12 }}>{i.tm_name || "—"}</td>
                          <td style={{ fontSize: 12, color: "var(--text3)" }}>{i.tm_class || "—"}</td>
                          <td style={{ fontSize: 12 }}>{i.action_type || "—"}</td>
                          <td className="mono" style={{ color: "var(--amber)", fontSize: 12 }}>{i.date || "—"}</td>
                          <td style={{ fontSize: 11 }}>{i.agent || "—"}</td>
                          <td style={{ fontSize: 11, color: "var(--text3)" }}>{i.office || "—"}</td>
                          <td><span className={`chip ${i.reply_status === "Pending" ? "chip-pending" : "chip-registered"}`}>{i.reply_status || "—"}</span></td>
                          <td>{daysLabel}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
