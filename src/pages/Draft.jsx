import React, { useState, useRef } from "react"

// ── Objection patterns ────────────────────────────────────────────────────────
const OBJECTION_PATTERNS = [
  { regex: /devoid|distinctiv|not capable/i,                        sec: "9(1)(a)", label: "Sec 9(1)(a) — Lack of Distinctiveness",  cls: "sec9"  },
  { regex: /descript|designat|kind|quality|geograph|origin/i,      sec: "9(1)(b)", label: "Sec 9(1)(b) — Descriptive",              cls: "sec9"  },
  { regex: /customary|generic|common/i,                             sec: "9(1)(c)", label: "Sec 9(1)(c) — Generic/Customary",        cls: "sec9"  },
  { regex: /deceiv|confus|mislead/i,                                sec: "9(2)(a)", label: "Sec 9(2)(a) — Deceptive",                cls: "sec9"  },
  { regex: /similar.*mark|earlier mark|likelihood.*confus/i,       sec: "11(1)",   label: "Sec 11(1) — Similarity/Confusion",       cls: "sec11" },
  { regex: /well.known|repute|dilut/i,                              sec: "11(2)",   label: "Sec 11(2) — Well-Known TM",              cls: "sec11" },
  { regex: /passing off|copyright/i,                                sec: "11(3)",   label: "Sec 11(3) — Passing Off",               cls: "sec11" },
  { regex: /overlap|class.*descrip|tm.m|specify.*goods/i,          sec: "Other",   label: "Other — Goods Description / Class Issue", cls: "sec13" },
  { regex: /section 9|sec.*9\b/i,                                   sec: "9",       label: "Section 9 Objection",                   cls: "sec9"  },
  { regex: /section 11|sec.*11\b/i,                                 sec: "11",      label: "Section 11 Objection",                  cls: "sec11" },
]

const CASE_LAWS = [
  { title: "Amritdhara Pharmacy v. Satya Deo Gupta",           citation: "AIR 1963 SC 449",        section: "11(1)", summary: "SC held that for confusion, one must consider the mark as a whole (holistic comparison), keeping in mind a consumer of average intelligence and imperfect recollection." },
  { title: "Cadila Healthcare Ltd. v. Cadila Pharmaceuticals", citation: "(2001) 5 SCC 73",         section: "11(1)", summary: "SC laid down multi-factor test: nature of marks, degree of resemblance, nature of goods, class of purchasers, and other surrounding circumstances." },
  { title: "Parle Products v. J.P. & Co. Mysore",              citation: "AIR 1972 SC 1359",        section: "11(1)", summary: "Marks need not be identical — if overall impression is similar and an unwary purchaser may be confused, infringement exists." },
  { title: "Corn Products v. Shangrila Food Products",          citation: "AIR 1960 SC 142",         section: "9(1)(b)", summary: "Descriptive words with acquired secondary meaning can be registered. Burden of proving distinctiveness lies on the applicant." },
  { title: "F. Hoffmann-La Roche v. Geoffrey Manners",         citation: "AIR 1970 SC 2062",        section: "9(1)(a)", summary: "A coined word can be inherently distinctive even if it consists of common elements, provided as a whole it distinguishes the applicant's goods." },
  { title: "Nandhini Deluxe v. Karnataka Co-op Milk",          citation: "Civil Appeal 2943/2018",   section: "11(1)", summary: "Similarity must be assessed in totality. Dominant features carry more weight; distinguishing features can differentiate even phonetically similar marks." },
  { title: "Godfrey Phillips v. Girnar Food",                  citation: "(2004) 5 SCC 257",         section: "Other", summary: "Classification of goods is not conclusive of similarity — the nature and trade channels of goods must be considered for class overlap issues." },
]

function detectObjTags(text) {
  return OBJECTION_PATTERNS.filter(p => p.regex.test(text))
}

