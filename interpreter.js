// ai/interpreter.js
// Converts text or chat commands into structured tasks

import { queryLLM } from "./llm_bridge.js";
import { NPC_TASK_RESPONSE_FORMAT, VALID_ACTIONS, actionsRequiringTarget, validateTask } from "./task_schema.js";

// Constants
const CONSTANTS = {
  DEFAULT_TARGET: { x: 0, y: 64, z: 0 },
  DEFAULT_LLM_TEMPERATURE: 0.2,
  DEFAULT_MAX_TOKENS: 350,
  DEFAULT_CONTROL_RATIO: 1,
  MAX_MINECRAFT_COORDINATE: 30000000,
  SYSTEM_PROMPT: "You translate player intentions into strict JSON tasks for Minecraft NPCs. Always return JSON that matches the provided schema. Avoid explanations, extra keys, or commentary."
};

function clampRatio(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.min(1, Math.max(0, value));
  }
  const parsed = Number(value);
  if (Number.isFinite(parsed)) {
    return Math.min(1, Math.max(0, parsed));
  }
  return null;
}

const ENV_CONTROL_RATIO = clampRatio(
  process.env.LLM_CONTROL_RATIO ?? process.env.MODEL_CONTROL_RATIO
);
const DEFAULT_MODEL_CONTROL_RATIO =
  ENV_CONTROL_RATIO ?? CONSTANTS.DEFAULT_CONTROL_RATIO;

/**
 * Extracts the first coordinate triplet from text
 * Supports formats: "x y z", "x, y, z", or "(x, y, z)"
 * @param {string} text - Input text to parse
 * @returns {Object|null} Coordinate object {x, y, z} or null if not found
 */
function extractFirstCoordinateTriplet(text) {
  // Match patterns like "x y z", "x, y, z", or "(x, y, z)"
  const patterns = [
    /\(?(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)[,\s]+(-?\d+(?:\.\d+)?)\)?/,
    /(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const [_, x, y, z] = match;
      const coords = {
        x: Number(x),
        y: Number(y),
        z: Number(z)
      };

      // Validate reasonable Minecraft coordinates
      if (Math.abs(coords.x) > CONSTANTS.MAX_MINECRAFT_COORDINATE ||
          Math.abs(coords.z) > CONSTANTS.MAX_MINECRAFT_COORDINATE) {
        continue; // Try next pattern or return null
      }

      return coords;
    }
  }

  return null;
}

/**
 * Normalizes whitespace in a string (collapses multiple spaces to one)
 * @param {string} value - Input string
 * @returns {string} Normalized string
 */
function normalizeWhitespace(value) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

// Action pattern definitions for rule-based parsing
const ACTION_PATTERNS = [
  {
    pattern: /(craft|forge|make)/,
    action: 'craft',
    extractor: (normalized) => {
      const itemMatch = normalized.match(/(?:craft|forge|make)(?:\s+an?|\s+the)?\s+([^,]+?)(?:\s+(?:at|in|for)\b|$)/);
      return itemMatch
        ? { item: normalizeWhitespace(itemMatch[1]) }
        : { item: "unspecified item" };
    }
  },
  {
    pattern: /(open|unlock).*chest|chest/,
    action: 'interact',
    extractor: (normalized) => {
      const containerMatch = normalized.match(/(ender\s+chest|trapped\s+chest|chest|barrel|shulker\s+box|crate|furnace|anvil|crafting\s+table)/);
      const metadata = { interaction: "open_container" };
      if (containerMatch) {
        metadata.container = normalizeWhitespace(containerMatch[1]);
      }
      return metadata;
    }
  },
  {
    pattern: /(fight|attack|defend|kill|combat)/,
    action: 'combat',
    extractor: (normalized) => {
      const enemyMatch = normalized.match(/(?:fight|attack|kill|defend|combat)(?:\s+the)?\s+([^,]+?)(?:\s+(?:at|near|in)\b|$)/);
      return enemyMatch
        ? { targetEntity: normalizeWhitespace(enemyMatch[1]) }
        : { targetEntity: "unspecified target" };
    }
  },
  {
    pattern: /guard|protect/,
    action: 'guard',
    extractor: () => ({})
  },
  {
    pattern: /mine|dig|quarry/,
    action: 'mine',
    extractor: () => ({})
  },
  {
    pattern: /gather|collect|harvest/,
    action: 'gather',
    extractor: () => ({})
  },
  {
    pattern: /explore|scout|search/,
    action: 'explore',
    extractor: () => ({})
  },
  {
    pattern: /build|construct|place/,
    action: 'build',
    extractor: () => ({})
  }
];

/**
 * Derives action and metadata from input text using pattern matching
 * @param {string} text - Input command text
 * @returns {Object} Object with action and metadata properties
 */
function deriveActionAndMetadata(text) {
  const normalized = text.toLowerCase();

  for (const { pattern, action, extractor } of ACTION_PATTERNS) {
    if (pattern.test(normalized)) {
      const metadata = extractor ? extractor(normalized) : {};
      return { action, metadata };
    }
  }

  // Default to "guard" for unrecognized commands (valid action that's safe)
  // Note: User will still see the note in metadata indicating command wasn't recognized
  return {
    action: "guard",
    metadata: {
      note: "Command not recognized - defaulted to guard",
      originalInput: text.substring(0, 100) // Limit length for safety
    }
  };
}

