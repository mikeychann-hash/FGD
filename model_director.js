// ai/model_director.js
// Utilities that let the LLM propose concrete tasks for the NPC engine

import { queryLLM } from "./llm_bridge.js";
import { NPC_TASK_SCHEMA, validateTask } from "./task_schema.js";

// Configuration constants
const MIN_TASKS = 1;
const MAX_TASKS = 10;
const DEFAULT_MAX_TASKS = 5;
const DEFAULT_TEMPERATURE = 0.3;
const MIN_TEMPERATURE = 0;
const MAX_TEMPERATURE = 2;
const DEFAULT_MAX_TOKENS = 700; // Approximately supports 10 tasks with rationale

const DEFAULT_AUTONOMY_PROMPT = [
  "You are the coordinator for a small Minecraft base.",
  "You receive snapshots of the NPC roster, their tasks, and the current queue.",
  "Reply ONLY with JSON following the provided schema so the engine can act on your instructions.",
  "Do not include explanations or markdown."
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

/**
 * Checks if OpenAI API key is available in environment
 * @returns {boolean} True if API key is configured
 */
function hasOpenAIApiKey() {
  return Boolean(process.env.OPENAI_API_KEY);
}

/**
 * Normalizes mock response to object format
 * @param {string|Object|null} mock - Mock response data
 * @returns {Object|null} Normalized mock object or null if invalid
 */
function normalizeMockResponse(mock) {
  if (!mock) return null;

  if (typeof mock === "string") {
    try {
      return JSON.parse(mock);
    } catch (err) {
      console.error("❌ Invalid JSON string provided to mock autonomy response:", err.message);
      // Return null to indicate parse error, distinguishing from null input
      return null;
    }
  }

  if (typeof mock === "object") {
    return mock;
  }

  console.warn("⚠️  Mock response must be string or object, received:", typeof mock);
  return null;
}

/**
 * Generates NPC tasks using an LLM based on current game state
 *
 * This function queries an LLM to generate high-value tasks for NPCs in a Minecraft
 * base. It validates all inputs, handles errors gracefully, and ensures all generated
 * tasks conform to the NPC_TASK_SCHEMA.
 *
 * @param {Object} options - Configuration options
 * @param {Object} options.statusSnapshot - Current game state including NPC roster,
 *                                          active tasks, inventory, and task queue.
 *                                          Should be a structured object with relevant
 *                                          game state information.
 * @param {string} [options.instructions=DEFAULT_AUTONOMY_PROMPT] - Custom system prompt
 *                                                                   to guide LLM behavior
 * @param {number} [options.maxTasks=5] - Maximum number of tasks to generate (clamped to 1-10)
 * @param {Object|string|null} [options.mockResponse=null] - Mock response for testing.
 *                                                           Can be JSON string or object.
 *                                                           When provided, skips LLM call.
 * @param {number} [options.temperature=0.3] - LLM temperature for response variability (0-2).
 *                                             Lower = more deterministic, Higher = more creative.
 *
 * @returns {Promise<{tasks: Array<Object>, rationale?: string}>} Object containing:
 *   - tasks: Array of validated task objects conforming to NPC_TASK_SCHEMA
 *   - rationale: Optional string explaining why these tasks were chosen
 *
 * @throws {Error} May throw if LLM call fails and error cannot be handled gracefully
 *
 * @example
 * const result = await generateModelTasks({
 *   statusSnapshot: { npcs: [...], inventory: {...}, queue: [...] },
 *   maxTasks: 3,
 *   temperature: 0.5
 * });
 * console.log(`Generated ${result.tasks.length} tasks: ${result.rationale}`);
 */
export async function generateModelTasks({
  statusSnapshot,
  instructions = DEFAULT_AUTONOMY_PROMPT,
  maxTasks = DEFAULT_MAX_TASKS,
  mockResponse = null,
  temperature = DEFAULT_TEMPERATURE
} = {}) {
  // Validate and normalize maxTasks parameter
  const normalizedMax = Math.min(
    Math.max(MIN_TASKS, Number.isFinite(maxTasks) ? Math.trunc(maxTasks) : DEFAULT_MAX_TASKS),
    MAX_TASKS
  );

  // Validate and normalize temperature parameter
  const normalizedTemp = Math.min(
    Math.max(MIN_TEMPERATURE, Number.isFinite(temperature) ? temperature : DEFAULT_TEMPERATURE),
    MAX_TEMPERATURE
  );

  // Validate statusSnapshot
  if (statusSnapshot !== null && typeof statusSnapshot !== "object") {
    console.warn("⚠️  statusSnapshot must be an object, received:", typeof statusSnapshot);
    return { tasks: [], rationale: "Invalid statusSnapshot type" };
  }

  const useMock = mockResponse != null;

  if (!useMock && !hasOpenAIApiKey()) {
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
    try {
      raw = await queryLLM({
        messages: autonomyMessages,
        response_format: AUTONOMY_RESPONSE_FORMAT,
        temperature: normalizedTemp,
        max_tokens: DEFAULT_MAX_TOKENS
      });

      if (!raw) {
        console.warn("⚠️  LLM returned no autonomy payload; skipping cycle.");
        return { tasks: [], rationale: "No response" };
      }

      // Handle both string and object responses
      if (typeof raw === "string") {
        try {
          raw = JSON.parse(raw);
        } catch (err) {
          console.error("❌ Failed to parse autonomy response:", err.message);
          return { tasks: [], rationale: "Malformed LLM response" };
        }
      } else if (typeof raw !== "object" || raw === null) {
        console.error("❌ LLM returned unexpected response type:", typeof raw);
        return { tasks: [], rationale: "Invalid response type" };
      }
    } catch (err) {
      console.error("❌ LLM query failed:", err.message);
      return { tasks: [], rationale: `LLM error: ${err.message}` };
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

// Export the default prompt for external use
export { DEFAULT_AUTONOMY_PROMPT };
