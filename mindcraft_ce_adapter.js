// integrations/mindcraft_ce_adapter.js
// Builds Minecraft CE compatible commands from NPC task payloads

const DEFAULT_PREFIX = "mindcraftce";
const DEFAULT_VERSION = "1.0";

export class MindcraftCEAdapter {
  constructor(options = {}) {
    this.prefix = options.prefix || DEFAULT_PREFIX;
    this.version = options.version || DEFAULT_VERSION;
    this.defaultAutoClose = options.defaultAutoClose ?? true;
  }

  buildCommand(taskPayload) {
    const envelope = this.buildEnvelope(taskPayload);
    return `${this.prefix} run ${JSON.stringify(envelope)}`;
  }

  buildEnvelope(taskPayload) {
    const { npcId, action, details, target, metadata, priority } = taskPayload;

    const envelope = {
      version: this.version,
      action,
      details,
      target,
      npc: npcId || null,
      priority: priority || "normal",
      metadata: this.buildMetadata(action, metadata, taskPayload),
      issuedAt: Date.now()
    };

    if (metadata?.tags) {
      envelope.tags = Array.isArray(metadata.tags)
        ? metadata.tags
        : [String(metadata.tags)];
    }

    return envelope;
  }

  buildMetadata(action, metadata = {}, taskPayload) {
    switch (action) {
      case "open_chest":
        return this.buildChestMetadata(metadata);
      case "craft":
        return this.buildCraftMetadata(metadata, taskPayload);
      case "mine":
        return this.buildMiningMetadata(metadata, taskPayload);
      case "fight":
        return this.buildCombatMetadata(metadata, taskPayload);
      case "check_inventory":
        return this.buildInventoryMetadata(metadata, taskPayload);
      case "assess_equipment":
        return this.buildEquipmentAssessment(metadata, taskPayload);
      default:
        return { ...metadata };
    }
  }

  buildChestMetadata(metadata) {
    const mode = this.normalizeChestMode(metadata.mode);
    const items = Array.isArray(metadata.items)
      ? metadata.items.map(item => this.normalizeItemDescriptor(item)).filter(Boolean)
      : [];

    return {
      mode,
      items,
      autoClose:
        typeof metadata.autoClose === "boolean"
          ? metadata.autoClose
          : this.defaultAutoClose,
      note: metadata.note || undefined
    };
  }

  buildCraftMetadata(metadata, taskPayload) {
    const recipeList = Array.isArray(metadata.recipe)
      ? metadata.recipe
      : Array.isArray(metadata.ingredients)
        ? metadata.ingredients
        : [];

    const normalizedRecipe = recipeList
      .map(item => this.normalizeItemDescriptor(item))
      .filter(Boolean);

    return {
      output: metadata.output || this.inferCraftOutput(taskPayload),
      quantity: this.normalizePositiveInteger(metadata.quantity, 1),
      workstation: this.resolveWorkstation(metadata.workstation, taskPayload),
      recipe: normalizedRecipe,
      tags: Array.isArray(metadata.tags) ? metadata.tags : metadata.tags ? [metadata.tags] : [],
      note: metadata.note || undefined
    };
  }

  buildCombatMetadata(metadata, taskPayload) {
    const style = this.normalizeCombatStyle(metadata.style || metadata.strategy);
    const target = this.normalizeCombatTarget(metadata.target || taskPayload?.details);

    const weapons = Array.isArray(metadata.weapons)
      ? metadata.weapons.map(item => this.normalizeItemDescriptor(item)).filter(Boolean)
      : [];

    const potions = Array.isArray(metadata.potions)
      ? metadata.potions.map(item => this.normalizeItemDescriptor(item)).filter(Boolean)
      : [];

    return {
      target,
      targetType: metadata.targetType || (typeof target === "object" ? target.type : undefined) || "entity",
      style,
      rallyPoint: this.extractRallyPoint(taskPayload?.target),
      weapons,
      potions,
      support: this.normalizeSupportPlan(metadata.support),
      tactics: Array.isArray(metadata.tactics) ? metadata.tactics : metadata.tactics ? [metadata.tactics] : [],
      priority: metadata.priority || taskPayload?.priority || "normal",
      note: metadata.note || undefined
    };
  }

