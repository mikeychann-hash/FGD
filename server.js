import { logger } from "./logger.js";
import { DEFAULT_PORT } from "./src/config/constants.js";
import { createAppServer } from "./src/config/server.js";
import { ensureDataDirectory, loadSystemData, setupFileWatcher } from "./src/services/data.js";
import { startTelemetryPipeline, cleanupTelemetry, attachNpcEngineTelemetry } from "./src/services/telemetry.js";
import { NPCSystem } from "./src/services/npc_initializer.js";
import { SystemStateManager } from "./src/services/state.js";
import { initClusterRoutes } from "./src/api/cluster.js";
import { initNPCRoutes } from "./src/api/npcs.js";
import { initProgressionRoutes } from "./src/api/progression.js";
import { initHealthRoutes } from "./src/api/health.js";
import { notFoundHandler, globalErrorHandler } from "./src/middleware/errorHandlers.js";
import { initializeWebSocketHandlers } from "./src/websocket/handlers.js";
import { handleLogin, getCurrentUser, authenticate } from "./middleware/auth.js";
import { initBotRoutes } from "./routes/bot.js";
import { initLLMRoutes } from "./routes/llm.js";
import { logSecretWarnings } from "./security/secrets.js";

// Create Express app, HTTP server, and Socket.IO
const { app, httpServer, io } = createAppServer();

// Initialize system components
const npcSystem = new NPCSystem();
const stateManager = new SystemStateManager(io);

/**
 * Initialize all API routes
 */
function initializeAPIRoutes() {
  // Auth routes
  app.post("/api/auth/login", handleLogin);
  app.get("/api/auth/me", authenticate, getCurrentUser);

  // Dashboard and cluster routes
  app.use("/", initClusterRoutes(stateManager, npcSystem));

  // Health and metrics routes
  app.use("/api", initHealthRoutes(npcSystem, stateManager));

  // NPC management routes
  app.use("/api/npcs", initNPCRoutes(npcSystem));

  // Progression system routes
  app.use("/api/progression", initProgressionRoutes());

  // Bot management routes (requires npcEngine)
  if (npcSystem.npcEngine) {
    const botRouter = initBotRoutes(npcSystem.npcEngine, io);
    app.use('/api/bots', botRouter);
    logger.info('Bot management routes initialized');
    console.log('✅ Bot management routes initialized');

    // LLM command routes
    const llmRouter = initLLMRoutes(npcSystem.npcEngine, io);
    app.use('/api/llm', llmRouter);
    logger.info('LLM command routes initialized');
    console.log('✅ LLM command routes initialized');
  } else {
    logger.warn('Bot and LLM routes not initialized - NPC Engine not ready');
  }

  // Error handlers
  app.use('/data', notFoundHandler);
  app.use(globalErrorHandler);
}

/**
 * Initialize system with data and telemetry
 */
async function initializeSystem() {
  try {
    // Load system data from files
    const loadedData = await loadSystemData();
    await stateManager.loadInitialData(loadedData);
    stateManager.recomputeSystemStats(npcSystem.npcEngine);

    logger.info('System initialized with sample data');
  } catch (err) {
    logger.warn('Failed to load some data', { error: err.message });
  }
}

/**
 * Gracefully shuts down the server
 */
async function gracefulShutdown(signal) {
  logger.warn('Shutdown signal received', { signal });
  console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);

  try {
    // Cleanup telemetry
    cleanupTelemetry();

    // Save NPC system data
    await npcSystem.save();
  } catch (err) {
    logger.error('Error saving data during shutdown', { error: err.message });
  }

  if (httpServer) {
    httpServer.close(() => {
      logger.info('Server closed gracefully');
      console.log("✅ Server closed gracefully");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      console.error("❌ Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
  }
}

/**
 * Start the server
 */
async function startServer() {
  try {
    // Ensure data directory exists
    await ensureDataDirectory();

    // Initialize system data
    await initializeSystem();

    // Initialize NPC system
    const systemState = stateManager.getState();
    await npcSystem.initialize(
      io,
      systemState,
      (engine) => attachNpcEngineTelemetry(
        engine,
        systemState,
        io,
        () => stateManager.recomputeSystemStats(npcSystem.npcEngine),
        (entry) => stateManager.appendSystemLog(entry)
      ),
      () => stateManager.recomputeSystemStats(npcSystem.npcEngine)
    );

    // Initialize API routes (after NPC system is ready)
    initializeAPIRoutes();

    // Initialize WebSocket handlers
    initializeWebSocketHandlers(io, stateManager, npcSystem);

    // Set up file watcher
    setupFileWatcher();

    // Start telemetry ingestion
    startTelemetryPipeline(
      systemState,
      io,
      () => stateManager.recomputeSystemStats(npcSystem.npcEngine)
    );

    // Surface any secret configuration warnings
    logSecretWarnings(logger);

    // Start HTTP server
    const PORT = process.env.PORT || DEFAULT_PORT;
    httpServer.listen(PORT, () => {
      logger.info('AICraft Cluster Control Panel started');
      console.log('╔══════════════════════════════════════════╗');
      console.log('║   AICraft Cluster Control Panel         ║');
      console.log('╚══════════════════════════════════════════╝');
      console.log(`🚀 Server: http://localhost:${PORT}`);
      console.log(`🔌 WebSocket: Real-time updates enabled`);
      console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
      console.log(`📈 Metrics: http://localhost:${PORT}/api/metrics/system`);
      console.log(`🤖 NPC API: http://localhost:${PORT}/api/npcs`);
    });
  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    console.error('❌ Failed to start server:', err);
    process.exit(1);
  }
}

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start the server
startServer();
