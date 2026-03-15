import React, { useState, useEffect, useRef } from "react"
import { checkBackend } from "../services/api"

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  })
  return res.json()
}

function LogBox({ logs }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [logs])
  const color = { "✅": "#00c4a0", "❌": "#f43f5e", "⚠": "#f0c842", "⏳": "#5b9ef8", "🔄": "#f0c842" }
  const getColor = (msg) => {
    for (const [emoji, c] of Object.entries(color)) {
      if (msg.includes(emoji)) return c
    }
    return "#8898bf"
  }
  return (
    <div ref={ref} style={{ background: "#010508", border: "1px solid #1a2545", borderRadius: 9,
      padding: "12px 14px", fontFamily: "var(--mono)", fontSize: 11.5, lineHeight: 2,
      height: 200, overflowY: "auto" }}>
      {logs.length === 0
        ? <span style={{ color: "#1e2d50" }}>Logs will appear here…</span>
        : logs.map((l, i) => (
          <div key={i} style={{ color: getColor(l.msg) }}>
            <span style={{ color: "#1e2d50", marginRight: 10 }}>{l.ts}</span>{l.msg}
          </div>
        ))}
    </div>
  )
}

function ProgressBar({ value }) {
  return (
    <div style={{ background: "var(--border)", borderRadius: 4, height: 6, overflow: "hidden", margin: "10px 0" }}>
      <div style={{ height: "100%", width: value + "%", borderRadius: 4,
        background: "linear-gradient(90deg,#c9920a,#f0c842)", transition: "width .5s ease" }} />
    </div>
  )
}

