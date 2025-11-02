// index.js
// Unified backend with DELETE bot route

import express from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { Server as SocketServer } from "socket.io";
import {
  bridge,
  listBots,
  getSystemStats,
  executeLLMCommand,
  runtimeEvents,
} from "./core_runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, { cors: { origin: "*" } });

app.use(express.json());
app.use(express.static(__dirname));

const API_KEY = process.env.FGD_API_KEY || "admin123";

app.use((req, res, next) => {
  if (
    req.path === "/" ||
    req.path.startsWith("/admin") ||
    req.path.startsWith("/dashboard") ||
    req.path.startsWith("/fusion") ||
    req.path.endsWith(".html") ||
    req.path.endsWith(".js") ||
    req.path.endsWith(".css") ||
    req.path.endsWith(".ico") ||
    req.path.startsWith("/socket.io")
  )
    return next();

  const key = req.headers["x-api-key"];
  if (key !== API_KEY)
    return res.status(401).json({ error: "Invalid API key" });

  next();
});

// --- API ROUTES ---
app.get("/api/bots", (req, res) => {
  const bots = listBots();
  res.json({ bots });
});

app.post("/api/bots", async (req, res) => {
  try {
    const { name, role, description, personality } = req.body;
    const botId = name || `bot_${Date.now()}`;
    await bridge.spawnEntity({ npcId: botId });
    res.json({
      success: true,
      bot: { name: botId, role, description, personality },
    });
  } catch (err) {
    console.error("❌ /api/bots failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/bots/:id", async (req, res) => {
  try {
    const npcId = req.params.id;
    await bridge.despawnEntity({ npcId });
    res.json({ success: true, message: `Removed ${npcId}` });
  } catch (err) {
    console.error("❌ /api/bots/:id failed:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/llm/command", async (req, res) => {
  const { command } = req.body;
  const result = await executeLLMCommand(command);
  res.json(result);
});

app.get("/api/system/stats", (req, res) => res.json(getSystemStats()));

app.get("/", (req, res) =>
  res.sendFile(path.join(__dirname, "admin.html"))
);

// --- SOCKET.IO ---
runtimeEvents.on("bot:created", (data) => io.emit("bot:created", data));
runtimeEvents.on("bot:spawned", (data) => io.emit("bot:spawned", data));
runtimeEvents.on("bot:despawned", (data) => io.emit("bot:despawned", data));
runtimeEvents.on("system:log", (data) => io.emit("system:log", data));

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);
  socket.on("disconnect", () =>
    console.log("Client disconnected:", socket.id)
  );
});

const PORT = 3000;
server.listen(PORT, () =>
  console.log(`✅ AICraft Federation server running at http://127.0.0.1:${PORT}`)
);
