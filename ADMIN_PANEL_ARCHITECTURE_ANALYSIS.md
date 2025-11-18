# FGD Admin Panel Architecture Analysis

**Analysis Date**: 2025-11-18  
**Framework**: Vanilla HTML/CSS/JavaScript  
**Build System**: None (No Vite, Webpack, etc.)  
**Real-time Communication**: Socket.IO WebSockets  
**Server Framework**: Express.js (Node.js)  
**Database**: PostgreSQL + Redis  

---

## Executive Summary

The FGD admin panel is a **vanilla JavaScript application** with NO build system or frontend framework. It consists of three independent HTML pages that communicate with an Express.js backend via REST APIs and WebSocket (Socket.IO). The system provides comprehensive bot management, real-time metrics visualization, and natural language command execution through LLM integration.

**Critical Issues Identified**: 3 broken features in the admin panel UI that will prevent users from executing commands and configuring personality traits.

---

## 1. Frontend Framework & Architecture

### Framework Stack
- **No Framework**: Pure vanilla HTML5/CSS3/JavaScript
- **No Build System**: No Vite, Webpack, Rollup, or build process required
- **No Transpilation**: Native ES5+ JavaScript (not ES6 modules in frontend)
- **No Package Management**: No npm/yarn for frontend dependencies

### Frontend Structure
```
/home/user/FGD/
├── admin.html                 # Bot management UI
├── admin.js                   # Bot management logic (241 lines)
├── dashboard.html             # Cluster monitoring UI
├── dashboard.js               # Metrics visualization (826 lines)
├── fusion.html                # Fusion memory viewer
├── fusion.js                  # Fusion visualization
├── theme.js                   # Dark/light theme switcher
├── style.css                  # Shared styling (786 lines)
├── server.js                  # Express.js backend entry point
└── routes/                    # API route handlers
    ├── bot.js                 # Bot management endpoints
    ├── llm.js                 # LLM command interface
    ├── mineflayer.js          # Mineflayer v1 endpoints
    └── mineflayer_v2.js       # Mineflayer v2 with policy
```

### External Dependencies (CDN)
- **Socket.IO**: `/socket.io/socket.io.js` (WebSocket client)
- **Chart.js**: `https://cdn.jsdelivr.net/npm/chart.js` (Data visualization)
- **Font**: System fonts only (no custom fonts loaded)

---

## 2. UI Component Hierarchy & Structure

### Admin Panel (`admin.html`)

#### Top-Level Components
1. **Login Screen** (id: `loginScreen`)
   - Fixed overlay with centered card
   - API Key input field
   - Submit button

2. **Admin Panel** (id: `adminPanel`) - Hidden until authenticated
   - **Header Section**
     - Title: "🤖 AICraft Admin Panel"
     - Status bar with:
       - Server connection status (status-dot)
       - Bot count display
       - User info
       - Logout button

   - **Two-Column Grid Layout**
     - **Column 1: Active Bots Card**
       - Bot list container (scrollable, max-height: 400px)
       - Refresh button
       - Dynamic bot items showing:
         - Bot name and role badge
         - Position (X, Y, Z coordinates)
         - Velocity vector
         - Tick count
         - Last tick timestamp
         - Delete button
     
     - **Column 2: Create Bot Card**
       - Form with fields:
         - Bot name (optional, auto-generated)
         - Role dropdown (miner, builder, scout, guard, gatherer)
         - Description textarea
         - **Personality Grid** (2-column layout)
           - Curiosity (0-100 range slider)
           - Patience (0-100 range slider)
           - Motivation (0-100 range slider)
           - Empathy (0-100 range slider)
           - Aggression (0-100 range slider)
           - Creativity (0-100 range slider)
           - Loyalty (0-100 range slider)
         - Create Bot submit button

   - **Command Console Card** (full width)
     - Console output area (scrollable, 300px height)
     - Command input field with placeholder examples
     - Execute button
     - Help text with example commands

#### Visual Styling
- **Color Scheme**: Dark theme (radial gradient from `#667eea` to `#764ba2`)
- **Active Bot Cards**: Left border accent `#667eea`
- **Inactive Bot Cards**: Opacity 0.6, border-left `#777`
- **Console Output**: Monospace font, color-coded by type (success, error, info, command)
- **Status Dot**: Animated pulse effect, green for online, red for offline

### Dashboard (`dashboard.html`)

#### Components
1. **Navigation Bar**
   - Links to dashboard.html, fusion.html, admin.html
   - Theme toggle button (light/dark mode)

2. **Cluster Nodes Grid** (id: `cluster-grid`)
   - Dynamic node cards showing:
     - Status badge (HEALTHY/OFFLINE)
     - Node name
     - CPU utilization %
     - Memory utilization %
     - Task count

3. **Metrics Charts Section** (id: `charts`)
   - CPU Utilization Chart (line chart, 15-minute rolling window)
   - Memory Allocation Chart (bar chart, per node)
   - Task Queue Depth Chart (line chart, pending tasks)
   - Task Latency Chart (line chart, completion time in seconds)

4. **Policy Control Panel** (id: `policy-panel`)
   - Learning Rate slider (0.1-2.0, step 0.1)
   - Delegation Bias slider (0-1, step 0.05)
   - Cooldown slider (1000-30000ms, step 1000)
   - Apply Policy button

5. **Fusion Knowledge Sidebar** (id: `fusion-sidebar`)
   - NPC Skills count
   - Dialogues count
   - Outcomes count
   - Last Sync timestamp
   - Fusion summary bar chart (horizontal)
   - Link to detailed fusion memory view

