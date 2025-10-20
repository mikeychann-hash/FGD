// ai/model_director.js
// Utilities that let the LLM propose concrete tasks for the NPC engine

import { queryLLM } from "./llm_bridge.js";
import { NPC_TASK_SCHEMA, validateTask } from "./task_schema.js";

const DEFAULT_AUTONOMY_PROMPT = [
  "You are the coordinator for a small Minecraft base.",
  "You receive snapshots of the NPC roster, their tasks, and the current queue.",
  "Reply ONLY with JSON following the provided schema so the engine can act on your instructions.",
  "Do not include explanations or markdown.",
  "NPCs cannot reason about elevation, liquids, or hazardous blocks; avoid proposing tasks that rely on them understanding those factors.",
  "Behaviors such as jumping, swimming, or hazard avoidance must be carried out by the Minecraft automation system that executes the task payloads."
].join(" ");

const AUTONOMY_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "npc_autonomy_batch",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["tasks"],
      properties: {
        rationale: {
          type: "string",
          description: "Short summary of why these tasks were chosen."
        },
        tasks: {
          type: "array",
          minItems: 1,
          maxItems: 10,
          items: NPC_TASK_SCHEMA
        }
      }
    }
  }
};

function hasApiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function normalizeMockResponse(mock) {
  if (!mock) return null;
  if (typeof mock === "string") {
    try {
      return JSON.parse(mock);
    } catch (err) {
      console.error("❌ Invalid JSON string provided to mock autonomy response:", err.message);
      return null;
    }
  }
  if (typeof mock === "object") {
    return mock;
  }
  return null;
}

export async function generateModelTasks({
  statusSnapshot,
  instructions = DEFAULT_AUTONOMY_PROMPT,
  maxTasks = 5,
  mockResponse = null,
  temperature = 0.3
} = {}) {
  const normalizedMax = Math.min(Math.max(1, Math.trunc(maxTasks) || 1), 10);
  const useMock = mockResponse != null;

  if (!useMock && !hasApiKey()) {
    console.warn("⚠️  No API key available; autonomy generator returning no tasks.");
    return { tasks: [], rationale: "Missing API key" };
  }

  const autonomyMessages = [
    { role: "system", content: instructions },
    {
      role: "user",
      content: [
        "Here is the current status snapshot in JSON.",
        "Propose up to",
        String(normalizedMax),
        "high-value tasks that help the base right now.",
        "If nothing needs to be done, respond with an empty tasks array."
      ].join(" ")
    },
    {
      role: "user",
      content: JSON.stringify(statusSnapshot ?? {})
    }
  ];

  let raw;
  if (useMock) {
    const normalizedMock = normalizeMockResponse(mockResponse);
    raw = normalizedMock ?? { tasks: [] };
  } else {
    raw = await queryLLM({
      messages: autonomyMessages,
      response_format: AUTONOMY_RESPONSE_FORMAT,
      temperature,
      max_tokens: 700
    });
    if (!raw) {
      console.warn("⚠️  LLM returned no autonomy payload; skipping cycle.");
      return { tasks: [], rationale: "No response" };
    }
    try {
      raw = JSON.parse(raw);
    } catch (err) {
      console.error("❌ Failed to parse autonomy response:", err.message);
      return { tasks: [], rationale: "Malformed LLM response" };
    }
  }

  const tasks = Array.isArray(raw?.tasks) ? raw.tasks.slice(0, normalizedMax) : [];
  const validTasks = [];

  for (const task of tasks) {
    const validation = validateTask(task);
    if (validation.valid) {
      validTasks.push(task);
    } else {
      console.warn("⚠️  Dropping invalid autonomy task:", validation.errors.join("; "));
    }
  }

  const rationale = typeof raw?.rationale === "string" ? raw.rationale : undefined;
  return { tasks: validTasks, rationale };
}

export const DEFAULT_AUTONOMY_PROMPT_TEXT = DEFAULT_AUTONOMY_PROMPT;
