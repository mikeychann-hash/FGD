/**
 * Structured Logging System
 * Provides consistent, structured logging with levels and context
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log levels
const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  FATAL: 4
};

// Reverse mapping for display
const LEVEL_NAMES = Object.keys(LOG_LEVELS);

class Logger {
  constructor(options = {}) {
    this.level = options.level || LOG_LEVELS.INFO;
    this.logDir = options.logDir || path.join(__dirname, 'logs');
    this.consoleOutput = options.consoleOutput !== false; // Default true
    this.fileOutput = options.fileOutput !== false; // Default true
    this.context = options.context || {};

    // Ensure log directory exists
    if (this.fileOutput && !fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }

    // Current log file path
    this.logFile = path.join(this.logDir, `app-${this._getDateString()}.log`);
  }

  /**
   * Get formatted date string for log file names
   */
  _getDateString() {
    const now = new Date();
    return now.toISOString().split('T')[0]; // YYYY-MM-DD
  }

  /**
   * Format log entry as JSON
   */
  _formatEntry(level, message, data = {}) {
    return {
      timestamp: new Date().toISOString(),
      level: LEVEL_NAMES[level],
      message,
      ...this.context,
      ...data
    };
  }

  /**
   * Format for console output with colors
   */
  _formatConsole(entry) {
    const colors = {
      DEBUG: '\x1b[36m', // Cyan
      INFO: '\x1b[32m',  // Green
      WARN: '\x1b[33m',  // Yellow
      ERROR: '\x1b[31m', // Red
      FATAL: '\x1b[35m'  // Magenta
    };
    const reset = '\x1b[0m';
    const color = colors[entry.level] || reset;

    const timestamp = entry.timestamp.split('T')[1].split('.')[0]; // HH:MM:SS
    let line = `${color}[${entry.level}]${reset} ${timestamp} - ${entry.message}`;

    // Add additional data if present
    const extraData = { ...entry };
    delete extraData.timestamp;
    delete extraData.level;
    delete extraData.message;

    if (Object.keys(extraData).length > 0) {
      line += ` ${JSON.stringify(extraData)}`;
    }

    return line;
  }

  /**
   * Write log entry
   */
  _write(level, message, data = {}) {
    if (level < this.level) return; // Skip if below log level

    const entry = this._formatEntry(level, message, data);

    // Console output
    if (this.consoleOutput) {
      console.log(this._formatConsole(entry));
    }

    // File output
    if (this.fileOutput) {
      try {
        // Check if date rolled over
        const currentFile = path.join(this.logDir, `app-${this._getDateString()}.log`);
        if (currentFile !== this.logFile) {
          this.logFile = currentFile;
        }

        fs.appendFileSync(this.logFile, JSON.stringify(entry) + '\n', 'utf8');
      } catch (err) {
        console.error('Failed to write to log file:', err.message);
      }
    }
  }

  /**
   * Create child logger with additional context
   */
  child(context = {}) {
    return new Logger({
      level: this.level,
      logDir: this.logDir,
      consoleOutput: this.consoleOutput,
      fileOutput: this.fileOutput,
      context: { ...this.context, ...context }
    });
  }

  /**
   * Log methods
   */
  debug(message, data = {}) {
    this._write(LOG_LEVELS.DEBUG, message, data);
  }

  info(message, data = {}) {
    this._write(LOG_LEVELS.INFO, message, data);
  }

  warn(message, data = {}) {
    this._write(LOG_LEVELS.WARN, message, data);
  }

  error(message, data = {}) {
    this._write(LOG_LEVELS.ERROR, message, data);
  }

  fatal(message, data = {}) {
    this._write(LOG_LEVELS.FATAL, message, data);
  }

  /**
   * Convenience method for logging errors with stack traces
   */
  logError(error, message = 'Error occurred', additionalData = {}) {
    this.error(message, {
      error: error.message,
      stack: error.stack,
      ...additionalData
    });
  }
}

// Default logger instance
const defaultLogger = new Logger({
  level: process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL.toUpperCase()] : LOG_LEVELS.INFO
});

export { Logger, LOG_LEVELS };
export const logger = defaultLogger;
