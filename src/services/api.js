/**
 * services/api.js  —  MarkShield Frontend API Service
 * VITE_API_URL is set in .env / .env.production
 */

var BASE = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

function apiFetch(path, options, timeoutMs) {
  if (!options) options = {}
  if (!timeoutMs) timeoutMs = 60000

  var controller = new AbortController()
  var timer = setTimeout(function() { controller.abort() }, timeoutMs)

  var fetchOptions = {
    headers: { "Content-Type": "application/json" },
    signal: controller.signal
  }
  if (options.method) fetchOptions.method = options.method
  if (options.body)   fetchOptions.body   = options.body

  return fetch(BASE + path, fetchOptions)
    .then(function(res) {
      clearTimeout(timer)
      return res.json().catch(function() { return { error: "HTTP " + res.status } })
    })
    .catch(function(err) {
      clearTimeout(timer)
      if (err.name === "AbortError") {
        throw new Error("Request timed out. Backend may be waking up — wait 30s and retry.")
      }
      throw err
    })
}

// ── Health ────────────────────────────────────────────────────────────────────

export function checkBackend() {
  return apiFetch("/health", {}, 15000)
    .then(function(data) { return !!(data && data.status === "ok") })
    .catch(function() { return false })
}

// ── eFiling ───────────────────────────────────────────────────────────────────

export function efilingLogin(username, password) {
  return apiFetch("/efiling/login", {
    method: "POST",
    body: JSON.stringify({ username: username, password: password })
  }, 60000)
}

export function efilingStatus() { return apiFetch("/efiling/status") }
export function efilingLogout() { return apiFetch("/efiling/logout", { method: "POST" }) }
export function efilingPortfolio() { return apiFetch("/efiling/portfolio", {}, 60000) }

// ── Public Search ─────────────────────────────────────────────────────────────
// Exported as both publicSearch and fetchPublicSearch (Search.jsx uses the latter)

export function publicSearch(opts) {
  if (!opts) opts = {}
  var q    = opts.q || ""
  var type = opts.type || "wordmark"
  var cls  = opts["class"] || opts.tmClass || ""
  var p    = new URLSearchParams({ q: q })
  if (type) p.set("type",  type)
  if (cls)  p.set("class", cls)
  return apiFetch("/public-search?" + p.toString())
}

export function fetchPublicSearch(opts) { return publicSearch(opts) }

// ── Cause List ────────────────────────────────────────────────────────────────
// Scraper.jsx imports this as fetchCauseList

export function fetchCauseList(opts) {
  if (!opts) opts = {}
  var p = new URLSearchParams()
  if (opts.date)     p.set("date",     opts.date)
  if (opts.agent)    p.set("agent",    opts.agent)
  if (opts.location) p.set("location", opts.location)
  var qs = p.toString() ? "?" + p.toString() : ""
  return apiFetch("/cause-list" + qs)
}

// ── Agent Hearings ────────────────────────────────────────────────────────────
// Scraper.jsx imports this as fetchAgentHearings — routes to cause-list with agent filter

export function fetchAgentHearings(opts) {
  if (!opts) opts = {}
  var p = new URLSearchParams()
  if (opts.agent) p.set("agent",   opts.agent)
  if (opts.from)  p.set("date",    opts.from)
  if (opts.to)    p.set("date_to", opts.to)
  var qs = p.toString() ? "?" + p.toString() : ""
  return apiFetch("/cause-list" + qs)
}

// ── Application lookup ────────────────────────────────────────────────────────

export function fetchApplication(appNo) {
  return apiFetch("/application/" + encodeURIComponent(appNo))
}

// Exported as both names — Scraper.jsx uses fetchAppsBulk
export function fetchApplicationsBulk(appNos) {
  return apiFetch("/applications/bulk", {
    method: "POST",
    body: JSON.stringify({ app_nos: appNos })
  }, 120000)
}

export function fetchAppsBulk(appNos) { return fetchApplicationsBulk(appNos) }

// ── Queue List ────────────────────────────────────────────────────────────────

export function fetchQueueList(opts) {
  if (!opts) opts = {}
  var p = new URLSearchParams()
  if (opts.username) p.set("username", opts.username)
  if (opts.appNo)    p.set("app_no",   opts.appNo)
  if (opts.app_no)   p.set("app_no",   opts.app_no)
  var qs = p.toString() ? "?" + p.toString() : ""
  return apiFetch("/queue-list" + qs)
}

export function fetchPendingReplies() {
  return apiFetch("/queue-list/pending-replies")
}