export default function Import({ context }) {
  const tmaCode   = context?.tmaData?.tmaCode || context?.tmaData?.username || ""
  const agentName = context?.agentProfile?.fullName || ""

  // TMA import
  const [tmCode,    setTmCode]    = useState(tmaCode)
  const [tmAgent,   setTmAgent]   = useState(agentName)
  const [tmLogs,    setTmLogs]    = useState([])
  const [tmPct,     setTmPct]     = useState(0)
  const [tmRunning, setTmRunning] = useState(false)
  const [tmResult,  setTmResult]  = useState(null)

  // App numbers import
  const [appNosInput, setAppNosInput] = useState("")
  const [appLogs,     setAppLogs]     = useState([])
  const [appPct,      setAppPct]      = useState(0)
  const [appRunning,  setAppRunning]  = useState(false)
  const [appResult,   setAppResult]   = useState(null)

  // DB stats
  const [dbStats, setDbStats] = useState(null)
  const [history, setHistory] = useState([])

  const addLog = (setter, msg) => setter(l => [...l, { ts: new Date().toLocaleTimeString(), msg }])

  useEffect(() => { loadStats() }, [])

  const loadStats = async () => {
    try {
      const [s, h] = await Promise.all([
        apiFetch("/import/db-stats"),
        apiFetch("/import/history"),
      ])
      setDbStats(s)
      setHistory(h.history || [])
    } catch(_e) {}
  }

  const pollJob = (jobId, logSetter, setPct, setRunning, setResult, onDone) => {
    const iv = setInterval(async () => {
      try {
        const res = await apiFetch(`/import/status/${jobId}`)
        if (res.message) addLog(logSetter, res.message)
        if (res.progress !== undefined) setPct(res.progress)
        if (res.status === "done") {
          clearInterval(iv)
          setRunning(false)
          setResult(res.result)
          if (onDone) onDone(res.result)
          loadStats()
        } else if (res.status === "error") {
          clearInterval(iv)
          setRunning(false)
          addLog(logSetter, `❌ Error: ${res.error}`)
        }
      } catch(_e) {}
    }, 2000)
  }

  // ── TMA Import ──
  const startTmaImport = async () => {
    if (!tmCode.trim()) return
    setTmRunning(true); setTmLogs([]); setTmPct(0); setTmResult(null)
    addLog(setTmLogs, `⏳ Starting import for TMA: ${tmCode}…`)
    try {
      const res = await apiFetch("/import/tma", {
        method: "POST",
        body: JSON.stringify({ tma_code: tmCode.trim(), agent_name: tmAgent.trim() }),
      })
      if (res.error) { addLog(setTmLogs, `❌ ${res.error}`); setTmRunning(false); return }
      pollJob(res.job_id, setTmLogs, setTmPct, setTmRunning, setTmResult)
    } catch(e) { addLog(setTmLogs, `❌ ${e.message}`); setTmRunning(false) }
  }

  // ── App Numbers Import ──
  const startAppImport = async () => {
    const nos = appNosInput.split(/[\n,\s]+/).map(s => s.trim()).filter(Boolean)
    if (!nos.length) return
    setAppRunning(true); setAppLogs([]); setAppPct(0); setAppResult(null)
    addLog(setAppLogs, `⏳ Importing ${nos.length} application number(s)…`)
    try {
      const res = await apiFetch("/import/appnos", {
        method: "POST",
        body: JSON.stringify({ app_nos: nos, tma_code: tmCode.trim() }),
      })
      if (res.error) { addLog(setAppLogs, `❌ ${res.error}`); setAppRunning(false); return }
      pollJob(res.job_id, setAppLogs, setAppPct, setAppRunning, setAppResult)
    } catch(e) { addLog(setAppLogs, `❌ ${e.message}`); setAppRunning(false) }
  }

  const card = { background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 14, padding: "22px 24px", marginBottom: 20 }
  const inp  = { width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8,
    padding: "9px 13px", color: "var(--text)", fontFamily: "var(--head)", fontSize: 13, outline: "none" }
  const lbl  = { fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text3)", display: "block", marginBottom: 5 }

  return (
    <div>
      {/* DB Stats */}
      {dbStats && (
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 22 }}>
          {[
            ["Total in DB",   dbStats.total_trademarks, "var(--text)"],
            ["Attorneys",     dbStats.total_attorneys,  "#f0c842"],
            ["Registered",    dbStats.by_status?.registered  || 0, "var(--teal)"],
            ["Objected",      dbStats.by_status?.objected     || 0, "var(--rose)"],
            ["Pending",       dbStats.by_status?.pending      || 0, "#5b9ef8"],
            ["Last Sync",     dbStats.last_sync ? new Date(dbStats.last_sync).toLocaleTimeString() : "Never", "var(--text3)"],
          ].map(([label, val, color]) => (
            <div key={label} style={{ background: "var(--s1)", border: "1px solid var(--border)", borderRadius: 12,
              padding: "14px 18px", flex: 1, minWidth: 110 }}>
              <div style={{ fontSize: 10.5, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text3)", marginBottom: 5 }}>{label}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 22, fontWeight: 600, color }}>{val}</div>
            </div>
          ))}
          <button onClick={loadStats} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 10,
            padding: "0 14px", color: "var(--text3)", cursor: "pointer", fontSize: 13, fontFamily: "var(--head)" }}
            title="Refresh stats">🔄</button>
        </div>
      )}

      {/* ── Import by TMA Code ── */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
          🏛 Import by TMA Code
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 18, lineHeight: 1.6 }}>
          Fetches <b style={{ color: "var(--text)" }}>all trademark applications</b> for your attorney code
          from IP India (TLA Queue + Cause List + eRegister). Run this once to build your database.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
          <div>
            <label style={lbl}>TMA Code / eFiling Username *</label>
            <input style={inp} placeholder="e.g. manthan15 or TMA/GJ/2847"
              value={tmCode} onChange={e => setTmCode(e.target.value)}
              onFocus={e => e.target.style.borderColor="var(--accent)"}
              onBlur={e => e.target.style.borderColor="var(--border)"} />
          </div>
          <div>
            <label style={lbl}>Attorney Full Name (improves search)</label>
            <input style={inp} placeholder="e.g. MANTHAN DESAI"
              value={tmAgent} onChange={e => setTmAgent(e.target.value.toUpperCase())}
              onFocus={e => e.target.style.borderColor="var(--accent)"}
              onBlur={e => e.target.style.borderColor="var(--border)"} />
          </div>
        </div>

        <LogBox logs={tmLogs} />
        <ProgressBar value={tmPct} />

        {tmResult && (
          <div style={{ background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.2)",
            borderRadius: 10, padding: "12px 16px", margin: "12px 0",
            display: "flex", gap: 16, flexWrap: "wrap" }}>
            <span style={{ color: "#00c4a0", fontWeight: 700 }}>✅ Import Complete</span>
            <span style={{ color: "var(--text3)", fontSize: 12 }}>
              {tmResult.imported} apps imported · Registered: {tmResult.summary?.registered || 0} ·
              Objected: {tmResult.summary?.objected || 0} · Pending: {tmResult.summary?.pending || 0}
            </span>
          </div>
        )}

        <button onClick={startTmaImport} disabled={tmRunning || !tmCode.trim()}
          className="topbar-btn btn-primary" style={{ marginTop: 10 }}>
          {tmRunning
            ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)",
                borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> Importing…</>
            : "🔄 Start TMA Import"}
        </button>
      </div>

      {/* ── Import by Application Numbers ── */}
      <div style={card}>
        <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
          🔢 Import Specific Application Numbers
        </div>
        <div style={{ fontSize: 12.5, color: "var(--text3)", marginBottom: 18, lineHeight: 1.6 }}>
          Enter application numbers you've added manually to fetch their full details from IP India eRegister.
          Paste one per line, or comma-separated.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={lbl}>Application Numbers *</label>
          <textarea
            style={{ ...inp, minHeight: 100, resize: "vertical", fontFamily: "var(--mono)", fontSize: 13 }}
            placeholder={"4182961\n6001234\n5089123\nor: 4182961, 6001234, 5089123"}
            value={appNosInput}
            onChange={e => setAppNosInput(e.target.value)}
            onFocus={e => e.target.style.borderColor="var(--accent)"}
            onBlur={e => e.target.style.borderColor="var(--border)"}
          />
          <div style={{ fontSize: 11, color: "var(--text3)", marginTop: 4 }}>
            {appNosInput.split(/[\n,\s]+/).filter(Boolean).length} application(s) entered · Max 200 per import
          </div>
        </div>

        <LogBox logs={appLogs} />
        <ProgressBar value={appPct} />

        {appResult && (
          <div style={{ background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.2)",
            borderRadius: 10, padding: "12px 16px", margin: "12px 0" }}>
            <div style={{ color: "#00c4a0", fontWeight: 700, marginBottom: 8 }}>✅ Import Complete</div>
            <div style={{ display: "flex", gap: 20, fontSize: 12.5, color: "var(--text3)" }}>
              <span>✅ Imported: <b style={{ color: "var(--teal)" }}>{appResult.imported}</b></span>
              <span>⏭ Skipped: <b style={{ color: "#f0c842" }}>{appResult.skipped}</b></span>
              <span>❌ Failed: <b style={{ color: "var(--rose)" }}>{appResult.failed}</b></span>
            </div>
            {appResult.records?.filter(r => r.status === "imported").slice(0, 5).map(r => (
              <div key={r.app_no} style={{ fontSize: 12, color: "var(--text2)", marginTop: 6, paddingTop: 6,
                borderTop: "1px solid var(--border)" }}>
                <b style={{ fontFamily: "var(--mono)" }}>{r.app_no}</b> — {r.trademark_name}
                <span style={{ marginLeft: 10, color: "var(--text3)" }}>{r.tm_status}</span>
              </div>
            ))}
          </div>
        )}

        <button onClick={startAppImport}
          disabled={appRunning || !appNosInput.split(/[\n,\s]+/).filter(Boolean).length}
          className="topbar-btn btn-primary" style={{ marginTop: 10 }}>
          {appRunning
            ? <><div style={{ width: 14, height: 14, border: "2px solid rgba(255,255,255,.4)",
                borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> Importing…</>
            : "📥 Import Applications"}
        </button>
      </div>

      {/* ── Import History ── */}
      {history.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>📋 Import History</div>
          <table className="tbl">
            <thead>
              <tr><th>TMA Code</th><th>Action</th><th>Records</th><th>Status</th><th>Time</th></tr>
            </thead>
            <tbody>
              {history.slice(0, 10).map((h, i) => (
                <tr key={i}>
                  <td className="mono">{h.tma_code || "—"}</td>
                  <td style={{ fontSize: 12 }}>{h.action}</td>
                  <td className="mono">{h.records}</td>
                  <td><span className={`chip ${h.status === "success" ? "chip-registered" : "chip-refused"}`}>{h.status}</span></td>
                  <td style={{ fontSize: 11, color: "var(--text3)" }}>
                    {h.finished_at ? new Date(h.finished_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