function getCaseLaws(detected) {
  const secs = detected.map(d => d.sec)
  const relevant = CASE_LAWS.filter(c => secs.some(s => c.section.includes(s.replace(/[()]/g, ""))) || secs.length === 0)
  const landmarks = ["Amritdhara Pharmacy v. Satya Deo Gupta", "Cadila Healthcare Ltd. v. Cadila Pharmaceuticals"]
  CASE_LAWS.forEach(c => { if (landmarks.includes(c.title) && !relevant.find(r => r.title === c.title)) relevant.push(c) })
  return [...new Map(relevant.map(c => [c.title, c])).values()].slice(0, 5)
}

// ── PDF → text extractor using Claude API ────────────────────────────────────
async function extractPDFWithClaude(base64Data) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 2000,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64Data }
          },
          {
            type: "text",
            text: `Extract all information from this Indian trademark examination report and return ONLY a JSON object with these exact keys (no markdown, no explanation):
{
  "app_no": "application number",
  "tm_name": "trademark/mark name",
  "tm_class": "class number(s)",
  "applicant": "applicant/proprietor name",
  "attorney": "attorney/agent name",
  "registry": "registry location",
  "date": "date of examination report",
  "objections": "full text of all objections listed",
  "objection_sections": ["list of section numbers objected e.g. 9(1)(b), 11(1)"],
  "search_report": "any conflicting marks found or none",
  "goods_services": "description of goods/services if mentioned",
  "examiner": "examiner name if mentioned",
  "ref_no": "reference/file number"
}`
          }
        ]
      }]
    })
  })
  const data = await response.json()
  const text = data.content?.[0]?.text || "{}"
  try {
    const clean = text.replace(/```json|```/g, "").trim()
    return JSON.parse(clean)
  } catch {
    return { raw: text }
  }
}

// ── Streaming draft generator ─────────────────────────────────────────────────
async function streamDraft(prompt, onChunk, onDone, onError) {
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        stream: true,
        messages: [{ role: "user", content: prompt }]
      }),
    })
    const reader  = response.body.getReader()
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

// ── PDF Upload Button ─────────────────────────────────────────────────────────
function PDFUploader({ onExtracted, label = "📎 Upload Examination Report PDF" }) {
  const fileRef  = useRef(null)
  const [status, setStatus] = useState("idle") // idle | reading | extracting | done | error
  const [fname,  setFname]  = useState("")

  const handleFile = async (e) => {
    const file = e.target.files?.[0]
    if (!file || file.type !== "application/pdf") {
      setStatus("error"); return
    }
    setFname(file.name)
    setStatus("reading")

    // Read file as base64
    const base64 = await new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload  = () => res(reader.result.split(",")[1])
      reader.onerror = rej
      reader.readAsDataURL(file)
    })

    setStatus("extracting")
    try {
      const extracted = await extractPDFWithClaude(base64)
      onExtracted(extracted)
      setStatus("done")
    } catch (err) {
      console.error("PDF extraction error:", err)
      setStatus("error")
    }
    // Reset input so same file can be re-uploaded
    e.target.value = ""
  }

  const colors = {
    idle:       { bg: "rgba(201,146,10,.1)",  border: "rgba(201,146,10,.3)",  color: "#f0c842" },
    reading:    { bg: "rgba(56,189,248,.1)",  border: "rgba(56,189,248,.3)",  color: "var(--sky)" },
    extracting: { bg: "rgba(139,92,246,.1)",  border: "rgba(139,92,246,.3)",  color: "var(--violet)" },
    done:       { bg: "rgba(0,196,160,.1)",   border: "rgba(0,196,160,.3)",   color: "var(--teal)" },
    error:      { bg: "rgba(244,63,94,.1)",   border: "rgba(244,63,94,.3)",   color: "var(--rose)" },
  }
  const c = colors[status]

  const statusLabel = {
    idle:       label,
    reading:    "📖 Reading PDF...",
    extracting: "🤖 AI extracting details...",
    done:       `✅ Extracted: ${fname}`,
    error:      "❌ Error — only PDF files supported",
  }

  return (
    <div>
      <input ref={fileRef} type="file" accept="application/pdf" style={{ display: "none" }} onChange={handleFile} />
      <button
        onClick={() => fileRef.current?.click()}
        disabled={status === "reading" || status === "extracting"}
        style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderRadius: 9, cursor: "pointer",
          border: `1px solid ${c.border}`, background: c.bg, color: c.color,
          fontFamily: "var(--head)", fontSize: 13, fontWeight: 600,
          transition: "all .2s", width: "100%", justifyContent: "center",
        }}
      >
        {(status === "reading" || status === "extracting") && (
          <div style={{ width: 14, height: 14, border: `2px solid ${c.color}40`, borderTopColor: c.color, borderRadius: "50%", animation: "spin .7s linear infinite" }} />
        )}
        {statusLabel[status]}
      </button>
      {status === "extracting" && (
        <div style={{ fontSize: 11, color: "var(--text3)", textAlign: "center", marginTop: 6 }}>
          Claude is reading your PDF and extracting all application details…
        </div>
      )}
    </div>
  )
}

