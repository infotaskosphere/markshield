import React from "react"
import { useNavigate } from "react-router-dom"

const portfolioData = [
  { name: "FRESHMART", app: "5847291", cls: "29, 30", filed: "12 Aug 2024", status: "hearing", next: "17 Mar 2026", owner: "Raj Foods Pvt" },
  { name: "TECHVEDA", app: "5821043", cls: "9, 42", filed: "05 Jun 2024", status: "objected", next: "19 Mar 2026", owner: "Veda Tech" },
  { name: "ZENSPA", app: "5798432", cls: "44", filed: "18 Apr 2024", status: "hearing", next: "24 Mar 2026", owner: "Zen Wellness" },
  { name: "INDIGO NEST", app: "5765210", cls: "43", filed: "02 Feb 2024", status: "pending", next: "01 Apr 2026", owner: "Indigo Hospitality" },
  { name: "CLOUDPATH", app: "5741889", cls: "38, 42", filed: "15 Dec 2023", status: "hearing", next: "05 Apr 2026", owner: "CloudPath Inc" },
  { name: "ROYALEE", app: "5698431", cls: "25, 35", filed: "30 Oct 2023", status: "registered", next: "Renewal: 2033", owner: "Royalee Fashion" },
  { name: "GREENBITE", app: "5672109", cls: "29", filed: "14 Sep 2023", status: "registered", next: "Renewal: 2033", owner: "GreenBite Foods" },
  { name: "NEXLEARN", app: "5643278", cls: "41", filed: "28 Jul 2023", status: "registered", next: "Renewal: 2033", owner: "NexLearn Edu" },
  { name: "PETPAL", app: "5612098", cls: "31, 44", filed: "10 Jun 2023", status: "registered", next: "Renewal: 2033", owner: "PetPal Pvt" },
  { name: "URBNFIT", app: "5589341", cls: "25, 28", filed: "05 Apr 2023", status: "refused", next: "File appeal by Apr 2026", owner: "UrbanFit Co" },
]

const chipMap = { hearing: "chip-hearing", objected: "chip-objected", pending: "chip-pending", registered: "chip-registered", refused: "chip-refused" }
const statusLabel = { hearing: "Hearing", objected: "Objected", pending: "Pending", registered: "Registered", refused: "Refused" }

export default function Portfolio() {
  const navigate = useNavigate()

  return (
    <>
      <div className="portfolio-filters">
        <input className="filter-input" placeholder="Search by name, class, app number..." />
        <select className="filter-select"><option>All Classes</option><option>Class 9</option><option>Class 25</option><option>Class 35</option><option>Class 42</option></select>
        <select className="filter-select"><option>All Status</option><option>Registered</option><option>Pending</option><option>Hearing</option><option>Objected</option></select>
        <select className="filter-select"><option>All Clients</option><option>Own</option><option>Client A</option><option>Client B</option></select>
        <button className="topbar-btn btn-ghost" style={{ marginLeft: "auto" }}>⬇ Export</button>
      </div>
      <div className="card">
        <div className="card-head"><h3>All Trademarks ({portfolioData.length})</h3></div>
        <div className="card-body">
          <table className="tbl">
            <thead>
              <tr><th>Mark</th><th>Application No.</th><th>Class</th><th>Filed On</th><th>Status</th><th>Next Action</th><th>Owner</th><th></th></tr>
            </thead>
            <tbody>
              {portfolioData.map((r) => (
                <tr key={r.app}>
                  <td><b>{r.name}</b></td>
                  <td className="mono">{r.app}</td>
                  <td><span style={{ fontSize: 12, color: "var(--text3)" }}>Class {r.cls}</span></td>
                  <td className="mono">{r.filed}</td>
                  <td><span className={`chip ${chipMap[r.status]}`}>{statusLabel[r.status]}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{r.next}</td>
                  <td style={{ fontSize: 12, color: "var(--text3)" }}>{r.owner}</td>
                  <td>
                    <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => navigate("/ai")}>⋮</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
