import React, { useState } from "react"
import Modal from "../components/Modal"

const ROLE_LABELS = { attorney: "⚖️ Attorney", paralegal: "📋 Paralegal", clerk: "📁 Clerk", intern: "🎓 Intern" }
const ROLE_COLORS = { attorney: "chip-objected", paralegal: "chip-hearing", clerk: "chip-pending", intern: "chip-registered" }
const ACCESS_LABELS = { full: "Full Access", view_tasks: "View + Tasks", view: "View Only" }
const ACCESS_COLORS = { full: "#00d4aa", view_tasks: "#f59e0b", view: "#94a3c8" }

const initialTeam = [
  { id: 1, name: "Priya Shah", role: "paralegal", email: "priya@firm.com", mobile: "+91 98001 23456", barNo: "", access: "view_tasks", status: "active", joined: "01 Jan 2026" },
  { id: 2, name: "Arjun Mehta", role: "clerk", email: "arjun@firm.com", mobile: "+91 97002 34567", barNo: "", access: "view", status: "active", joined: "15 Feb 2026" },
  { id: 3, name: "Kavya Desai", role: "attorney", email: "kavya@firm.com", mobile: "+91 96003 45678", barNo: "GJ/4421/2018", access: "full", status: "active", joined: "01 Mar 2026" },
]

