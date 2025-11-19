// admin.js
// Admin panel with secure login and bot controls

let apiKey = "";
let socket = null;
let refreshTimeout = null;
let statusLogThrottle = new Map(); // Track last log time per bot
const STATUS_LOG_INTERVAL = 5000; // Only log status updates every 5 seconds per bot

document.addEventListener("DOMContentLoaded", async () => {
  apiKey = localStorage.getItem("apiKey") || "";

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
      apiKey = "";
      if (apiKeyInput) {
        apiKeyInput.value = "";
      }
    }
  }

  document.getElementById("loginForm").addEventListener("submit", handleLoginSubmit);
  document.getElementById("createBotForm").addEventListener("submit", handleCreateBot);

  // Initialize personality sliders
  initPersonalitySliders();
});

// Initialize personality trait sliders with event listeners
function initPersonalitySliders() {
  const traits = ["curiosity", "patience", "motivation", "empathy", "aggression", "creativity", "loyalty"];

  traits.forEach(trait => {
    const slider = document.getElementById(trait);
    const valueDisplay = document.getElementById(`${trait}Val`);

    if (slider && valueDisplay) {
      // Set initial value
      updateSliderValue(slider, valueDisplay);

      // Add event listener for changes
      slider.addEventListener("input", () => {
        updateSliderValue(slider, valueDisplay);
      });
    }
  });
}

// Update slider value display (convert 0-100 to 0.0-1.0)
function updateSliderValue(slider, valueDisplay) {
  const normalizedValue = (parseInt(slider.value) / 100).toFixed(2);
  valueDisplay.textContent = normalizedValue;
}

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
  socket.on("disconnect", () => {
    logConsole("Disconnected", "error");
    statusLogThrottle.clear(); // Clear throttle map on disconnect
  });
  socket.on("bot:moved", (payload) => {
    logConsole(`Bot ${payload.botId} moved to ${formatPosition(payload.position)}`);
    scheduleBotRefresh();
  });
  socket.on("bot:status", (payload) => {
    // Throttle status logs to prevent console spam
    const now = Date.now();
    const lastLog = statusLogThrottle.get(payload.botId) || 0;
    if (now - lastLog >= STATUS_LOG_INTERVAL) {
      logConsole(`Status update from ${payload.botId} (tick ${payload.tick ?? "?"})`);
      statusLogThrottle.set(payload.botId, now);
    }
    scheduleBotRefresh();
  });
  socket.on("bot:task_complete", (payload) => {
    logConsole(`Task complete for ${payload.botId}`, "success");
    scheduleBotRefresh();
  });
  socket.on("bot:scan", (payload) => {
    logConsole(`Scan received for ${payload.botId} (r=${payload.radius})`);
  });
  socket.on("bot:deleted", (payload) => {
    logConsole(`Bot ${payload.botId} deleted by ${payload.deletedBy}`, "info");
    scheduleBotRefresh();
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

  // Collect personality traits
  const personality = {
    curiosity: parseFloat((parseInt(document.getElementById("curiosity").value) / 100).toFixed(2)),
    patience: parseFloat((parseInt(document.getElementById("patience").value) / 100).toFixed(2)),
    motivation: parseFloat((parseInt(document.getElementById("motivation").value) / 100).toFixed(2)),
    empathy: parseFloat((parseInt(document.getElementById("empathy").value) / 100).toFixed(2)),
    aggression: parseFloat((parseInt(document.getElementById("aggression").value) / 100).toFixed(2)),
    creativity: parseFloat((parseInt(document.getElementById("creativity").value) / 100).toFixed(2)),
    loyalty: parseFloat((parseInt(document.getElementById("loyalty").value) / 100).toFixed(2))
  };

  try {
    await apiCall("/api/bots", {
      method: "POST",
      body: JSON.stringify({ name, role, description: desc, personality }),
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

// Execute natural language command through LLM
async function executeCommand() {
  const input = document.getElementById("commandInput");
  const command = input?.value.trim();

  if (!command) {
    showNotification("Please enter a command", "error");
    return;
  }

  logConsole(`Executing: ${command}`, "info");

  try {
    const result = await apiCall("/api/llm/command", {
      method: "POST",
      body: JSON.stringify({ command })
    });

    // Log the response
    if (result.response) {
      logConsole(`Response: ${result.response}`, "success");
    }

    // Log any actions taken
    if (result.actions && result.actions.length > 0) {
      result.actions.forEach(action => {
        logConsole(`Action: ${action.type} - ${action.result || "completed"}`, "success");
      });
    }

    // Show success notification
    showNotification("Command executed successfully", "success");

    // Clear input
    input.value = "";

    // Refresh bot list if command might have changed bot state
    if (command.toLowerCase().includes("spawn") ||
        command.toLowerCase().includes("delete") ||
        command.toLowerCase().includes("remove") ||
        command.toLowerCase().includes("kill")) {
      setTimeout(() => loadBots(), 500);
    }

  } catch (err) {
    logConsole(`Error: ${err.message}`, "error");
    showNotification(`Command failed: ${err.message}`, "error");
  }
}

// Make executeCommand available globally
window.executeCommand = executeCommand;
