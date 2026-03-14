import React, { useState } from "react"

const OBJECTION_PATTERNS = [
  { regex: /devoid|distinctiv|not capable/i, sec: "9(1)(a)", label: "Sec 9(1)(a) — Lack of Distinctiveness", cls: "sec9" },
  { regex: /descript|designat|kind|quality|geograph|origin/i, sec: "9(1)(b)", label: "Sec 9(1)(b) — Descriptive", cls: "sec9" },
  { regex: /customary|generic|common/i, sec: "9(1)(c)", label: "Sec 9(1)(c) — Generic/Customary", cls: "sec9" },
  { regex: /deceiv|confus|mislead/i, sec: "9(2)(a)", label: "Sec 9(2)(a) — Deceptive", cls: "sec9" },
  { regex: /similar.*mark|earlier mark|likelihood.*confus/i, sec: "11(1)", label: "Sec 11(1) — Similarity/Confusion", cls: "sec11" },
  { regex: /well.known|repute|dilut/i, sec: "11(2)", label: "Sec 11(2) — Well-Known TM", cls: "sec11" },
  { regex: /passing off|copyright/i, sec: "11(3)", label: "Sec 11(3) — Passing Off", cls: "sec11" },
]

const CASE_LAWS = [
  { title: "Amritdhara Pharmacy v. Satya Deo Gupta", citation: "AIR 1963 SC 449", section: "11(1)", summary: "SC held that for confusion, one must consider the mark as a whole (holistic comparison), keeping in mind a consumer of average intelligence and imperfect recollection." },
  { title: "Cadila Healthcare Ltd. v. Cadila Pharmaceuticals Ltd.", citation: "(2001) 5 SCC 73", section: "11(1)", summary: "SC laid down multi-factor test: nature of marks, degree of resemblance, nature of goods, class of purchasers, and other surrounding circumstances." },
  { title: "Parle Products Pvt. Ltd. v. J.P. & Co. Mysore", citation: "AIR 1972 SC 1359", section: "11(1)", summary: "SC held that marks need not be identical — if overall impression is similar and an unwary purchaser may be confused, infringement exists." },
  { title: "Corn Products Refining Co. v. Shangrila Food Products", citation: "AIR 1960 SC 142", section: "9(1)(b)", summary: "Descriptive words that have acquired secondary meaning through use can be registered. The burden of proving acquired distinctiveness lies on the applicant." },
  { title: "F. Hoffmann-La Roche & Co. v. Geoffrey Manners & Co.", citation: "AIR 1970 SC 2062", section: "9(1)(a)", summary: "A coined word can be inherently distinctive even if it consists of common elements, provided as a whole it distinguishes the applicant's goods." },
  { title: "Nandhini Deluxe v. Karnataka Co-op Milk Producers", citation: "Civil Appeal 2943/2018 (SC)", section: "11(1)", summary: "SC clarified that similarity must be assessed in totality. Dominant features carry more weight; distinguishing features can differentiate even phonetically similar marks." },
]

function detectObjTags(text) {
  return OBJECTION_PATTERNS.filter(p => p.regex.test(text))
}

function getCaseLaws(detected) {
  const secs = detected.map(d => d.sec)
  const relevant = CASE_LAWS.filter(c => secs.includes(c.section) || secs.length === 0)
  const landmarks = ["Amritdhara Pharmacy v. Satya Deo Gupta", "Cadila Healthcare Ltd. v. Cadila Pharmaceuticals Ltd."]
  CASE_LAWS.forEach(c => { if (landmarks.includes(c.title) && !relevant.find(r => r.title === c.title)) relevant.push(c) })
  return relevant.slice(0, 5)
}

async function streamDraft(prompt, onChunk, onDone, onError) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, stream: true, messages: [{ role: "user", content: prompt }] }),
    })
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let full = ""
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      for (const line of chunk.split("\n")) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === "content_block_delta" && data.delta?.text) {
              full += data.delta.text
              onChunk(full)
            }
          } catch (_) {}
        }
      }
    }
    onDone(full)
  } catch (e) { onError(e.message) }
}

