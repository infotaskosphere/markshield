import React, { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Monitoring({ context }) {
  const navigate = useNavigate()
  const [conflicts, setConflicts] = useState([])
  const [showConfig, setShowConfig] = useState(false)
  const [watchTerm, setWatchTerm] = useState("")
  const [running, setRunning] = useState(false)

  const handleRunScan = () => {
    setRunning(true)
    setTimeout(() => {
      setRunning(false)
      // Real scan would call the backend; for now show empty result
    }, 2000)
  }

  const handleDismiss = (idx) => setConflicts(prev => prev.filter((_, i) => i !== idx))

  return (
    <>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--text3)" }}>
          AI-powered conflict detection across the IP India trademark database
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="topbar-btn btn-ghost" onClick={() => setShowConfig(true)}>⚙ Configure Watch</button>
          <button className="topbar-btn btn-primary" onClick={handleRunScan} disabled={running}>
            {running ? (
              <><div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> Scanning...</>
            ) : "▶ Run Scan Now"}
          </button>
        </div>
      </div>

      {conflicts.length > 0 && (
        <div className="alert-banner">
          <div className="ab-icon">🚨</div>
          <div className="ab-text">
            <div className="ab-title">{conflicts.length} Conflict{conflicts.length > 1 ? "s" : ""} Detected</div>
            <div className="ab-sub">AI similarity score above threshold. Review and take action below.</div>
          </div>
        </div>
      )}

      {conflicts.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">🛡️</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>No conflicts detected</div>
            <div style={{ fontSize: 13, color: "var(--text3)", maxWidth: 360, lineHeight: 1.6 }}>
              Add trademarks to your portfolio first, then run a scan to detect potential conflicts from the IP India database.
              The AI engine monitors phonetic similarity, visual resemblance, and class overlap.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 4, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="topbar-btn btn-primary" onClick={handleRunScan} disabled={running}>
                {running ? "Scanning..." : "▶ Run Scan Now"}
              </button>
              <button className="topbar-btn btn-ghost" onClick={() => navigate("/portfolio")}>+ Add Trademarks</button>
            </div>
          </div>
        </div>
      ) : (
        conflicts.map((m, idx) => (
          <div key={idx} className="monitor-card">
            <div className="monitor-icon" style={{ background: "rgba(244,63,94,.1)" }}>⚠️</div>
            <div className="monitor-body">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div>
                  <div className="monitor-title">
                    {m.name} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text3)" }}>conflicts with your</span> {m.vs}
                  </div>
                  <div className="monitor-sub">{m.reason}</div>
                </div>
                <div style={{ textAlign: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 600, color: m.risk > 85 ? "var(--rose)" : "var(--amber)" }}>{m.risk}%</div>
                  <div style={{ fontSize: "9.5px", textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text3)" }}>AI Risk</div>
                </div>
              </div>
              <div className="monitor-meta">
                <span className="rc-tag">App: {m.app}</span>
                <span className="rc-tag">Class {m.cls}</span>
                <span className="rc-tag">Filed: {m.filed}</span>
              </div>
              <div className="monitor-actions">
                <button className="mact-btn mact-oppose">⚔️ File Opposition</button>
                <button className="mact-btn mact-oppose" style={{ background: "rgba(245,158,11,.1)", color: "var(--amber)" }}>📨 C&D Letter</button>
                <button className="mact-btn mact-watch">👁 Watch</button>
                <button className="mact-btn mact-dismiss" onClick={() => handleDismiss(idx)}>✕ Dismiss</button>
              </div>
            </div>
          </div>
        ))
      )}

      {/* How it works */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-head"><h3>ℹ How TM Watch Works</h3></div>
        <div className="card-body" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
            {[
              { icon: "🔊", title: "Phonetic Analysis", desc: "Detects sound-alike marks using Soundex and phonetic algorithms." },
              { icon: "👁", title: "Visual Similarity", desc: "Compares letter shapes, style, and overall appearance of marks." },
              { icon: "📦", title: "Class Overlap", desc: "Flags marks in the same or overlapping Nice Classification classes." },
              { icon: "🤖", title: "AI Scoring", desc: "Combines signals to produce a risk score from 0–100%." },
            ].map(item => (
              <div key={item.title} style={{ background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>{item.title}</div>
                <div style={{ fontSize: 12, color: "var(--text3)", lineHeight: 1.5 }}>{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Config Modal */}
      {showConfig && (
        <div className="overlay open" onClick={e => e.target.classList.contains("overlay") && setShowConfig(false)}>
          <div className="modal">
            <div className="modal-title">Configure TM Watch</div>
            <div className="modal-sub">Set your monitoring preferences and risk thresholds.</div>
            <div className="mf">
              <label>Risk Threshold (%)</label>
              <input type="number" placeholder="70" min="0" max="100" />
            </div>
            <div className="mf">
              <label>Watch Term / Mark</label>
              <input placeholder="e.g. FRESHMART" value={watchTerm} onChange={e => setWatchTerm(e.target.value.toUpperCase())} />
            </div>
            <div className="mf">
              <label>Classes to Monitor</label>
              <input placeholder="e.g. 29, 30, 35 (comma separated)" />
            </div>
            <div className="mf">
              <label>Email Alerts</label>
              <input type="email" placeholder="your@email.com" />
            </div>
            <div className="modal-btns">
              <button className="topbar-btn btn-ghost" onClick={() => setShowConfig(false)}>Cancel</button>
              <button className="topbar-btn btn-primary" onClick={() => setShowConfig(false)}>Save Config</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
