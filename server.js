import commandRouter from "./routes/command.js";
import { initMineflayerRoutes } from "./routes/mineflayer.js";
import { initMineflayerRoutesV2 } from "./routes/mineflayer_v2.js";
import { MineflayerPolicyService } from "./src/services/mineflayer_policy_service.js";
import { initLLMRoutes } from "./routes/llm.js";
import { initActionRoutes } from "./routes/action.js";
import { initBotRoutes } from "./routes/bot.js";
import { logSecretWarnings } from "./security/secrets.js";
import { runStartupValidation } from "./src/services/startup.js";
import { initDatabase, closeDatabase } from "./src/database/connection.js";
import { bindMetricsToNpcEngine, getPrometheusRegistry } from "./src/services/metrics.js";
import { loadAndValidateGovernanceConfig } from "./security/governance_validator.js";
import { validateCriticalEnvVars } from "./security/env-validation.js";
import { initializeClusterServices } from "./src/services/init_cluster.js";
import { getServiceContainer } from "./src/services/service_container.js";
import { initMinecraftStatusRoutes } from "./routes/minecraft_status.js";
import { initAutonomyRoutes } from "./src/api/autonomy.js";
import { initClusterRoutes } from "./src/api/cluster.js";
import { initHealthRoutes } from "./src/api/health.js";
import { initNPCRoutes } from "./src/api/npcs.js";
import { initProgressionRoutes } from "./src/api/progression.js";
import { NPCSystem } from "./src/services/npc_initializer.js";
import { SystemStateManager } from "./src/services/state.js";
import {
  startTelemetryPipeline,
  attachNpcEngineTelemetry,
  cleanupTelemetry
} from "./src/services/telemetry.js";
import {
  ensureDataDirectory,
  loadSystemData,
  setupFileWatcher
} from "./src/services/data.js";
import { createAppServer } from "./src/config/server.js";
import { DEFAULT_PORT } from "./src/config/constants.js";
import { initializeWebSocketHandlers } from "./src/websocket/handlers.js";
import { notFoundHandler, globalErrorHandler } from "./src/middleware/errorHandlers.js";
import { apiLimiter, authLimiter } from "./src/middleware/rateLimiter.js";
import {
  authenticate,
  handleLogin,
  getCurrentUser,
  refreshAccessToken,
  logout
} from "./middleware/auth.js";
import { logger } from "./logger.js";
import express from "express";
import path from "path";
import controlRouter from "./routes/control.js";
import { initServerControlRoutes } from "./src/api/serverControl.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
let swaggerUi = null;
try {
  swaggerUi = require("swagger-ui-express");
} catch (err) {
  console.warn("swagger-ui-express not installed, falling back to static UI");
}

// CRITICAL SECURITY: Validate environment variables BEFORE any initialization
// This prevents the server from starting with hardcoded/weak credentials
try {
  validateCriticalEnvVars();
} catch (error) {
  console.error('\n❌ FATAL: Environment validation failed');
  console.error(error.message);
  process.exit(1);
}

// Create Express app, HTTP server, and Socket.IO
// Server and System instances (mutable for restart)
let app, httpServer, io;
let npcSystem, stateManager;
let DOCS_DIR;

/**
 * Initialize all API routes
 */