// ── Exam Report Panel ─────────────────────────────────────────────────────────
function ExamPanel() {
  const [report,    setReport]    = useState("")
  const [appNo,     setAppNo]     = useState("")
  const [tmName,    setTmName]    = useState("")
  const [cls,       setCls]       = useState("")
  const [goods,     setGoods]     = useState("")
  const [applicant, setApplicant] = useState("")
  const [attorney,  setAttorney]  = useState("")
  const [registry,  setRegistry]  = useState("")
  const [evidence,  setEvidence]  = useState("")
  const [style,     setStyle]     = useState("formal")
  const [draft,     setDraft]     = useState("")
  const [streaming, setStreaming] = useState(false)
  const [streamTxt, setStreamTxt] = useState("")
  const [cases,     setCases]     = useState([])
  const [pdfStatus, setPdfStatus] = useState("") // feedback on what was extracted

  // Called when PDF is uploaded and Claude extracts data
  const handlePDFExtracted = (data) => {
    if (data.app_no)     setAppNo(data.app_no)
    if (data.tm_name)    setTmName(data.tm_name)
    if (data.tm_class)   setCls(data.tm_class)
    if (data.applicant)  setApplicant(data.applicant)
    if (data.attorney)   setAttorney(data.attorney)
    if (data.registry)   setRegistry(data.registry)
    if (data.goods_services) setGoods(data.goods_services)
    if (data.objections) setReport(data.objections)

    // Build feedback summary
    const filled = [
      data.app_no    && `App: ${data.app_no}`,
      data.tm_name   && `Mark: ${data.tm_name}`,
      data.tm_class  && `Class: ${data.tm_class}`,
      data.applicant && `Applicant: ${data.applicant}`,
    ].filter(Boolean)
    setPdfStatus(filled.join(" · "))
  }

  const generate = async () => {
    if (!report && !tmName && !appNo) return
    const detected = detectObjTags(report)
    setCases(getCaseLaws(detected))
    setStreaming(true); setStreamTxt(""); setDraft("")

    const prompt = `You are an expert Indian Trademark Attorney drafting a formal Reply to Examination Report under The Trade Marks Act, 1999 and Trade Marks Rules, 2017.

APPLICATION DETAILS:
- TM Application No: ${appNo || "[App No]"}
- Trade Mark: ${tmName || "[Mark Name]"}
- Class: ${cls || "[Class]"}
- Goods/Services: ${goods || "[Goods/Services]"}
- Applicant/Proprietor: ${applicant || "[Applicant]"}
- Attorney/Agent: ${attorney || "[Attorney]"}
- Registry: ${registry || "Ahmedabad"}

EXAMINATION REPORT OBJECTIONS:
${report || "[Draft comprehensive reply addressing the stated objection]"}

ADDITIONAL EVIDENCE/ARGUMENTS:
${evidence || "Include standard legal arguments appropriate for this type of objection"}

DRAFTING STYLE: ${style === "detailed" ? "Very detailed with multiple case law citations per objection" : style === "concise" ? "Concise and direct" : "Formal legal language, balanced detail"}

INSTRUCTIONS:
Draft a complete, formal Reply to Examination Report with:
1. Header (To: Registrar, Re: App No, Mark, Class)
2. Preliminary Submissions
3. Reply to each objection point-by-point with legal arguments
4. Case law citations relevant to the objections raised
5. Prayer for acceptance and registration
6. Closing (For [Applicant Name], Through [Attorney Name])

Use proper Indian trademark law terminology. Be professional and persuasive.`

    streamDraft(
      prompt,
      t => setStreamTxt(t),
      t => { setStreaming(false); setDraft(t) },
      err => { setStreaming(false); setDraft("⚠️ Error: " + err) }
    )
  }

  const copy = () => navigator.clipboard.writeText(draft).catch(() => {
    const ta = document.createElement("textarea"); ta.value = draft
    document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta)
  })

  const download = () => {
    const blob = new Blob([draft], { type: "text/plain" })
    const a    = document.createElement("a")
    a.href     = URL.createObjectURL(blob)
    a.download = `Reply_ExamReport_${appNo || tmName || "Draft"}_${new Date().toISOString().slice(0,10)}.txt`
    a.click(); URL.revokeObjectURL(a.href)
  }

  const detected = detectObjTags(report)

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        {/* ── INPUT PANEL ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head"><h3>📄 Examination Report Details</h3></div>
          <div className="card-body" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>

            {/* PDF Upload */}
            <PDFUploader
              label="📎 Upload Examination Report PDF — AI will auto-fill all fields"
              onExtracted={handlePDFExtracted}
            />
            {pdfStatus && (
              <div style={{ fontSize: 11.5, color: "var(--teal)", background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.2)", borderRadius: 7, padding: "7px 12px" }}>
                ✅ Auto-filled from PDF: {pdfStatus}
              </div>
            )}

            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: "var(--text3)", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10 }}>
                Or fill in manually ↓
              </div>

              {/* Objection text */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontSize: 11, textTransform: "uppercase", letterSpacing: ".1em", color: "var(--text3)", marginBottom: 6 }}>
                  Objection Text (from Examination Report) *
                </label>
                <textarea value={report} onChange={e => setReport(e.target.value)}
                  placeholder={"Paste objection text here...\n\ne.g. Applicant is required to specify goods description as there is overlapping with other classes..."}
                  style={{ width: "100%", height: 110, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 11, fontSize: "12.5px", fontFamily: "var(--mono)", color: "var(--text)", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                />
              </div>

              {/* Detected objections */}
              {report && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 11, color: "var(--text3)", marginBottom: 6 }}>Detected Objection Types:</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {detected.length > 0
                      ? detected.map(p => <span key={p.sec} className={`obj-tag ${p.cls}`}>{p.label}</span>)
                      : <span style={{ fontSize: 12, color: "var(--text3)" }}>Paste objection text to detect sections…</span>
                    }
                  </div>
                </div>
              )}

              {/* Form fields grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div className="mf" style={{ margin: 0 }}>
                  <label>Application No. *</label>
                  <input value={appNo} onChange={e => setAppNo(e.target.value)} placeholder="e.g. 5738719" style={{ fontFamily: "var(--mono)" }} />
                </div>
                <div className="mf" style={{ margin: 0 }}>
                  <label>Trade Mark Name *</label>
                  <input value={tmName} onChange={e => setTmName(e.target.value.toUpperCase())} placeholder="e.g. ZR LIGHTING" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div className="mf" style={{ margin: 0 }}>
                  <label>Class(es)</label>
                  <input value={cls} onChange={e => setCls(e.target.value)} placeholder="e.g. 11" />
                </div>
                <div className="mf" style={{ margin: 0 }}>
                  <label>Registry</label>
                  <select value={registry} onChange={e => setRegistry(e.target.value)}
                    style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text)", padding: "9px 13px", borderRadius: 8, fontSize: 13, fontFamily: "var(--head)", outline: "none", width: "100%" }}>
                    <option value="">Select Registry</option>
                    {["Ahmedabad","Mumbai","Delhi","Chennai","Kolkata"].map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
              </div>
              <div className="mf" style={{ marginBottom: 10 }}>
                <label>Goods / Services Description</label>
                <input value={goods} onChange={e => setGoods(e.target.value)} placeholder="e.g. LED lights, lighting fixtures (Class 11)" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div className="mf" style={{ margin: 0 }}>
                  <label>Applicant / Proprietor</label>
                  <input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="e.g. ROHIT BHARTIA" />
                </div>
                <div className="mf" style={{ margin: 0 }}>
                  <label>Attorney / Agent</label>
                  <input value={attorney} onChange={e => setAttorney(e.target.value)} placeholder="e.g. MANTHAN DESAI" />
                </div>
              </div>
              <div className="mf" style={{ marginBottom: 10 }}>
                <label>Supporting Evidence / Arguments (optional)</label>
                <textarea value={evidence} onChange={e => setEvidence(e.target.value)}
                  placeholder={"e.g. Mark in use since 2018, ₹2.5Cr turnover, filing TM-M to restrict goods description..."}
                  style={{ width: "100%", height: 70, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: "12.5px", color: "var(--text)", resize: "vertical", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <select value={style} onChange={e => setStyle(e.target.value)}
                  style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", fontFamily: "var(--head)", outline: "none" }}>
                  <option value="formal">Formal Legal (Default)</option>
                  <option value="detailed">Detailed — Multiple Case Laws</option>
                  <option value="concise">Concise & Direct</option>
                </select>
                <button className="topbar-btn btn-primary" onClick={generate} disabled={streaming}
                  style={{ flex: 1, justifyContent: "center" }}>
                  {streaming
                    ? <><div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,.3)", borderTopColor: "#fff", borderRadius: "50%", animation: "spin .7s linear infinite" }} /> Generating…</>
                    : "✨ Generate Reply"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── OUTPUT PANEL ── */}
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <h3>📝 Generated Reply</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!draft} onClick={copy}>📋 Copy</button>
              <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!draft} onClick={download}>⬇ Download .txt</button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0, height: "calc(100% - 50px)", minHeight: 500, overflowY: "auto" }}>
            {!draft && !streaming ? (
              <div style={{ padding: "52px 24px", textAlign: "center", color: "var(--text3)" }}>
                <div style={{ fontSize: 42, marginBottom: 14 }}>⚖️</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Reply will appear here</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.7, maxWidth: 280, margin: "0 auto" }}>
                  Upload your examination report PDF or fill in the details manually, then click <b style={{ color: "#f0c842" }}>Generate Reply</b>
                </div>
              </div>
            ) : (
              <div style={{ padding: "18px 20px" }}>
                {streaming && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                    <div className="stream-dot" />
                    <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>Drafting reply…</span>
                  </div>
                )}
                <div style={{ fontSize: 12.5, lineHeight: 1.9, whiteSpace: "pre-wrap", color: "var(--text)", fontFamily: "var(--mono)" }}>
                  {streaming ? streamTxt : draft}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Case Laws */}
      {cases.length > 0 && (
        <div className="card">
          <div className="card-head">
            <h3>⚖️ Relevant Case Laws</h3>
            <span style={{ fontSize: 12, color: "var(--text3)" }}>{cases.length} references</span>
          </div>
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

// ── Opposition Counter-Statement Panel ───────────────────────────────────────
function OppPanel() {
  const [notice,    setNotice]    = useState("")
  const [appNo,     setAppNo]     = useState("")
  const [tmName,    setTmName]    = useState("")
  const [oppMark,   setOppMark]   = useState("")
  const [cls,       setCls]       = useState("")
  const [applicant, setApplicant] = useState("")
  const [opponent,  setOpponent]  = useState("")
  const [goods,     setGoods]     = useState("")
  const [evidence,  setEvidence]  = useState("")
  const [style,     setStyle]     = useState("formal")
  const [draft,     setDraft]     = useState("")
  const [streaming, setStreaming] = useState(false)
  const [streamTxt, setStreamTxt] = useState("")
  const [cases,     setCases]     = useState([])
  const [pdfStatus, setPdfStatus] = useState("")

  const handlePDFExtracted = (data) => {
    if (data.app_no)    setAppNo(data.app_no)
    if (data.tm_name)   setTmName(data.tm_name)
    if (data.tm_class)  setCls(data.tm_class)
    if (data.applicant) setApplicant(data.applicant)
    if (data.attorney)  {} // attorney is the drafter, not needed here
    if (data.objections || data.raw) setNotice(data.objections || data.raw || "")
    const filled = [data.app_no && `App: ${data.app_no}`, data.tm_name && `Mark: ${data.tm_name}`].filter(Boolean)
    setPdfStatus(filled.join(" · "))
  }

  const generate = async () => {
    if (!notice && !tmName) return
    const detected = detectObjTags(notice)
    setCases(getCaseLaws(detected.length ? detected : [{ sec: "11(1)" }]))
    setStreaming(true); setStreamTxt(""); setDraft("")

    const prompt = `You are an expert Indian Trademark Attorney drafting a formal Counter-Statement under Section 21 of The Trade Marks Act, 1999.

APPLICATION DETAILS:
- Application No: ${appNo}
- Applicant's Trade Mark: ${tmName}
- Opponent's Trade Mark: ${oppMark}
- Class: ${cls}
- Applicant: ${applicant}
- Opponent: ${opponent}
- Goods/Services: ${goods}

OPPOSITION NOTICE GROUNDS:
${notice || "[Draft comprehensive counter-statement addressing grounds including Section 11(1) and passing off]"}

DEFENCE ARGUMENTS:
${evidence || "Include standard counter-arguments"}

STYLE: ${style}

Draft complete Counter-Statement with:
1. Title and heading
2. Preliminary Objections to the opposition
3. Reply to each ground of opposition
4. Positive case for applicant
5. Case law citations
6. Prayer for dismissal of opposition`

    streamDraft(prompt, t => setStreamTxt(t), t => { setStreaming(false); setDraft(t) }, err => { setStreaming(false); setDraft("⚠️ Error: " + err) })
  }

  const copy = () => navigator.clipboard.writeText(draft).catch(() => {
    const ta = document.createElement("textarea"); ta.value = draft; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta)
  })

  const download = () => {
    const blob = new Blob([draft], { type: "text/plain" })
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob)
    a.download = `Counter_Statement_${appNo || tmName || "Draft"}_${new Date().toISOString().slice(0,10)}.txt`
    a.click(); URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, marginBottom: 18 }}>
        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head"><h3>📄 Opposition Notice Details</h3></div>
          <div className="card-body" style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14 }}>
            <PDFUploader label="📎 Upload Opposition Notice PDF — AI will auto-fill" onExtracted={handlePDFExtracted} />
            {pdfStatus && (
              <div style={{ fontSize: 11.5, color: "var(--teal)", background: "rgba(0,196,160,.08)", border: "1px solid rgba(0,196,160,.2)", borderRadius: 7, padding: "7px 12px" }}>
                ✅ Auto-filled: {pdfStatus}
              </div>
            )}
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
              <div className="mf">
                <label>Opposition Notice Text</label>
                <textarea value={notice} onChange={e => setNotice(e.target.value)}
                  placeholder={"Paste opposition notice content here...\n\ne.g. The Opponent files opposition under Section 11(1)(b)..."}
                  style={{ width: "100%", height: 110, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 11, fontSize: "12.5px", fontFamily: "var(--mono)", color: "var(--text)", resize: "vertical", lineHeight: 1.6, outline: "none" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div className="mf" style={{ margin: 0 }}><label>Application No.</label><input value={appNo} onChange={e => setAppNo(e.target.value)} placeholder="6001234" style={{ fontFamily: "var(--mono)" }} /></div>
                <div className="mf" style={{ margin: 0 }}><label>Applicant's Mark</label><input value={tmName} onChange={e => setTmName(e.target.value.toUpperCase())} placeholder="YOUR MARK" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div className="mf" style={{ margin: 0 }}><label>Opponent's Mark</label><input value={oppMark} onChange={e => setOppMark(e.target.value.toUpperCase())} placeholder="OPPONENT MARK" /></div>
                <div className="mf" style={{ margin: 0 }}><label>Class(es)</label><input value={cls} onChange={e => setCls(e.target.value)} placeholder="e.g. 29, 30" /></div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <div className="mf" style={{ margin: 0 }}><label>Applicant</label><input value={applicant} onChange={e => setApplicant(e.target.value)} placeholder="Your client name" /></div>
                <div className="mf" style={{ margin: 0 }}><label>Opponent</label><input value={opponent} onChange={e => setOpponent(e.target.value)} placeholder="Opposing party" /></div>
              </div>
              <div className="mf"><label>Goods / Services</label><input value={goods} onChange={e => setGoods(e.target.value)} placeholder="e.g. Dairy products, beverages" /></div>
              <div className="mf">
                <label>Defence Arguments / Evidence</label>
                <textarea value={evidence} onChange={e => setEvidence(e.target.value)} placeholder={"e.g. Mark in use since 2010, ₹5Cr turnover, no actual confusion..."}
                  style={{ width: "100%", height: 70, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: 10, fontSize: "12.5px", color: "var(--text)", resize: "vertical", outline: "none" }}
                />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <select value={style} onChange={e => setStyle(e.target.value)}
                  style={{ flex: 1, background: "var(--s2)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px", fontSize: 13, color: "var(--text)", fontFamily: "var(--head)", outline: "none" }}>
                  <option value="formal">Formal Legal Counter-Statement</option>
                  <option value="detailed">Detailed with Case Laws</option>
                  <option value="concise">Concise Counter-Statement</option>
                </select>
                <button className="topbar-btn btn-primary" onClick={generate} disabled={streaming} style={{ flex: 1, justifyContent: "center" }}>
                  {streaming ? "⏳ Generating…" : "✨ Generate Counter-Statement"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: 0 }}>
          <div className="card-head">
            <h3>📝 Counter-Statement Draft</h3>
            <div style={{ display: "flex", gap: 6 }}>
              <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!draft} onClick={copy}>📋 Copy</button>
              <button className="topbar-btn btn-ghost" style={{ fontSize: 11, padding: "5px 10px" }} disabled={!draft} onClick={download}>⬇ Download</button>
            </div>
          </div>
          <div className="card-body" style={{ padding: 0, minHeight: 500, overflowY: "auto" }}>
            {!draft && !streaming ? (
              <div style={{ padding: "52px 24px", textAlign: "center", color: "var(--text3)" }}>
                <div style={{ fontSize: 42, marginBottom: 14 }}>⚔️</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: "var(--text)" }}>Counter-Statement will appear here</div>
                <div style={{ fontSize: 12.5, lineHeight: 1.7 }}>Upload opposition PDF or fill details, then click <b style={{ color: "#f0c842" }}>Generate</b></div>
              </div>
            ) : (
              <div style={{ padding: "18px 20px" }}>
                {streaming && (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--border)" }}>
                    <div className="stream-dot" />
                    <span style={{ fontSize: 12, color: "var(--teal)", fontWeight: 600 }}>Drafting counter-statement…</span>
                  </div>
                )}
                <div style={{ fontSize: 12.5, lineHeight: 1.9, whiteSpace: "pre-wrap", color: "var(--text)", fontFamily: "var(--mono)" }}>
                  {streaming ? streamTxt : draft}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

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

