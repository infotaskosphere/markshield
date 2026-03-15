import React, { useState, useRef, useEffect } from "react"
import { fetchAIChat } from "../services/api"

const CLAUDE_SYSTEM = `You are LexAI, an expert AI trademark attorney assistant for the MarkShield platform.
You have deep knowledge of Indian trademark law, IP India procedures, the Trademarks Act 1999, and trademark prosecution.
The user is a registered IP attorney using MarkShield to manage their trademark portfolio.
Be concise, actionable, and use specific legal knowledge. Format clearly with bullet points where helpful.
When asked about specific trademarks in the user's portfolio, note that portfolio data is loaded separately — answer generally if no context is provided.`

const QUICK_CHIPS = [
  { label: "📅 Hearing prep checklist", msg: "What should I prepare before a trademark hearing at IP India?" },
  { label: "📝 Opposition response steps", msg: "How should I respond to a trademark opposition notice under TM Act 1999?" },
  { label: "🔍 Class selection help", msg: "Which trademark classes should I file for a food delivery app?" },
  { label: "⚖️ Sec 9 vs Sec 11 objections", msg: "Explain the difference between Section 9 and Section 11 objections and how to overcome them." },
  { label: "📊 TM registration timeline", msg: "What is the typical timeline for trademark registration in India from filing to registration?" },
]

export default function AI({ context }) {
  const name = context?.currentUser?.name || context?.agentProfile?.fullName || ""
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "U"

  const [messages, setMessages] = useState([
    {
      role: "ai",
      text: `Hello${name ? ` ${name.split(" ")[0]}` : ""}! I'm LexAI, your AI trademark intelligence assistant.\n\nI can help you with:\n• Hearing preparation & legal strategy\n• Trademark conflict analysis\n• Opposition & examination report drafting\n• Class selection and filing advice\n• Indian trademark law (TM Act 1999)\n\nWhat would you like to know today?`,
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
    setMessages(m => [...m, { role: "user", text: msg, time: now }, { role: "ai", text: "...", time: now, typing: true }])
    setLoading(true)

    try {
      // Build conversation history for multi-turn context
      const history = messages
        .filter(m => !m.typing && m.role !== "ai" || (m.role === "ai" && m.text !== "..."))
        .map(m => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }))
        .filter(m => m.content && m.content !== "...")
      history.push({ role: "user", content: msg })

      const data = await fetchAIChat(history, CLAUDE_SYSTEM)
      const reply = data.reply || "Sorry, I couldn\'t get a response. Please try again."
      setMessages(m => [...m.filter(x => !x.typing), { role: "ai", text: reply, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }])
    } catch (e) {
      setMessages(m => [...m.filter(x => !x.typing), { role: "ai", text: "Connection error — backend may be waking up. Please wait 30s and try again.", time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }])
    }
    setLoading(false)
  }

  const formatText = (text) =>
    text.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>").replace(/\n/g, "<br>")

  return (
    <div className="chat-shell">
      <div className="chat-header">
        <div className="ai-avatar">⚖️</div>
        <div>
          <div className="ai-name">LexAI — Trademark Intelligence</div>
          <div className="ai-status">Online · Powered by Claude</div>
        </div>
        <div style={{ marginLeft: "auto", fontSize: "11.5px", color: "var(--text3)", fontFamily: "var(--mono)" }}>
          TM Act 1999 · IP India · CGPDTM
        </div>
      </div>

      <div className="chat-messages" ref={messagesRef}>
        {messages.map((msg, i) => (
          <div key={i} className={`msg${msg.role === "user" ? " user" : ""}`}>
            <div className={`msg-avatar ${msg.role === "ai" ? "ai-av" : "user-av"}`}>
              {msg.role === "ai" ? "⚖" : initials}
            </div>
            <div>
              {msg.typing ? (
                <div className="msg-bubble">
                  <div className="typing-indicator"><span /><span /><span /></div>
                </div>
              ) : (
                <div className="msg-bubble" dangerouslySetInnerHTML={{ __html: formatText(msg.text) }} />
              )}
              <div className="msg-time">{msg.time}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="quick-chips">
        {QUICK_CHIPS.map(c => (
          <div key={c.label} className="qchip" onClick={() => sendMessage(c.msg)}>{c.label}</div>
        ))}
      </div>

      <div className="chat-input-area">
        <textarea
          className="chat-input"
          placeholder="Ask anything about trademarks, hearings, opposition, or Indian TM law..."
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
        />
        <button className="chat-send" onClick={() => sendMessage()} disabled={loading || !input.trim()}>➤</button>
      </div>
    </div>
  )
}