### Fusion Memory Viewer (`fusion.html`)

#### Components
1. **Knowledge Composition Section**
   - Pie chart showing distribution of skills, dialogues, outcomes
   - Statistics cards with counts

2. **Raw Fusion Payload Section**
   - JSON code block for debugging
   - Pre-formatted text display

---

## 3. Complete API Endpoint Mapping

### Bot Management Endpoints (`/api/bots`)

```
GET    /api/bots
       Query params: status, role, type
       Returns: { success, count, bots: [...] }
       Auth: Required (read permission)

GET    /api/bots/:id
       Returns: { success, bot: {...}, learning: {...} }
       Auth: Required (read permission)

POST   /api/bots
       Body: { name, role, type, personality, appearance, description, position, taskParameters, behaviorPreset, autoSpawn }
       Returns: { success, message, bot, spawned, spawnResponse }
       Auth: Required (write permission)
       Rate limited: botCreationLimiter

PUT    /api/bots/:id
       Body: { description, personality, appearance, position, taskParameters, behaviorPreset }
       Returns: { success, message, bot }
       Auth: Required (write permission)

DELETE /api/bots/:id
       Query params: permanent (boolean)
       Returns: { success, message }
       Auth: Required (delete permission)
       Note: permanent=true requires admin role

POST   /api/bots/:id/spawn
       Body: { position: { x, y, z } }
       Returns: { success, message, position }
       Auth: Required (spawn permission)

POST   /api/bots/:id/despawn
       Returns: { success, message }
       Auth: Required (spawn permission)

POST   /api/bots/:id/task
       Body: { action, target, parameters, priority }
       Returns: { success, message, task }
       Auth: Required (command permission)

POST   /api/bots/spawn-all
       Returns: { success, message, count, bots }
       Auth: Required (spawn permission)

GET    /api/bots/status
       Returns: { success, status: { total, idle, working, queueLength, maxQueueSize, queueUtilization, bridgeConnected } }
       Auth: Required (read permission)

GET    /api/bots/learning
       Returns: { success, count, profiles: [...] }
       Auth: Required (read permission)

GET    /api/bots/dead-letter
       Returns: { success, count, queue }
       Auth: Required (read permission)
       Conditional: Only if npcSpawner available

POST   /api/bots/dead-letter/retry
       Returns: { success, ...results }
       Auth: Required (write permission)
       Conditional: Only if npcSpawner available
```

### LLM Command Endpoints (`/api/llm`)

```
POST   /api/llm/command
       Body: { command: string, context?: any }
       Returns: { success, message?, result?, error?, suggestions? }
       Auth: Required (command permission)
       Examples:
         - "spawn bot miner_01 as miner"
         - "list all bots"
         - "assign bot_01 task mine iron"
         - "move bot_01 to 100 64 200"
         - "spawn all bots"
         - "delete bot bot_01"

POST   /api/llm/batch
       Body: { commands: [string], stopOnError?: boolean }
       Returns: { success, count, results: [{ command, result }] }
       Auth: Required (command permission)

GET    /api/llm/help
       Returns: { success, commands: [...], notes: [...] }
       Auth: Required
```

### Mineflayer v1 Endpoints (`/api/mineflayer`) - Direct Control

```
GET    /api/mineflayer
       Returns: { success, count, bots: [...] }
       Auth: Required (read permission)

GET    /api/mineflayer/:botId
       Returns: { success, bot: {...} }
       Auth: Required (read permission)

POST   /api/mineflayer/spawn
       Body: { botId, username?, version? }
       Returns: { success, botId, position, health, food }
       Auth: Required (write permission)

DELETE /api/mineflayer/:botId
       Returns: { success, error? }
       Auth: Required (write permission)

GET    /api/mineflayer/tasks
       Returns: { success, count, taskTypes: [...] }
       Auth: Required (read permission)

POST   /api/mineflayer/:botId/task
       Body: { task: string, parameters?: {} }
       Returns: { success, message, task }
       Auth: Required (write permission)
```

### Mineflayer v2 Endpoints (`/api/v2/mineflayer`) - Policy-Enforced

```
GET    /api/mineflayer/policy/status
       Returns: { success, policy: {...} }
       Auth: Required

GET    /api/mineflayer/policy/approvals
       Returns: { success, count, approvals: [...] }
       Auth: Required (admin permission)

POST   /api/mineflayer/policy/approve/:token
       Body: { userId, reason? }
       Returns: { success, message, result }
       Auth: Required (admin permission)

POST   /api/mineflayer/policy/reject/:token
       Body: { reason? }
       Returns: { success, message }
       Auth: Required (admin permission)

POST   /api/mineflayer/:botId/task
       Body: { action, target?, parameters?, priority? }
       Returns: { success, message, task, requiresApproval?, token? }
       Auth: Required (write permission)
       Note: Dangerous actions require admin approval

POST   /api/mineflayer/:botId/move
       Body: { position: { x, y, z }, speed? }
       Returns: { success, message, position }
       Auth: Required (write permission)

POST   /api/mineflayer/:botId/chat
       Body: { message }
       Returns: { success, message }
       Auth: Required (write permission)

POST   /api/mineflayer/:botId/mine
       Body: { blockType?, radius? }
       Returns: { success, message, blocksDestroyed }
       Auth: Required (write permission)

GET    /api/mineflayer/health
       Returns: { success, status }
       Auth: Required

GET    /api/mineflayer/stats
       Returns: { success, stats: {...} }
       Auth: Required (read permission)

POST   /api/mineflayer/stats/reset
       Returns: { success, message }
       Auth: Required (admin permission)
```

