# Admin Panel Integration Guide

This guide explains how to integrate the complete admin panel system into your server.

## 📦 What's Been Created

### Backend Components

1. **`middleware/auth.js`** - JWT authentication system
   - Token generation and verification
   - API key authentication
   - Role-based access control (Admin, LLM, Viewer)
   - WebSocket authentication

2. **`routes/bot.js`** - Bot management API
   - Full CRUD operations for bots
   - Spawn/despawn controls
   - Task assignment
   - Real-time WebSocket events

3. **`routes/llm.js`** - LLM command interface
   - Natural language command parser
   - Batch command execution
   - Command history and feedback

4. **`schemas/`** - JSON schemas for validation
   - `bot-config.schema.json` - Bot configuration schema
   - `task.schema.json` - Task definition schema

### Frontend Components

5. **`public/admin.html`** - Admin panel UI
   - Bot list and management
   - Create bot form with personality sliders
   - Real-time command console
   - WebSocket-powered live updates

6. **`public/admin.js`** - Admin panel JavaScript
   - API integration
   - WebSocket handling
   - Real-time UI updates

## 🔧 Server.js Integration Steps

### Step 1: Update Imports

Add these imports to the top of `server.js`:

```javascript
import { createServer } from "http";
import { Server } from "socket.io";
import { handleLogin, getCurrentUser, authenticateSocket } from "./middleware/auth.js";
import { initBotRoutes } from "./routes/bot.js";
import { initLLMRoutes } from "./routes/llm.js";
```

### Step 2: Add Authentication Routes

Add after your existing routes:

```javascript
// Authentication
app.post("/api/auth/login", handleLogin);
app.get("/api/auth/me", getCurrentUser);

// Admin panel route
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});
```

### Step 3: Mount Bot & LLM Routers

After NPC engine initialization, add:

```javascript
// Initialize and mount bot management routes
const botRouter = initBotRoutes(npcEngine, io);
app.use('/api/bots', botRouter);

// Initialize and mount LLM command routes
const llmRouter = initLLMRoutes(npcEngine, io);
app.use('/api/llm', llmRouter);
```

### Step 4: Add WebSocket Authentication

Update your Socket.io initialization:

```javascript
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Add authentication middleware
io.use(authenticateSocket);

io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id} (${socket.user.username})`);

  socket.emit('auth:success', {
    user: socket.user
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});
```

### Step 5: Install Dependencies

```bash
npm install jsonwebtoken
```

## 🔐 Authentication Setup

### Default API Keys (Change in Production!)

The system comes with default API keys in `middleware/auth.js`:

```javascript
// Admin key
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'admin-key-change-me'

// LLM key
const LLM_API_KEY = process.env.LLM_API_KEY || 'llm-key-change-me'
```

**⚠️ Important**: Set these as environment variables in production:

```bash
export ADMIN_API_KEY="your-secure-admin-key"
export LLM_API_KEY="your-secure-llm-key"
export JWT_SECRET="your-secure-jwt-secret"
```

## 🚀 Usage

### 1. Access the Admin Panel

Navigate to: `http://localhost:3000/admin`

### 2. Login

Use the API key: `admin-key-change-me` (or your configured key)

### 3. Create Bots

- Select role (miner, builder, scout, guard, gatherer)
- Adjust personality sliders
- Add description (optional)
- Click "Create Bot"

### 4. Manage Bots

- **Spawn**: Deploy bot in Minecraft
- **Despawn**: Remove from world
- **Info**: View detailed stats
- **Delete**: Deactivate bot

### 5. Use Command Console

Natural language commands:
- `spawn bot miner_01 as miner`
- `list all bots`
- `assign miner_01 task mine iron ore`
- `get status for miner_01`
- `move bot_01 to 100 64 200`

## 📡 API Endpoints

### Authentication

- `POST /api/auth/login` - Login with API key
- `GET /api/auth/me` - Get current user info

### Bot Management

- `GET /api/bots` - List all bots
- `GET /api/bots/:id` - Get bot details
- `POST /api/bots` - Create new bot
- `PUT /api/bots/:id` - Update bot
- `DELETE /api/bots/:id` - Delete bot
- `POST /api/bots/:id/spawn` - Spawn bot
- `POST /api/bots/:id/despawn` - Despawn bot
- `POST /api/bots/:id/task` - Assign task
- `POST /api/bots/spawn-all` - Spawn all bots
- `GET /api/bots/status` - Get engine status
- `GET /api/bots/learning` - Get learning profiles

