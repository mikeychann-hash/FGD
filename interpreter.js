// ai/interpreter.js
// Converts text or chat commands into structured tasks

import { queryLLM } from "./llm_bridge.js";
import { NPC_TASK_RESPONSE_FORMAT, VALID_ACTIONS, actionsRequiringTarget, validateTask } from "./task_schema.js";

const DEFAULT_TARGET = { x: 0, y: 64, z: 0 };

// LRU Cache for parsed commands
class LRUCache {
  constructor(maxSize = 100) {
    this.maxSize = maxSize;
    this.cache = new Map();
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0
    };
  }

  get(key) {
    if (this.cache.has(key)) {
      const value = this.cache.get(key);
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
      this.stats.hits++;
      return value;
    }
    this.stats.misses++;
    return null;
  }

  set(key, value) {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxSize) {
      // Remove least recently used (first item)
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
      this.stats.evictions++;
    }
    this.cache.set(key, value);
  }

  clear() {
    this.cache.clear();
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total * 100).toFixed(2) : 0;
    return {
      ...this.stats,
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: `${hitRate}%`
    };
  }
}

// Cache for fallback interpretations (rule-based parsing)
const fallbackCache = new LRUCache(
  parseInt(process.env.INTERPRETER_CACHE_SIZE) || 100
);

// Export for testing/monitoring
export function getCacheStats() {
  return fallbackCache.getStats();
}

export function clearCache() {
  fallbackCache.clear();
}

// Optional: Log cache stats periodically (disabled by default)
if (process.env.INTERPRETER_CACHE_STATS === 'true') {
  const statsInterval = parseInt(process.env.INTERPRETER_CACHE_STATS_INTERVAL) || 60000;
  setInterval(() => {
    const stats = getCacheStats();
    console.log(`📊 Interpreter Cache Stats: ${stats.hits} hits, ${stats.misses} misses, ${stats.hitRate} hit rate, ${stats.size}/${stats.maxSize} entries, ${stats.evictions} evictions`);
  }, statsInterval);
}

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
  ENV_CONTROL_RATIO ?? 1;

