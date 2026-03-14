/**
 * services/api.js  —  MarkShield Frontend API Service
 * VITE_API_URL is set in .env / .env.production
 */

const BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

const DEFAULT_TIMEOUT_MS = 60000

async function apiFetch(path, options, timeoutMs) {
  if (options === undefined) options = {}
  if (timeoutMs === undefined) timeoutMs = DEFAULT_TIMEOUT_MS

  const controller = new AbortController()
  const timer = setTimeout(function() { controller.abort() }, timeoutMs)

  try {
    const res = await fetch(BASE + path, Object.assign({
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    }, options))
    clearTimeout(timer)
    const data = await res.json().catch(function() { return { error: "HTTP " + res.status } })
    return data
  } catch (err) {
    clearTimeout(timer)
    if (err.name === "AbortError") {
      throw new Error("Request timed out. The backend may be waking up on Render — please wait 30s and try again.")
    }
    throw err
  }
}

// ── Health ────────────────────────────────────────────────────────────────────

export async function checkBackend() {
  try {
    const data = await apiFetch("/health", {}, 15000)
    return data && data.status === "ok"
  } catch (e) {
    return false
  }
}

// ── eFiling ───────────────────────────────────────────────────────────────────

export async function efilingLogin(username, password) {
  return apiFetch("/efiling/login", {
    method: "POST",
    body: JSON.stringify({ username: username, password: password }),
  }, 60000)
}

export async function efilingStatus() {
  return apiFetch("/efiling/status")
}

export async function efilingLogout() {
  return apiFetch("/efiling/logout", { method: "POST" })
}

export async function efilingPortfolio() {
  return apiFetch("/efiling/portfolio", {}, 60000)
}

// ── Public Search ─────────────────────────────────────────────────────────────

export async function publicSearch(opts) {
  if (!opts) opts = {}
  var q = opts.q || ""
  var type = opts.type || "wordmark"
  var tmClass = opts.tmClass || opts["class"] || ""
  var params = new URLSearchParams({ q: q })
  if (type) params.set("type", type)
  if (tmClass) params.set("class", tmClass)
  return apiFetch("/public-search?" + params.toString())
}

// Alias — Search.jsx uses this name
export async function fetchPublicSearch(opts) {
  return publicSearch(opts)
}

// ── Cause List ────────────────────────────────────────────────────────────────

export async function fetchCauseList(opts) {
  if (!opts) opts = {}
  var params = new URLSearchParams()
  if (opts.date)     params.set("date",     opts.date)
  if (opts.agent)    params.set("agent",    opts.agent)
  if (opts.location) params.set("location", opts.location)
  var qs = params.toString() ? "?" + params.toString() : ""
  return apiFetch("/cause-list" + qs)
}

// ── Application / e-Register ──────────────────────────────────────────────────

export async function fetchApplication(appNo) {
  return apiFetch("/application/" + encodeURIComponent(appNo))
}

export async function fetchApplicationsBulk(appNos) {
  return apiFetch("/applications/bulk", {
    method: "POST",
    body: JSON.stringify({ app_nos: appNos }),
  }, 120000)
}

// ── Queue List ────────────────────────────────────────────────────────────────

export async function fetchQueueList(opts) {
  if (!opts) opts = {}
  var params = new URLSearchParams()
  if (opts.username) params.set("username", opts.username)
  if (opts.appNo)    params.set("app_no",   opts.appNo)
  var qs = params.toString() ? "?" + params.toString() : ""
  return apiFetch("/queue-list" + qs)
}

export async function fetchPendingReplies() {
  return apiFetch("/queue-list/pending-replies")
}
