/* =========================================
   AnimeHunt Admin Simple Auth Handler
========================================= */

const API_BASE = "https://animehunt-backend-rhg6.onrender.com";

// ===============================
// LOGIN FUNCTION
// ===============================
async function loginAdmin(username, password) {
  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok) {
      alert(data.message || "Login failed");
      return;
    }

    // Save JWT
    localStorage.setItem("AUTH_TOKEN", data.accessToken);

    // Redirect to dashboard
    window.location.href = "index.html";

  } catch (error) {
    console.error("Login Error:", error);
    alert("Server error");
  }
}

// ===============================
// AUTO AUTH CHECK
// ===============================
const storedToken = localStorage.getItem("AUTH_TOKEN");

if (storedToken) {
  window.__AUTH_TOKEN__ = storedToken;
} else {
  if (!location.pathname.includes("login")) {
    location.href = "login.html";
  }
}

// ===============================
// AUTO FETCH WRAPPER
// ===============================
const originalFetch = window.fetch;

window.fetch = async (url, options = {}) => {

  if (url.startsWith("/api")) {
    url = API_BASE + url;
  }

  options.headers = options.headers || {};

  const token = localStorage.getItem("AUTH_TOKEN");

  if (token) {
    options.headers["Authorization"] = "Bearer " + token;
  }

  const response = await originalFetch(url, options);

  if (response.status === 401) {
    localStorage.removeItem("AUTH_TOKEN");
    location.href = "login.html";
  }

  return response;
};