### Authentication Endpoints

```
POST   /api/auth/login
       Body: { username, password }
       Returns: { success, token, refreshToken, user }
       Rate limited: authLimiter

POST   /api/auth/refresh
       Body: { refreshToken }
       Returns: { success, accessToken, token }
       Rate limited: authLimiter

POST   /api/auth/logout
       Returns: { success, message }
       Auth: Required

GET    /api/auth/me
       Returns: { success, user }
       Auth: Required
```

### Health & Metrics Endpoints

```
GET    /api/health
       Returns: { success, status, timestamp }
       No auth required

GET    /api/cluster/metrics
       Returns: { success, performance: {...}, timestamp }
       Auth: Required (read permission)

GET    /metrics
       Returns: Prometheus metrics in text format
       No auth required
```

---

## 4. WebSocket Events Catalog

### Socket.IO Connection Events

```javascript
// Client receives on connection
'init'                          // { nodes, metrics, stats, logs, config }
'cluster:update'                // { nodes: [...], timestamp }
'metrics:update'                // { cpu, memory, performance, timestamp }
'fusion:update'                 // { skills, dialogues, outcomes, lastSync, timestamp }
'bridge:heartbeat'              // { timestamp, ageSeconds }

// Connection lifecycle
'connect'                       // Automatic on connection success
'disconnect'                    // Client disconnected
'connect_error'                 // { error message }
```

### Bot Event Stream

```javascript
// Emitted by bot.js route handlers
'bot:created'                   // { bot: { id, role, type, personalitySummary }, createdBy, timestamp }
'bot:moved'                     // { botId, position: { x, y, z }, timestamp }
'bot:status'                    // { botId, tick, status, timestamp }
'bot:task_complete'             // { botId, taskAction, result, timestamp }
'bot:task_assigned'             // { botId, task: { action, target, priority }, assignedBy, timestamp }
'bot:spawned'                   // { botId, position, spawnedBy, timestamp }
'bot:despawned'                 // { botId, despawnedBy, timestamp }
'bot:updated'                   // { botId, changes: {...}, updatedBy, timestamp }
'bot:deleted'                   // { botId, deletedBy, permanent, timestamp }
'bot:scan'                      // { botId, radius, results, timestamp }
'bot:error'                     // { botId, npcId, message, timestamp }
```

### LLM Command Events

```javascript
'llm:command'                   // { command, result, executedBy, context, timestamp }
'llm:batch'                     // { count, results: [{command, result}], executedBy, timestamp }
```

### Plugin/Bridge Events

```javascript
'plugin_register'               // Register FGDProxyPlayer plugin
'plugin_heartbeat'              // { tick, tps, memoryUsage, ... }
'plugin_heartbeat_ack'          // { timestamp } - Acknowledge heartbeat
```

### Data Update Events (30-second interval push)

- `cluster:update` - Cluster topology and node status
- `metrics:update` - CPU, memory, performance metrics
- `fusion:update` - Fusion knowledge base counts

---

## 5. Current Bot Control UI Features

### Working Features ✅

1. **Bot Listing & Display**
   - Real-time list of active bots
   - Shows position, velocity, tick count
   - Status indicator (active/inactive)
   - Last tick timestamp
   - Refresh button to reload bot list

2. **Bot Creation**
   - Name input (optional, auto-generated)
   - Role selection (dropdown: miner, builder, scout, guard, gatherer)
   - Description textarea
   - Auto-spawn on creation
   - Spawned successfully confirmation

3. **Bot Deletion**
   - Delete button on each bot item
   - Confirmation dialog
   - Deactivates bot (marks inactive)
   - Removes from active NPC engine

4. **Real-time Status Monitoring**
   - WebSocket events for bot movements
   - Status update throttling (5-second minimum interval)
   - Automatic refresh on bot events
   - Console logging of all bot activities

5. **Login/Authentication**
   - API key authentication
   - LocalStorage persistence
   - Auto-login on page load
   - Logout functionality
   - Session management

6. **Console Logging**
   - Real-time event log display
   - Color-coded output (success, error, info, command)
   - Timestamp on each log entry
   - Auto-scroll to bottom
   - Scrollable console area

### Broken/Missing Features ❌

#### 1. **CRITICAL: executeCommand() Function Missing**
- **Location**: admin.html line 460
- **Issue**: HTML button calls `executeCommand()` but function not defined in admin.js
- **Impact**: Users cannot execute commands via console
- **Status**: NON-FUNCTIONAL

```html
<button onclick="executeCommand()">Execute</button>
```

- **Should call**: `/api/llm/command` endpoint with command text
- **Missing implementation**: No function to read command input, validate, and call API

#### 2. **CRITICAL: Personality Sliders Non-Functional**
- **Location**: admin.html lines 411-447
- **Issue**: 7 personality trait sliders have no event listeners
- **Sliders affected**:
  - Curiosity
  - Patience
  - Motivation
  - Empathy
  - Aggression
  - Creativity
  - Loyalty

- **Problems**:
  - Slider values don't update display (span shows "0.5" regardless of slider position)
  - No event listeners on range inputs
  - handleCreateBot() doesn't collect personality values
  - Personality data never sent to API

- **Missing code**:
```javascript
// No event listeners like:
document.getElementById('curiosity').addEventListener('input', (e) => {
  document.getElementById('curiosityVal').textContent = (e.target.value / 100).toFixed(1);
});
```

