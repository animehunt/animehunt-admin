/* ================================================================
   auth.js — AnimeHunt Admin CMS — Shared Auth Layer
   File: js/auth.js

   Every admin HTML page includes this via <script src="/js/auth.js">
   and calls a small set of methods on the global `Auth` object:

     Auth.protect()          — call once per page, synchronously, near
                                the bottom of the page's <script>. If
                                there's no stored access token, redirects
                                to Login.html immediately. Does NOT
                                verify the token against the server (that
                                happens naturally on the page's first
                                real API call — see the 401 handling in
                                Auth.headers()'s fetch wrapper below).
                                This mirrors how every page in this
                                codebase actually calls it: synchronously,
                                never awaited, immediately followed by
                                that page's own data-loading call.

     Auth.showUsername(id)   — fills the element with the given id with
                                the logged-in admin's username, from the
                                token payload (no extra network request).

     Auth.headers()           — returns { Authorization: 'Bearer <token>' }
                                for use in fetch() calls. Every page in
                                this codebase spreads this into its own
                                headers object.

     Auth.logout()            — calls POST /auth/logout (best-effort;
                                network failure doesn't block logout),
                                clears session storage, redirects to
                                Login.html.

     Auth.getAdmin()          — returns the decoded token payload (id,
                                username, role) or null. Used by pages
                                that want more than just the username.

   Token storage: sessionStorage (not localStorage) — matches
   Login.html's explicit choice ("XSS safer, clears on tab close").

   Token refresh: access tokens are short-lived (15 min, per
   adminAuth.js's ACCESS_TOKEN_EXPIRY). Auth.headers() is synchronous
   (every call site uses it inline inside a fetch() options object,
   never awaited), so it cannot itself perform an async refresh. Instead,
   this file runs a silent background refresh on a timer well inside
   that 15-minute window, so tokens are proactively replaced before they
   expire during a normal admin session — normal API calls should never
   actually hit the expiry. As a fallback for the rare edge case (laptop
   sleep, long-idle tab) where a request still goes out with an expired
   token, wrapFetch() below catches the 401, attempts one synchronous
   refresh-and-retry, and only then falls back to a hard logout.
================================================================ */

;(function () {
  const TOKEN_KEY   = 'admin_access_token'
  const REFRESH_KEY = 'admin_refresh_token'
  const LOGIN_PAGE  = 'Login.html'
  const API         = '/api/admin'

  // 15-minute access tokens (see adminAuth.js's ACCESS_TOKEN_EXPIRY) —
  // refresh at the 10-minute mark, well before expiry, so a normal
  // session never actually hits a 401 from staleness.
  const REFRESH_INTERVAL_MS = 10 * 60 * 1000

  function getToken()        { return sessionStorage.getItem(TOKEN_KEY) }
  function getRefreshToken() { return sessionStorage.getItem(REFRESH_KEY) }

  function setTokens(accessToken, refreshToken) {
    sessionStorage.setItem(TOKEN_KEY, accessToken)
    if (refreshToken) sessionStorage.setItem(REFRESH_KEY, refreshToken)
  }

  function clearTokens() {
    sessionStorage.removeItem(TOKEN_KEY)
    sessionStorage.removeItem(REFRESH_KEY)
  }

  // Decode a JWT payload without verifying the signature — this is only
  // ever used to read non-sensitive display fields (username, role) that
  // the server already gave us; the server independently verifies the
  // signature on every real API call. Never trust this for access
  // control decisions.
  function decodePayload(token) {
    try {
      const part = token.split('.')[1]
      const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'))
      return JSON.parse(decodeURIComponent(escape(json)))
    } catch {
      return null
    }
  }

  function redirectToLogin() {
    clearTokens()
    window.location.href = LOGIN_PAGE
  }

  let refreshInFlight = null

  async function refreshAccessToken() {
    // Coalesce concurrent refresh attempts (e.g. two tabs, or a timer
    // tick racing a 401-triggered retry) into a single request.
    if (refreshInFlight) return refreshInFlight

    const refreshToken = getRefreshToken()
    if (!refreshToken) return false

    refreshInFlight = (async () => {
      try {
        const res = await fetch(`${API}/auth/refresh`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ refreshToken })
        })
        if (!res.ok) return false

        const json = await res.json()
        if (!json.success || !json.data?.accessToken) return false

        setTokens(json.data.accessToken, null) // refresh token itself doesn't rotate
        return true
      } catch {
        return false
      } finally {
        refreshInFlight = null
      }
    })()

    return refreshInFlight
  }

  // Background proactive refresh — runs for as long as the tab/page is
  // open. Cleared implicitly on navigation/reload (each page re-inits).
  setInterval(() => {
    if (getToken()) refreshAccessToken()
  }, REFRESH_INTERVAL_MS)

  const Auth = {
    protect() {
      if (!getToken()) {
        redirectToLogin()
      }
    },

    showUsername(elementId) {
      const el = document.getElementById(elementId)
      if (!el) return
      const token = getToken()
      const payload = token ? decodePayload(token) : null
      el.textContent = payload?.username || ''
    },

    getAdmin() {
      const token = getToken()
      if (!token) return null
      const payload = decodePayload(token)
      if (!payload) return null
      return { id: payload.sub, username: payload.username, role: payload.role }
    },

    headers() {
      const token = getToken()
      return token ? { Authorization: `Bearer ${token}` } : {}
    },

    // Wraps fetch() with automatic 401 -> refresh -> retry-once, then
    // hard logout if the retry also fails. Available for pages that
    // want it, but not required — every page's Auth.headers() usage
    // continues to work exactly as-is even without ever calling this;
    // this only adds a safety net for the rare stale-token edge case
    // described in the file header, and is not itself required for
    // any of the 21 pages' existing fetch() calls to function.
    async fetch(url, options = {}) {
      const doFetch = () => fetch(url, {
        ...options,
        headers: { ...(options.headers || {}), ...Auth.headers() }
      })

      let res = await doFetch()

      if (res.status === 401 && getRefreshToken()) {
        const refreshed = await refreshAccessToken()
        if (refreshed) {
          res = await doFetch()
        }
      }

      if (res.status === 401) {
        redirectToLogin()
      }

      return res
    },

    async logout() {
      try {
        await fetch(`${API}/auth/logout`, {
          method:  'POST',
          headers: Auth.headers()
        })
      } catch {
        // Best-effort — still log out locally even if the network call fails
      }
      redirectToLogin()
    }
  }

  window.Auth = Auth
})()
