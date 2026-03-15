import React, { useState } from "react"
import EStatusSetup from "../components/EStatusSetup"
import EFilingLogin from "../components/EFilingLogin"

export default function Settings({ context }) {
  const [tab, setTab] = useState("efiling")

  return (
    <div>
      <div style={{ fontSize:17, fontWeight:800, marginBottom:20 }}>⚙️ Settings</div>
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {[
          ["efiling",  "🏛 eFiling Login"],
          ["estatus",  "🔐 eStatus OTP"],
          ["account",  "👤 Account"],
        ].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`topbar-btn ${tab===t ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize:13 }}>{l}</button>
        ))}
      </div>

      {tab === "efiling" && (
        <div>
          <div style={{ background:"rgba(0,196,160,.07)", border:"1px solid rgba(0,196,160,.15)",
            borderRadius:10, padding:"12px 18px", marginBottom:16, fontSize:12.5 }}>
            <b style={{ color:"var(--teal)" }}>⭐ Recommended:</b>
            <span style={{ color:"var(--text3)", marginLeft:6 }}>
              eFiling login fetches your <b style={{ color:"var(--text)" }}>complete portfolio</b> directly
              from your IP India account — all applications you've ever filed with full details.
            </span>
          </div>
          <EFilingLogin context={context} />
        </div>
      )}

      {tab === "estatus" && (
        <div>
          <div style={{ background:"rgba(240,200,66,.07)", border:"1px solid rgba(240,200,66,.15)",
            borderRadius:10, padding:"12px 18px", marginBottom:16, fontSize:12.5 }}>
            <b style={{ color:"#f0c842" }}>Alternative:</b>
            <span style={{ color:"var(--text3)", marginLeft:6 }}>
              eStatus uses OTP verification to fetch individual application status.
              Use this if eFiling login doesn't work.
            </span>
          </div>
          <EStatusSetup context={context} />
        </div>
      )}

      {tab === "account" && (
        <div style={{ background:"var(--s1)", border:"1px solid var(--border)",
          borderRadius:14, padding:24 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Account Info</div>
          {[
            ["Name",     context?.agentProfile?.fullName || context?.currentUser?.name || "—"],
            ["Email",    context?.agentProfile?.email    || context?.currentUser?.email || "—"],
            ["Mobile",   context?.agentProfile?.mobile   || "—"],
            ["TMA Code", context?.tmaData?.tmaCode       || context?.tmaData?.username  || "—"],
            ["Firm",     context?.agentProfile?.firmName || "—"],
          ].map(([l,v]) => (
            <div key={l} style={{ display:"flex", gap:16, marginBottom:12,
              paddingBottom:12, borderBottom:"1px solid var(--border)" }}>
              <div style={{ width:100, fontSize:12, color:"var(--text3)", flexShrink:0 }}>{l}</div>
              <div style={{ fontSize:13, fontWeight:600 }}>{v}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
