// ai/interpreter.js
// Converts text or chat commands into structured tasks

import { queryLLM } from "./llm_bridge.js";

const VALID_ACTIONS = ["build", "mine", "explore", "gather", "guard"];

export async function interpretCommand(inputText) {
  const prompt = `
You are the command interpreter for AICraft NPCs.
Convert this instruction into a JSON object describing an actionable task.

Input: "${inputText}"
Respond ONLY in valid JSON:
{
  "action": "<one of: build, mine, explore, gather, guard>",
  "details": "<short description>",
  "target": { "x": 0, "y": 0, "z": 0 }
}
  `;

  try {
    const raw = await queryLLM(prompt);
    if (!raw) {
      throw new Error("LLM returned null response");
    }

    // Better JSON extraction using regex
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in LLM output");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate the structure
    if (!parsed.action || !VALID_ACTIONS.includes(parsed.action)) {
      throw new Error(`Invalid action: ${parsed.action}`);
    }

    if (!parsed.target || typeof parsed.target.x !== "number") {
      throw new Error("Invalid target coordinates");
    }

    return parsed;
  } catch (err) {
    console.error("❌ Interpreter error:", err.message);
    return {
      action: "none",
      details: "Failed to parse command",
      target: null,
      error: err.message
    };
  }
}