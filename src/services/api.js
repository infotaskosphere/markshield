/**
 * services/api.js  —  MarkShield Frontend API Service
 *
 * Centralises all backend calls so components never inline fetch() URLs.
 * VITE_API_URL is set in .env / .env.production
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

// Render free tier needs extra time to wake from cold-start (up to 90 s).
// 60 000 ms gives it a fair chance without hanging forever.
const DEFAULT_TIMEOUT_MS = 60000

/**
 * Thin fetch wrapper with configurable timeout.
 * Throws on network / timeout errors; returns parsed JSON on success.
 */
async function apiFetch(path, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      ...options,
    })
    clearTimeout(timer)

    // Try to parse JSON even for error responses (backend sends {error:...})
    const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    return data
  } catch (err) {
    clearTimeout(timer)
    if (err.name === "AbortError") {
      throw new Error(
        "Request timed out. The backend may be waking up on Render — please wait 30 s and try again."
      )
    }
    throw err
  }
}

// ── Health / connectivity ─────────────────────────────────────────────────────

/**
 * Returns true if the backend is reachable and healthy.
 * Used by TMASetup before attempting login.
 */
export async function checkBackend() {
  try {
    const data = await apiFetch("/health", {}, 15000)
    return data?.status === "ok"
  } catch {
    return false
  }
}

// ── eFiling ───────────────────────────────────────────────────────────────────

/**
 * POST /api/efiling/login
 * Returns { success: true/false, message, username? }
 */
export async function efilingLogin(username, password) {
  return apiFetch(
    "/efiling/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    60000          // login hits IP India — give it a full minute
  )
}

/**
 * GET /api/efiling/status
 * Returns { authenticated: bool, username: string|null }
 */
export async function efilingStatus() {
  return apiFetch("/efiling/status")
}

/**
 * POST /api/efiling/logout
 */
export async function efilingLogout() {
  return apiFetch("/efiling/logout", { method: "POST" })
}

/**
 * GET /api/efiling/portfolio
 * Requires a prior successful efilingLogin() in the same session.
 */
export async function efilingPortfolio() {
  return apiFetch("/efiling/portfolio", {}, 60000)
}

// ── Cause List ────────────────────────────────────────────────────────────────

/**
 * GET /api/cause-list
 * @param {string} date       DD/MM/YYYY (defaults to today on backend)
 * @param {string} agent      case-insensitive agent name filter
 * @param {string} location   Delhi | Mumbai | Chennai | Kolkata | Ahmedabad
 */
export async function fetchCauseList({ date, agent, location } = {}) {
  const params = new URLSearchParams()
  if (date)     params.set("date",     date)
  if (agent)    params.set("agent",    agent)
  if (location) params.set("location", location)
  const qs = params.toString() ? `?${params}` : ""
  return apiFetch(`/cause-list${qs}`)
}

// ── Application / e-Register ──────────────────────────────────────────────────

/**
 * GET /api/application/:appNo
 */
export async function fetchApplication(appNo) {
  return apiFetch(`/application/${encodeURIComponent(appNo)}`)
}

/**
 * POST /api/applications/bulk
 * @param {string[]} appNos
 */
export async function fetchApplicationsBulk(appNos) {
  return apiFetch(
    "/applications/bulk",
    { method: "POST", body: JSON.stringify({ app_nos: appNos }) },
    120000   // bulk can take a while
  )
}

// ── Public Search ─────────────────────────────────────────────────────────────

/**
 * GET /api/public-search
 * @param {string} q           search term
 * @param {string} type        wordmark | proprietor | application
 * @param {string} tmClass     numeric class string, e.g. "29"
 */
export async function publicSearch({ q, type = "wordmark", tmClass = "" } = {}) {
  const params = new URLSearchParams({ q })
  if (type)    params.set("type",  type)
  if (tmClass) params.set("class", tmClass)
  return apiFetch(`/public-search?${params}`)
}

// ── Queue List ────────────────────────────────────────────────────────────────

/**
 * GET /api/queue-list
 * @param {string} username   TMA code
 * @param {string} appNo      specific application number (optional)
 */
export async function fetchQueueList({ username, appNo } = {}) {
  const params = new URLSearchParams()
  if (username) params.set("username", username)
  if (appNo)    params.set("app_no",   appNo)
  const qs = params.toString() ? `?${params}` : ""
  return apiFetch(`/queue-list${qs}`)
}

/**
 * GET /api/queue-list/pending-replies
 */
export async function fetchPendingReplies() {
  return apiFetch("/queue-list/pending-replies")
}
