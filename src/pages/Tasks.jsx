import React, { useState } from "react"

const COLS = ["To Do", "In Progress", "Done"]

export default function Tasks() {
  const [tasks, setTasks] = useState([])
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: "", col: "To Do", prio: "medium", due: "", assignee: "" })

  const addTask = () => {
    if (!form.name.trim()) return
    setTasks(prev => [...prev, { ...form, id: Date.now() }])
    setForm({ name: "", col: "To Do", prio: "medium", due: "", assignee: "" })
    setShowAdd(false)
  }

  const moveTask = (id, col) => setTasks(prev => prev.map(t => t.id === id ? { ...t, col } : t))
  const removeTask = (id) => setTasks(prev => prev.filter(t => t.id !== id))

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button className="topbar-btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Task</button>
      </div>

      <div className="task-cols">
        {COLS.map(col => {
          const colTasks = tasks.filter(t => t.col === col)
          return (
            <div key={col} className="task-col">
              <div className="task-col-head">
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: col === "To Do" ? "var(--sky)" : col === "In Progress" ? "var(--amber)" : "var(--teal)", display: "inline-block" }} />
                  {col}
                </span>
                <span className="task-col-count">{colTasks.length}</span>
              </div>

              {colTasks.length === 0 ? (
                <div style={{ padding: "20px 10px", textAlign: "center", color: "var(--text3)", fontSize: 12 }}>
                  No tasks yet
                </div>
              ) : (
                colTasks.map(t => (
                  <div key={t.id} className="task-item">
                    <div className="task-name">{t.name}</div>
                    <div className="task-meta">
                      <span className={`task-prio ${t.prio}`}>{t.prio}</span>
                      {t.due && <span className="task-due">{t.due}</span>}
                      {t.assignee && (
                        <div className="task-assignee">{t.assignee.slice(0,2).toUpperCase()}</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                      {COLS.filter(c => c !== col).map(c => (
                        <button key={c} onClick={() => moveTask(t.id, c)}
                          style={{ fontSize: 10, padding: "2px 8px", borderRadius: 6, background: "var(--s3)", border: "1px solid var(--border)", cursor: "pointer", color: "var(--text3)", fontFamily: "var(--head)" }}>
                          → {c}
                        </button>
                      ))}
                      <button onClick={() => removeTask(t.id)}
                        style={{ fontSize: 10, padding: "2px 6px", borderRadius: 6, background: "none", border: "none", cursor: "pointer", color: "var(--text3)", marginLeft: "auto" }}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))
              )}

              <button
                onClick={() => { setForm(p => ({...p, col})); setShowAdd(true) }}
                style={{ width: "100%", background: "none", border: "1px dashed var(--border)", borderRadius: 8, padding: "8px", cursor: "pointer", color: "var(--text3)", fontSize: 12, fontFamily: "var(--head)", marginTop: 8, transition: "border-color .18s" }}
                onMouseOver={e => e.currentTarget.style.borderColor = "var(--accent)"}
                onMouseOut={e => e.currentTarget.style.borderColor = "var(--border)"}
              >
                + Add task
              </button>
            </div>
          )
        })}
      </div>

      {showAdd && (
        <div className="overlay open" onClick={e => e.target.classList.contains("overlay") && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">New Task</div>
            <div className="modal-sub">Add a task to your trademark workflow.</div>
            <div className="mf">
              <label>Task Name *</label>
              <input placeholder="e.g. File reply for TECHVEDA objection" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))} autoFocus />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="mf">
                <label>Column</label>
                <select value={form.col} onChange={e => setForm(p => ({...p, col: e.target.value}))}>
                  {COLS.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className="mf">
                <label>Priority</label>
                <select value={form.prio} onChange={e => setForm(p => ({...p, prio: e.target.value}))}>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
            <div className="mf">
              <label>Due Date</label>
              <input type="date" value={form.due} onChange={e => setForm(p => ({...p, due: e.target.value}))} />
            </div>
            <div className="mf">
              <label>Assignee</label>
              <input placeholder="Name or initials" value={form.assignee} onChange={e => setForm(p => ({...p, assignee: e.target.value}))} />
            </div>
            <div className="modal-btns">
              <button className="topbar-btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="topbar-btn btn-primary" onClick={addTask}>Add Task</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
