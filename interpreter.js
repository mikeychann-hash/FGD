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
        "Avoid explanations, extra keys, or commentary.",
        `Supported actions: ${VALID_ACTIONS.join(", ")}.`,
        "For mine tasks, specify what resource or block is being extracted in metadata.resource, outline any prioritized targets in metadata.targets with priority labels (primary/secondary/tertiary/optional), and list hazards (lava, water, enemies, etc.) in metadata.hazards along with mitigation steps when known. Include metadata.statusDirectives.hazards entries that describe how the miner should react (pause, reroute, request_support, request_tools) when those hazards are encountered.",
        "For open_chest tasks, describe the chest interaction in details, provide chest coordinates in target, and populate metadata.mode (inspect/deposit/withdraw).",
        "When depositing or withdrawing, include metadata.items as an array of { item, count } objects.",
        "For open_inventory tasks, specify metadata.scope (self/npc/chest/storage/area), optional metadata.view (overview/hotbar/equipment/crafting/materials), and include metadata.focus or metadata.priorities when highlighting items to check first.",
        "For craft tasks, describe the recipe or desired output in details, set target to the relevant workstation, and include metadata.output, metadata.quantity, metadata.recipe (array of { item, count }), plus metadata.tools when special stations or tools are needed.",
        "For fight tasks, specify the enemy or objective in details, keep target coordinates to the engagement point, and include metadata.target, metadata.style (melee/ranged/defensive/support/balanced), metadata.weapons (array of items) or metadata.preferredWeapons, and metadata.healingItems for sustain.",
        "For check_inventory tasks, keep details concise, set target to the inventory location, and use metadata.mode (summary/locate/count/missing), metadata.scope (self/npc/chest/storage/area), metadata.view when a specific panel is needed, plus metadata.filters (items or tags).",
        "For manage_inventory tasks, include metadata.priorities (array of { item or tag, priority level }), and use metadata.restock, metadata.discard, or metadata.actions to direct sorting, restocking, or purging.",
        "For use_item tasks, include metadata.item, metadata.usage (heal/buff/attack/utility/tool/place/consume/equip/interact), optional metadata.target, and metadata.fallbacks for backup consumables.",
        "For equip_item tasks, provide metadata.item or metadata.candidates, metadata.slot (main_hand/off_hand/head/chest/legs/feet/hotbar/accessory), and metadata.priority or metadata.preferred lists when deciding optimal gear.",
        "For dig tasks, describe the excavation area in metadata.area (shape + dimensions), include metadata.tools, metadata.hazards (lava, water, enemies, etc.), and metadata.mitigations or metadata.statusDirectives for safety just like mining.",
        "For assess_equipment tasks, describe the decision goal in details, point target toward the storage or NPC being evaluated, and include metadata.goal (best_defense/best_attack/balanced/specialized), metadata.criteria (array of strings), and metadata.candidates (items under consideration).",
        "For support tasks, name the NPC needing help in metadata.targetNpc, describe the hazard or reason, list metadata.assistance/actions/objectives, include metadata.requests.items if supplies are needed, and set metadata.level (emergency/high/normal/low) plus metadata.priority when triaging.",
        "For deliver_items tasks, include metadata.items (array of { item, count }), metadata.actions (deliver/restock/swap/repair), metadata.targetNpc, metadata.priority (critical/high/normal/low), and set the task target to the drop-off point."
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