### LLM Commands

- `POST /api/llm/command` - Execute natural language command
- `POST /api/llm/batch` - Execute multiple commands
- `GET /api/llm/help` - Get available commands

## 🔌 WebSocket Events

### Emitted by Server

- `bot:created` - Bot was created
- `bot:updated` - Bot was updated
- `bot:deleted` - Bot was deleted
- `bot:spawned` - Bot spawned in Minecraft
- `bot:despawned` - Bot despawned
- `bot:task_assigned` - Task assigned to bot
- `llm:command` - LLM command executed
- `llm:batch` - Batch commands executed

## 🎯 Testing the Integration

### 1. Test API Endpoints

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "admin-key-change-me"}'

# Create bot
curl -X POST http://localhost:3000/api/bots \
  -H "Content-Type: application/json" \
  -H "X-API-Key: admin-key-change-me" \
  -d '{
    "role": "miner",
    "description": "Test miner bot"
  }'

# List bots
curl -H "X-API-Key: admin-key-change-me" \
  http://localhost:3000/api/bots

# LLM command
curl -X POST http://localhost:3000/api/llm/command \
  -H "Content-Type: application/json" \
  -H "X-API-Key: llm-key-change-me" \
  -d '{"command": "list all bots"}'
```

### 2. Test Admin Panel

1. Open `http://localhost:3000/admin`
2. Login with API key
3. Create a test bot
4. Try natural language commands in console
5. Check WebSocket connection indicator

## 🛡️ Security Notes

1. **Change default API keys** before deploying to production
2. **Use HTTPS** in production
3. **Set JWT_SECRET** environment variable
4. **Implement rate limiting** for API endpoints
5. **Add IP whitelist** for sensitive operations
6. **Enable CORS selectively** - don't use `*` in production

## 🔄 Migration from Old NPC Routes

If you have existing `/api/npcs/*` routes in server.js:

1. **Remove old routes**: All `/api/npcs/*` routes are now handled by `routes/bot.js`
2. **Update frontend**: Change `/api/npcs` to `/api/bots` in any existing code
3. **Keep compatibility**: The bot router uses the same JSON format as old routes

## 📊 Monitoring

The admin panel includes:
- Real-time bot status updates
- Command execution logs
- Server connection status
- Bot count and activity metrics

## 🐛 Troubleshooting

### "NPC engine not initialized"
- Ensure `initializeNPCEngine()` is called before mounting routes
- Check that `npcEngine` is passed to route initializers

### "Authentication failed"
- Verify API key matches configured key
- Check that JWT_SECRET is set (for token auth)
- Ensure WebSocket authentication is enabled

### "Bridge not configured"
- Minecraft bridge is optional
- Bots can be created without bridge
- Spawning requires RCON connection

### Frontend not loading
- Ensure `public/` directory contains admin.html and admin.js
- Check static file middleware is enabled
- Verify Socket.io client is loaded

## 📝 Example: Complete Integration

```javascript
// server.js example

import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { NPCEngine } from "./npc_engine.js";
import { handleLogin, authenticateSocket } from "./middleware/auth.js";
import { initBotRoutes } from "./routes/bot.js";
import { initLLMRoutes } from "./routes/llm.js";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static("public"));

// NPC Engine
let npcEngine = null;

async function initializeSystem() {
  // Initialize NPC engine
  npcEngine = new NPCEngine({
    autoSpawn: false,
    autoRegisterFromRegistry: true
  });

  await npcEngine.registryReady;
  await npcEngine.learningReady;

  console.log("✅ NPC Engine initialized");

  // Mount routers
  const botRouter = initBotRoutes(npcEngine, io);
  app.use('/api/bots', botRouter);

  const llmRouter = initLLMRoutes(npcEngine, io);
  app.use('/api/llm', llmRouter);
}

// Auth routes
app.post("/api/auth/login", handleLogin);
app.get("/admin", (req, res) => {
  res.sendFile(__dirname + "/public/admin.html");
});

// WebSocket
io.use(authenticateSocket);
io.on('connection', (socket) => {
  console.log(`🔌 ${socket.user.username} connected`);
});

// Start server
const PORT = 3000;
httpServer.listen(PORT, async () => {
  await initializeSystem();
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`🎮 Admin panel: http://localhost:${PORT}/admin`);
});
```

## 🎉 You're Done!

The admin panel is now fully integrated and ready to use. Access it at `/admin` and start managing your bots!