#### 3. **No Live Minecraft World Map Viewer**
- **Issue**: No 2D/3D visualization of bot positions in Minecraft world
- **Available**: JSON position data in API responses
- **Missing**: Visual map component to render bot positions and world state
- **Impact**: Users cannot visualize where bots are in the world

### Partially Implemented Features ⚠️

1. **Task Assignment**
   - API endpoint exists (`POST /api/bots/:id/task`)
   - No UI button/form in admin panel
   - Can only assign via LLM commands
   - No direct task creation interface

2. **Bot Spawning at Specific Position**
   - API supports position parameter
   - Admin UI doesn't expose position input
   - Only uses auto-spawn or default position
   - Advanced positioning requires API calls

3. **Personality Configuration**
   - API accepts personality object
   - UI has sliders but they don't work
   - Cannot customize personality traits from UI

---

## 6. Broken UI Logic & Missing Implementations

### Issue Summary Table

| Feature | Component | Problem | Severity | Fix Effort |
|---------|-----------|---------|----------|-----------|
| Command Execution | admin.js | Function not defined | CRITICAL | 1-2 hours |
| Personality Sliders | admin.js | No event handlers | CRITICAL | 1-2 hours |
| Personality Display | admin.js | Values not synchronized | CRITICAL | 30 mins |
| Personality in API Call | admin.js | Not collected/sent | CRITICAL | 1 hour |
| World Map Viewer | N/A | Not implemented | MAJOR | 4-8 hours |
| Task Assignment UI | admin.js | No form provided | MINOR | 2 hours |
| Advanced Position Input | admin.js | Not exposed | MINOR | 1 hour |

### Code Issues

#### 1. Missing executeCommand Function
```javascript
// In admin.html line 460:
<button onclick="executeCommand()">Execute</button>

// Missing from admin.js entirely
// Should be:
async function executeCommand() {
  const input = document.getElementById("commandInput").value.trim();
  if (!input) {
    showNotification("Command cannot be empty", "error");
    return;
  }
  
  try {
    const result = await apiCall("/api/llm/command", {
      method: "POST",
      body: JSON.stringify({ command: input })
    });
    logConsole(`Command executed: ${input}`, "success");
    document.getElementById("commandInput").value = "";
  } catch (err) {
    logConsole(`Error: ${err.message}`, "error");
  }
}
```

#### 2. Missing Personality Slider Event Handlers
```javascript
// In admin.js - should add after DOMContentLoaded:
// Currently: MISSING
// Should be:
document.addEventListener("DOMContentLoaded", () => {
  // ... existing code ...
  
  // Add personality slider handlers
  const traits = ['curiosity', 'patience', 'motivation', 'empathy', 'aggression', 'creativity', 'loyalty'];
  traits.forEach(trait => {
    const slider = document.getElementById(trait);
    const display = document.getElementById(trait + 'Val');
    if (slider && display) {
      slider.addEventListener('input', (e) => {
        display.textContent = (e.target.value / 100).toFixed(1);
      });
    }
  });
});
```

#### 3. Missing Personality Collection in handleCreateBot
```javascript
// Current (lines 157-172):
async function handleCreateBot(e) {
  e.preventDefault();
  const name = document.getElementById("botName").value || `bot_${Date.now()}`;
  const role = document.getElementById("botRole").value;
  const desc = document.getElementById("botDescription").value;
  // MISSING: Personality collection
  
  try {
    await apiCall("/api/bots", {
      method: "POST",
      body: JSON.stringify({ name, role, description: desc })
      // MISSING: personality object
    });
    // ...
  }
}

// Should collect:
const personality = {
  curiosity: parseFloat(document.getElementById("curiosity").value) / 100,
  patience: parseFloat(document.getElementById("patience").value) / 100,
  // ... etc
};

// And send in body:
body: JSON.stringify({ 
  name, 
  role, 
  description: desc,
  personality  // ADD THIS
})
```

---

## 7. Build System & Configuration

### Build System Status: **NONE**

The frontend is pure vanilla JavaScript with **NO build process**:

- ❌ No Vite configuration
- ❌ No Webpack configuration  
- ❌ No TypeScript/tsconfig.json
- ❌ No Babel configuration
- ❌ No Module bundling (no import/export)
- ❌ No Minification/Optimization
- ❌ No Source maps
- ❌ No Hot Module Replacement (HMR)

### Backend Build System

**Framework**: Express.js (Node.js)

```json
{
  "name": "aicraft-cluster-dashboard",
  "version": "2.1.0",
  "type": "module",  // ES6 modules in backend
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "node --watch server.js",
    "lint": "eslint src/ routes/ middleware/ tests/",
    "lint:fix": "eslint src/ routes/ middleware/ tests/ --fix",
    "format": "prettier --write \"src/**/*.js\" \"routes/**/*.js\"...",
    "test": "jest",
    "test:unit": "jest tests/unit",
    "test:integration": "jest tests/integration",
    "test:coverage": "jest --coverage",
    "build": "npm run policy:heal"
  },
  "dependencies": {
    "express": "^4.19.0",
    "socket.io": "^4.6.1",
    "mineflayer": "^4.0.0",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "bcrypt": "^6.0.0",
    "jsonwebtoken": "^9.0.2"
    // ... more
  }
}
```

### Frontend Delivery

- **No Build Step**: Frontend files served as-is by Express.js
- **Static File Path**: Files in project root served via `express.static()`
- **Hot Reload**: None (manual refresh required)
- **Optimization**: None (no minification)

---

## 8. Data Communication Architecture

### REST API Communication