/**
 * Derives task priority from input text based on urgency keywords
 * @param {string} text - Input command text
 * @returns {string} Priority level: "high", "normal", or "low"
 */
function derivePriority(text) {
  const normalized = text.toLowerCase();
  if (/urgent|immediately|asap|danger/.test(normalized)) {
    return "high";
  }
  if (/when you can|eventually|no rush/.test(normalized)) {
    return "low";
  }
  return "normal";
}

/**
 * Rule-based interpretation fallback when LLM is unavailable or fails
 * @param {string} inputText - User command text
 * @returns {Object} Structured task object
 */
function fallbackInterpretation(inputText) {
  const coordinateTarget = extractFirstCoordinateTriplet(inputText);
  const { action, metadata } = deriveActionAndMetadata(inputText);
  const priority = derivePriority(inputText);

  const needsTarget = actionsRequiringTarget.has(action);
  const target = needsTarget
    ? coordinateTarget || CONSTANTS.DEFAULT_TARGET
    : coordinateTarget || null;

  return {
    action,
    details: inputText.trim(),
    target,
    metadata,
    priority
  };
}

/**
 * Creates a standardized error response object
 * @param {string} errorMessage - The error message to include
 * @param {Array} validActions - List of valid actions (defaults to VALID_ACTIONS)
 * @returns {Object} Error response object
 */
function createErrorResponse(errorMessage, validActions = VALID_ACTIONS) {
  return {
    action: "none",
    details: "Failed to parse command",
    target: null,
    error: errorMessage,
    validActions
  };
}

/**
 * Determines whether to use LLM response based on control ratio
 * @param {number} effectiveRatio - The control ratio (0-1)
 * @param {Object} fallbackValidation - Validation result of fallback interpretation
 * @returns {boolean} True if should use LLM response
 */
function shouldUseLLMResponse(effectiveRatio, fallbackValidation) {
  if (!fallbackValidation.valid) {
    return true; // Must use LLM if fallback is invalid
  }

  if (effectiveRatio <= 0) {
    console.info(
      `ℹ️  Using rule-based interpreter due to control ratio ${effectiveRatio}`
    );
    return false;
  }

  if (effectiveRatio >= 1) {
    return true;
  }

  const roll = Math.random();
  if (roll > effectiveRatio) {
    console.info(
      `ℹ️  Falling back to rule-based interpreter (roll ${roll.toFixed(3)} > ratio ${effectiveRatio}).`
    );
    return false;
  }

  return true;
}

/**
 * Interprets natural language commands into structured tasks
 * @param {string} inputText - The user's command text
 * @param {Object} options - Configuration options
 * @param {number} [options.controlRatio] - LLM vs fallback ratio (0-1)
 * @param {string|Object} [options.mockLLMResponse] - Mock response for testing
 * @returns {Promise<Object>} Structured task object
 */
export async function interpretCommand(inputText, options = {}) {
  // Input validation
  if (!inputText || typeof inputText !== 'string' || !inputText.trim()) {
    return createErrorResponse("Input text is required and must be a non-empty string");
  }

  const {
    controlRatio,
    mockLLMResponse
  } = options || {};

  const ratio = clampRatio(controlRatio);
  const effectiveRatio = typeof ratio === "number" ? ratio : DEFAULT_MODEL_CONTROL_RATIO;
  const hasMockLLM = mockLLMResponse != null;
  const useLLM = hasMockLLM || Boolean(process.env.OPENAI_API_KEY);
  const messages = [
    {
      role: "system",
      content: CONSTANTS.SYSTEM_PROMPT
    },
    {
      role: "user",
      content: `Input: "${inputText}"`
    }
  ];

  if (!useLLM) {
    const fallback = fallbackInterpretation(inputText);
    const validation = validateTask(fallback);
    if (!validation.valid) {
      console.error("❌ Interpreter fallback produced invalid task:", validation.errors.join("; "));
      return createErrorResponse(validation.errors.join("; "));
    }
    return fallback;
  }

  try {
    let raw;
    if (hasMockLLM) {
      raw = typeof mockLLMResponse === "string"
        ? mockLLMResponse
        : JSON.stringify(mockLLMResponse);
    } else {
      raw = await queryLLM({
        messages,
        response_format: NPC_TASK_RESPONSE_FORMAT,
        temperature: CONSTANTS.DEFAULT_LLM_TEMPERATURE,
        max_tokens: CONSTANTS.DEFAULT_MAX_TOKENS
      });
    }

    if (!raw) {
      throw new Error("LLM returned null response");
    }

    // Improved JSON parsing with better error messages
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (parseErr) {
      throw new Error(`Invalid JSON from LLM: ${parseErr.message}`);
    }

    const validation = validateTask(parsed);

    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    // Use the extracted control ratio logic
    if (effectiveRatio < 1) {
      const fallback = fallbackInterpretation(inputText);
      const fallbackValidation = validateTask(fallback);

      if (!shouldUseLLMResponse(effectiveRatio, fallbackValidation)) {
        return fallback;
      }
    }

    return parsed;
  } catch (err) {
    console.error("❌ Interpreter error:", err.message);
    const fallback = fallbackInterpretation(inputText);
    const validation = validateTask(fallback);
    if (validation.valid) {
      console.warn("⚠️  Falling back to rule-based interpreter due to LLM error.");
      return fallback;
    }
    return createErrorResponse(err.message);
  }
}
