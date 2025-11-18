const PLACEHOLDER_VALUES = new Set([
  "admin123",
  "admin-key-change-me",
  "llm-key-change-me",
  "fgd_rcon_password_change_me",
  "folks123",  // Hardcoded admin API key
  "postgres"   // Hardcoded database password
]);

const recordedWarnings = new Set();

function normalize(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isPlaceholderValue(value, fallback) {
  const normalized = normalize(value);
  if (!normalized) {
    return false;
  }
  if (PLACEHOLDER_VALUES.has(normalized)) {
    return true;
  }
  const normalizedFallback = normalize(fallback);
  return normalizedFallback && normalized === normalizedFallback;
}

function recordWarning(message) {
  if (message && !recordedWarnings.has(message)) {
    recordedWarnings.add(message);
  }
}

export function resolveSecret(envVar, fallback, options = {}) {
  const label = options.label || envVar;
  const envValue = normalize(process.env[envVar]);
  const normalizedFallback = normalize(fallback);

  if (envValue && !isPlaceholderValue(envValue, normalizedFallback)) {
    return envValue;
  }

  if (envValue && isPlaceholderValue(envValue, normalizedFallback)) {
    recordWarning(`${label} is using a placeholder value from ${envVar}; set a secure value before production.`);
  } else {
    recordWarning(`${label} not set via ${envVar}; falling back to a development-only placeholder.`);
  }

  if (process.env.NODE_ENV === "production" && options.allowFallback !== true) {
    throw new Error(`${label} must be configured via ${envVar} with a non-default value in production environments.`);
  }

  return fallback;
}

export function ensureNonDefaultSecret({ label, value, fallback, envVar, allowEmpty = false }) {
  const normalized = normalize(value);
  const normalizedFallback = normalize(fallback);

  if (!normalized) {
    if (allowEmpty) {
      return "";
    }
    const message = `${label} is not configured${envVar ? ` via ${envVar}` : ""}.`;
    recordWarning(message);
    if (process.env.NODE_ENV === "production") {
      throw new Error(`${message} It must be provided before running in production.`);
    }
    return normalized;
  }

  if (isPlaceholderValue(normalized, normalizedFallback)) {
    const message = `${label} is using a placeholder value${envVar ? ` from ${envVar}` : ""}; replace it with a secure secret.`;
    recordWarning(message);
    if (process.env.NODE_ENV === "production") {
      throw new Error(message);
    }
  }

  return normalized;
}

export function getSecretWarnings() {
  return Array.from(recordedWarnings);
}

export function logSecretWarnings(logger = console) {
  getSecretWarnings().forEach(message => {
    if (logger?.warn) {
      logger.warn(message);
    } else {
      console.warn(message);
    }
  });
}

export default {
  resolveSecret,
  ensureNonDefaultSecret,
  getSecretWarnings,
  logSecretWarnings
};
