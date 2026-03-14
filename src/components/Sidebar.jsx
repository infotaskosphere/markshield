import React from "react"

export default function StatCard({ accent, iconBg, iconColor, icon, label, value, delta, deltaUp, deltaDown }) {
  return (
    <div className="stat-card">
      <div className="stat-accent" style={{ background: accent }}></div>
      <div className="stat-icon" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-delta">
        {deltaUp && <span className="up">{deltaUp}</span>}
        {deltaDown && <span className="dn">{deltaDown}</span>}
        {delta}
      </div>
    </div>
  )
}