async function initializeAPIRoutes() {
  const apiV1 = express.Router();
  const apiV2 = express.Router();

  // Auth routes (unversioned for compatibility)
  app.post("/api/auth/login", authLimiter, handleLogin);
  app.get("/api/auth/me", authenticate, getCurrentUser);

  // Refresh token endpoint
  app.post("/api/auth/refresh", authLimiter, (req, res) => {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token required' });
    }

    const newAccessToken = refreshAccessToken(refreshToken);

    if (!newAccessToken) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }

    res.json({
      success: true,
      accessToken: newAccessToken,
      // Keep 'token' for backward compatibility
      token: newAccessToken
    });
  });

  // Logout endpoint
  app.post("/api/auth/logout", authenticate, async (req, res) => {
    const token = req.headers.authorization?.split(' ')[1];
    try {
      await logout(token);
    } catch (err) {
      logger.warn('Logout blacklist write failed', { error: err.message });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });

  // Dashboard and cluster routes remain unversioned for HTML assets
  app.use("/", initClusterRoutes(stateManager, npcSystem));

  const healthRouter = initHealthRoutes(npcSystem, stateManager);
  const npcRouter = initNPCRoutes(npcSystem);
  const progressionRouter = initProgressionRoutes((payload) => {
    if (io) {
      io.emit('progression:phaseChanged', payload);
    }
  });
  const minecraftStatusRouter = initMinecraftStatusRoutes(npcSystem);

  let botRouter = null;
  let mineflayerRouterV1 = null;
  let mineflayerRouterV2 = null;
  let llmRouter = null;
  let policyService = null;
  let actionRouter = null;

  if (npcSystem.npcEngine) {
    botRouter = initBotRoutes(npcSystem, io);
    llmRouter = initLLMRoutes(npcSystem, io);
    actionRouter = initActionRoutes(npcSystem, io);
    logger.info('Bot management routes initialized');
    console.log('✅ Bot management routes initialized');
    logger.info('LLM command routes initialized');
    console.log('✅ LLM command routes initialized');

    // Initialize Mineflayer routes if bridge available
    if (npcSystem.mineflayerBridge) {
      // v1: Direct bot control without policy approval
      mineflayerRouterV1 = initMineflayerRoutes(npcSystem, io);
      logger.info('Mineflayer v1 routes initialized (direct control)');
      console.log('✅ Mineflayer v1 routes initialized (direct control)');

      // v2: Policy-based approval flow for bot actions
      policyService = new MineflayerPolicyService(npcSystem);
      const policyInitialized = await policyService.initialize();
      if (policyInitialized) {
        mineflayerRouterV2 = initMineflayerRoutesV2(npcSystem, policyService, io);
        logger.info('Mineflayer v2 routes initialized (with policy enforcement)');
        console.log('✅ Mineflayer v2 routes initialized (with policy enforcement)');
      } else {
        logger.warn('Policy service failed to initialize, v2 routes unavailable');
        console.warn('⚠️  Policy service initialization failed');
      }
    }
  } else {
    logger.warn('Bot and LLM routes not initialized - NPC Engine not ready');
  }

  // Initialize autonomy routes
  const autonomyRouter = npcSystem.npcEngine && npcSystem.mineflayerBridge
    ? initAutonomyRoutes(npcSystem.npcEngine, npcSystem.mineflayerBridge)
    : null;

  const mountRoutesV1 = (router) => {
    router.use("/health", healthRouter);
    router.use("/npcs", npcRouter);
    router.use("/progression", progressionRouter);
    router.use("/minecraft", minecraftStatusRouter);
    if (botRouter) {
      router.use("/bots", botRouter);
    }
    if (actionRouter) {
      router.use("/action", actionRouter);
    }
    if (mineflayerRouterV1) {
      router.use("/mineflayer", mineflayerRouterV1);
    }
    if (llmRouter) {
      router.use("/llm", llmRouter);
    }
    if (autonomyRouter) {
      router.use("/autonomy", autonomyRouter);
    }
    router.use("/control", controlRouter);
  };

  const mountRoutesV2 = (router) => {
    router.use("/health", healthRouter);
    router.use("/npcs", npcRouter);
    router.use("/progression", progressionRouter);
    router.use("/minecraft", minecraftStatusRouter);
    if (botRouter) {
      router.use("/bots", botRouter);
    }
    if (actionRouter) {
      router.use("/action", actionRouter);
    }
    if (mineflayerRouterV2) {
      router.use("/mineflayer", mineflayerRouterV2);
    }
    if (llmRouter) {
      router.use("/llm", llmRouter);
    }
    if (autonomyRouter) {
      router.use("/autonomy", autonomyRouter);
    }
    router.use("/control", controlRouter);
    router.use("/server", serverControlRouter);
  };

  const serverControlRouter = initServerControlRoutes({
    startServer,
    restartServer,
    stopServer: () => gracefulShutdown('API_STOP'),
    getServerStatus
  });

  app.use('/api/server', serverControlRouter);

  mountRoutesV1(apiV1);
  mountRoutesV2(apiV2);

  // Apply rate limiting to all API routes
  app.use("/api", apiLimiter, apiV1);
  app.use("/api/v1", apiLimiter, apiV1);
  app.use("/api/v2", apiLimiter, apiV2);

  // OpenAPI spec + Swagger UI
  app.use("/docs/openapi", express.static(DOCS_DIR));
  app.get("/docs/api", (_req, res) => {
    res.sendFile(path.join(DOCS_DIR, "swagger-ui.html"));
  });
  app.get("/api/docs", (_req, res) => {
    res.redirect("/docs/api");
  });
  if (swaggerUi) {
    try {
      const swaggerSpec = await import(path.join(DOCS_DIR, "swagger.json"), { assert: { type: "json" } }).catch(() => null);
      if (swaggerSpec?.default) {
        app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec.default));
      }
    } catch (err) {
      logger.warn("Swagger UI setup skipped", { error: err.message });
    }
  }

  // Backward compatibility: default to v2 routes for critical endpoints
  // This allows old clients to work with policy enforcement
  if (mineflayerRouterV2) {
    app.use("/api/mineflayer", mineflayerRouterV2);
  } else if (mineflayerRouterV1) {
    // Fallback to v1 if v2 policy service failed to initialize
    app.use("/api/mineflayer", mineflayerRouterV1);
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
/**
 * Gracefully shuts down the server
 */
async function gracefulShutdown(signal, isRestart = false) {
  logger.warn('Shutdown signal received', { signal });
  console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);

  try {
    // Cleanup telemetry
    cleanupTelemetry();

    // Release engine-owned resources (bridge listeners, monitor intervals,
    // pending task timeouts) so no handles outlive the process shutdown.
    if (npcSystem?.npcEngine?.shutdown) {
      try {
        npcSystem.npcEngine.shutdown();
      } catch (err) {
        logger.error('Error shutting down NPC engine', { error: err.message });
      }
    }

    // Stop Socket.IO dashboard interval set up in initializeWebSocketHandlers.
    if (io?.__dashboardCleanup) {
      try {
        io.__dashboardCleanup();
      } catch (err) {
        logger.error('Error cleaning up websocket intervals', { error: err.message });
      }
    }

    await closeDatabase().catch(err => {
      logger.error('Error closing database during shutdown', { error: err.message });
    });

    // Save NPC system data
    await npcSystem.save();
  } catch (err) {
    logger.error('Error saving data during shutdown', { error: err.message });
  }

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => {
        logger.info('Server closed gracefully');
        console.log("✅ Server closed gracefully");
        resolve();
      });
    });
  }

  if (!isRestart) {
    process.exit(0);
  }
}

