import React, { useState } from "react"

const hearingDates = { 15: "teal", 17: "amber", 19: "rose", 24: "amber", 5: "violet" }
const hearingLabels = { 15: "Renewal: ROYALEE", 17: "FRESHMART Hearing", 19: "TECHVEDA Hearing", 24: "ZENSPA Hearing", 5: "CLOUDPATH Hearing" }

const upcomingItems = [
  { day: "17", month: "MAR", title: "FRESHMART Hearing", sub: "Dy. Registrar — Mumbai • 10:30 AM" },
  { day: "19", month: "MAR", title: "TECHVEDA Reply Deadline", sub: "FER Response due — online submission" },
  { day: "24", month: "MAR", title: "ZENSPA Hearing", sub: "Dy. Registrar — Ahmedabad • 2:00 PM" },
  { day: "01", month: "APR", title: "INDIGO NEST Status Update", sub: "Expected exam report response" },
  { day: "05", month: "APR", title: "CLOUDPATH Hearing", sub: "Video conference hearing scheduled" },
]

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

export default function CalendarPage() {
  const [year, setYear] = useState(2026)
  const [month, setMonth] = useState(2) // March

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear(y => y - 1) } else setMonth(m => m - 1) }
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear(y => y + 1) } else setMonth(m => m + 1) }

  const firstDay = new Date(year, month, 1).getDay()
  const totalDays = new Date(year, month + 1, 0).getDate()

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 18 }}>
      <div>
        <div className="card">
          <div className="card-head">
            <div className="cal-month-nav" style={{ width: "100%" }}>
              <button className="cal-month-btn" onClick={prevMonth}>‹</button>
              <div className="cal-month-title">{MONTHS[month]} {year}</div>
              <button className="cal-month-btn" onClick={nextMonth}>›</button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 16 }}>
            <div className="cal-grid">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                <div key={d} className="cal-day-name">{d}</div>
              ))}
            </div>
            <div className="cal-grid" style={{ marginTop: 0 }}>
              {Array(firstDay).fill(null).map((_, i) => <div key={"e" + i} />)}
              {Array.from({ length: totalDays }, (_, i) => i + 1).map((d) => {
                const isToday = d === 13 && month === 2 && year === 2026
                const ev = hearingDates[d]
                return (
                  <div
                    key={d}
                    className={`cal-day${isToday ? " today" : ""}${ev ? " has-event" : ""}`}
                    onClick={() => ev && alert("📅 " + hearingLabels[d])}
                  >
                    <div className="day-num">{d}</div>
                    {ev && (
                      <div className={`cal-event-dot${ev === "teal" ? " teal" : ev === "rose" ? " rose" : ev === "violet" ? " violet" : ""}`}>
                        {hearingLabels[d]}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="sec-head"><div className="sec-title">Upcoming Deadlines</div></div>
        <div className="upcoming-list">
          {upcomingItems.map((i) => (
            <div key={i.title} className="upcoming-item">
              <div className="upcoming-date">
                <div className="ud-day">{i.day}</div>
                <div className="ud-month">{i.month}</div>
              </div>
              <div className="upcoming-body">
                <div className="ub-title">{i.title}</div>
                <div className="ub-sub">{i.sub}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}>
          <button className="topbar-btn btn-primary" style={{ width: "100%", justifyContent: "center" }}>
            + Add Custom Reminder
          </button>
        </div>
      </div>
    </div>
  )
}