  buildInventoryMetadata(metadata = {}, taskPayload) {
    return {
      mode: this.normalizeInventoryMode(metadata.mode),
      scope: this.normalizeInventoryScope(metadata.scope, taskPayload),
      includeEmpty: typeof metadata.includeEmpty === "boolean" ? metadata.includeEmpty : false,
      filters: Array.isArray(metadata.filters)
        ? metadata.filters.map(entry => this.normalizeInventoryFilter(entry)).filter(Boolean)
        : [],
      summary: metadata.summary || undefined,
      note: metadata.note || undefined
    };
  }

  buildEquipmentAssessment(metadata = {}, taskPayload) {
    return {
      goal: this.normalizeEquipmentGoal(metadata.goal),
      criteria: Array.isArray(metadata.criteria)
        ? metadata.criteria.filter(Boolean).map(String)
        : metadata.criteria
          ? [String(metadata.criteria)]
          : [],
      preferredStyle: this.normalizeCombatStyle(metadata.preferredStyle || metadata.style),
      candidates: Array.isArray(metadata.candidates)
        ? metadata.candidates.map(item => this.normalizeItemDescriptor(item)).filter(Boolean)
        : [],
      minimumTier: metadata.minimumTier || undefined,
      allowCrafting: typeof metadata.allowCrafting === "boolean" ? metadata.allowCrafting : undefined,
      origin: metadata.origin || (taskPayload?.target?.dimension ? `dimension:${taskPayload.target.dimension}` : undefined),
      note: metadata.note || undefined
    };
  }

  buildMiningMetadata(metadata = {}, taskPayload = {}) {
    const resourceDescriptor = metadata.resource ?? metadata.ore ?? metadata.block;
    const resource = this.normalizeResourceDescriptor(
      resourceDescriptor || this.inferResourceFromDetails(taskPayload.details)
    );

    const targets = Array.isArray(metadata.targets)
      ? metadata.targets
          .map(target => this.normalizeMiningTarget(target))
          .filter(Boolean)
      : resource
        ? [this.normalizeMiningTarget(resource)]
        : [];

    const hazards = Array.isArray(metadata.hazards)
      ? metadata.hazards
          .map(hazard => this.normalizeHazardDescriptor(hazard))
          .filter(Boolean)
      : [];

    const mitigation = Array.isArray(metadata.mitigations)
      ? metadata.mitigations
          .map(step => this.normalizeMitigationStep(step))
          .filter(Boolean)
      : metadata.safetyPlan
        ? [this.normalizeMitigationStep(metadata.safetyPlan)]
        : [];

    const tools = Array.isArray(metadata.tools)
      ? metadata.tools
          .map(item => this.normalizeItemDescriptor(item))
          .filter(Boolean)
      : [];

    return {
      resource: resource || undefined,
      targets,
      hazards,
      mitigation,
      tools,
      priority: this.normalizePriorityRank(metadata.priority || taskPayload.priority),
      strategy: this.normalizeMiningStrategy(metadata.strategy),
      deposit: metadata.deposit || metadata.dropoff || undefined,
      lightLevel: metadata.lightLevel ?? undefined,
      tunnelPlan: metadata.tunnelPlan || undefined,
      scout: metadata.scout || undefined,
      note: metadata.note || undefined
    };
  }

  normalizeChestMode(mode) {
    if (mode === "deposit" || mode === "withdraw" || mode === "inspect") {
      return mode;
    }
    return "inspect";
  }

  normalizePositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
    return fallback;
  }

  normalizeItemDescriptor(item) {
    if (!item) return null;

    if (typeof item === "string") {
      return { item, count: 1 };
    }

    if (typeof item !== "object") {
      return null;
    }

    const name = item.item || item.id || item.name;
    if (!name || typeof name !== "string") {
      return null;
    }

    const count = this.normalizePositiveInteger(item.count ?? item.quantity, 1);

    return {
      item: name,
      count,
      metadata: item.metadata || undefined
    };
  }

  inferCraftOutput(taskPayload) {
    if (taskPayload.metadata?.output) {
      return taskPayload.metadata.output;
    }

    const details = taskPayload.details || "";
    const match = details.match(/craft(?:ing)?\s+([\w:]+)/i);
    if (match && match[1]) {
      return match[1];
    }

    return "unknown";
  }

  resolveWorkstation(explicit, taskPayload) {
    if (explicit) {
      return explicit;
    }

    const detail = (taskPayload.details || "").toLowerCase();
    if (detail.includes("furnace")) return "furnace";
    if (detail.includes("blast furnace")) return "blast_furnace";
    if (detail.includes("smith")) return "smithing_table";
    if (detail.includes("loom")) return "loom";
    if (detail.includes("anvil")) return "anvil";
    if (detail.includes("brewing")) return "brewing_stand";
    if (detail.includes("stonecutter")) return "stonecutter";

    return "crafting_table";
  }

  normalizeCombatStyle(style) {
    const normalized = typeof style === "string" ? style.toLowerCase() : "";
    if (["melee", "ranged", "defensive", "support", "balanced"].includes(normalized)) {
      return normalized;
    }
    if (normalized === "tank") return "defensive";
    if (normalized === "healer") return "support";
    if (normalized === "hybrid") return "balanced";
    return "balanced";
  }

  normalizeCombatTarget(target) {
    if (!target) {
      return "unknown";
    }

    if (typeof target === "string") {
      return target;
    }

    if (typeof target === "object") {
      const name = target.name || target.id || target.entity || target.type || "unknown";
      return {
        name,
        type: target.type || target.category || "entity",
        level: target.level || undefined
      };
    }

    return "unknown";
  }

  extractRallyPoint(target = {}) {
    if (!target || typeof target !== "object") return undefined;
    const { x, y, z, dimension } = target;
    if ([x, y, z].every(coord => typeof coord === "number" && Number.isFinite(coord))) {
      return {
        x,
        y,
        z,
        dimension: dimension || undefined
      };
    }
    return undefined;
  }

  normalizeSupportPlan(support) {
    if (typeof support === "boolean") {
      return support ? ["provide_cover"] : [];
    }

    if (Array.isArray(support)) {
      return support.map(entry => String(entry)).filter(Boolean);
    }

    if (typeof support === "string" && support.trim()) {
      return [support.trim()];
    }

    return [];
  }

  normalizeInventoryMode(mode) {
    const normalized = typeof mode === "string" ? mode.toLowerCase() : "";
    if (["summary", "locate", "count", "missing"].includes(normalized)) {
      return normalized;
    }
    if (normalized === "check") return "summary";
    if (normalized === "find") return "locate";
    return "summary";
  }

  normalizeInventoryScope(scope, taskPayload) {
    const normalized = typeof scope === "string" ? scope.toLowerCase() : "";
    if (["self", "npc", "chest", "storage", "area"].includes(normalized)) {
      return normalized;
    }
    if (taskPayload?.target?.dimension) {
      return "area";
    }
    return "self";
  }

  normalizeResourceDescriptor(resource) {
    if (!resource) return null;

    if (typeof resource === "string") {
      return { block: resource, priority: "primary" };
    }

    if (typeof resource !== "object") {
      return null;
    }

    const block = resource.block || resource.ore || resource.material || resource.id || resource.name || resource.tag;
    if (!block) {
      return null;
    }

    return {
      block,
      priority: this.normalizePriorityRank(resource.priority),
      quantity: this.normalizePositiveInteger(resource.quantity ?? resource.count, undefined),
      tag: resource.tag,
      depthRange: resource.depthRange,
      note: resource.note || undefined
    };
  }

  normalizeMiningTarget(target) {
    if (!target) return null;

    if (typeof target === "string") {
      return {
        block: target,
        priority: "primary"
      };
    }

    if (typeof target !== "object") {
      return null;
    }

    const block = target.block || target.ore || target.material || target.id || target.name || target.tag;
    if (!block) {
      return null;
    }

    const normalized = {
      block,
      priority: this.normalizePriorityRank(target.priority),
      quantity: this.normalizePositiveInteger(target.quantity ?? target.count, undefined),
      minDepth: Number.isFinite(target.minDepth) ? Number(target.minDepth) : undefined,
      maxDepth: Number.isFinite(target.maxDepth) ? Number(target.maxDepth) : undefined,
      requiresSilkTouch: typeof target.requiresSilkTouch === "boolean" ? target.requiresSilkTouch : undefined,
      avoidHazards: Array.isArray(target.avoidHazards)
        ? target.avoidHazards.filter(Boolean).map(String)
        : undefined,
      note: target.note || undefined
    };

    if (target.path) {
      normalized.path = target.path;
    }

    return normalized;
  }

  normalizeHazardDescriptor(hazard) {
    if (!hazard) return null;

    if (typeof hazard === "string") {
      return {
        type: this.normalizeHazardType(hazard),
        severity: this.inferHazardSeverity(hazard)
      };
    }

    if (typeof hazard !== "object") {
      return null;
    }

    const type = this.normalizeHazardType(hazard.type || hazard.name || hazard.kind);
    const severity = this.normalizeHazardSeverity(hazard.severity || hazard.level);

    return {
      type,
      severity,
      distance: Number.isFinite(hazard.distance) ? Number(hazard.distance) : undefined,
      mitigation: this.normalizeMitigationList(hazard.mitigation || hazard.plan),
      note: hazard.note || hazard.description || undefined,
      location: this.extractRallyPoint(hazard.location) || undefined
    };
  }

  normalizeMitigationStep(step) {
    if (!step) return null;

    if (typeof step === "string") {
      const trimmed = step.trim();
      return trimmed ? { action: trimmed } : null;
    }

    if (typeof step !== "object") {
      return null;
    }

    const action = step.action || step.plan || step.step;
    if (!action) {
      return null;
    }

    const normalizedAction = String(action).trim();
    if (!normalizedAction) {
      return null;
    }

    return {
      action: normalizedAction,
      tools: Array.isArray(step.tools)
        ? step.tools.map(item => this.normalizeItemDescriptor(item)).filter(Boolean)
        : undefined,
      note: step.note || undefined
    };
  }

  normalizeMitigationList(value) {
    if (!value) return undefined;
    if (Array.isArray(value)) {
      const steps = value
        .map(entry => (typeof entry === "string" ? entry : entry?.action || entry?.plan || null))
        .filter(Boolean)
        .map(String);
      return steps.length ? steps : undefined;
    }
    if (typeof value === "string") {
      return [value];
    }
    if (typeof value === "object" && value.action) {
      return [String(value.action)];
    }
    return undefined;
  }

  normalizeHazardType(type) {
    if (!type) return "unknown";
    const normalized = String(type).toLowerCase();
    if (["lava", "water", "enemy", "void", "fall", "explosive", "cave_in", "darkness", "drowning", "gravel"].includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("mob") || normalized.includes("enemy")) {
      return "enemy";
    }
    if (normalized.includes("lava")) return "lava";
    if (normalized.includes("water") || normalized.includes("drown")) return "water";
    if (normalized.includes("fall")) return "fall";
    return "unknown";
  }

  normalizeHazardSeverity(severity) {
    if (!severity) return "moderate";
    const normalized = String(severity).toLowerCase();
    if (["low", "moderate", "high", "critical"].includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("deadly") || normalized.includes("lethal")) {
      return "critical";
    }
    if (normalized.includes("severe") || normalized.includes("danger")) {
      return "high";
    }
    if (normalized.includes("minor")) {
      return "low";
    }
    return "moderate";
  }

  inferHazardSeverity(hazardName) {
    const normalized = String(hazardName).toLowerCase();
    if (normalized.includes("lava") || normalized.includes("void")) return "critical";
    if (normalized.includes("enemy") || normalized.includes("mob")) return "high";
    if (normalized.includes("water") || normalized.includes("drown")) return "moderate";
    return "moderate";
  }

  normalizePriorityRank(priority) {
    if (!priority) return "primary";
    const normalized = String(priority).toLowerCase();
    if (["primary", "secondary", "tertiary", "optional"].includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("high")) return "primary";
    if (normalized.includes("medium") || normalized.includes("mid")) return "secondary";
    if (normalized.includes("low")) return "tertiary";
    return "primary";
  }

  normalizeMiningStrategy(strategy) {
    if (!strategy) return undefined;
    const normalized = String(strategy).toLowerCase();
    const known = {
      branch: "branch_mining",
      strip: "strip_mining",
      spiral: "spiral_stair",
      staircase: "staircase",
      quarry: "quarry",
      shaft: "vertical_shaft",
      explore: "exploration"
    };

    if (known[normalized]) {
      return known[normalized];
    }

    if (normalized.includes("branch")) return "branch_mining";
    if (normalized.includes("strip")) return "strip_mining";
    if (normalized.includes("stair")) return "staircase";
    if (normalized.includes("spiral")) return "spiral_stair";
    if (normalized.includes("shaft")) return "vertical_shaft";
    if (normalized.includes("quarry")) return "quarry";

    return normalized;
  }

  inferResourceFromDetails(details) {
    if (!details) return null;
    const normalized = details.toLowerCase();
    const knownResources = [
      "diamond",
      "iron",
      "coal",
      "gold",
      "redstone",
      "emerald",
      "lapis",
      "copper",
      "ancient_debris"
    ];

    const found = knownResources.find(resource => normalized.includes(resource));
    if (!found) return null;

    return {
      block: found.includes(":") ? found : `minecraft:${found}`,
      priority: "primary"
    };
  }

  normalizeInventoryFilter(filter) {
    if (!filter) return null;
    if (typeof filter === "string") {
      if (filter.startsWith("tag:")) {
        return { tag: filter.slice(4) };
      }
      return { item: filter };
    }
    if (typeof filter !== "object") {
      return null;
    }

    const normalized = {};
    if (filter.item || filter.id || filter.name) {
      normalized.item = filter.item || filter.id || filter.name;
    }
    if (filter.tag) {
      normalized.tag = filter.tag;
    }
    if (filter.minCount !== undefined) {
      const parsed = Number(filter.minCount);
      if (Number.isFinite(parsed)) {
        normalized.minCount = parsed;
      }
    }
    if (filter.maxCount !== undefined) {
      const parsed = Number(filter.maxCount);
      if (Number.isFinite(parsed)) {
        normalized.maxCount = parsed;
      }
    }
    if (filter.preferred) {
      normalized.preferred = Boolean(filter.preferred);
    }
    return Object.keys(normalized).length > 0 ? normalized : null;
  }

  normalizeEquipmentGoal(goal) {
    const normalized = typeof goal === "string" ? goal.toLowerCase() : "";
    if (["best_defense", "best_attack", "balanced", "specialized"].includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("defense") || normalized.includes("tank")) {
      return "best_defense";
    }
    if (normalized.includes("attack") || normalized.includes("damage")) {
      return "best_attack";
    }
    if (normalized.includes("special")) {
      return "specialized";
    }
    return "balanced";
  }
}
