import React, { useEffect } from "react"

export default function Modal({ isOpen, onClose, title, sub, children, style }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === "Escape") onClose() }
    if (isOpen) document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      className="overlay open"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="modal" style={style}>
        {title && <div className="modal-title">{title}</div>}
        {sub && <div className="modal-sub">{sub}</div>}
        {children}
      </div>
    </div>
  )
}
