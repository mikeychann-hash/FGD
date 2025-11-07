// admin.js
// Admin panel with secure login and bot controls

let apiKey = "";
let socket = null;
let refreshTimeout = null;

document.addEventListener("DOMContentLoaded", async () => {
  // Auto-login with default API key for local development
  const DEFAULT_API_KEY = "folks123";
  apiKey = localStorage.getItem("apiKey") || DEFAULT_API_KEY;

  const apiKeyInput = document.getElementById("apiKeyInput");
  if (apiKeyInput) {
    apiKeyInput.value = apiKey;
  }

  // Auto-login if we have an API key
  if (apiKey) {
    try {
      await login(apiKey);
      console.log("Auto-login successful");
    } catch (err) {
      // If auto-login fails, show login screen
      console.log("Auto-login failed, showing login screen");
      apiKey = DEFAULT_API_KEY;
      if (apiKeyInput) {
        apiKeyInput.value = apiKey;
      }
    }
  }

  document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
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
    showNotification(err.message || "Login failed", "error");
    throw err;
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const input = document.getElementById("apiKeyInput");
  const key = input?.value.trim();

  if (!key) {
    showNotification("API key is required", "error");
    return;
  }

  try {
    await login(key);
  } catch (err) {
    console.error(err);
  }
}

function connectWebSocket() {
  socket = io({ auth: { apiKey } });
  socket.on("connect", () => logConsole("Connected to backend", "success"));
  socket.on("disconnect", () => logConsole("Disconnected", "error"));
  socket.on("bot:moved", (payload) => {
    logConsole(`Bot ${payload.botId} moved to ${formatPosition(payload.position)}`);
    scheduleBotRefresh();
  });
  socket.on("bot:status", (payload) => {
    logConsole(`Status update from ${payload.botId} (tick ${payload.tick ?? "?"})`);
    scheduleBotRefresh();
  });
  socket.on("bot:task_complete", (payload) => {
    logConsole(`Task complete for ${payload.botId}`, "success");
    scheduleBotRefresh();
  });
  socket.on("bot:scan", (payload) => {
    logConsole(`Scan received for ${payload.botId} (r=${payload.radius})`);
  });
  socket.on("bot:error", (payload) => {
    logConsole(`Bot error for ${payload.npcId || payload.botId || "unknown"}`, "error");
  });
}

function scheduleBotRefresh() {
  if (refreshTimeout) return;
  refreshTimeout = setTimeout(async () => {
    try {
      await loadBots();
    } catch (err) {
      console.error(err);
    } finally {
      refreshTimeout = null;
    }
  }, 250);
}

function logout() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  apiKey = "";
  localStorage.removeItem("apiKey");

  document.getElementById("adminPanel").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");

  const apiKeyInput = document.getElementById("apiKeyInput");
  if (apiKeyInput) {
    apiKeyInput.value = "";
    apiKeyInput.focus();
  }

  showNotification("Logged out", "info");
}

window.logout = logout;

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
    list.innerHTML = data.bots.map(b => {
      const position = formatPosition(b.position);
      const velocity = formatVelocity(b.velocity);
      const state = b.state || "unknown";
      return `
      <div class="bot-item">
        <div class="bot-header">
          <strong>${b.name || b.id}</strong>
          <span class="bot-role">${b.role || "unknown"}</span>
          <span class="bot-state ${state}">${state}</span>
        </div>
        <div class="bot-meta">Pos: ${position} • Vel: ${velocity}</div>
        <div class="bot-meta">Tick: ${b.tick || 0} • Last Tick: ${b.lastTickAt || "—"}</div>
        <button onclick="deleteBot('${b.id}')">🗑️ Remove</button>
      </div>`;
    }).join("");
  } catch (err) {
    console.error(err);
  }
}

function formatPosition(pos) {
  if (!pos) return "N/A";
  const { x = 0, y = 0, z = 0 } = pos;
  return `${Number(x).toFixed(1)}, ${Number(y).toFixed(1)}, ${Number(z).toFixed(1)}`;
}

function formatVelocity(vel) {
  if (!vel) return "0,0,0";
  const { x = 0, y = 0, z = 0 } = vel;
  return `${Number(x).toFixed(2)}, ${Number(y).toFixed(2)}, ${Number(z).toFixed(2)}`;
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
