import { queryLLM } from "../../llm_bridge.js";
import { logger } from "../../logger.js";

const MINEFLAYER_TASK_SCHEMA = {
  type: "object",
  properties: {
    type: {
      type: "string",
      enum: [
        "move_to",
        "navigate",
        "mine_block",
        "place_block",
        "interact",
        "use_item",
        "eat",
        "look_at",
        "chat",
        "get_inventory",
        "equip_item",
        "drop_item"
      ]
    },
    target: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        z: { type: "number" }
      },
      // target is not required for all, but if present must have x,y,z
    },
    itemName: { type: "string" },
    blockType: { type: "string" },
    count: { type: "number" },
    slot: { type: "number" },
    message: { type: "string" },
    face: { type: "string", enum: ["top", "bottom", "north", "south", "east", "west"] }
  },
  required: ["type"]
};

const PLAN_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "mineflayer_plan",
    schema: {
      type: "object",
      properties: {
        rationale: { type: "string" },
        plan: {
          type: "array",
          items: MINEFLAYER_TASK_SCHEMA
        }
      },
      required: ["plan"]
    }
  }
};

const PLANNER_SYSTEM_PROMPT = `
You are an expert Mineflayer bot planner.
Convert high-level goals into a sequence of low-level atomic actions.
Available actions:
- move_to: { target: {x,y,z} } - Walk to coordinate
- mine_block: { target: {x,y,z} } - Break block at coordinate
- place_block: { target: {x,y,z}, blockType: "name", face: "top" } - Place block
- interact: { target: {x,y,z} } - Right click block/entity
- eat: { itemName: "name" } - Eat food (optional name, defaults to best food)
- chat: { message: "string" } - Send chat message
- equip_item: { itemName: "name" } - Hold item in hand
- drop_item: { slot: number, count: number } - Drop item from slot

Rules:
1. Be precise with coordinates.
2. Keep plans short (max 10 steps).
3. Ensure safety (don't dig straight down, don't walk into lava).
4. If the goal is impossible, return an empty plan with a rationale explaining why.
`;

export async function generateLLMPlan(botId, goal, worldState, context = {}) {
  try {
    const messages = [
      { role: "system", content: PLANNER_SYSTEM_PROMPT },
      {
        role: "user",
        content: JSON.stringify({
          goal,
          context,
          botState: {
            position: worldState.botState.position,
            inventory: worldState.botState.inventory,
            health: worldState.botState.health,
            equipment: worldState.botState.equipment,
            food: worldState.botState.food
          },
          nearbyBlocks: worldState.blocks.slice(0, 50), // Limit context
          nearbyEntities: worldState.entities.slice(0, 20)
        })
      }
    ];

    const response = await queryLLM({
      messages,
      response_format: PLAN_RESPONSE_FORMAT,
      temperature: 0.2
    });

    if (!response) {
      return { success: false, error: "No response from LLM" };
    }

    let parsed = response;
    if (typeof response === "string") {
      parsed = JSON.parse(response);
    }
    
    // Transform flat properties to 'parameters' object if needed by Adapter
    // The Adapter expects { type: "...", parameters: { ... } }
    // But the LLM output is flat { type: "...", target: ..., itemName: ... }
    // We should normalize this.
    
    const plan = (parsed.plan || []).map(task => {
        const { type, ...params } = task;
        return {
            type,
            parameters: params
        };
    });

    return {
      success: true,
      plan,
      rationale: parsed.rationale
    };
  } catch (error) {
    logger.error("LLM Plan generation failed", { botId, error: error.message });
    return { success: false, error: error.message };
  }
}