```javascript
// Pattern used in admin.js:
async function apiCall(endpoint, options = {}) {
  const response = await fetch(endpoint, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,  // OR: Authorization Bearer token
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}
```

### WebSocket Communication Pattern

```javascript
// Pattern used in admin.js:
socket = io({ auth: { apiKey } });

socket.on('bot:moved', (payload) => {
  // Update UI with bot position
});

socket.emit('custom_event', data);  // Client can emit too
```

### Auth Strategy

- **Authentication Method**: API Key OR JWT Token
- **Storage**: localStorage for API key
- **Transmission**: 
  - REST: `X-API-Key` header or `Authorization: Bearer` header
  - WebSocket: `auth` object in Socket.IO connection
- **Refresh**: JWT has refresh token endpoint

---

## 9. Chart.js Visualizations

### Dashboard Charts

1. **CPU Utilization** (Line Chart)
   - Type: `type: 'line'`
   - Data: 15-minute rolling window
   - Color: Blue (`#60a5fa`)
   - Y-axis: 0-100%
   - X-axis: Timestamps

2. **Memory Allocation** (Bar Chart)
   - Type: `type: 'bar'`
   - Data: 15-minute rolling window per node
   - Color: Green (`#34d399`)
   - Y-axis: 0-100%
   - X-axis: Timestamps

3. **Task Queue Depth** (Line Chart)
   - Type: `type: 'line'`
   - Data: Pending tasks count
   - Color: Yellow (`#facc15`)
   - Y-axis: Task count
   - X-axis: Timestamps

4. **Task Latency** (Line Chart)
   - Type: `type: 'line'`
   - Data: Time between task assignment and completion
   - Color: Green (`#34d399`)
   - Y-axis: Seconds
   - X-axis: Timestamps

5. **Fusion Knowledge** (Horizontal Bar Chart)
   - Type: `type: 'bar'` with `indexAxis: 'y'`
   - Data: [skills count, dialogues count, outcomes count]
   - Colors: Blue, Green, Red
   - X-axis: Count values

### Chart Rendering

```javascript
// Charts are updated in-place (not destroyed/recreated):
if (chartInstances.cpu) {
  chartInstances.cpu.data.labels = metricsHistory.timestamps;
  chartInstances.cpu.data.datasets[0].data = metricsHistory.cpu;
  chartInstances.cpu.update('none');  // No animation for performance
} else {
  chartInstances.cpu = new Chart(ctx, {
    type: 'line',
    data: { ... },
    options: { ... }
  });
}
```

### Historical Data

- **Storage**: In-memory arrays in JavaScript
- **Max History**: 15 data points per metric
- **Update Frequency**: Every 30 seconds via WebSocket
- **Loss on Refresh**: All history lost on page refresh (not persisted)

---

## 10. Theme System

### Dark/Light Mode Implementation

**File**: `theme.js` (85 lines)

```javascript
// CSS variables switch via data-theme attribute:
:root {                    /* Dark theme (default) */
  --bg-gradient: radial-gradient(circle at top left, #1f2937, #0b1120 55%, #050810 100%);
  --card-bg: rgba(17, 24, 39, 0.92);
  --accent: #60a5fa;
  --text-primary: #e2e8f0;
  --text-secondary: #94a3b8;
  --success: #34d399;
  --danger: #f87171;
  --warning: #fbbf24;
}

[data-theme="light"] {     /* Light theme */
  --bg-gradient: radial-gradient(circle at top left, #f8fafc, #e0e7ff 55%, #dbeafe 100%);
  --card-bg: rgba(255, 255, 255, 0.95);
  --accent: #2563eb;
  --text-primary: #1e293b;
  --text-secondary: #64748b;
}
```

**Toggle Logic**:
- Reads localStorage key `aicraft-theme`
- Falls back to system preference via `prefers-color-scheme`
- Applies immediately to prevent flash
- Listens for system theme changes

---

## 11. Configuration & Constants

### Bot System Configuration

**File**: `/home/user/FGD/constants.js`

```javascript
export const MAX_BOTS = 8;                           // Spawn limit
export const DEFAULT_SPAWN_POSITION = { x: 0, y: 64, z: 0 };
export const DEFAULT_TICK_RATE_MS = 200;            // Update frequency
export const DEFAULT_SCAN_INTERVAL_MS = 1500;       // Area scan rate
export const DEFAULT_SCAN_RADIUS = 5;               // Blocks to scan
export const MAX_SPAWN_RETRIES = 3;                 // Retry attempts
export const RETRY_DELAY_MS = 1000;                 // Exponential backoff
export const MAX_QUEUE_SIZE = 100;                  // Task queue limit
export const MEMORY_SIZE = 10;                      // Bot memory context
export const WORLD_BOUNDS = {
  MIN_Y: -64,
  MAX_Y: 320
};
```

### Bot Roles (Available)

```javascript
MINER      - Mining operations
BUILDER    - Construction tasks
SCOUT      - Exploration and reconnaissance
GUARD      - Defense and protection
GATHERER   - Resource collection
EXPLORER   - World exploration
FIGHTER    - Combat operations
FARMER     - Agricultural tasks
```

### Task Priorities

```javascript
LOW        - Low priority tasks
NORMAL     - Standard priority (default)
HIGH       - Urgent tasks
CRITICAL   - System-critical tasks
```

---

## 12. Security Features

### Authentication & Authorization

1. **API Key Authentication**
   - Passed in header: `X-API-Key`
   - LocalStorage persistence
   - Or JWT token via `Authorization: Bearer`

