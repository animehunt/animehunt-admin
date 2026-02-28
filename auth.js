/* =========================================
   SIMPLE LOGIN AUTH (NO JWT)
========================================= */

const API_BASE = "https://animehunt-backend-rhg6.onrender.com";

/* ===============================
   LOGIN FUNCTION
================================ */
async function loginAdmin(username, password) {
  try {
    const response = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ username, password })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert("Invalid credentials");
      return;
    }

    // SIMPLE LOGIN FLAG
    localStorage.setItem("LOGGED_IN", "true");

    window.location.href = "dashboard.html";

  } catch (error) {
    console.error("Login Error:", error);
    alert("Server error");
  }
}

/* ===============================
   PAGE PROTECTION
================================ */
if (!location.pathname.includes("login")) {
  if (localStorage.getItem("LOGGED_IN") !== "true") {
    location.href = "login.html";
  }
}