async function restartServer() {
  console.log('🔄 Restarting server...');
  await gracefulShutdown('RESTART', true);
  // Clear module cache? ESM modules are cached permanently. 
  // We can't easily reload modules in ESM without restarting the process.
  // However, we can re-run startServer which re-initializes services.
  // This won't reload code changes, but it will reset state.
  // For full code reload, we'd need a watcher that restarts the process (like nodemon).
  // But the user asked for "server start and restart from it".
  // Re-initializing services might be enough for "soft restart".
  await startServer();
}

function getServerStatus() {
  return {
    status: httpServer && httpServer.listening ? 'running' : 'stopped',
    uptime: process.uptime(),
    port: process.env.PORT || DEFAULT_PORT
  };
}

/**
 * Start the server
 */
export async function startServer() {
  try {
    // Initialize server and system instances
    const serverConfig = createAppServer();
    app = serverConfig.app;
    httpServer = serverConfig.httpServer;
    io = serverConfig.io;

    DOCS_DIR = path.join(process.cwd(), "docs", "openapi");
    npcSystem = new NPCSystem();
    stateManager = new SystemStateManager(io);

    // Ensure data directory exists
    await ensureDataDirectory();

    // Initialize system data
    await initializeSystem();

    const systemState = stateManager.getState();

    // Start telemetry before dependent services to satisfy validation order
    startTelemetryPipeline(
      systemState,
      io,
      () => stateManager.recomputeSystemStats(npcSystem.npcEngine)
    );

    await runStartupValidation({
      stateManager,
      npcSystem,
      io,
      initializeDatabase: () => initDatabase(),
      initializeNpcSystem: async () => {
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
        bindMetricsToNpcEngine(npcSystem.npcEngine, stateManager);
      }
    });

    // Wire services into container and run self-checks
    await initializeClusterServices(npcSystem);

    await loadAndValidateGovernanceConfig();

    // Initialize API routes (after NPC system is ready)
    await initializeAPIRoutes();
    // Mount high‑level command routes
    app.use('/api/command', commandRouter);

    // Initialize WebSocket handlers
    initializeWebSocketHandlers(io, stateManager, npcSystem);

    // Set up file watcher
    setupFileWatcher();

    // Surface any secret configuration warnings
    logSecretWarnings(logger);

    // Expose Prometheus metrics endpoint (before server starts)
    app.get('/metrics', async (req, res) => {
      try {
        const registry = getPrometheusRegistry();
        res.set('Content-Type', registry.contentType);
        res.end(await registry.metrics());
      } catch (err) {
        res.status(500).send(err.message);
      }
    });

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

process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.stack || reason.message : String(reason);
  console.error('❌ Unhandled Rejection:', message);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();