function extractFirstCoordinateTriplet(text) {
  const tripletMatch = text.match(/(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/);
  if (!tripletMatch) return null;

  const [_, x, y, z] = tripletMatch;
  return {
    x: Number(x),
    y: Number(y),
    z: Number(z)
  };
}

function normalizeWhitespace(value) {
  return value
    .replace(/\s+/g, " ")
    .trim();
}

function deriveActionAndMetadata(text) {
  const normalized = text.toLowerCase();
  const metadata = {};

  // Enhanced craft pattern - extract item and quantity
  if (/(craft|forge|make)/.test(normalized)) {
    const itemMatch = normalized.match(/(?:craft|forge|make)(?:\s+an?|\s+the|\s+(\d+))?\s+([^,]+?)(?:\s+(?:at|in|for|using|with)\b|$)/);
    if (itemMatch) {
      if (itemMatch[1]) metadata.quantity = parseInt(itemMatch[1]);
      metadata.item = normalizeWhitespace(itemMatch[2]);
    }
    // Extract tool/station if mentioned
    const toolMatch = normalized.match(/(?:using|with|at)(?:\s+an?|\s+the)?\s+(crafting\s+table|furnace|anvil|smithing\s+table|loom|stonecutter|[a-z\s]+)/);
    if (toolMatch) {
      metadata.tool = normalizeWhitespace(toolMatch[1]);
    }
    if (!metadata.item) {
      metadata.item = "unspecified item";
    }
    return { action: "craft", metadata };
  }

  if (/(open|unlock).*chest/.test(normalized) || /chest/.test(normalized)) {
    metadata.interaction = "open_container";
    const containerMatch = normalized.match(/(ender\s+chest|trapped\s+chest|chest|barrel|shulker\s+box|crate|furnace|anvil|crafting\s+table)/);
    if (containerMatch) {
      metadata.container = normalizeWhitespace(containerMatch[1]);
    }
    return { action: "interact", metadata };
  }

  // Enhanced combat pattern - extract entity type and location
  if (/(fight|attack|defend|kill|combat)/.test(normalized)) {
    const enemyMatch = normalized.match(/(?:fight|attack|kill|defend)(?:\s+the|\s+an?|\s+(\d+))?\s+([a-z\s]+?)(?:\s+(?:at|near|in)\b|$)/);
    if (enemyMatch) {
      if (enemyMatch[1]) metadata.count = parseInt(enemyMatch[1]);
      metadata.targetEntity = normalizeWhitespace(enemyMatch[2]);
    }
    // Extract location context
    const locationMatch = normalized.match(/(?:at|near|in|around)(?:\s+the)?\s+([a-z\s]+?)(?:\s|$)/);
    if (locationMatch) {
      metadata.location = normalizeWhitespace(locationMatch[1]);
    }
    if (!metadata.targetEntity) {
      metadata.targetEntity = "unspecified target";
    }
    return { action: "combat", metadata };
  }

  // Enhanced guard pattern - extract what/who to guard and location
  if (/guard|protect|defend/.test(normalized)) {
    const guardMatch = normalized.match(/(?:guard|protect|defend)(?:\s+the|\s+my)?\s+([a-z\s]+?)(?:\s+(?:at|from|against)\b|$)/);
    if (guardMatch) {
      metadata.target = normalizeWhitespace(guardMatch[1]);
    }
    const locationMatch = normalized.match(/(?:at|near)(?:\s+the)?\s+([a-z\s]+?)(?:\s|$)/);
    if (locationMatch) {
      metadata.location = normalizeWhitespace(locationMatch[1]);
    }
    return { action: "guard", metadata };
  }

  // Enhanced mine pattern - extract resource, quantity, and location
  if (/mine|dig|quarry/.test(normalized)) {
    const resourceMatch = normalized.match(/(?:mine|dig|quarry)(?:\s+(\d+))?\s+([a-z\s]+?)(?:\s+(?:at|near|in|from)\b|$)/);
    if (resourceMatch) {
      if (resourceMatch[1]) metadata.quantity = parseInt(resourceMatch[1]);
      metadata.resource = normalizeWhitespace(resourceMatch[2]);
    }
    // Extract location/biome context (e.g., "near spawn", "in the cave", "at coordinates")
    const locationMatch = normalized.match(/(?:at|near|in|from)(?:\s+the)?\s+([a-z\s]+?)(?:\s|,|$)/);
    if (locationMatch) {
      metadata.location = normalizeWhitespace(locationMatch[1]);
    }
    // Extract depth if mentioned
    const depthMatch = normalized.match(/(?:at|below)?\s*y[:\s=]?\s*(-?\d+)/);
    if (depthMatch) {
      metadata.depth = parseInt(depthMatch[1]);
    }
    return { action: "mine", metadata };
  }

  // Enhanced gather pattern - extract items and quantities
  if (/gather|collect|harvest/.test(normalized)) {
    const itemsMatch = normalized.match(/(?:gather|collect|harvest)(?:\s+(\d+))?\s+([a-z\s]+?)(?:\s+(?:and|,|at|near|in|from)\b|$)/);
    if (itemsMatch) {
      if (itemsMatch[1]) metadata.quantity = parseInt(itemsMatch[1]);
      metadata.resource = normalizeWhitespace(itemsMatch[2]);
    }
    // Extract multiple items if using "and"
    const multiMatch = normalized.match(/(?:gather|collect|harvest)\s+(.+?)(?:\s+(?:at|near|from)\b|$)/);
    if (multiMatch) {
      const parts = multiMatch[1].split(/\s+and\s+|,\s*/);
      if (parts.length > 1) {
        metadata.items = parts.map(p => normalizeWhitespace(p));
      }
    }
    const locationMatch = normalized.match(/(?:at|near|in|from)(?:\s+the)?\s+([a-z\s]+?)(?:\s|$)/);
    if (locationMatch) {
      metadata.location = normalizeWhitespace(locationMatch[1]);
    }
    return { action: "gather", metadata };
  }

  // Enhanced explore pattern - extract area/biome to explore
  if (/explore|scout|search/.test(normalized)) {
    const areaMatch = normalized.match(/(?:explore|scout|search)(?:\s+the|\s+for)?\s+([a-z\s]+?)(?:\s+(?:for|at|near)\b|$)/);
    if (areaMatch) {
      metadata.area = normalizeWhitespace(areaMatch[1]);
    }
    const targetMatch = normalized.match(/(?:for|looking\s+for)(?:\s+an?|\s+the)?\s+([a-z\s]+?)(?:\s|$)/);
    if (targetMatch) {
      metadata.searchTarget = normalizeWhitespace(targetMatch[1]);
    }
    return { action: "explore", metadata };
  }

  // Enhanced build pattern - extract structure type, materials, and location
  if (/build|construct|place/.test(normalized)) {
    const structureMatch = normalized.match(/(?:build|construct|place)(?:\s+an?|\s+the)?\s+([a-z\s]+?)(?:\s+(?:at|with|using|from|near)\b|$)/);
    if (structureMatch) {
      metadata.structure = normalizeWhitespace(structureMatch[1]);
    }
    const materialMatch = normalized.match(/(?:with|using|from)(?:\s+the)?\s+([a-z\s]+?)(?:\s+(?:at|near)\b|$)/);
    if (materialMatch) {
      metadata.material = normalizeWhitespace(materialMatch[1]);
    }
    const locationMatch = normalized.match(/(?:at|near)(?:\s+the)?\s+([a-z\s]+?)(?:\s|$)/);
    if (locationMatch) {
      metadata.location = normalizeWhitespace(locationMatch[1]);
    }
    return { action: "build", metadata };
  }

  return { action: "guard", metadata: { note: "Defaulted to guard due to ambiguous request" } };
}

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
 * Fallback interpretation using rule-based regex parsing with caching
 * @param {string} inputText - The command text to parse
 * @returns {object} Parsed task object
 */
function fallbackInterpretation(inputText) {
  const trimmedText = inputText.trim();

  // Check cache first
  const cached = fallbackCache.get(trimmedText);
  if (cached) {
    return { ...cached }; // Return a copy to prevent mutation
  }

  // Parse the command
  const coordinateTarget = extractFirstCoordinateTriplet(trimmedText);
  const { action, metadata } = deriveActionAndMetadata(trimmedText);
  const priority = derivePriority(trimmedText);

  const needsTarget = actionsRequiringTarget.has(action);
  const target = needsTarget
    ? coordinateTarget || DEFAULT_TARGET
    : coordinateTarget || null;

  const result = {
    action,
    details: trimmedText,
    target,
    metadata,
    priority
  };

  // Cache the result
  fallbackCache.set(trimmedText, result);

  return result;
}

export async function interpretCommand(inputText, options = {}) {
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
      content: [
        "You translate player intentions into strict JSON tasks for Minecraft NPCs.",
        "Always return JSON that matches the provided schema.",
        "Avoid explanations, extra keys, or commentary."
      ].join(" ")
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
      return {
        action: "none",
        details: "Failed to parse command",
        target: null,
        error: validation.errors.join("; "),
        validActions: VALID_ACTIONS
      };
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
        temperature: 0.2,
        max_tokens: 350
      });
    }

    if (!raw) {
      throw new Error("LLM returned null response");
    }

    const parsed = JSON.parse(raw);
    const validation = validateTask(parsed);

    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
    }

    if (effectiveRatio < 1) {
      const fallback = fallbackInterpretation(inputText);
      const fallbackValidation = validateTask(fallback);
      if (fallbackValidation.valid) {
        if (effectiveRatio <= 0) {
          console.info(
            `ℹ️  Using rule-based interpreter due to control ratio ${effectiveRatio}`
          );
          return fallback;
        }
        const roll = Math.random();
        if (roll > effectiveRatio) {
          console.info(
            `ℹ️  Falling back to rule-based interpreter (roll ${roll.toFixed(3)} > ratio ${effectiveRatio}).`
          );
          return fallback;
        }
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
    return {
      action: "none",
      details: "Failed to parse command",
      target: null,
      error: err.message,
      validActions: VALID_ACTIONS
    };
  }
}
