import React, { useState, useEffect } from "react"

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"]
const DAYS   = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
const LS_KEY = "ms_calendar_events"

export default function CalendarPage({ context }) {
  const now = new Date()
  const [viewMonth, setViewMonth] = useState(now.getMonth())
  const [viewYear,  setViewYear]  = useState(now.getFullYear())

  const [events, setEvents] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]") } catch { return [] }
  })
  const [showAdd, setShowAdd] = useState(false)
  const [selDay,  setSelDay]  = useState(null)
  const [form,    setForm]    = useState({ title: "", type: "hearing", app: "" })

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(events)) } catch(_e) {}
  }, [events])

  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()

  const eventsForDay = (day) => events.filter(e => e.year === viewYear && e.month === viewMonth && e.day === day)

  const addEvent = () => {
    if (!form.title.trim()) return
    setEvents(prev => [...prev, { ...form, year: viewYear, month: viewMonth, day: selDay, id: Date.now() }])
    setForm({ title: "", type: "hearing", app: "" })
    setShowAdd(false)
  }

  const removeEvent = (id) => setEvents(prev => prev.filter(e => e.id !== id))

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y-1) } else setViewMonth(m => m-1) }
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0);  setViewYear(y => y+1) } else setViewMonth(m => m+1) }

  const upcoming = events
    .filter(e => new Date(e.year, e.month, e.day) >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .sort((a, b) => new Date(a.year, a.month, a.day) - new Date(b.year, b.month, b.day))
    .slice(0, 8)

  const typeColor = { hearing: "#f0c842", deadline: "var(--rose)", renewal: "var(--teal)", other: "var(--sky)" }

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
      <div className="card" style={{ margin: 0 }}>
        <div className="card-head">
          <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1 }}>
            <button className="cal-month-btn" onClick={prevMonth}>‹</button>
            <div className="cal-month-title">{MONTHS[viewMonth]} {viewYear}</div>
            <button className="cal-month-btn" onClick={nextMonth}>›</button>
          </div>
          <button className="topbar-btn btn-primary" style={{ fontSize: 12 }}
            onClick={() => { setSelDay(now.getDate()); setShowAdd(true) }}>
            + Add Event
          </button>
        </div>
        <div className="card-body" style={{ padding: "0 16px 16px" }}>
          <div className="cal-grid">
            {DAYS.map(d => <div key={d} className="cal-day-name">{d}</div>)}
            {Array.from({ length: firstDay }, (_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day       = i + 1
              const dayEvents = eventsForDay(day)
              const isToday   = viewYear === now.getFullYear() && viewMonth === now.getMonth() && day === now.getDate()
              return (
                <div key={day}
                  className={`cal-day${isToday ? " today" : ""}${dayEvents.length > 0 ? " has-event" : ""}`}
                  onClick={() => { setSelDay(day); setShowAdd(true) }}>
                  <div className="day-num">{day}</div>
                  {dayEvents.map(ev => (
                    <div key={ev.id}
                      className={`cal-event-dot${ev.type === "deadline" ? " rose" : ev.type === "renewal" ? " teal" : ""}`}
                      title={ev.title}>
                      {ev.title}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: "var(--text2)" }}>Upcoming Events</div>
        {upcoming.length === 0 ? (
          <div className="card" style={{ padding: 24, margin: 0, textAlign: "center" }}>
            <div style={{ fontSize: 28, marginBottom: 10 }}>📅</div>
            <div style={{ fontSize: 13, color: "var(--text3)" }}>Click any date to add hearings, deadlines or renewals.</div>
          </div>
        ) : (
          <div className="upcoming-list">
            {upcoming.map(ev => (
              <div key={ev.id} className="upcoming-item">
                <div className="upcoming-date">
                  <div className="ud-day">{String(ev.day).padStart(2,"0")}</div>
                  <div className="ud-month">{MONTHS[ev.month].slice(0,3)}</div>
                </div>
                <div className="upcoming-body">
                  <div className="ub-title">{ev.title}</div>
                  <div className="ub-sub" style={{ color: typeColor[ev.type] || "var(--text3)" }}>
                    {ev.type}{ev.app ? ` · ${ev.app}` : ""}
                  </div>
                </div>
                <button onClick={() => removeEvent(ev.id)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: 14 }}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <div className="overlay open" onClick={e => e.target.classList.contains("overlay") && setShowAdd(false)}>
          <div className="modal">
            <div className="modal-title">Add Event</div>
            <div className="modal-sub">{selDay && `${MONTHS[viewMonth]} ${selDay}, ${viewYear}`}</div>
            <div className="mf"><label>Event Title *</label>
              <input placeholder="e.g. Hearing — ZR LIGHTING" value={form.title} onChange={e => setForm(p => ({...p, title: e.target.value}))} autoFocus />
            </div>
            <div className="mf"><label>Type</label>
              <select value={form.type} onChange={e => setForm(p => ({...p, type: e.target.value}))}>
                <option value="hearing">Hearing</option>
                <option value="deadline">Deadline</option>
                <option value="renewal">Renewal</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="mf"><label>Application No. (optional)</label>
              <input placeholder="e.g. 5738719" value={form.app} onChange={e => setForm(p => ({...p, app: e.target.value}))} style={{ fontFamily: "var(--mono)" }} />
            </div>
            <div className="modal-btns">
              <button className="topbar-btn btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="topbar-btn btn-primary" onClick={addEvent}>Add Event</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
