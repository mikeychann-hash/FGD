// ai/interpreter.js
// Converts text or chat commands into structured tasks

import { queryLLM } from "./llm_bridge.js";
import { NPC_TASK_RESPONSE_FORMAT, VALID_ACTIONS, validateTask } from "./task_schema.js";

const DEFAULT_TARGET = { x: 0, y: 64, z: 0 };

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

function deriveActionAndMetadata(text) {
  const normalized = text.toLowerCase();
  const metadata = {};

  if (/(craft|forge|make)/.test(normalized)) {
    const itemMatch = normalized.match(/craft(?:\s+an?|\s+the)?\s+([\w\s]+)/);
    if (itemMatch) {
      metadata.item = itemMatch[1].trim().replace(/\s+(?:at|in|to)\s+.*$/, "").trim();
    }
    return { action: "craft", metadata };
  }

  if (/(open|unlock).*chest/.test(normalized) || /chest/.test(normalized)) {
    metadata.interaction = "open_container";
    return { action: "interact", metadata };
  }

  if (/(fight|attack|defend|kill|combat)/.test(normalized)) {
    const enemyMatch = normalized.match(/(?:fight|attack|kill|defend)(?:\s+the)?\s+([\w\s]+)/);
    if (enemyMatch) {
      metadata.targetEntity = enemyMatch[1].trim();
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
  const coordinateTarget = extractFirstCoordinateTriplet(inputText) || DEFAULT_TARGET;
  const { action, metadata } = deriveActionAndMetadata(inputText);
  const priority = derivePriority(inputText);

  return {
    action,
    details: inputText.trim(),
    target: coordinateTarget,
    metadata,
    priority
  };
}

export async function interpretCommand(inputText) {
  const useLLM = Boolean(process.env.OPENAI_API_KEY);
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
    const raw = await queryLLM({
      messages,
      response_format: NPC_TASK_RESPONSE_FORMAT,
      temperature: 0.2,
      max_tokens: 350
    });

    if (!raw) {
      throw new Error("LLM returned null response");
    }

    const parsed = JSON.parse(raw);
    const validation = validateTask(parsed);

    if (!validation.valid) {
      throw new Error(validation.errors.join("; "));
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