function DraftPanel({ title, emptyIcon, emptyLabel }) {
  const [report, setReport] = useState("")
  const [appNo, setAppNo] = useState("")
  const [tmName, setTmName] = useState("")
  const [cls, setCls] = useState("")
  const [goods, setGoods] = useState("")
  const [applicant, setApplicant] = useState("")
  const [opponent, setOpponent] = useState("")
  const [oppMark, setOppMark] = useState("")
  const [evidence, setEvidence] = useState("")
  const [style, setStyle] = useState("formal")
  const [draft, setDraft] = useState("")
  const [streaming, setStreaming] = useState(false)
  const [streamText, setStreamText] = useState("")
  const [cases, setCases] = useState([])
  const isOpp = title.includes("Counter")

  const generate = async () => {
    if (!report && !tmName && !appNo) return
    const detected = detectObjTags(report)
    setCases(getCaseLaws(isOpp ? [{ sec: "11(1)" }] : detected))
    setStreaming(true)
    setStreamText("")
    setDraft("")

    const prompt = isOpp
      ? `You are an expert Indian Trademark Attorney drafting a formal Counter-Statement under Section 21 of The Trade Marks Act, 1999.
APPLICATION: App No. ${appNo}, Applicant's TM: ${tmName}, Opponent's TM: ${oppMark}, Class: ${cls}, Applicant: ${applicant}, Opponent: ${opponent}, Goods: ${goods}
OPPOSITION NOTICE: ${report || "[Draft comprehensive counter-statement addressing grounds including Section 11(1), 9(1)(b) and passing off]"}
DEFENCE: ${evidence || "Include standard counter-arguments"}
STYLE: ${style}
Draft complete Counter-Statement with: Title → Preliminary Objections → Reply to Each Ground → Positive Case → Case Laws → Prayer for dismissal.`
      : `You are an expert Indian Trademark Attorney drafting a formal Reply to Examination Report under The Trade Marks Act, 1999.
APPLICATION: TM No. ${appNo}, Mark: ${tmName}, Class: ${cls}, Goods: ${goods}, Applicant: ${applicant}
EXAMINATION REPORT: ${report || "[Draft comprehensive reply addressing common objections under Sections 9 and 11]"}
EVIDENCE: ${evidence || "Include standard arguments"}
STYLE: ${style === "detailed" ? "Very detailed with 3+ case laws per objection" : style === "concise" ? "Concise and direct" : "Formal legal language"}
Draft a complete Reply to Examination Report with: Header → Preliminary Submissions → Reply to Each Objection → Legal Arguments with case law citations → Prayer for registration.`

    streamDraft(prompt, t => setStreamText(t), t => { setStreaming(false); setDraft(t) }, err => { setStreaming(false); setDraft("⚠️ Error: " + err) })
  }

  const copy = () => navigator.clipboard.writeText(draft).catch(() => {
    const ta = document.createElement("textarea"); ta.value = draft; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta)
  })

  const download = () => {
    const blob = new Blob([draft], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${title.replace(/\s+/g, "_")}_${tmName || "Draft"}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        {/* Input */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head"><h3>📄 {isOpp ? "Paste Opposition Notice" : "Paste Examination Report"}</h3></div>
          <div className="card-body" style={{ padding: 18 }}>
            <textarea
              value={report}
              onChange={e => setReport(e.target.value)}
              placeholder={isOpp
                ? "Paste opposition notice content here...\n\ne.g. The Opponent files opposition under Section 11(1)(b)..."
                : "Paste the examination report content here...\n\ne.g. The Examiner has raised objection under Section 9(1)(b)..."}
              style={{ width: "100%", height: 140, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: "12.5px", fontFamily: "var(--mono)", color: "var(--text)", resize: "vertical", lineHeight: 1.6, outline: "none" }}
            />

            {report && (
              <div style={{ marginTop: 10 }}>
                <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, marginBottom: 6 }}>Detected Objections:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {detectObjTags(report).length > 0
                    ? detectObjTags(report).map(p => <span key={p.sec} className={`obj-tag ${p.cls}`}>{p.label}</span>)
                    : <span style={{ fontSize: 12, color: "var(--text3)" }}>No objections detected yet…</span>}
                </div>
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
              <div className="mf" style={{ margin: 0 }}><label>App No.</label><input value={appNo} onChange={e => setAppNo(e.target.value)} placeholder="5847291" style={{ fontFamily: "var(--mono)" }} /></div>
              <div className="mf" style={{ margin: 0 }}><label>Trade Mark</label><input value={tmName} onChange={e => setTmName(e.target.value.toUpperCase())} placeholder="MARK NAME" /></div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
              <div className="mf" style={{ margin: 0 }}><label>Class(es)</label><input value={cls} onChange={e => setCls(e.target.value)} placeholder="e.g. 29, 30" /></div>
              <div className="mf" style={{ margin: 0 }}><label>Goods / Services</label><input value={goods} onChange={e => setGoods(e.target.value)} placeholder="e.g. Dairy products" /></div>
            </div>
            <div className="mf" style={{ marginTop: 10 }}><label>Applicant</label><input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="Registered proprietor name" /></div>
            {isOpp && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div className="mf"><label>Opponent's Mark</label><input value={oppMark} onChange={e => setOppMark(e.target.value.toUpperCase())} placeholder="Opponent TM name" /></div>
                <div className="mf"><label>Opponent Name</label><input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Opposing party" /></div>
              </div>
            )}
            <div className="mf" style={{ marginTop: 10 }}>
              <label>Evidence / Arguments (optional)</label>
              <textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder="e.g. Mark in use since 2018, turnover ₹2.5Cr, user affidavit..." style={{ width: "100%", height: 70, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: "12.5px", color: "var(--text)", resize: "vertical", outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 10, flexWrap: "wrap" }}>
              <select value={style} onChange={e => setStyle(e.target.value)} style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)", fontFamily: "var(--head)", outline: "none" }}>
                <option value="formal">Formal Legal (Default)</option>
                <option value="detailed">Detailed with Case Laws</option>
                <option value="concise">Concise & Direct</option>
              </select>
              <button className="topbar-btn btn-primary" onClick={generate} disabled={streaming} style={{ flex: 1, justifyContent: "center" }}>
                {streaming ? "⏳ Generating…" : "✨ Generate Draft"}
              </button>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <h3>📝 Generated Draft</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!draft} onClick={copy}>📋 Copy</button>
              <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!draft} onClick={download}>⬇ Download</button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {!draft && !streaming ? (
              <div style={{ padding: "52px 24px", textAlign: "center", color: "var(--text3)" }}>
                <div style={{ fontSize: 42, marginBottom: 12 }}>{emptyIcon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>{emptyLabel}</div>
                <div style={{ fontSize: 12 }}>Fill in the details and click <b>Generate Draft</b></div>
              </div>
            ) : (
              <div style={{ padding: "16px 20px" }}>
                {streaming && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                    <div className="stream-dot" />
                    <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>Generating draft…</span>
                  </div>
                )}
                <div style={{ fontSize: 12.5, lineHeight: 1.9, whiteSpace: "pre-wrap", color: "var(--text)", fontFamily: "var(--mono)" }}>
                  {streaming ? streamText : draft}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Case Laws */}
      {cases.length > 0 && (
        <div className="card">
          <div className="card-head"><h3>⚖️ Relevant Case Laws</h3><span style={{ fontSize: 12, color: "var(--text3)" }}>{cases.length} references</span></div>
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12, padding: 16 }}>
            {cases.map(c => (
              <div key={c.title} className="case-law-card">
                <div className="case-law-title">{c.title}</div>
                <div className="case-law-citation">{c.citation} · Section {c.section}</div>
                <div className="case-law-body">{c.summary}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}

export default function Draft() {
  const [activeTab, setActiveTab] = useState("exam")
  const [history, setHistory] = useState([])

  return (
    <>
      <div className="tabs">
        {[
          { id: "exam", label: "📋 Examination Report Reply" },
          { id: "opp", label: "⚔️ Opposition Counter-Statement" },
          { id: "history", label: `🗂 Draft History${history.length > 0 ? ` (${history.length})` : ""}` },
        ].map(t => (
          <div key={t.id} className={`tab${activeTab === t.id ? " on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {activeTab === "exam" && (
        <DraftPanel title="Examination Report Reply" emptyIcon="⚖️" emptyLabel="AI Reply will appear here" />
      )}

      {activeTab === "opp" && (
        <DraftPanel title="Counter-Statement" emptyIcon="⚔️" emptyLabel="Counter-Statement will appear here" />
      )}

      {activeTab === "history" && (
        <div className="card">
          <div className="card-head">
            <h3>🗂 Saved Drafts</h3>
            {history.length > 0 && (
              <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setHistory([])}>🗑 Clear All</button>
            )}
          </div>
          <div className="card-body">
            {history.length === 0 ? (
              <div style={{ padding: "50px 30px", textAlign: "center", color: "var(--text3)", fontSize: 13 }}>
                No saved drafts yet. Generate a reply and click Save to store it here.
              </div>
            ) : (
              history.map(d => (
                <div key={d.id} style={{ display: "flex", gap: 14, padding: "14px 18px", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                  <div style={{ fontSize: 24 }}>{d.type.includes("Exam") ? "📋" : "⚔️"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{d.tmName}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{d.type} · {d.date}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{d.text.slice(0, 120)}…</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  )
}
