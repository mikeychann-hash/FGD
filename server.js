import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { watch } from "fs";

// Constants
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_PATH = path.join(__dirname, "data", "fused_knowledge.json");
const DEFAULT_PORT = 3000;
const REQUEST_SIZE_LIMIT = "10mb";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;

/**
 * Default fusion data structure returned when no data file exists
 */
const DEFAULT_FUSION_DATA = {
  skills: {},
  dialogues: {},
  outcomes: [],
  metadata: {
    version: "2.0.0",
    lastMerge: null,
    mergeCount: 0,
    sources: []
  }
};

// Cache for fusion data
let cachedData = null;
let lastModified = null;

/**
 * Ensures the data directory exists
 * @returns {Promise<void>}
 */
async function ensureDataDirectory() {
  try {
    await fs.mkdir(path.dirname(DATA_PATH), { recursive: true });
    console.log("✅ Data directory verified");
  } catch (err) {
    console.error("❌ Failed to create data directory:", err);
    throw err;
  }
}

/**
 * Loads fusion data from disk with caching
 * @returns {Promise<Object>} The fusion data
 */
async function loadFusionData() {
  try {
    const stats = await fs.stat(DATA_PATH);
    const currentModified = stats.mtime.getTime();

    // Return cached data if file hasn't changed
    if (cachedData && lastModified === currentModified) {
      return cachedData;
    }

    // Read and parse the file
    const rawData = await fs.readFile(DATA_PATH, "utf-8");
    const data = JSON.parse(rawData);

    // Update cache
    cachedData = data;
    lastModified = currentModified;

    return data;
  } catch (err) {
    if (err.code === "ENOENT") {
      // File doesn't exist, return default data
      return DEFAULT_FUSION_DATA;
    }
    // Re-throw other errors to be handled by caller
    throw err;
  }
}

/**
 * Sets up file watcher to invalidate cache when data changes
 */
function setupFileWatcher() {
  try {
    watch(DATA_PATH, (eventType) => {
      if (eventType === "change" || eventType === "rename") {
        console.log("📝 Data file changed, invalidating cache");
        cachedData = null;
        lastModified = null;
      }
    });
    console.log("👁️  File watcher active for fusion data");
  } catch (err) {
    console.warn("⚠️  Could not set up file watcher:", err.message);
  }
}

// Initialize Express app
const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Request logging
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing with size limits
app.use(express.json({ limit: REQUEST_SIZE_LIMIT }));
app.use(express.urlencoded({ extended: true, limit: REQUEST_SIZE_LIMIT }));

// Rate limiting
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/data', limiter);

// Static file serving
app.use(express.static(__dirname));

/**
 * Health check endpoint for monitoring
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * Main dashboard route
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "dashboard.html"));
});

/**
 * API endpoint to fetch fusion knowledge data
 * Implements caching and proper error handling
 */
app.get("/data/fused_knowledge.json", async (req, res) => {
  try {
    const data = await loadFusionData();
    res.type("application/json").json(data);
  } catch (err) {
    console.error("❌ Error loading fusion data:", err);

    if (err instanceof SyntaxError) {
      // JSON parsing error
      return res.status(500).json({
        error: "Data file is corrupted",
        message: "Unable to parse fusion data"
      });
    }

    if (err.code === "EACCES") {
      // Permission error
      return res.status(500).json({
        error: "Permission denied",
        message: "Unable to access fusion data"
      });
    }

    // Generic server error
    return res.status(500).json({
      error: "Internal server error",
      message: "Failed to load fusion data"
    });
  }
});

/**
 * 404 handler for API routes
 */
app.use('/data', (req, res) => {
  res.status(404).json({
    error: "Not found",
    message: "The requested resource does not exist"
  });
});

/**
 * Global error handler
 */
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);

  if (err.type === 'entity.too.large') {
    return res.status(413).json({
      error: "Payload too large",
      message: `Request size exceeds ${REQUEST_SIZE_LIMIT} limit`
    });
  }

  res.status(500).json({
    error: "Internal server error",
    message: process.env.NODE_ENV === 'production'
      ? "An unexpected error occurred"
      : err.message
  });
});

// Server instance
let server;

/**
 * Starts the Express server
 * @returns {Promise<void>}
 */
async function startServer() {
  try {
    // Ensure data directory exists
    await ensureDataDirectory();

    // Set up file watcher
    setupFileWatcher();

    // Start listening
    const PORT = process.env.PORT || DEFAULT_PORT;
    server = app.listen(PORT, () => {
      console.log(`✅ AICraft control panel active at http://localhost:${PORT}`);
      console.log(`📊 Health check available at http://localhost:${PORT}/health`);
      console.log(`🔒 Security headers enabled`);
      console.log(`⚡ Rate limiting: ${RATE_LIMIT_MAX_REQUESTS} requests per ${RATE_LIMIT_WINDOW_MS / 60000} minutes`);
    });
  } catch (err) {
    console.error("❌ Failed to start server:", err);
    process.exit(1);
  }
}

/**
 * Gracefully shuts down the server
 * @param {string} signal - The signal that triggered shutdown
 */
function gracefulShutdown(signal) {
  console.log(`\n⚠️  ${signal} received, shutting down gracefully...`);

  if (server) {
    server.close(() => {
      console.log("✅ Server closed gracefully");
      process.exit(0);
    });

    // Force shutdown after 10 seconds
    setTimeout(() => {
      console.error("❌ Forced shutdown after timeout");
      process.exit(1);
    }, 10000);
  } else {
    process.exit(0);
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

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown('UNHANDLED_REJECTION');
});

// Start the server
startServer();
