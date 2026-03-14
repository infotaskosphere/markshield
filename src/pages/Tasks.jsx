import React, { useState } from "react"
import Modal from "../components/Modal"

const initialTasks = {
  todo: [
    { id: 1, name: "Prepare reply for FRESHMART FER", prio: "high", due: "15 Mar 2026", init: "RS" },
    { id: 2, name: "File opposition against FRESHKART", prio: "high", due: "20 Mar 2026", init: "RS" },
    { id: 3, name: "Renew ROYALEE trademark", prio: "medium", due: "28 Mar 2026", init: "KP" },
    { id: 4, name: "Review Class 42 filing for CLOUDPATH", prio: "low", due: "10 Apr 2026", init: "RS" },
  ],
  inprog: [
    { id: 5, name: "Draft cease & desist for TECHVEDHA", prio: "high", due: "18 Mar 2026", init: "RS" },
    { id: 6, name: "Collect evidence for ZENSPA hearing", prio: "medium", due: "22 Mar 2026", init: "AM" },
  ],
  done: [
    { id: 7, name: "Filed INDIGO NEST application", prio: "medium", due: "01 Feb 2026", init: "RS" },
    { id: 8, name: "Submitted documents for GREENBITE", prio: "low", due: "10 Jan 2026", init: "KP" },
  ],
}

export default function Tasks() {
  const [tasks, setTasks] = useState(initialTasks)
  const [modalOpen, setModalOpen] = useState(false)
  const [newTask, setNewTask] = useState({ name: "", prio: "High", due: "", tm: "FRESHMART" })

  const createTask = () => {
    if (!newTask.name.trim()) return
    const task = { id: Date.now(), name: newTask.name, prio: newTask.prio.toLowerCase(), due: newTask.due, init: "RS" }
    setTasks((t) => ({ ...t, todo: [task, ...t.todo] }))
    setModalOpen(false)
    setNewTask({ name: "", prio: "High", due: "", tm: "FRESHMART" })
  }

  const cols = [
    { key: "todo", label: "📋 To Do" },
    { key: "inprog", label: "⚡ In Progress" },
    { key: "done", label: "✅ Done" },
  ]

  return (
    <>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16, gap: 10 }}>
        <button className="topbar-btn btn-ghost">Filter</button>
        <button className="topbar-btn btn-primary" onClick={() => setModalOpen(true)}>+ New Task</button>
      </div>

      <div className="task-cols">
        {cols.map((col) => (
          <div key={col.key} className="task-col">
            <div className="task-col-head">
              {col.label}
              <span className="task-col-count">{tasks[col.key].length}</span>
            </div>
            {tasks[col.key].map((t) => (
              <div key={t.id} className="task-item">
                <div className="task-name">{t.name}</div>
                <div className="task-meta">
                  <span className={`task-prio ${t.prio}`}>{t.prio}</span>
                  <span className="task-due">📅 {t.due}</span>
                  <div className="task-assignee">{t.init}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="New Task" sub="Create a trademark-related task">
        <div className="mf"><label>Task Title</label><input type="text" placeholder="e.g. Prepare reply for FRESHMART objection" value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} /></div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div className="mf">
            <label>Priority</label>
            <select value={newTask.prio} onChange={(e) => setNewTask({ ...newTask, prio: e.target.value })}>
              <option>High</option><option>Medium</option><option>Low</option>
            </select>
          </div>
          <div className="mf"><label>Due Date</label><input type="date" value={newTask.due} onChange={(e) => setNewTask({ ...newTask, due: e.target.value })} /></div>
        </div>
        <div className="mf">
          <label>Related Trademark</label>
          <select value={newTask.tm} onChange={(e) => setNewTask({ ...newTask, tm: e.target.value })}>
            <option>FRESHMART</option><option>TECHVEDA</option><option>ZENSPA</option><option>None</option>
          </select>
        </div>
        <div className="modal-btns">
          <button className="topbar-btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
          <button className="topbar-btn btn-primary" onClick={createTask}>Create Task</button>
        </div>
      </Modal>
    </>
  )
}
