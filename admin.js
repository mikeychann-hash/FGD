// admin.js
// Admin panel with auto-login and remove buttons

let apiKey = "admin123";
let socket = null;

document.addEventListener("DOMContentLoaded", () => {
  localStorage.setItem("apiKey", apiKey);
  login(apiKey);
  document.getElementById("createBotForm").addEventListener("submit", handleCreateBot);
});

async function login(key) {
  try {
    const response = await fetch("/api/bots", { headers: { "X-API-Key": key } });
    if (!response.ok) throw new Error("Invalid API key");
    apiKey = key;
    localStorage.setItem("apiKey", key);
    document.getElementById("loginScreen").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    connectWebSocket();
    await loadBots();
  } catch (err) {
    console.error(err);
  }
}

function connectWebSocket() {
  socket = io({ auth: { apiKey } });
  socket.on("connect", () => logConsole("Connected to backend", "success"));
  socket.on("disconnect", () => logConsole("Disconnected", "error"));
}

async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

async function handleCreateBot(e) {
  e.preventDefault();
  const name = document.getElementById("botName").value || `bot_${Date.now()}`;
  const role = document.getElementById("botRole").value;
  const desc = document.getElementById("botDescription").value;
  try {
    await apiCall("/api/bots", {
      method: "POST",
      body: JSON.stringify({ name, role, description: desc }),
    });
    showNotification(`Spawned ${name}`, "success");
    await loadBots();
  } catch (err) {
    showNotification("Create failed: " + err.message, "error");
  }
}

async function deleteBot(botId) {
  if (!confirm(`Remove bot ${botId}?`)) return;
  try {
    await apiCall(`/api/bots/${botId}`, { method: "DELETE" });
    showNotification(`Removed ${botId}`, "success");
    await loadBots();
  } catch (err) {
    showNotification("Remove failed: " + err.message, "error");
  }
}

async function loadBots() {
  try {
    const data = await apiCall("/api/bots");
    const list = document.getElementById("botList");
    if (!data.bots?.length) {
      list.innerHTML = "<div>No bots</div>";
      return;
    }
    list.innerHTML = data.bots.map(b => `
      <div class="bot-item">
        <strong>${b.name}</strong> (${b.role || "unknown"})
        <button onclick="deleteBot('${b.name}')">🗑️ Remove</button>
      </div>`).join("");
  } catch (err) {
    console.error(err);
  }
}

function logConsole(msg, type="info") {
  const el = document.getElementById("console");
  const div = document.createElement("div");
  div.className = "console-line " + type;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function showNotification(msg, type="info") {
  const n = document.createElement("div");
  n.className = `notification ${type}`;
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 4000);
}