// ── Main Draft page ───────────────────────────────────────────────────────────
export default function Draft() {
  const [activeTab, setActiveTab] = useState("exam")
  const [history,   setHistory]   = useState([])

  return (
    <>
      <div className="tabs">
        {[
          { id: "exam", label: "📋 Examination Report Reply" },
          { id: "opp",  label: "⚔️ Opposition Counter-Statement" },
          { id: "history", label: `🗂 Draft History${history.length > 0 ? ` (${history.length})` : ""}` },
        ].map(t => (
          <div key={t.id} className={`tab${activeTab === t.id ? " on" : ""}`} onClick={() => setActiveTab(t.id)}>{t.label}</div>
        ))}
      </div>

      {activeTab === "exam"    && <ExamPanel />}
      {activeTab === "opp"     && <OppPanel />}
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
            ) : history.map(d => (
              <div key={d.id} style={{ display: "flex", gap: 14, padding: "14px 18px", borderBottom: "1px solid var(--border)", alignItems: "flex-start" }}>
                <div style={{ fontSize: 24 }}>{d.type.includes("Exam") ? "📋" : "⚔️"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{d.tmName}</div>
                  <div style={{ fontSize: 11, color: "var(--text3)" }}>{d.type} · {d.date}</div>
                  <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" }}>{d.text?.slice(0, 120)}…</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
