/* =========================================
   AnimeHunt Admin Auth Handler
========================================= */

const API_BASE = "https://animehunt-backend.onrender.com"; 
// ⚠️ Apna real backend URL daalo

// Load token
const storedToken = localStorage.getItem("AUTH_TOKEN");

if (storedToken) {
  window.__AUTH_TOKEN__ = storedToken;
} else {
  // Agar login page nahi hai to redirect karo
  if (!location.pathname.includes("login") &&
      !location.pathname.includes("verification")) {
    location.href = "login.html";
  }
}

/* ===============================
   AUTO FETCH WRAPPER
================================ */
const originalFetch = window.fetch;

window.fetch = async (url, options = {}) => {

  // Agar relative API call hai to base add karo
  if (url.startsWith("/api")) {
    url = API_BASE + url;
  }

  options.headers = options.headers || {};

  if (window.__AUTH_TOKEN__) {
    options.headers["Authorization"] =
      "Bearer " + window.__AUTH_TOKEN__;
  }

  const response = await originalFetch(url, options);

  // Agar unauthorized ho jaye to logout
  if (response.status === 401) {
    localStorage.removeItem("AUTH_TOKEN");
    location.href = "login.html";
  }

  return response;
};
