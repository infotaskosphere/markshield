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
  { title: "Nandhini Deluxe v. Karnataka Co-operative Milk Producers", citation: "Civil Appeal No. 2943/2018 (SC)", section: "11(1)", summary: "SC clarified that similarity must be assessed in totality. Dominant features carry more weight; distinguishing features can differentiate even phonetically similar marks." },
]

function detectObjTags(text) {
  return OBJECTION_PATTERNS.filter((p) => p.regex.test(text))
}

function getCaseLaws(detected) {
  const secs = detected.map((d) => d.sec)
  const relevant = CASE_LAWS.filter((c) => secs.includes(c.section) || secs.length === 0)
  const landmarks = ["Amritdhara Pharmacy v. Satya Deo Gupta", "Cadila Healthcare Ltd. v. Cadila Pharmaceuticals Ltd.", "Parle Products Pvt. Ltd. v. J.P. & Co. Mysore"]
  CASE_LAWS.forEach((c) => { if (landmarks.includes(c.title) && !relevant.find((r) => r.title === c.title)) relevant.push(c) })
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
  } catch (e) {
    onError(e.message)
  }
}

export default function Draft() {
  const [activeTab, setActiveTab] = useState("exam")
  const [draftHistory, setDraftHistory] = useState([])

  // Exam tab state
  const [examReport, setExamReport] = useState("")
  const [examAppNo, setExamAppNo] = useState("")
  const [examTMName, setExamTMName] = useState("")
  const [examClass, setExamClass] = useState("")
  const [examGoods, setExamGoods] = useState("")
  const [examApplicant, setExamApplicant] = useState("")
  const [examEvidence, setExamEvidence] = useState("")
  const [examStyle, setExamStyle] = useState("formal")
  const [examDraft, setExamDraft] = useState("")
  const [examStreaming, setExamStreaming] = useState(false)
  const [examStreamText, setExamStreamText] = useState("")
  const [examCases, setExamCases] = useState([])

  // Opp tab state
  const [oppNotice, setOppNotice] = useState("")
  const [oppTM, setOppTM] = useState("")
  const [oppOpponentTM, setOppOpponentTM] = useState("")
  const [oppAppNo, setOppAppNo] = useState("")
  const [oppClass, setOppClass] = useState("")
  const [oppApplicant, setOppApplicant] = useState("")
  const [oppOpponent, setOppOpponent] = useState("")
  const [oppGoods, setOppGoods] = useState("")
  const [oppEvidence, setOppEvidence] = useState("")
  const [oppStyle, setOppStyle] = useState("formal")
  const [oppDraft, setOppDraft] = useState("")
  const [oppStreaming, setOppStreaming] = useState(false)
  const [oppStreamText, setOppStreamText] = useState("")
  const [oppCases, setOppCases] = useState([])

  const generateExam = async () => {
    if (!examReport && !examTMName && !examAppNo) return
    const detected = detectObjTags(examReport)
    setExamCases(getCaseLaws(detected))
    setExamStreaming(true)
    setExamStreamText("")
    setExamDraft("")

    const prompt = `You are an expert Indian Trademark Attorney drafting a formal Reply to Examination Report under The Trade Marks Act, 1999.
APPLICATION: TM No. ${examAppNo || "[App No]"}, Mark: ${examTMName || "[Mark]"}, Class: ${examClass || "[Class]"}, Goods: ${examGoods || "[Goods]"}, Applicant: ${examApplicant || "[Applicant]"}
EXAMINATION REPORT: ${examReport || "[Draft comprehensive reply addressing common objections under Sections 9 and 11]"}
EVIDENCE: ${examEvidence || "Include standard arguments"}
STYLE: ${examStyle === "detailed" ? "Very detailed with 3+ case laws per objection" : examStyle === "concise" ? "Concise and direct" : "Formal legal language"}
Draft a complete Reply to Examination Report with: Header → Preliminary Submissions → Reply to Each Objection → Legal Arguments with case law citations → Prayer for registration.`

    streamDraft(prompt, (text) => setExamStreamText(text), (text) => { setExamStreaming(false); setExamDraft(text) }, (err) => { setExamStreaming(false); setExamDraft("⚠️ Error: " + err) })
  }

  const generateOpp = async () => {
    if (!oppNotice && !oppTM) return
    const detected = detectObjTags(oppNotice)
    setOppCases(getCaseLaws(detected.length ? detected : [{ sec: "11(1)" }]))
    setOppStreaming(true)
    setOppStreamText("")
    setOppDraft("")

    const prompt = `You are an expert Indian Trademark Attorney drafting a formal Counter-Statement under Section 21 of The Trade Marks Act, 1999.
APPLICATION: App No. ${oppAppNo}, Applicant's TM: ${oppTM}, Opponent's TM: ${oppOpponentTM}, Class: ${oppClass}, Applicant: ${oppApplicant}, Opponent: ${oppOpponent}, Goods: ${oppGoods}
OPPOSITION NOTICE: ${oppNotice || "[Draft comprehensive counter-statement addressing grounds including Section 11(1), 9(1)(b) and passing off]"}
DEFENCE: ${oppEvidence || "Include standard counter-arguments"}
STYLE: ${oppStyle}
Draft complete Counter-Statement with: Title → Preliminary Objections → Reply to Each Ground → Positive Case → Case Laws → Prayer for dismissal.`

    streamDraft(prompt, (text) => setOppStreamText(text), (text) => { setOppStreaming(false); setOppDraft(text) }, (err) => { setOppStreaming(false); setOppDraft("⚠️ Error: " + err) })
  }

  const copyDraft = (text) => {
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta)
    })
  }

  const downloadDraft = (text, label) => {
    const blob = new Blob([text], { type: "text/plain" })
    const a = document.createElement("a")
    a.href = URL.createObjectURL(blob)
    a.download = `${label}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const saveDraft = (type, text, tmName) => {
    if (!text) return
    setDraftHistory((h) => [{ id: Date.now(), type, tmName, text, date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) }, ...h])
  }

  const tabs = [
    { id: "exam", label: "📋 Examination Report Reply" },
    { id: "opp", label: "⚔️ Opposition Reply" },
    { id: "history", label: "🗂 Draft History" },
  ]

  return (
    <>
      <div className="tabs">
        {tabs.map((t) => (
          <div key={t.id} className={`tab${activeTab === t.id ? " on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {/* ── EXAM TAB ── */}
      {activeTab === "exam" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-head"><h3>📄 Upload / Paste Examination Report</h3></div>
              <div className="card-body" style={{ padding: 18 }}>
                <textarea value={examReport} onChange={(e) => setExamReport(e.target.value)}
                  placeholder="Paste the examination report content here...&#10;&#10;e.g. The Examiner has raised objection under Section 9(1)(b) that the mark is descriptive..."
                  style={{ width: "100%", height: 160, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: "12.5px", fontFamily: "var(--mono)", color: "var(--text)", resize: "vertical", lineHeight: 1.6, outline: "none" }} />

                {examReport && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, marginBottom: 6 }}>Detected Objections:</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {detectObjTags(examReport).length > 0
                        ? detectObjTags(examReport).map((p) => <span key={p.sec} className={`obj-tag ${p.cls}`}>{p.label}</span>)
                        : <span style={{ fontSize: 12, color: "var(--text3)" }}>No objections detected yet…</span>}
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 14 }}>
                  <div className="mf" style={{ margin: 0 }}><label>TM Application No.</label><input type="text" value={examAppNo} onChange={(e) => setExamAppNo(e.target.value)} placeholder="e.g. 5847291" style={{ fontFamily: "var(--mono)" }} /></div>
                  <div className="mf" style={{ margin: 0 }}><label>Trade Mark Name</label><input type="text" value={examTMName} onChange={(e) => setExamTMName(e.target.value)} placeholder="e.g. FRESHMART" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div className="mf" style={{ margin: 0 }}><label>Class(es)</label><input type="text" value={examClass} onChange={(e) => setExamClass(e.target.value)} placeholder="e.g. 29, 30" /></div>
                  <div className="mf" style={{ margin: 0 }}><label>Goods / Services</label><input type="text" value={examGoods} onChange={(e) => setExamGoods(e.target.value)} placeholder="e.g. Dairy products" /></div>
                </div>
                <div className="mf" style={{ marginTop: 10 }}><label>Applicant Name</label><input type="text" value={examApplicant} onChange={(e) => setExamApplicant(e.target.value)} placeholder="Registered proprietor name" /></div>
                <div style={{ marginTop: 12 }}><label style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Evidence / Arguments (optional):</label>
                  <textarea value={examEvidence} onChange={(e) => setExamEvidence(e.target.value)} placeholder="e.g. Mark in use since 2018, user affidavit, sales turnover ₹2.5Cr..." style={{ width: "100%", height: 80, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: "12.5px", color: "var(--text)", resize: "vertical", outline: "none" }} />
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select value={examStyle} onChange={(e) => setExamStyle(e.target.value)} style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)" }}>
                    <option value="formal">Formal Legal (Default)</option>
                    <option value="detailed">Detailed with Case Laws</option>
                    <option value="concise">Concise & Direct</option>
                  </select>
                  <button className="topbar-btn btn-primary" onClick={generateExam} disabled={examStreaming} style={{ flex: 1, justifyContent: "center" }}>
                    {examStreaming ? "⏳ Generating…" : "✨ Generate Reply"}
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-head">
                <h3>📝 Drafted Reply</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!examDraft} onClick={() => copyDraft(examDraft)}>📋 Copy</button>
                  <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!examDraft} onClick={() => downloadDraft(examDraft, "Exam_Report_Reply_" + (examTMName || "Draft"))}>⬇ Download</button>
                  <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!examDraft} onClick={() => saveDraft("Exam Report Reply", examDraft, examTMName || "Unknown TM")}>💾 Save</button>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {!examDraft && !examStreaming && (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text3)" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⚖️</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>AI Reply will appear here</div>
                    <div style={{ fontSize: 12 }}>Fill in the details and click <strong>Generate Reply</strong></div>
                  </div>
                )}
                {(examStreaming || examDraft) && (
                  <div style={{ padding: "18px 20px" }}>
                    {examStreaming && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                        <div className="stream-dot" />
                        <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>Generating reply…</span>
                      </div>
                    )}
                    <div style={{ fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap", color: "var(--text)", fontFamily: "var(--mono)" }}>
                      {examStreaming ? examStreamText : examDraft}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {examCases.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>⚖️ Relevant Legal Provisions & Case Laws</h3><span className="sec-link">{examCases.length} references</span></div>
              <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12, padding: 16 }}>
                {examCases.map((c) => (
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
      )}

      {/* ── OPP TAB ── */}
      {activeTab === "opp" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-head"><h3>📄 Upload / Paste Opposition Notice</h3></div>
              <div className="card-body" style={{ padding: 18 }}>
                <textarea value={oppNotice} onChange={(e) => setOppNotice(e.target.value)}
                  placeholder="Paste opposition notice content here...&#10;&#10;e.g. The Opponent files opposition under Section 11(1)(b) claiming similarity with their prior mark..."
                  style={{ width: "100%", height: 140, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 12, fontSize: "12.5px", fontFamily: "var(--mono)", color: "var(--text)", resize: "vertical", lineHeight: 1.6, outline: "none" }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                  <div className="mf" style={{ margin: 0 }}><label>Applicant's TM Name</label><input type="text" value={oppTM} onChange={(e) => setOppTM(e.target.value)} placeholder="e.g. FRESHMART" /></div>
                  <div className="mf" style={{ margin: 0 }}><label>Opponent's TM Name</label><input type="text" value={oppOpponentTM} onChange={(e) => setOppOpponentTM(e.target.value)} placeholder="e.g. FRESHZONE" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div className="mf" style={{ margin: 0 }}><label>Application No.</label><input type="text" value={oppAppNo} onChange={(e) => setOppAppNo(e.target.value)} placeholder="e.g. 5847291" /></div>
                  <div className="mf" style={{ margin: 0 }}><label>Class(es)</label><input type="text" value={oppClass} onChange={(e) => setOppClass(e.target.value)} placeholder="e.g. 29, 30" /></div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
                  <div className="mf" style={{ margin: 0 }}><label>Applicant Name</label><input type="text" value={oppApplicant} onChange={(e) => setOppApplicant(e.target.value)} placeholder="Your client name" /></div>
                  <div className="mf" style={{ margin: 0 }}><label>Opponent Name</label><input type="text" value={oppOpponent} onChange={(e) => setOppOpponent(e.target.value)} placeholder="Opposing party" /></div>
                </div>
                <div className="mf" style={{ marginTop: 10 }}><label>Goods / Services</label><input type="text" value={oppGoods} onChange={(e) => setOppGoods(e.target.value)} placeholder="e.g. Dairy products, spices" /></div>
                <div style={{ marginTop: 10 }}><label style={{ fontSize: 12, color: "var(--text3)", fontWeight: 600, display: "block", marginBottom: 6 }}>Defence Arguments / Evidence</label>
                  <textarea value={oppEvidence} onChange={(e) => setOppEvidence(e.target.value)} placeholder="e.g. Mark in use since 2010 with ₹5Cr turnover..." style={{ width: "100%", height: 80, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: "12.5px", color: "var(--text)", resize: "vertical", outline: "none" }} />
                </div>
                <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <select value={oppStyle} onChange={(e) => setOppStyle(e.target.value)} style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 12px", fontSize: 13, color: "var(--text)" }}>
                    <option value="formal">Formal Legal Counter-Statement</option>
                    <option value="detailed">Detailed with Case Laws</option>
                    <option value="concise">Concise Counter-Statement</option>
                  </select>
                  <button className="topbar-btn btn-primary" onClick={generateOpp} disabled={oppStreaming} style={{ flex: 1, justifyContent: "center" }}>
                    {oppStreaming ? "⏳ Generating…" : "✨ Generate Counter-Statement"}
                  </button>
                </div>
              </div>
            </div>

            <div className="card" style={{ marginBottom: 0 }}>
              <div className="card-head">
                <h3>📝 Counter-Statement Draft</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!oppDraft} onClick={() => copyDraft(oppDraft)}>📋 Copy</button>
                  <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!oppDraft} onClick={() => downloadDraft(oppDraft, "Counter_Statement_" + (oppTM || "Draft"))}>⬇ Download</button>
                  <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!oppDraft} onClick={() => saveDraft("Counter-Statement", oppDraft, oppTM || "Unknown TM")}>💾 Save</button>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                {!oppDraft && !oppStreaming && (
                  <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text3)" }}>
                    <div style={{ fontSize: 40, marginBottom: 12 }}>⚔️</div>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Counter-Statement will appear here</div>
                    <div style={{ fontSize: 12 }}>Fill in the details and click <strong>Generate Counter-Statement</strong></div>
                  </div>
                )}
                {(oppStreaming || oppDraft) && (
                  <div style={{ padding: "18px 20px" }}>
                    {oppStreaming && (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                        <div className="stream-dot" />
                        <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>Analysing grounds of opposition…</span>
                      </div>
                    )}
                    <div style={{ fontSize: 13, lineHeight: 1.9, whiteSpace: "pre-wrap", color: "var(--text)", fontFamily: "var(--mono)" }}>
                      {oppStreaming ? oppStreamText : oppDraft}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {oppCases.length > 0 && (
            <div className="card">
              <div className="card-head"><h3>⚖️ Relevant Legal Provisions & Case Laws</h3><span className="sec-link">{oppCases.length} references</span></div>
              <div className="card-body" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 12, padding: 16 }}>
                {oppCases.map((c) => (
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
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="card">
          <div className="card-head">
            <h3>🗂 Saved Drafts</h3>
            <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => setDraftHistory([])}>🗑 Clear All</button>
          </div>
          <div className="card-body" style={{ padding: 16 }}>
            {draftHistory.length === 0 ? (
              <div style={{ padding: 32, textAlign: "center", color: "var(--text3)" }}>No saved drafts yet. Generate and save a reply to see it here.</div>
            ) : (
              draftHistory.map((d) => (
                <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 24, flexShrink: 0 }}>{d.type.includes("Exam") ? "📋" : "⚔️"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{d.tmName}</div>
                    <div style={{ fontSize: 11, color: "var(--text3)" }}>{d.type} · {d.date}</div>
                    <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{d.text.slice(0, 120)}…</div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 9px" }} onClick={() => downloadDraft(d.text, d.type.replace(/\s+/g, "_") + "_" + d.tmName.replace(/\s+/g, "_"))}>⬇</button>
                    <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "4px 9px", color: "var(--rose)" }} onClick={() => setDraftHistory((h) => h.filter((x) => x.id !== d.id))}>🗑</button>
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
