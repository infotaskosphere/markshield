import axios from "axios"

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5000/api",
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  // Increased from 20s → 45s because IP India + Render cold-starts can be slow.
  // The backend itself uses 40s per request, so 45s gives a comfortable margin.
  timeout: 45000,
})

api.interceptors.request.use(c => c, e => Promise.reject(e))
api.interceptors.response.use(r => r.data, e => {
  console.error("[MarkShield API Error]", e.message)
  return Promise.reject(e)
})

export const checkBackend = async () => {
  try { await api.get("/health"); return true }
  catch { return false }
}

// ── Scraper endpoints ──────────────────────────────────────────────────────────
export const fetchCauseList      = (params)       => api.get("/cause-list", { params })
export const fetchAppsBulk       = (appNos)       => api.post("/applications/bulk", { app_nos: appNos })
export const fetchAgentHearings  = (params)       => api.get("/agent/hearings", { params })
export const fetchQueueList      = (params)       => api.get("/queue-list", { params })
export const fetchPendingReplies = ()             => api.get("/queue-list/pending-replies")
export const fetchPublicSearch   = (params)       => api.get("/public-search", { params })
export const exportReport        = (fmt, data)    => api.post(`/export/${fmt}`, data, { responseType: "blob" })

// ── eFiling / TMA Auth endpoints ───────────────────────────────────────────────
// Returns { success: true/false, message: "..." }
export const efilingLogin  = (username, password) =>
  api.post("/efiling/login", { username, password })

// Returns { success: true }
export const efilingLogout = () =>
  api.post("/efiling/logout")

// Returns { authenticated: true/false, username: "..." }
export const efilingStatus = () =>
  api.get("/efiling/status")

// Returns { applications: [...], total: N }
export const efilingPortfolio = () =>
  api.get("/efiling/portfolio")

export default api
