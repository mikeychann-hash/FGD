// ai/interpreter.js
// Converts text or chat commands into structured tasks

import { queryLLM } from "./llm_bridge.js";
import { NPC_TASK_RESPONSE_FORMAT, VALID_ACTIONS, actionsRequiringTarget, validateTask } from "./task_schema.js";

const DEFAULT_TARGET = { x: 0, y: 64, z: 0 };

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

  if (/(craft|forge|make)/.test(normalized)) {
    const itemMatch = normalized.match(/craft(?:\s+an?|\s+the)?\s+([^,]+?)(?:\s+(?:at|in|for)\b|$)/);
    if (itemMatch) {
      metadata.item = normalizeWhitespace(itemMatch[1]);
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

  if (/(fight|attack|defend|kill|combat)/.test(normalized)) {
    const enemyMatch = normalized.match(/(?:fight|attack|kill|defend)(?:\s+the)?\s+([^,]+?)(?:\s+(?:at|near|in)\b|$)/);
    if (enemyMatch) {
      metadata.targetEntity = normalizeWhitespace(enemyMatch[1]);
    }
    if (!metadata.targetEntity) {
      metadata.targetEntity = "unspecified target";
    }
    return { action: "combat", metadata };
  }

  if (/guard|protect/.test(normalized)) {
    return { action: "guard", metadata };
  }

  if (/mine|dig|quarry/.test(normalized)) {
    return { action: "mine", metadata };
  }

  if (/gather|collect|harvest/.test(normalized)) {
    return { action: "gather", metadata };
  }

  if (/explore|scout|search/.test(normalized)) {
    return { action: "explore", metadata };
  }

  if (/build|construct|place/.test(normalized)) {
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

function fallbackInterpretation(inputText) {
  const coordinateTarget = extractFirstCoordinateTriplet(inputText);
  const { action, metadata } = deriveActionAndMetadata(inputText);
  const priority = derivePriority(inputText);

  const needsTarget = actionsRequiringTarget.has(action);
  const target = needsTarget
    ? coordinateTarget || DEFAULT_TARGET
    : coordinateTarget || null;

  return {
    action,
    details: inputText.trim(),
    target,
    metadata,
    priority
  };
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
        "Avoid explanations, extra keys, or commentary.",
        "NPCs cannot reason about elevation, liquids, or other environmental hazards; never assume they can jump, swim, or pathfind around them.",
        "Any behaviors like jumping, swimming, or hazard avoidance must be performed by the downstream Minecraft automation that receives the task payloads."
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
