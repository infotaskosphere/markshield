import React, { useState } from "react"
import { useNavigate } from "react-router-dom"

export default function Pending() {
  const navigate = useNavigate()
  const [items, setItems] = useState([])

  return (
    <>
      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ fontSize: 13, color: "var(--text3)" }}>
          Trademark applications with pending examination reports or opposition replies
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="topbar-btn btn-ghost" onClick={() => navigate("/scraper")}>🔄 Sync from IP India</button>
          <button className="topbar-btn btn-primary" onClick={() => navigate("/draft")}>✍ Draft Reply</button>
        </div>
      </div>

      <div className="card">
        {items.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📬</div>
            <div style={{ fontSize: 17, fontWeight: 700 }}>No pending replies</div>
            <div style={{ fontSize: 13, color: "var(--text3)", maxWidth: 380, lineHeight: 1.6 }}>
              Use the Data Scraper → Queue List tab to fetch your TLA queue from IP India eFiling portal.
              Pending examination reports and opposition replies will appear here.
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8, flexWrap: "wrap", justifyContent: "center" }}>
              <button className="topbar-btn btn-primary" onClick={() => navigate("/scraper")}>Open Data Scraper</button>
              <button className="topbar-btn btn-ghost" onClick={() => navigate("/draft")}>Draft a Reply Manually</button>
            </div>
          </div>
        ) : (
          <>
            <div className="card-head">
              <h3>Pending Replies ({items.length})</h3>
              <div style={{ display: "flex", gap: 8 }}>
                {items.filter(i => i.urgency === "overdue").length > 0 && (
                  <span className="chip chip-refused">⏰ {items.filter(i => i.urgency === "overdue").length} Overdue</span>
                )}
              </div>
            </div>
            <div className="card-body">
              <table className="tbl">
                <thead>
                  <tr><th>App No.</th><th>Mark</th><th>Class</th><th>Action Type</th><th>Agent</th><th>Office</th><th>Reply Status</th><th>Days Left</th><th></th></tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={idx}>
                      <td className="mono">
                        <a href={`https://tmrsearch.ipindia.gov.in/eregister/Application_View_Trademark.aspx?AppNosValue=${i.app_no}`}
                          target="_blank" rel="noreferrer" style={{ color: "#f0c842", textDecoration: "none" }}>
                          {i.app_no} ↗
                        </a>
                      </td>
                      <td style={{ fontWeight: 600 }}>{i.tm_name || "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--text3)" }}>{i.tm_class || "—"}</td>
                      <td style={{ fontSize: 12 }}>{i.action_type || "—"}</td>
                      <td style={{ fontSize: 11 }}>{i.agent || "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--text3)" }}>{i.office || "—"}</td>
                      <td><span className="chip chip-pending">{i.reply_status || "Pending"}</span></td>
                      <td style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                        {i.days_left != null ? (
                          <span style={{ color: i.days_left < 0 ? "var(--rose)" : i.days_left <= 7 ? "var(--amber)" : "var(--teal)", fontWeight: i.days_left <= 7 ? 700 : 400 }}>
                            {i.days_left < 0 ? `${Math.abs(i.days_left)}d overdue` : `${i.days_left}d left`}
                          </span>
                        ) : "—"}
                      </td>
                      <td>
                        <button className="topbar-btn btn-primary" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => navigate("/draft")}>
                          Draft →
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