2. **Role-Based Access Control**
   - Roles: VIEWER, USER, ADMIN, AUTOPILOT
   - Permissions: read, write, delete, spawn, command, admin

3. **Rate Limiting**
   - `apiLimiter`: General API requests
   - `authLimiter`: Login/auth endpoints
   - `botCreationLimiter`: Bot creation endpoint

4. **Policy-Based Action Approval** (Mineflayer v2)
   - Dangerous actions require admin approval
   - Token-based approval workflow
   - Audit trail of all approvals/rejections

### Environment Validation

- Critical environment variables validated at startup
- Prevents hardcoded credentials
- Governance config validation

---

## 13. Recommendations for Fixes & Improvements

### CRITICAL - Must Fix

#### 1. Implement executeCommand() Function
**Estimated Time**: 1-2 hours

```javascript
async function executeCommand() {
  const input = document.getElementById("commandInput");
  const commandText = input.value.trim();
  
  if (!commandText) {
    showNotification("Please enter a command", "error");
    return;
  }
  
  try {
    const result = await apiCall("/api/llm/command", {
      method: "POST",
      body: JSON.stringify({ command: commandText })
    });
    
    if (result.success) {
      logConsole(`✓ ${result.message}`, "success");
      if (result.result) {
        logConsole(JSON.stringify(result.result, null, 2), "info");
      }
    } else {
      logConsole(`✗ ${result.error}`, "error");
      if (result.suggestions) {
        logConsole("Suggestions: " + result.suggestions.join(", "), "info");
      }
    }
    
    input.value = "";
  } catch (err) {
    logConsole(`Error: ${err.message}`, "error");
  }
}

// Add to global scope:
window.executeCommand = executeCommand;
```

#### 2. Fix Personality Sliders
**Estimated Time**: 1-2 hours

```javascript
// Add to DOMContentLoaded listener in admin.js:
function initPersonalitySliders() {
  const traits = [
    'curiosity', 'patience', 'motivation', 'empathy', 
    'aggression', 'creativity', 'loyalty'
  ];
  
  traits.forEach(trait => {
    const slider = document.getElementById(trait);
    const display = document.getElementById(trait + 'Val');
    
    if (slider && display) {
      // Set initial display
      display.textContent = (slider.value / 100).toFixed(1);
      
      // Listen for changes
      slider.addEventListener('input', (e) => {
        const normalized = (e.target.value / 100).toFixed(1);
        display.textContent = normalized;
      });
    }
  });
}

// Call in DOMContentLoaded:
document.addEventListener("DOMContentLoaded", async () => {
  // ... existing code ...
  initPersonalitySliders();  // ADD THIS
});
```

#### 3. Update handleCreateBot to Send Personality
**Estimated Time**: 1 hour

```javascript
async function handleCreateBot(e) {
  e.preventDefault();
  const name = document.getElementById("botName").value || `bot_${Date.now()}`;
  const role = document.getElementById("botRole").value;
  const desc = document.getElementById("botDescription").value;
  
  // COLLECT PERSONALITY TRAITS
  const personality = {
    curiosity: parseFloat(document.getElementById("curiosity").value) / 100,
    patience: parseFloat(document.getElementById("patience").value) / 100,
    motivation: parseFloat(document.getElementById("motivation").value) / 100,
    empathy: parseFloat(document.getElementById("empathy").value) / 100,
    aggression: parseFloat(document.getElementById("aggression").value) / 100,
    creativity: parseFloat(document.getElementById("creativity").value) / 100,
    loyalty: parseFloat(document.getElementById("loyalty").value) / 100,
  };
  
  try {
    await apiCall("/api/bots", {
      method: "POST",
      body: JSON.stringify({ 
        name, 
        role, 
        description: desc,
        personality  // INCLUDE PERSONALITY
      }),
    });
    showNotification(`Spawned ${name}`, "success");
    await loadBots();
  } catch (err) {
    showNotification("Create failed: " + err.message, "error");
  }
}
```

### MAJOR - High Value Additions

#### 4. Add Live Minecraft World Map Viewer
**Estimated Time**: 4-8 hours

```javascript
// Options:
// 1. 2D Canvas-based map (faster to implement)
//    - Show bot positions as dots
//    - Color-code by role
//    - Pan/zoom functionality
//    - Simple grid overlay

// 2. 3D WebGL viewer (more complex)
//    - Three.js or Babylon.js
//    - Render block terrain
//    - Real-time bot position updates
//    - First-person or top-down view

// Minimal 2D version (2-3 hours):
function renderWorldMap(bots) {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 800;
  const ctx = canvas.getContext('2d');
  
  // Draw grid
  for (let i = 0; i <= 800; i += 50) {
    ctx.strokeStyle = '#333';
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i, 800);
    ctx.stroke();
    ctx.moveTo(0, i);
    ctx.lineTo(800, i);
    ctx.stroke();
  }
  
  // Draw bots
  const scale = 800 / 200;  // 200 block viewport
  const centerX = 100, centerZ = 100;
  
  bots.forEach(bot => {
    const x = (bot.position.x - centerX) * scale + 400;
    const z = (bot.position.z - centerZ) * scale + 400;
    
    ctx.fillStyle = getRoleColor(bot.role);
    ctx.beginPath();
    ctx.arc(x, z, 8, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#fff';
    ctx.font = '10px sans-serif';
    ctx.fillText(bot.id, x + 10, z);
  });
  
  return canvas;
}
```

#### 5. Add Direct Task Assignment Form
**Estimated Time**: 2 hours

