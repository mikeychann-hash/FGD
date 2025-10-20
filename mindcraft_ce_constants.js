// shared/mindcraft_ce_constants.js
// Centralized enumerations shared across schema and adapter logic

export const INVENTORY_VIEWS = ["overview", "hotbar", "equipment", "crafting", "materials"];
export const INVENTORY_PRIORITY_LEVELS = ["critical", "high", "medium", "low", "junk"];
export const INVENTORY_SCOPES = ["self", "npc", "chest", "storage", "area"];
export const INVENTORY_MODES = ["summary", "locate", "count", "missing"];
export const COMBAT_STYLES = ["melee", "ranged", "defensive", "support", "balanced"];
export const ITEM_USAGE_TYPES = [
  "heal",
  "buff",
  "attack",
  "utility",
  "tool",
  "place",
  "consume",
  "equip",
  "interact"
];
export const EQUIP_SLOTS = [
  "main_hand",
  "off_hand",
  "head",
  "chest",
  "legs",
  "feet",
  "hotbar",
  "accessory"
];
export const LOADOUT_PRIORITIES = ["primary", "secondary", "backup"];
export const DIG_STRATEGIES = ["clear", "tunnel", "staircase", "quarry", "strip", "pillar"];
export const SUPPORT_LEVELS = ["emergency", "high", "normal", "low"];
export const SUPPLY_ACTIONS = ["deliver", "restock", "swap", "repair"];
export const TASK_PRIORITIES = ["critical", "high", "normal", "low"];
export const STATUS_DIRECTIVE_ACTIONS = [
  "pause",
  "resume",
  "reroute",
  "request_support",
  "request_tools"
];
