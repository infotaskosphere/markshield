import React, { useState } from "react"
import EStatusSetup from "../components/EStatusSetup"

export default function Settings({ context }) {
  const [tab, setTab] = useState("estatus")

  return (
    <div>
      <div style={{ fontSize:17, fontWeight:800, marginBottom:20 }}>⚙️ Settings</div>
      <div style={{ display:"flex", gap:8, marginBottom:20 }}>
        {[["estatus","🔐 eStatus / IP India"],["account","👤 Account"]].map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`topbar-btn ${tab===t ? "btn-primary" : "btn-ghost"}`}
            style={{ fontSize:13 }}>{l}</button>
        ))}
      </div>
      {tab === "estatus" && <EStatusSetup context={context} />}
      {tab === "account" && (
        <div style={{ background:"var(--s1)", border:"1px solid var(--border)",
          borderRadius:14, padding:24 }}>
          <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Account Info</div>
          {[
            ["Name",  context?.agentProfile?.fullName || context?.currentUser?.name || "—"],
            ["Email", context?.agentProfile?.email    || context?.currentUser?.email || "—"],
            ["Mobile",context?.agentProfile?.mobile   || "—"],
            ["TMA Code", context?.tmaData?.tmaCode    || context?.tmaData?.username  || "—"],
            ["Firm",  context?.agentProfile?.firmName || "—"],
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
