import React from "react"

const monitorData = [
  { name: "FRESHKART", app: "5912341", cls: "29, 30", filed: "08 Mar 2026", risk: 94, colorVar: "var(--rose)", vs: "FRESHMART", reason: "Near-identical phonetics and visual similarity. Class overlap: 29, 30. Likely to cause confusion." },
  { name: "TECHVEDHA", app: "5908772", cls: "42", filed: "01 Mar 2026", risk: 78, colorVar: "var(--amber)", vs: "TECHVEDA", reason: "Phonetically similar with deliberate misspelling. Same class. Pattern of copycat filing detected." },
  { name: "ZENSPA INDIA", app: "5901234", cls: "44", filed: "22 Feb 2026", risk: 65, colorVar: "var(--sky)", vs: "ZENSPA", reason: "Includes exact mark with geographic suffix. Moderate risk — suffix may not confer distinctiveness." },
]

export default function Monitoring() {
  return (
    <>
      <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 13, color: "var(--text3)" }}>AI-powered conflict detection across IP India database</div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="topbar-btn btn-ghost">Configure Watch</button>
          <button className="topbar-btn btn-primary">Run Scan Now</button>
        </div>
      </div>

      <div className="alert-banner">
        <div className="ab-icon">🚨</div>
        <div className="ab-text">
          <div className="ab-title">3 New Conflicts Detected in Latest Scan — 12 Mar 2026</div>
          <div className="ab-sub">AI similarity score above 80% threshold. Immediate review recommended.</div>
        </div>
      </div>

      {monitorData.map((m) => (
        <div key={m.app} className="monitor-card">
          <div className="monitor-icon" style={{ background: "rgba(244,63,94,.1)", fontSize: 22 }}>⚠️</div>
          <div className="monitor-body">
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div className="monitor-title">
                  {m.name} <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text3)" }}>conflicts with your</span> {m.vs}
                </div>
                <div className="monitor-sub">{m.reason}</div>
              </div>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: 24, fontWeight: 600, color: m.colorVar }}>{m.risk}%</div>
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
              <button className="mact-btn mact-oppose" style={{ background: "rgba(245,158,11,.1)", color: "var(--amber)" }}>📨 Send Cease & Desist</button>
              <button className="mact-btn mact-watch">👁 Watch</button>
              <button className="mact-btn mact-dismiss">✕ Dismiss</button>
            </div>
          </div>
        </div>
      ))}
    </>
  )
}
