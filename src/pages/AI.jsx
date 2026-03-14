import React, { useState, useRef, useEffect } from "react"

const CLAUDE_SYSTEM = `You are LexAI, an expert AI trademark attorney assistant for the MarkShield platform.
You have deep knowledge of Indian trademark law, IP India procedures, the Trademarks Act 1999, and trademark prosecution.
The user is a registered IP attorney. Their portfolio includes: FRESHMART (Class 29/30, hearing 17 Mar 2026), TECHVEDA (Class 9/42, objected), ZENSPA (Class 44, hearing 24 Mar), CLOUDPATH (Class 38/42), ROYALEE (registered), and more.
Be concise, actionable, and use specific legal knowledge. Format clearly with bullet points where helpful.`

const QUICK_CHIPS = [
  { label: "📅 This week's hearings", msg: "What are my upcoming hearings this week?" },
  { label: "⚠️ FRESHMART objection", msg: "Explain the objection on FRESHMART trademark" },
  { label: "📝 Opposition response", msg: "How should I respond to a trademark opposition notice?" },
  { label: "🔍 Class selection help", msg: "Which trademark classes should I file for a food delivery app?" },
  { label: "📊 TECHVEDA status", msg: "What is the current status of my TECHVEDA application?" },
]

export default function AI({ context }) {
  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: "Hello! I'm LexAI, your AI trademark intelligence assistant. I have access to your portfolio of 24 trademarks and live IP India data.\n\nI can help you with:\n• Hearing preparation & strategy\n• Trademark conflict analysis\n• Opposition drafting\n• Status explanations & next steps\n• Class selection advice\n\nWhat would you like to know today?",
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)
  const messagesRef = useRef(null)

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight
  }, [messages])

  const sendMessage = async (text) => {
    const msg = (text || input).trim()
    if (!msg || loading) return
    setInput("")

    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    const userMsg = { role: "user", text: msg, time: now }
    const typingMsg = { role: "ai", text: "...", time: now, typing: true }

    setMessages((m) => [...m, userMsg, typingMsg])
    setLoading(true)

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: CLAUDE_SYSTEM,
          messages: [{ role: "user", content: msg }],
        }),
      })
      const data = await res.json()
      const reply = data.content?.[0]?.text || "Sorry, I encountered an error. Please try again."
      setMessages((m) => [...m.filter((x) => !x.typing), { role: "ai", text: reply, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }])
    } catch (e) {
      setMessages((m) => [...m.filter((x) => !x.typing), { role: "ai", text: "Connection error. Please check your network and try again.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }])
    }
    setLoading(false)
  }

  const formatText = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")
      .replace(/\n/g, "<br>")
  }

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <div className="ai-avatar">🤖</div>
        <div>
          <div className="ai-name">LexAI — Trademark Intelligence</div>
          <div className="ai-status">Online · Powered by Claude</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "11.5px", color: "var(--text3)", fontFamily: "var(--mono)" }}>
          Context-aware · IP India integrated
        </div>
      </div>

      <div className="chat-messages" ref={messagesRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`msg${msg.role === "user" ? " user" : ""}`}>
            <div className={`msg-avatar ${msg.role === "ai" ? "ai-av" : "user-av"}`}>
              {msg.role === "ai" ? "🤖" : "RS"}
            </div>
            <div>
              {msg.typing ? (
                <div className="msg-bubble">
                  <div className="typing-indicator">
                    <span /><span /><span />
                  </div>
                </div>
              ) : (
                <div
                  className="msg-bubble"
                  dangerouslySetInnerHTML={{ __html: formatText(msg.text) }}
                />
              )}
              <div className="msg-time">{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-chips">
        {QUICK_CHIPS.map((c) => (
          <div key={c.label} className="qchip" onClick={() => sendMessage(c.msg)}>
            {c.label}
          </div>
        ))}
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="Ask anything about trademarks..."
          rows={1}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
        />
        <button className="chat-send" onClick={() => sendMessage()} disabled={loading || !input.trim()}>
          ➤
        </button>
      </div>
    </div>
  )
}
