// admin.js
// Admin panel JavaScript

let apiKey = null;
let socket = null;
let userRole = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check for stored API key
  apiKey = localStorage.getItem('apiKey');
  if (apiKey) {
    login(apiKey);
  }

  // Setup personality sliders
  const traits = ['curiosity', 'patience', 'motivation', 'empathy', 'aggression', 'creativity', 'loyalty'];
  traits.forEach(trait => {
    const slider = document.getElementById(trait);
    const valueSpan = document.getElementById(`${trait}Val`);
    slider.addEventListener('input', (e) => {
      valueSpan.textContent = (e.target.value / 100).toFixed(2);
    });
  });

  // Setup forms
  document.getElementById('loginForm').addEventListener('submit', handleLogin);
  document.getElementById('createBotForm').addEventListener('submit', handleCreateBot);
  document.getElementById('commandInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') executeCommand();
  });
});

// Login
async function handleLogin(e) {
  e.preventDefault();
  const key = document.getElementById('apiKeyInput').value;
  await login(key);
}

async function login(key) {
  try {
    // Test API key
    const response = await fetch('/api/bots/health', {
      headers: {
        'X-API-Key': key
      }
    });

    if (!response.ok) {
      throw new Error('Invalid API key');
    }

    apiKey = key;
    localStorage.setItem('apiKey', key);

    // Hide login, show admin panel
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');

    // Connect WebSocket
    connectWebSocket();

    // Load initial data
    await loadBots();
    await loadStatus();

    showNotification('Login successful', 'success');
    logConsole('System ready', 'success');
  } catch (error) {
    showNotification('Login failed: ' + error.message, 'error');
  }
}

function logout() {
  localStorage.removeItem('apiKey');
  apiKey = null;
  if (socket) socket.disconnect();
  location.reload();
}

// WebSocket connection
function connectWebSocket() {
  socket = io({
    auth: {
      apiKey: apiKey
    }
  });

  socket.on('connect', () => {
    updateServerStatus(true);
    logConsole('Connected to server', 'success');
  });

  socket.on('disconnect', () => {
    updateServerStatus(false);
    logConsole('Disconnected from server', 'error');
  });

  // Bot events
  socket.on('bot:created', (data) => {
    logConsole(`Bot ${data.bot.id} created by ${data.createdBy}`, 'info');
    loadBots();
  });

  socket.on('bot:updated', (data) => {
    logConsole(`Bot ${data.botId} updated by ${data.updatedBy}`, 'info');
    loadBots();
  });

  socket.on('bot:deleted', (data) => {
    logConsole(`Bot ${data.botId} deleted by ${data.deletedBy}`, 'info');
    loadBots();
  });

  socket.on('bot:spawned', (data) => {
    logConsole(`Bot ${data.botId} spawned by ${data.spawnedBy}`, 'success');
    loadBots();
  });

  socket.on('bot:despawned', (data) => {
    logConsole(`Bot ${data.botId} despawned by ${data.despawnedBy}`, 'info');
    loadBots();
  });

  socket.on('bot:task_assigned', (data) => {
    logConsole(`Task ${data.task.action} assigned to ${data.botId} by ${data.assignedBy}`, 'info');
  });

  // LLM command events
  socket.on('llm:command', (data) => {
    logConsole(`LLM command: ${data.command}`, 'command');
    if (data.result.success) {
      logConsole(`  → ${data.result.message || 'Success'}`, 'success');
    } else {
      logConsole(`  → Error: ${data.result.error}`, 'error');
    }
  });
}

// API calls
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': apiKey,
      ...options.headers
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || data.error || 'API request failed');
  }

  return data;
}

// Load bots
async function loadBots() {
  try {
    const data = await apiCall('/api/bots');
    const botList = document.getElementById('botList');

    if (data.bots.length === 0) {
      botList.innerHTML = '<div style="text-align: center; color: #888; padding: 20px;">No bots created yet</div>';
      document.getElementById('botCount').textContent = '0 bots';
      return;
    }

    botList.innerHTML = data.bots.map(bot => `
      <div class="bot-item ${bot.status === 'inactive' ? 'inactive' : ''}">
        <div class="bot-header">
          <div class="bot-name">${bot.id}</div>
          <div class="bot-role">${bot.role}</div>
        </div>
        <div style="font-size: 12px; color: #888;">
          ${bot.personalitySummary || 'No personality'} |
          Spawned ${bot.spawnCount || 0} times
        </div>
        ${bot.description ? `<div style="font-size: 12px; margin-top: 5px;">${bot.description}</div>` : ''}
        <div class="bot-actions">
          <button onclick="spawnBot('${bot.id}')">Spawn</button>
          <button onclick="despawnBot('${bot.id}')">Despawn</button>
          <button onclick="showBotInfo('${bot.id}')">Info</button>
          <button class="danger" onclick="deleteBot('${bot.id}')">Delete</button>
        </div>
      </div>
    `).join('');

    document.getElementById('botCount').textContent = `${data.bots.length} bots`;
  } catch (error) {
    showNotification('Failed to load bots: ' + error.message, 'error');
  }
}

// Load status
async function loadStatus() {
  try {
    const data = await apiCall('/api/bots/status');
    // Update UI with status info
  } catch (error) {
    console.error('Failed to load status:', error);
  }
}