Add UI to assign tasks without LLM:
```html
<div class="card">
  <div class="card-header">Assign Task</div>
  <form id="assignTaskForm">
    <div class="form-group">
      <label>Target Bot</label>
      <select id="taskBotId" required></select>
    </div>
    <div class="form-group">
      <label>Task Action</label>
      <select id="taskAction" required>
        <option value="">Select action...</option>
        <option value="mine">Mine</option>
        <option value="move">Move</option>
        <option value="build">Build</option>
        <option value="collect">Collect</option>
      </select>
    </div>
    <div class="form-group">
      <label>Target</label>
      <input type="text" id="taskTarget" placeholder="Block type or location">
    </div>
    <button type="submit">Assign Task</button>
  </form>
</div>
```

### MINOR - Polish & Enhancement

#### 6. Add Position Input for Spawn
```html
<div class="form-group">
  <label>Spawn Position (optional)</label>
  <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px;">
    <input type="number" id="spawnX" placeholder="X" value="0">
    <input type="number" id="spawnY" placeholder="Y" value="64">
    <input type="number" id="spawnZ" placeholder="Z" value="0">
  </div>
</div>
```

#### 7. Add Command Validation & Autocomplete
```javascript
function suggestCommands(partial) {
  const commands = [
    'spawn bot ',
    'list all bots',
    'assign ',
    'move ',
    'delete bot ',
    'get status for ',
  ];
  return commands.filter(c => c.startsWith(partial.toLowerCase()));
}
```

#### 8. Persist Dashboard Settings
```javascript
// Save user preferences:
localStorage.setItem('dashboard-theme', currentTheme);
localStorage.setItem('dashboard-refresh-interval', interval);
localStorage.setItem('dashboard-visible-charts', JSON.stringify(visibleCharts));
```

#### 9. Add Export/Import Bot Configurations
```javascript
function exportBotConfig(botId) {
  return JSON.stringify(bots[botId], null, 2);
}

function importBotConfig(jsonData) {
  // Validate schema, create bot with imported config
}
```

---

## 14. WebSocket Event Flow Diagram

```
Client (Browser)                           Server (Node.js)
     │                                           │
     ├─── socket.io connection ─────────────────┤
     │                                           │
     ├──────────────────────────────────────────>│ io.on('connection')
     │                                           │
     │<──────────── 'init' event ────────────────┤
     │  (send initial state)                     │
     │                                           │
     │<──────── 'cluster:update' (every 30s) ───┤
     │<──────── 'metrics:update' (every 30s) ───┤
     │<──────── 'fusion:update' (every 30s) ────┤
     │                                           │
     │  User creates bot (REST call)             │
     ├─── POST /api/bots ────────────────────────>│
     │<─── 201 response ──────────────────────────┤
     │<──── 'bot:created' event ─────────────────┤
     │<──── 'bot:spawned' event ──────────────────┤
     │                                           │
     │  Bot moves in game                        │
     │                                           │
     │<──────── 'bot:moved' event ────────────────┤
     │<──────── 'bot:status' event ───────────────┤
     │                                           │
     │  User sends LLM command (REST)            │
     ├─── POST /api/llm/command ─────────────────>│
     │<─── 200 response ──────────────────────────┤
     │<──── 'llm:command' event ──────────────────┤
     │                                           │
     │  User logs out                            │
     ├─── POST /api/auth/logout ─────────────────>│
     │                                           │
     ├─────── socket.disconnect() ──────────────>│
     │                                           │
```

---

## 15. File Size & Code Complexity

| File | Lines | Type | Complexity |
|------|-------|------|------------|
| admin.js | 241 | JavaScript | Low |
| admin.html | 471 | HTML | Low |
| dashboard.js | 826 | JavaScript | Medium |
| dashboard.html | 110 | HTML | Low |
| style.css | 786 | CSS | Medium |
| theme.js | 85 | JavaScript | Low |
| fusion.js | ~250 | JavaScript | Medium |
| fusion.html | 70 | HTML | Low |
| routes/bot.js | 787 | JavaScript | High |
| routes/llm.js | 443 | JavaScript | Medium |
| server.js | 335 | JavaScript | High |

**Frontend Total**: ~2,500 lines of code  
**Backend Routes**: ~2,000 lines of code

---

## 16. Live Features Status Checklist

### Admin Panel ✅ / ❌

- ✅ Login with API key
- ✅ Bot list display  
- ✅ Create bot with role
- ✅ Delete bot
- ✅ Real-time status updates
- ✅ WebSocket connection
- ✅ Logout
- ❌ Command console execution (executeCommand missing)
- ❌ Personality trait configuration (sliders broken)
- ❌ Task assignment form
- ❌ Advanced spawn position input

### Dashboard ✅ / ❌

- ✅ Cluster node monitoring
- ✅ CPU/Memory charts
- ✅ Task queue visualization
- ✅ Task latency tracking
- ✅ Fusion knowledge summary
- ✅ Policy control panel
- ✅ Theme toggle
- ✅ Real-time WebSocket updates
- ❌ Historical data persistence
- ❌ Alert/notification system

### Fusion Memory Viewer ✅ / ❌

- ✅ Knowledge composition pie chart
- ✅ Statistics display
- ✅ Raw JSON payload view
- ✅ Theme toggle
- ✅ Real-time updates

---

## 17. Performance Characteristics

### Client-Side
- **No JavaScript bundle**: Direct script loading
- **Chart.js updates**: In-place updates (no destroy/recreate)
- **WebSocket polling**: 30-second interval (optimized from 5s)
- **DOM Updates**: Throttled status logs (5-second minimum)
- **Memory Usage**: Minimal (~50MB typical for 8 bots)

