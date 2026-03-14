import React, { useState, useEffect } from "react"

const ROLE_LABELS  = { attorney: "⚖️ Attorney", paralegal: "📋 Paralegal", clerk: "📁 Clerk", intern: "🎓 Intern" }
const ACCESS_LABELS = { full: "Full Access", view_tasks: "View + Tasks", view: "View Only" }
const LS_KEY = "ms_team"

export default function Team({ context }) {
  const [team,     setTeam]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") } catch { return [] }
  })
  const [addOpen,  setAddOpen]  = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editIdx,  setEditIdx]  = useState(null)
  const [form,     setForm]     = useState({ name: "", role: "attorney", email: "", mobile: "", barNo: "", access: "full" })

  const agentName = context?.agentProfile?.fullName || context?.currentUser?.name || "Team Admin"
  const agentFirm = context?.agentProfile?.firmName || agentName

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(team)) } catch {}
  }, [team])

  const openAdd  = () => { setForm({ name: "", role: "attorney", email: "", mobile: "", barNo: "", access: "full" }); setAddOpen(true) }
  const openEdit = (i) => { setEditIdx(i); setForm({ ...team[i] }); setEditOpen(true) }

  const addMember = () => {
    if (!form.name || !form.email) return
    setTeam(t => [...t, { id: Date.now(), ...form, status: "pending", joined: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) }])
    setAddOpen(false)
    const sub  = encodeURIComponent(`You are invited to join ${agentFirm} on MarkShield`)
    const body = encodeURIComponent(`Dear ${form.name},\n\nYou have been invited by ${agentName} to join MarkShield.\n\nRole: ${ROLE_LABELS[form.role]}\nAccess: ${ACCESS_LABELS[form.access]}\n\nWarm regards,\n${agentName}`)
    window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(form.email)}&su=${sub}&body=${body}`, "_blank")
  }

  const saveMember   = () => { setTeam(t => t.map((m, i) => i === editIdx ? { ...m, ...form } : m)); setEditOpen(false) }
  const removeMember = () => { if (!window.confirm(`Remove ${team[editIdx]?.name}?`)) return; setTeam(t => t.filter((_, i) => i !== editIdx)); setEditOpen(false) }

  const chipStyle  = { attorney: { bg: "rgba(37,99,255,.12)", color: "#7aa3ff" }, paralegal: { bg: "rgba(0,196,160,.1)", color: "var(--teal)" }, clerk: { bg: "rgba(201,146,10,.12)", color: "#f0c842" }, intern: { bg: "rgba(139,92,246,.1)", color: "var(--violet)" } }
  const accessColor = { full: "var(--teal)", view_tasks: "#f0c842", view: "var(--text3)" }

  const FormFields = () => (
    <>
      <div className="mf"><label>Full Name *</label><input placeholder="Advocate Name" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} autoFocus /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="mf"><label>Role</label>
          <select value={form.role} onChange={e => setForm(p => ({...p, role: e.target.value}))}>
            <option value="attorney">⚖️ Attorney</option>
            <option value="paralegal">📋 Paralegal</option>
            <option value="clerk">📁 Clerk</option>
            <option value="intern">🎓 Intern</option>
          </select>
        </div>
        <div className="mf"><label>Access Level</label>
          <select value={form.access} onChange={e => setForm(p => ({...p, access: e.target.value}))}>
            <option value="full">Full Access</option>
            <option value="view_tasks">View + Tasks</option>
            <option value="view">View Only</option>
          </select>
        </div>
      </div>
      <div className="mf"><label>Email *</label><input type="email" placeholder="attorney@firm.com" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))} /></div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div className="mf"><label>Mobile</label><input placeholder="+91 98000 00000" value={form.mobile} onChange={e => setForm(p => ({...p, mobile: e.target.value}))} /></div>
        <div className="mf"><label>Bar / TMA No.</label><input placeholder="GJ/1234/2020" value={form.barNo} onChange={e => setForm(p => ({...p, barNo: e.target.value}))} /></div>
      </div>
    </>
  )

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: "var(--text3)" }}>Invite attorneys, clerks and paralegals to collaborate on your portfolio.</div>
        <button className="topbar-btn btn-primary" onClick={openAdd}>+ Add Team Member</button>
      </div>

      <div className="card">
        <div className="card-head">
          <h3>👥 Team Members</h3>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>{team.length} member{team.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="card-body">
          {team.length === 0 ? (
            <div style={{ padding: "60px 40px", textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 40 }}>👥</div>
              <div style={{ fontSize: 17, fontWeight: 700 }}>No team members yet</div>
              <div style={{ fontSize: 13, color: "var(--text3)", maxWidth: 360, lineHeight: 1.6 }}>
                Invite your team — attorneys, paralegals, and clerks — to collaborate on your firm's trademark portfolio.
              </div>
              <button className="topbar-btn btn-primary" onClick={openAdd} style={{ marginTop: 4 }}>+ Invite First Member</button>
            </div>
          ) : (
            <table className="tbl">
              <thead><tr><th>Member</th><th>Role</th><th>Email</th><th>Mobile</th><th>Access</th><th>Status</th><th>Joined</th><th></th></tr></thead>
              <tbody>
                {team.map((m, i) => (
                  <tr key={m.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 30, height: 30, borderRadius: "50%", background: "linear-gradient(145deg,#c9920a,#7a5800)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, color: "#fff", flexShrink: 0 }}>
                          {m.name.split(" ").map(w => w[0]).join("").slice(0,2).toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{m.name}</div>
                          {m.barNo && <div style={{ fontSize: 10, color: "var(--text3)" }}>{m.barNo}</div>}
                        </div>
                      </div>
                    </td>
                    <td><span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: chipStyle[m.role]?.bg, color: chipStyle[m.role]?.color }}>{ROLE_LABELS[m.role]}</span></td>
                    <td style={{ fontSize: 12 }}>{m.email}</td>
                    <td style={{ fontSize: 12, color: "var(--text3)" }}>{m.mobile || "—"}</td>
                    <td style={{ fontSize: 12, color: accessColor[m.access] }}>{ACCESS_LABELS[m.access]}</td>
                    <td><span className={`chip ${m.status === "active" ? "chip-registered" : "chip-pending"}`}>{m.status === "active" ? "Active" : "Pending"}</span></td>
                    <td className="mono" style={{ fontSize: 11 }}>{m.joined}</td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => openEdit(i)}>Edit</button>
                        <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 9px" }}
                          onClick={() => { const s = encodeURIComponent(`Update from ${agentFirm}`); window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(m.email)}&su=${s}`, "_blank") }}>
                          ✉
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {addOpen && (
        <div className="overlay open" onClick={e => e.target.classList.contains("overlay") && setAddOpen(false)}>
          <div className="modal">
            <div className="modal-title">Add Team Member</div>
            <div className="modal-sub">They'll receive an email invitation.</div>
            <FormFields />
            <div className="modal-btns">
              <button className="topbar-btn btn-ghost" onClick={() => setAddOpen(false)}>Cancel</button>
              <button className="topbar-btn btn-primary" onClick={addMember}>Send Invite</button>
            </div>
          </div>
        </div>
      )}

      {editOpen && editIdx !== null && (
        <div className="overlay open" onClick={e => e.target.classList.contains("overlay") && setEditOpen(false)}>
          <div className="modal">
            <div className="modal-title">Edit Member</div>
            <div className="modal-sub">{team[editIdx]?.name}</div>
            <FormFields />
            <div className="modal-btns">
              <button className="topbar-btn btn-ghost" style={{ color: "var(--rose)" }} onClick={removeMember}>Remove</button>
              <button className="topbar-btn btn-ghost" onClick={() => setEditOpen(false)}>Cancel</button>
              <button className="topbar-btn btn-primary" onClick={saveMember}>Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