export default function Team({ context }) {
  const [team, setTeam] = useState(initialTeam)
  const [addOpen, setAddOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editIdx, setEditIdx] = useState(null)
  const [form, setForm] = useState({ name: "", role: "attorney", email: "", mobile: "", barNo: "", access: "full" })

  const agentProfile = context?.agentProfile || {}
  const agentName = agentProfile.fullName || context?.currentUser?.name || "TM Agent"
  const agentFirm = agentProfile.firmName || agentName
  const agentEmail = agentProfile.email || ""

  const openAdd = () => { setForm({ name: "", role: "attorney", email: "", mobile: "", barNo: "", access: "full" }); setAddOpen(true) }
  const openEdit = (i) => { setEditIdx(i); setForm({ ...team[i] }); setEditOpen(true) }

  const addMember = () => {
    if (!form.name || !form.email) return
    const member = { id: Date.now(), ...form, status: "pending", joined: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) }
    setTeam((t) => [...t, member])
    setAddOpen(false)
    const subject = encodeURIComponent(`You are invited to join ${agentFirm} on MarkShield`)
    const body = encodeURIComponent(`Dear ${form.name},\n\nYou have been invited by ${agentName} to join MarkShield.\n\nRole: ${ROLE_LABELS[form.role]}\nAccess: ${ACCESS_LABELS[form.access]}\n\nWarm regards,\n${agentName}`)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(form.email)}&su=${subject}&body=${body}`, "_blank")
  }

  const saveMember = () => {
    setTeam((t) => t.map((m, i) => i === editIdx ? { ...m, ...form } : m))
    setEditOpen(false)
  }

  const removeMember = () => {
    if (!window.confirm(`Remove ${team[editIdx]?.name}?`)) return
    setTeam((t) => t.filter((_, i) => i !== editIdx))
    setEditOpen(false)
  }

  const sendEmail = (m) => {
    const subject = encodeURIComponent(`Update from MarkShield — ${agentName}`)
    const body = encodeURIComponent(`Dear ${m.name},\n\n[Add your message here]\n\nWarm regards,\n${agentName}`)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.email)}&su=${subject}&body=${body}`, "_blank")
  }

  const pending = team.filter((m) => m.status === "pending")

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
        <div style={{ fontSize: 13, color: "var(--text3)" }}>Add attorneys, clerks and paralegals who can track trademark records.</div>
        <button className="topbar-btn btn-primary" onClick={openAdd}>+ Add Team Member</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, background: "rgba(37,99,255,.12)", color: "#7aa3ff", border: "1px solid rgba(37,99,255,.25)" }}>⚖️ Attorney — Full Access</span>
        <span style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, background: "rgba(0,212,170,.1)", color: "var(--teal)", border: "1px solid rgba(0,212,170,.2)" }}>📋 Paralegal — View + Tasks</span>
        <span style={{ fontSize: 12, padding: "5px 12px", borderRadius: 20, background: "rgba(245,158,11,.1)", color: "var(--amber)", border: "1px solid rgba(245,158,11,.2)" }}>📁 Clerk — View Only</span>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>👥 Team Members</h3>
          <span className="sec-link">{team.length} member{team.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="card-body">
          <table className="tbl">
            <thead><tr><th>Member</th><th>Role</th><th>Email</th><th>Mobile</th><th>Access</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {team.map((m, i) => (
                <tr key={m.id}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 34, height: 34, borderRadius: "50%", background: "linear-gradient(135deg,#2563ff,#00d4aa)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                        {m.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                        <div style={{ fontSize: 11, color: "var(--text3)" }}>{m.barNo || "No bar no."}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className={`chip ${ROLE_COLORS[m.role] || "chip-pending"}`} style={{ fontSize: 11 }}>{ROLE_LABELS[m.role] || m.role}</span></td>
                  <td style={{ fontSize: 12, color: "var(--text2)" }}>{m.email}</td>
                  <td style={{ fontSize: 12, color: "var(--text3)" }}>{m.mobile || "—"}</td>
                  <td><span style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, background: "rgba(0,0,0,.2)", border: "1px solid var(--border)", color: ACCESS_COLORS[m.access] }}>{ACCESS_LABELS[m.access]}</span></td>
                  <td><span className="chip chip-registered" style={{ fontSize: 11 }}>{m.status === "active" ? "✅ Active" : "⏳ Pending"}</span></td>
                  <td>
                    <div style={{ display: "flex", gap: 5 }}>
                      <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => openEdit(i)}>✏️ Edit</button>
                      <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 10px" }} onClick={() => sendEmail(m)}>📧</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {pending.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><h3>📨 Pending Invitations</h3></div>
          <div className="card-body">
            {pending.map((m) => (
              <div key={m.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderBottom: "1px solid var(--border)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "rgba(245,158,11,.15)", border: "1.5px dashed var(--amber)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>⏳</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{m.email} · {ROLE_LABELS[m.role]}</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--amber)" }}>Invite sent</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Modal */}
      <Modal isOpen={addOpen} onClose={() => setAddOpen(false)} title="👥 Add Team Member" sub="Invite a colleague to access MarkShield." style={{ maxWidth: 500 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="mf"><label>Full Name *</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Priya Mehta" /></div>
          <div className="mf"><label>Role *</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="mf"><label>Email *</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="colleague@firm.com" /></div>
          <div className="mf"><label>Mobile</label><input type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} placeholder="+91 98765 43210" /></div>
        </div>
        <div className="mf"><label>Bar / Enrolment No.</label><input type="text" value={form.barNo} onChange={(e) => setForm({ ...form, barNo: e.target.value })} placeholder="e.g. GJ/1234/2015" style={{ fontFamily: "var(--mono)" }} /></div>
        <div className="mf"><label>Access Level</label><select value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value })}>{Object.entries(ACCESS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div style={{ background: "rgba(37,99,255,.07)", border: "1px solid rgba(37,99,255,.2)", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#7aa3ff", marginBottom: 14 }}>
          📧 An invitation email will be sent to the team member.
        </div>
        <div className="modal-btns">
          <button className="topbar-btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
          <button className="topbar-btn btn-primary" onClick={addMember}>📨 Send Invite</button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="✏️ Edit Team Member" sub="Update role, access level or contact info." style={{ maxWidth: 480 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="mf"><label>Full Name</label><input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="mf"><label>Role</label><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>{Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        </div>
        <div className="mf"><label>Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div className="mf"><label>Mobile</label><input type="tel" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></div>
        <div className="mf"><label>Access Level</label><select value={form.access} onChange={(e) => setForm({ ...form, access: e.target.value })}>{Object.entries(ACCESS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
        <div className="modal-btns">
          <button className="topbar-btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
          <button className="topbar-btn" style={{ background: "rgba(244,63,94,.15)", color: "var(--rose)", border: "1px solid rgba(244,63,94,.3)", borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer" }} onClick={removeMember}>🗑 Remove</button>
          <button className="topbar-btn btn-primary" onClick={saveMember}>💾 Save Changes</button>
        </div>
      </Modal>
    </>
  )
}