### Network
- **Initial Load**: Single HTML + 2-3 JS files + 1 CSS file (~60KB total)
- **WebSocket Messages**: ~1KB every 30 seconds for cluster data
- **API Calls**: On-demand (bot creation, deletion, commands)
- **Bandwidth**: <10KB/min per client in steady state

### Server
- **Concurrency**: Express + Socket.IO handles 100+ concurrent connections
- **Rate Limiting**: Prevents API abuse (login, bot creation)
- **Database**: PostgreSQL for bot registry, Redis for caching

---

## 18. Known Limitations & Edge Cases

1. **Personality Sliders**: Display values incorrect, not sent to API
2. **Command Console**: Cannot execute commands due to missing function
3. **Bot Position Updates**: May lag 5-30 seconds on WebSocket
4. **Task Status**: Limited real-time feedback on task progress
5. **No Undo/Rollback**: Bot deletions are permanent (in current version)
6. **Single Session**: No multi-user conflict detection
7. **No Bot History**: No audit log of bot state changes
8. **Session Persistence**: API key stored in plain localStorage (should be secure)
9. **Error Handling**: Generic error messages, no detailed error codes
10. **Mobile Responsive**: Not tested on mobile (CSS media queries minimal)

---

## 19. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Browser                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ admin.html / dashboard.html / fusion.html                │  │
│  │ (Vanilla HTML + CSS + JavaScript)                         │  │
│  └──────────────────────────────────────────────────────────┘  │
│    │                  │                     │                   │
│    ├─ REST API ──────┤                     │                   │
│    │  (fetch)        └─ WebSocket/Socket.IO (real-time)        │
│    │                                        │                   │
└────┼────────────────────────────────────────┼───────────────────┘
     │                                        │
     v                                        v
┌──────────────────────────────────────────────────────────────────┐
│                  Express.js Server (Node.js)                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ routes/                                                    │  │
│  │  - bot.js          (Bot CRUD + control)                    │  │
│  │  - llm.js          (LLM command parsing)                   │  │
│  │  - mineflayer.js   (v1: Direct bot control)                │  │
│  │  - mineflayer_v2.js (v2: Policy-enforced control)          │  │
│  └────────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ src/                                                       │  │
│  │  - services/   (NPC engine, Mineflayer bridge, etc.)       │  │
│  │  - middleware/ (Auth, rate limiting, validation)          │  │
│  │  - websocket/  (Socket.IO handlers, replay buffer)        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                      │                │                          │
│                      v                v                          │
│         ┌─────────────────────────────────────┐                 │
│         │  NPC Engine + Mineflayer Bridge     │                 │
│         │  (Bot management + Minecraft control)                 │
│         └─────────────────────────────────────┘                 │
└────────┬─────────────────────────────────────────────────────────┘
         │
         ├─────> PostgreSQL (Bot registry, users, roles)
         ├─────> Redis (Caching, session storage)
         └─────> Minecraft Server (Bot spawning & control)
```

---

## 20. Conclusion & Summary

### Key Findings

1. **Architecture**: Simple, maintainable vanilla JavaScript frontend with no build complexity
2. **Communication**: REST API + WebSocket (Socket.IO) for real-time updates
3. **Critical Issues**: 3 broken features that completely break command execution and personality configuration
4. **Missing Feature**: No live Minecraft world map viewer
5. **Build System**: None needed or used (pure HTML/CSS/JS delivery)
6. **Security**: API key + JWT auth with role-based access control and policy enforcement

### Strengths ✅

- Simple, easy-to-understand codebase
- No build tool complexity
- Real-time updates with WebSocket
- Multiple UI views for different purposes
- Good separation of concerns (frontend/backend)
- Comprehensive API documentation

### Weaknesses ❌

- Broken critical UI features (command execution, personality sliders)
- No live map viewer for bot positions
- Limited error handling and user feedback
- No historical data persistence on client
- Missing UI for advanced features (task assignment, position input)
- No mobile responsiveness

### Recommended Priority Order

1. **Phase 1 (Critical)**: Fix executeCommand() and personality sliders (1-2 days)
2. **Phase 2 (High)**: Add live map viewer (4-8 hours)
3. **Phase 3 (Medium)**: Add direct task assignment form (2-3 hours)
4. **Phase 4 (Polish)**: Improve error handling, add more UI refinements

### Estimated Development Effort

- **Fix all critical issues**: 8-12 hours
- **Add map viewer**: 8-16 hours
- **Full feature parity**: 40-60 hours

---

## Appendix A: Command Examples

### Using LLM Commands (via /api/llm/command)

```
"spawn bot miner_01 as miner"
"list all bots"
"assign miner_01 task mine iron"
"get status for miner_01"
"move miner_01 to 100 64 200"
"spawn all bots"
"delete bot miner_01"
"show all npcs"
"summon a bot named scout_01 as scout"
```

### Using Direct REST API

```bash
# Create bot
curl -X POST http://localhost:3000/api/bots \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "miner_01",
    "role": "miner",
    "description": "Iron mining bot"
  }'

# List bots
curl http://localhost:3000/api/bots \
  -H "X-API-Key: your-key"

# Delete bot
curl -X DELETE http://localhost:3000/api/bots/miner_01 \
  -H "X-API-Key: your-key"

# Execute command
curl -X POST http://localhost:3000/api/llm/command \
  -H "X-API-Key: your-key" \
  -H "Content-Type: application/json" \
  -d '{"command": "spawn bot miner_02 as miner"}'
```

---

