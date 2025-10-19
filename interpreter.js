// ai/interpreter.js
// Converts text or chat commands into structured tasks

import { queryLLM } from "./llm_bridge.js";
import { NPC_TASK_RESPONSE_FORMAT, VALID_ACTIONS, validateTask } from "./task_schema.js";

export async function interpretCommand(inputText) {
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
    return {
      action: "none",
      details: "Failed to parse command",
      target: null,
      error: err.message,
      validActions: VALID_ACTIONS
    };
  }
}