// Create bot
async function handleCreateBot(e) {
  e.preventDefault();

  const name = document.getElementById('botName').value || undefined;
  const role = document.getElementById('botRole').value;
  const description = document.getElementById('botDescription').value || undefined;

  const personality = {
    curiosity: parseInt(document.getElementById('curiosity').value) / 100,
    patience: parseInt(document.getElementById('patience').value) / 100,
    motivation: parseInt(document.getElementById('motivation').value) / 100,
    empathy: parseInt(document.getElementById('empathy').value) / 100,
    aggression: parseInt(document.getElementById('aggression').value) / 100,
    creativity: parseInt(document.getElementById('creativity').value) / 100,
    loyalty: parseInt(document.getElementById('loyalty').value) / 100
  };

  try {
    const data = await apiCall('/api/bots', {
      method: 'POST',
      body: JSON.stringify({
        name,
        role,
        description,
        personality
      })
    });

    showNotification(`Bot ${data.bot.id} created successfully!`, 'success');
    logConsole(`Created bot ${data.bot.id} (${role})`, 'success');

    // Reset form
    document.getElementById('createBotForm').reset();

    // Reset sliders
    const traits = ['curiosity', 'patience', 'motivation', 'empathy', 'aggression', 'creativity', 'loyalty'];
    traits.forEach(trait => {
      document.getElementById(trait).value = 50;
      document.getElementById(`${trait}Val`).textContent = '0.5';
    });

    await loadBots();
  } catch (error) {
    showNotification('Failed to create bot: ' + error.message, 'error');
    logConsole(`Failed to create bot: ${error.message}`, 'error');
  }
}

// Bot actions
async function spawnBot(botId) {
  try {
    await apiCall(`/api/bots/${botId}/spawn`, {
      method: 'POST'
    });
    showNotification(`Bot ${botId} spawned`, 'success');
    logConsole(`Spawned bot ${botId}`, 'success');
  } catch (error) {
    showNotification('Spawn failed: ' + error.message, 'error');
    logConsole(`Spawn failed: ${error.message}`, 'error');
  }
}

async function despawnBot(botId) {
  try {
    await apiCall(`/api/bots/${botId}/despawn`, {
      method: 'POST'
    });
    showNotification(`Bot ${botId} despawned`, 'success');
    logConsole(`Despawned bot ${botId}`, 'success');
  } catch (error) {
    showNotification('Despawn failed: ' + error.message, 'error');
    logConsole(`Despawn failed: ${error.message}`, 'error');
  }
}

async function deleteBot(botId) {
  if (!confirm(`Delete bot ${botId}? This will mark it as inactive.`)) {
    return;
  }

  try {
    await apiCall(`/api/bots/${botId}`, {
      method: 'DELETE'
    });
    showNotification(`Bot ${botId} deleted`, 'success');
    logConsole(`Deleted bot ${botId}`, 'success');
    await loadBots();
  } catch (error) {
    showNotification('Delete failed: ' + error.message, 'error');
    logConsole(`Delete failed: ${error.message}`, 'error');
  }
}

async function showBotInfo(botId) {
  try {
    const data = await apiCall(`/api/bots/${botId}`);
    const bot = data.bot;

    let info = `Bot: ${bot.id}\n`;
    info += `Role: ${bot.role}\n`;
    info += `Status: ${bot.status}\n`;
    info += `Personality: ${bot.personalitySummary}\n`;

    if (bot.learning) {
      info += `\nLearning Stats:\n`;
      info += `  Level: ${bot.learning.level}\n`;
      info += `  XP: ${bot.learning.xp}\n`;
      info += `  Tasks: ${bot.learning.tasksCompleted} completed, ${bot.learning.tasksFailed} failed\n`;
      info += `  Success Rate: ${bot.learning.successRate.toFixed(1)}%\n`;
    }

    alert(info);
  } catch (error) {
    showNotification('Failed to load bot info: ' + error.message, 'error');
  }
}

// Command console
async function executeCommand() {
  const input = document.getElementById('commandInput');
  const command = input.value.trim();

  if (!command) return;

  logConsole(`> ${command}`, 'command');
  input.value = '';

  try {
    const data = await apiCall('/api/llm/command', {
      method: 'POST',
      body: JSON.stringify({ command })
    });

    if (data.success) {
      logConsole(data.message || 'Command executed successfully', 'success');
      if (data.bot) {
        logConsole(`  Bot: ${data.bot.id}`, 'info');
      }
      if (data.bots) {
        data.bots.forEach(bot => {
          logConsole(`  ${bot.id} (${bot.role})`, 'info');
        });
      }
      await loadBots();
    } else {
      logConsole(`Error: ${data.error}`, 'error');
      if (data.suggestions) {
        logConsole('Try:', 'info');
        data.suggestions.forEach(s => logConsole(`  ${s}`, 'info'));
      }
    }
  } catch (error) {
    logConsole(`Error: ${error.message}`, 'error');
  }
}

function logConsole(message, type = 'info') {
  const console = document.getElementById('console');
  const line = document.createElement('div');
  line.className = `console-line ${type}`;
  line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
  console.appendChild(line);
  console.scrollTop = console.scrollHeight;

  // Keep only last 100 lines
  while (console.children.length > 100) {
    console.removeChild(console.firstChild);
  }
}

// UI updates
function updateServerStatus(connected) {
  const dot = document.getElementById('serverStatus');
  const text = document.getElementById('serverStatusText');

  if (connected) {
    dot.classList.remove('offline');
    text.textContent = 'Connected';
  } else {
    dot.classList.add('offline');
    text.textContent = 'Offline';
  }
}

function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 5000);
}
