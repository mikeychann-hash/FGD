// integrations/mindcraft_ce_adapter.js
// Builds Minecraft CE compatible commands from NPC task payloads

const DEFAULT_PREFIX = "mindcraftce";
const DEFAULT_VERSION = "1.0";
const INVENTORY_VIEWS = ["overview", "hotbar", "equipment", "crafting", "materials"];
const INVENTORY_PRIORITY_LEVELS = ["critical", "high", "medium", "low", "junk"];
const ITEM_USAGE_TYPES = [
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
const EQUIP_SLOTS = [
  "main_hand",
  "off_hand",
  "head",
  "chest",
  "legs",
  "feet",
  "hotbar",
  "accessory"
];
const LOADOUT_PRIORITIES = ["primary", "secondary", "backup"];
const DIG_STRATEGIES = ["clear", "tunnel", "staircase", "quarry", "strip", "pillar"];

export class MindcraftCEAdapter {
  constructor(options = {}) {
    this.prefix = options.prefix || DEFAULT_PREFIX;
    this.version = options.version || DEFAULT_VERSION;
    this.defaultAutoClose = options.defaultAutoClose ?? true;
  }

  buildCommand(taskPayload) {
    const envelope = this.buildEnvelope(taskPayload);
    return this.buildCommandFromEnvelope(envelope);
  }

  buildCommandFromEnvelope(envelope) {
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
      case "open_inventory":
        return this.buildInventoryOpenMetadata(metadata, taskPayload);
      case "craft":
        return this.buildCraftMetadata(metadata, taskPayload);
      case "mine":
        return this.buildMiningMetadata(metadata, taskPayload);
      case "fight":
        return this.buildCombatMetadata(metadata, taskPayload);
      case "check_inventory":
        return this.buildInventoryMetadata(metadata, taskPayload);
      case "manage_inventory":
        return this.buildInventoryManagementMetadata(metadata, taskPayload);
      case "use_item":
        return this.buildUseItemMetadata(metadata, taskPayload);
      case "equip_item":
        return this.buildEquipMetadata(metadata, taskPayload);
      case "dig":
        return this.buildDigMetadata(metadata, taskPayload);
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

    const tools = this.normalizeItemList(metadata.tools);

    return {
      output: metadata.output || this.inferCraftOutput(taskPayload),
      quantity: this.normalizePositiveInteger(metadata.quantity, 1),
      workstation: this.resolveWorkstation(metadata.workstation, taskPayload),
      recipe: normalizedRecipe,
      tools,
      priority: this.normalizeInventoryPriorityLevel(metadata.priority),
      autoCraft:
        typeof metadata.autoCraft === "boolean" ? metadata.autoCraft : undefined,
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

    const preferredWeapons = this.normalizeItemList(metadata.preferredWeapons);
    const backupWeapons = this.normalizeItemList(metadata.backupWeapons);
    const healingItems = this.normalizeItemList(metadata.healingItems);

    return {
      target,
      targetType: metadata.targetType || (typeof target === "object" ? target.type : undefined) || "entity",
      style,
      rallyPoint: this.extractRallyPoint(taskPayload?.target),
      weapons,
      preferredWeapons,
      backupWeapons,
      potions,
      healingItems,
      weaponType: this.normalizeWeaponType(metadata.weaponType),
      support: this.normalizeSupportPlan(metadata.support),
      tactics: Array.isArray(metadata.tactics) ? metadata.tactics : metadata.tactics ? [metadata.tactics] : [],
      priority: metadata.priority || taskPayload?.priority || "normal",
      loadout: this.normalizeCombatLoadout(metadata.loadout, {
        preferredWeapons,
        backupWeapons,
        healingItems
      }),
      note: metadata.note || undefined
    };
  }

  buildInventoryMetadata(metadata = {}, taskPayload) {
    const focus = this.normalizeInventoryFocus(metadata.focus);
    const priorities = this.normalizeInventoryPriorities(metadata.priorities);

    return {
      mode: this.normalizeInventoryMode(metadata.mode),
      scope: this.normalizeInventoryScope(metadata.scope, taskPayload),
      view: this.normalizeInventoryView(metadata.view),
      includeEmpty: typeof metadata.includeEmpty === "boolean" ? metadata.includeEmpty : false,
      focus,
      priorities,
      filters: Array.isArray(metadata.filters)
        ? metadata.filters.map(entry => this.normalizeInventoryFilter(entry)).filter(Boolean)
        : [],
      summary: metadata.summary || undefined,
      note: metadata.note || undefined
    };
  }

  buildInventoryOpenMetadata(metadata = {}, taskPayload) {
    const base = this.buildInventoryMetadata(
      { ...metadata, mode: metadata.mode || "open" },
      taskPayload
    );

    return {
      ...base,
      mode: base.mode || "open",
      actions: this.normalizeInventoryActions(metadata.actions),
      autoSort:
        typeof metadata.autoSort === "boolean" ? metadata.autoSort : undefined,
      includeEquipment:
        typeof metadata.includeEquipment === "boolean"
          ? metadata.includeEquipment
          : undefined
    };
  }

  buildInventoryManagementMetadata(metadata = {}, taskPayload) {
    const base = this.buildInventoryMetadata(
      { ...metadata, mode: metadata.mode || "manage" },
      taskPayload
    );

    return {
      mode: base.mode || "manage",
      scope: base.scope,
      view: base.view,
      focus: base.focus,
      priorities: base.priorities,
      includeEmpty: base.includeEmpty,
      filters: base.filters,
      restock: this.normalizeItemList(metadata.restock),
      discard: this.normalizeItemList(metadata.discard),
      ensure: this.normalizeItemList(metadata.ensure),
      actions: this.normalizeInventoryActions(metadata.actions),
      autoSort:
        typeof metadata.autoSort === "boolean" ? metadata.autoSort : undefined,
      lockSlots: this.normalizeStringArray(metadata.lockSlots),
      summary: base.summary,
      note: metadata.note || base.note || undefined
    };
  }

  buildUseItemMetadata(metadata = {}, taskPayload = {}) {
    const item = this.normalizeItemDescriptor(metadata.item);
    const fallbacks = this.normalizeItemList(metadata.fallbacks);

    return {
      item,
      usage: this.normalizeUsageType(metadata.usage || metadata.purpose),
      target:
        this.normalizeTargetDescriptor(metadata.target) ||
        this.normalizeTargetDescriptor(taskPayload?.target),
      quantity: this.normalizePositiveInteger(metadata.quantity, undefined),
      cooldown: typeof metadata.cooldown === "number" ? metadata.cooldown : undefined,
      healAmount:
        typeof metadata.healAmount === "number" ? metadata.healAmount : undefined,
      conditions: this.normalizeStringArray(metadata.conditions),
      fallbacks,
      note: metadata.note || undefined
    };
  }

  buildEquipMetadata(metadata = {}, taskPayload = {}) {
    const candidates = this.normalizeItemList(metadata.candidates);

    return {
      npc: taskPayload?.npcId || undefined,
      slot: this.normalizeEquipSlot(metadata.slot),
      item: metadata.item ? this.normalizeItemDescriptor(metadata.item) : undefined,
      candidates,
      category: metadata.category || undefined,
      preferred: this.normalizeItemList(metadata.preferred),
      backups: this.normalizeItemList(metadata.backups),
      priority: this.normalizeLoadoutPriority(metadata.priority),
      requirements: this.normalizeStringArray(metadata.requirements),
      note: metadata.note || undefined
    };
  }

  buildDigMetadata(metadata = {}, taskPayload = {}) {
    const area = this.normalizeDigArea(metadata.area, taskPayload);
    const hazards = Array.isArray(metadata.hazards)
      ? metadata.hazards.map(hazard => this.normalizeHazardDescriptor(hazard)).filter(Boolean)
      : [];
    const mitigation = Array.isArray(metadata.mitigations)
      ? metadata.mitigations
          .map(step => this.normalizeMitigationStep(step))
          .filter(Boolean)
      : [];
    const tools = this.normalizeItemList(metadata.tools);
    const directives = this.normalizeMiningDirectives(metadata.statusDirectives);
    const watchers = this.buildMiningWatchers(hazards, directives);

    return {
      area,
      depth: typeof metadata.depth === "number" ? metadata.depth : undefined,
      layers: this.normalizePositiveInteger(metadata.layers, undefined),
      strategy: this.normalizeDigStrategy(metadata.strategy),
      hazards,
      mitigation,
      tools,
      directives,
      watchers,
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

    const directives = this.normalizeMiningDirectives(metadata.statusDirectives);
    const watchers = this.buildMiningWatchers(hazards, directives);
    const plan = this.buildMiningPlan({
      resource,
      targets,
      hazards,
      mitigation,
      tools,
      directives,
      strategy: metadata.strategy,
      deposit: metadata.deposit || metadata.dropoff,
      task: taskPayload
    });

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
      directives,
      watchers,
      plan,
      note: metadata.note || undefined
    };
  }

  buildMiningWatchers(hazards, directives) {
    if (!hazards.length && !directives?.hazards?.length) {
      return [];
    }

    const hazardDirectives = directives?.hazards || [];

    return hazards.map(hazard => {
      const response = this.resolveHazardDirective(hazard, hazardDirectives);
      const type = typeof hazard === "string" ? hazard : hazard?.type || "unknown";

      return {
        hazard: type,
        severity:
          typeof hazard === "object" && hazard?.severity
            ? hazard.severity
            : "moderate",
        mitigation:
          typeof hazard === "object" && hazard?.mitigation
            ? hazard.mitigation
            : undefined,
        response: response || undefined
      };
    });
  }

  resolveHazardDirective(hazard, directives = []) {
    if (!Array.isArray(directives) || directives.length === 0) {
      return null;
    }

    const type = typeof hazard === "string" ? hazard : hazard?.type || "unknown";
    const severity = typeof hazard === "object" ? hazard?.severity : undefined;

    const exact = directives.find(entry => {
      const matchesType = !entry.type || entry.type === "any" || entry.type === type;
      const matchesSeverity = !entry.severity || entry.severity === severity;
      return matchesType && matchesSeverity;
    });

    if (exact) return exact;

    return (
      directives.find(entry => entry.type === "any" || !entry.type) || null
    );
  }

  buildMiningPlan({
    resource,
    targets,
    hazards,
    mitigation,
    tools,
    directives,
    strategy,
    deposit,
    task
  }) {
    const operations = [];
    const targetSummary = targets
      .map(target => this.describeMiningTarget(target))
      .join(", ");

    if (strategy) {
      operations.push({
        step: "strategy",
        kind: "pattern",
        description: `Use the ${this.normalizeMiningStrategy(strategy)} strategy`
      });
    }

    operations.push({
      step: "survey",
      kind: "safety",
      description: `Survey the area around (${task?.target?.x}, ${task?.target?.y}, ${task?.target?.z}) before mining ${this.describeResource(resource)}`,
      hazards: hazards.map(hazard => this.describeHazard(hazard))
    });

    hazards.forEach(hazard => {
      const response = this.resolveHazardDirective(hazard, directives?.hazards || []);
      operations.push({
        step: "mitigate",
        kind: "safety",
        hazard: this.describeHazard(hazard),
        mitigation: this.describeMitigation(hazard, mitigation),
        response: response || undefined
      });
    });

    operations.push({
      step: "extract",
      kind: "mining",
      description: `Prioritize ${targetSummary || this.describeResource(resource)}`,
      tools: tools.map(item => item.item)
    });

    if (deposit) {
      operations.push({
        step: "deposit",
        kind: "logistics",
        description: `Deliver mined resources to ${deposit}`
      });
    }

    return {
      summary: `Mine ${this.describeResource(resource)} while following mitigation plans`,
      operations,
      directives,
      hazards: hazards.map(hazard => this.describeHazard(hazard))
    };
  }

  describeResource(resource) {
    if (!resource) return "target resources";
    if (typeof resource === "string") return resource;
    return (
      resource.block ||
      resource.ore ||
      resource.material ||
      resource.id ||
      resource.name ||
      resource.tag ||
      "target resources"
    );
  }

  describeMiningTarget(target) {
    if (!target) return "target";
    if (typeof target === "string") return target;
    const descriptor =
      target.block || target.ore || target.material || target.id || target.name || target.tag;
    const priority = target.priority ? `(${target.priority})` : "";
    return `${descriptor}${priority}`;
  }

  describeHazard(hazard) {
    if (!hazard) return "unknown hazard";
    if (typeof hazard === "string") return hazard;
    const type = hazard.type || "unknown";
    const severity = hazard.severity ? ` (${hazard.severity})` : "";
    return `${type}${severity}`;
  }

  describeMitigation(hazard, mitigation) {
    if (typeof hazard === "object" && hazard?.mitigation) {
      return hazard.mitigation;
    }

    if (!mitigation || mitigation.length === 0) {
      return undefined;
    }

    return mitigation.map(step => (typeof step === "string" ? step : step?.action)).filter(Boolean);
  }

  normalizeMiningDirectives(directives) {
    if (!directives || typeof directives !== "object") {
      return { hazards: [] };
    }

    const normalized = {
      hazards: Array.isArray(directives.hazards)
        ? directives.hazards
            .map(entry => this.normalizeHazardDirectiveEntry(entry))
            .filter(Boolean)
        : [],
      depletion: this.normalizeDirectiveBlock(directives.depletion, "continue"),
      toolFailure: this.normalizeDirectiveBlock(directives.toolFailure, "request_tools"),
      resume: this.normalizeDirectiveBlock(directives.resume, "resume"),
      fallback: this.normalizeDirectiveBlock(directives.fallback, "pause")
    };

    return normalized;
  }

  normalizeHazardDirectiveEntry(entry) {
    if (!entry) return null;

    if (typeof entry === "string") {
      return {
        type: entry,
        action: "pause"
      };
    }

    if (typeof entry !== "object") {
      return null;
    }

    const directive = {
      type: entry.type || entry.hazard || "any",
      severity: entry.severity || undefined,
      action: this.normalizeDirectiveAction(entry.action, "pause"),
      notify: this.normalizeNotifyList(entry.notify),
      request: this.normalizeDirectiveRequest(entry.request),
      note: entry.note || undefined,
      reroute: entry.reroute || undefined
    };

    if (entry.escalate) {
      directive.escalate = this.normalizeDirectiveAction(entry.escalate, "request_support");
    }

    if (entry.resume) {
      directive.resume = this.normalizeDirectiveAction(entry.resume, "resume");
    }

    return directive;
  }

  normalizeDirectiveBlock(block, defaultAction) {
    if (!block) return undefined;

    if (typeof block === "string") {
      return { action: this.normalizeDirectiveAction(block, defaultAction) };
    }

    if (typeof block !== "object") {
      return undefined;
    }

    const normalized = {
      action: this.normalizeDirectiveAction(block.action, defaultAction),
      notify: this.normalizeNotifyList(block.notify),
      request: this.normalizeDirectiveRequest(block.request),
      note: block.note || undefined,
      reroute: block.reroute || undefined,
      priority: block.priority || undefined
    };

    if (block.on) {
      normalized.on = block.on;
    }

    return normalized;
  }

  normalizeDirectiveAction(action, fallback = "continue") {
    const value = typeof action === "string" ? action.toLowerCase() : "";
    const allowed = [
      "pause",
      "resume",
      "reroute",
      "request_support",
      "request_tools",
      "continue"
    ];

    if (allowed.includes(value)) {
      return value;
    }

    return fallback;
  }

  normalizeNotifyList(list) {
    if (!list) return undefined;

    const array = Array.isArray(list) ? list : [list];
    const normalized = array
      .map(entry => (typeof entry === "string" ? entry.trim() : entry))
      .filter(Boolean);

    return normalized.length ? normalized : undefined;
  }

  normalizeDirectiveRequest(request) {
    if (!request) return undefined;

    if (typeof request === "string") {
      return { message: request };
    }

    if (typeof request !== "object") {
      return undefined;
    }

    const normalized = {};

    if (request.message && typeof request.message === "string") {
      normalized.message = request.message;
    }

    if (request.reason && typeof request.reason === "string") {
      normalized.reason = request.reason;
    }

    if (request.items) {
      const items = Array.isArray(request.items) ? request.items : [request.items];
      normalized.items = items
        .map(item => this.normalizeItemDescriptor(item))
        .filter(Boolean);
    }

    return Object.keys(normalized).length ? normalized : undefined;
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
    if (["summary", "locate", "count", "missing", "open", "manage"].includes(normalized)) {
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

  normalizeInventoryView(view) {
    const normalized = typeof view === "string" ? view.toLowerCase() : "";
    if (INVENTORY_VIEWS.includes(normalized)) {
      return normalized;
    }
    return undefined;
  }

  normalizeInventoryFocus(focus) {
    if (!focus) return [];
    const list = Array.isArray(focus) ? focus : [focus];
    return list
      .map(entry => {
        if (!entry) return null;
        if (typeof entry === "string") {
          return { item: entry };
        }
        if (typeof entry !== "object") {
          return null;
        }
        const descriptor = {};
        if (entry.item || entry.id || entry.name) {
          descriptor.item = (entry.item || entry.id || entry.name).toString();
        }
        if (entry.tag) {
          descriptor.tag = entry.tag.toString();
        }
        if (entry.note) {
          descriptor.note = entry.note;
        }
        return Object.keys(descriptor).length ? descriptor : null;
      })
      .filter(Boolean);
  }

  normalizeInventoryPriorityEntry(entry) {
    if (!entry) return null;

    if (typeof entry === "string") {
      return { item: entry, priority: "high" };
    }

    if (typeof entry !== "object") {
      return null;
    }

    const normalized = {};
    if (entry.item || entry.id || entry.name) {
      normalized.item = (entry.item || entry.id || entry.name).toString();
    }
    if (entry.tag) {
      normalized.tag = entry.tag.toString();
    }
    if (entry.category) {
      normalized.category = entry.category.toString();
    }

    const priority = this.normalizeInventoryPriorityLevel(entry.priority);
    if (priority) {
      normalized.priority = priority;
    }

    ["minCount", "maxCount", "desired", "desiredCount"].forEach(key => {
      if (entry[key] !== undefined) {
        const value = Number(entry[key]);
        if (Number.isFinite(value) && value >= 0) {
          normalized[key] = value;
        }
      }
    });

    if (entry.actions) {
      normalized.actions = this.normalizeInventoryActions(entry.actions);
    }

    return Object.keys(normalized).length ? normalized : null;
  }

  normalizeInventoryPriorities(priorities) {
    if (!priorities) return [];
    const list = Array.isArray(priorities) ? priorities : [priorities];
    return list
      .map(entry => this.normalizeInventoryPriorityEntry(entry))
      .filter(Boolean);
  }

  normalizeInventoryPriorityLevel(priority) {
    if (!priority) return undefined;
    const normalized = priority.toString().toLowerCase();
    if (INVENTORY_PRIORITY_LEVELS.includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("high")) return "high";
    if (normalized.includes("critical")) return "critical";
    if (normalized.includes("medium") || normalized.includes("mid")) return "medium";
    if (normalized.includes("low")) return "low";
    if (normalized.includes("junk") || normalized.includes("trash")) return "junk";
    return undefined;
  }

  normalizeInventoryActions(actions) {
    if (!actions) return [];
    const list = Array.isArray(actions) ? actions : [actions];
    return list
      .map(action => (typeof action === "string" ? action.trim() : null))
      .filter(Boolean);
  }

  normalizeItemList(list) {
    if (!list) return [];
    const array = Array.isArray(list) ? list : [list];
    return array
      .map(item => this.normalizeItemDescriptor(item))
      .filter(Boolean);
  }

  normalizeUsageType(usage) {
    if (!usage) return undefined;
    const normalized = usage.toString().toLowerCase();
    if (ITEM_USAGE_TYPES.includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("heal")) return "heal";
    if (normalized.includes("buff") || normalized.includes("potion")) return "buff";
    if (normalized.includes("attack") || normalized.includes("weapon")) return "attack";
    if (normalized.includes("tool")) return "tool";
    if (normalized.includes("place") || normalized.includes("build")) return "place";
    if (normalized.includes("equip")) return "equip";
    if (normalized.includes("consume") || normalized.includes("eat")) return "consume";
    if (normalized.includes("interact")) return "interact";
    return "utility";
  }

  normalizeTargetDescriptor(target) {
    if (!target) return undefined;

    if (typeof target === "string") {
      return { name: target };
    }

    if (typeof target !== "object") {
      return undefined;
    }

    const normalized = {};
    if (target.id) normalized.id = String(target.id);
    if (target.name) normalized.name = String(target.name);
    if (target.type) normalized.type = String(target.type);
    if (target.entity) normalized.entity = String(target.entity);

    if (target.position && typeof target.position === "object") {
      const { x, y, z } = target.position;
      if ([x, y, z].some(coord => coord !== undefined)) {
        normalized.position = {
          x: Number.isFinite(x) ? Number(x) : undefined,
          y: Number.isFinite(y) ? Number(y) : undefined,
          z: Number.isFinite(z) ? Number(z) : undefined
        };
      }
    }

    if (!normalized.position) {
      const { x, y, z } = target;
      if ([x, y, z].some(coord => coord !== undefined)) {
        normalized.position = {
          x: Number.isFinite(x) ? Number(x) : undefined,
          y: Number.isFinite(y) ? Number(y) : undefined,
          z: Number.isFinite(z) ? Number(z) : undefined
        };
      }
    }

    if (!Object.keys(normalized).length && target.target) {
      return this.normalizeTargetDescriptor(target.target);
    }

    return Object.keys(normalized).length ? normalized : undefined;
  }

  normalizeEquipSlot(slot) {
    if (!slot) return undefined;
    const normalized = slot.toString().toLowerCase();
    if (EQUIP_SLOTS.includes(normalized)) {
      return normalized;
    }
    if (normalized === "weapon" || normalized === "main") return "main_hand";
    if (normalized === "offhand" || normalized === "shield") return "off_hand";
    return undefined;
  }

  normalizeLoadoutPriority(priority) {
    if (!priority) return undefined;
    const normalized = priority.toString().toLowerCase();
    if (LOADOUT_PRIORITIES.includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("backup") || normalized.includes("spare")) {
      return "backup";
    }
    if (normalized.includes("primary") || normalized.includes("main")) {
      return "primary";
    }
    if (normalized.includes("secondary") || normalized.includes("alt")) {
      return "secondary";
    }
    return undefined;
  }

  normalizeStringArray(list) {
    if (!list) return [];
    const array = Array.isArray(list) ? list : [list];
    return array
      .map(entry => (typeof entry === "string" ? entry.trim() : null))
      .filter(Boolean);
  }

  normalizeCombatLoadout(loadout, fallback = {}) {
    if (!loadout || typeof loadout !== "object") {
      const { preferredWeapons, backupWeapons, healingItems } = fallback;
      if (
        (preferredWeapons && preferredWeapons.length) ||
        (backupWeapons && backupWeapons.length) ||
        (healingItems && healingItems.length)
      ) {
        return {
          preferredWeapons: preferredWeapons?.length ? preferredWeapons : undefined,
          backupWeapons: backupWeapons?.length ? backupWeapons : undefined,
          healingItems: healingItems?.length ? healingItems : undefined
        };
      }
      return undefined;
    }

    const normalized = { ...loadout };
    if (!normalized.preferredWeapons && fallback.preferredWeapons?.length) {
      normalized.preferredWeapons = fallback.preferredWeapons;
    }
    if (!normalized.backupWeapons && fallback.backupWeapons?.length) {
      normalized.backupWeapons = fallback.backupWeapons;
    }
    if (!normalized.healingItems && fallback.healingItems?.length) {
      normalized.healingItems = fallback.healingItems;
    }
    if (normalized.priority) {
      normalized.priority = this.normalizeLoadoutPriority(normalized.priority);
    }
    if (normalized.strategy && typeof normalized.strategy === "string") {
      normalized.strategy = normalized.strategy.toLowerCase();
    }
    return normalized;
  }

  normalizeWeaponType(weaponType) {
    if (!weaponType) return undefined;
    const normalized = weaponType.toString().toLowerCase();
    if (["melee", "ranged", "magic", "hybrid"].includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("bow") || normalized.includes("crossbow")) {
      return "ranged";
    }
    if (normalized.includes("sword") || normalized.includes("axe")) {
      return "melee";
    }
    return normalized;
  }

  normalizeDigArea(area, taskPayload) {
    if (!area || typeof area !== "object") {
      const target = taskPayload?.target || {};
      return {
        shape: "clear",
        origin: this.extractRallyPoint(target)
      };
    }

    const shape = area.shape || area.type || "clear";
    const normalized = {
      shape: this.normalizeDigStrategy(shape) || "clear",
      origin: this.extractRallyPoint(area.origin || taskPayload?.target)
    };

    if (area.dimensions && typeof area.dimensions === "object") {
      normalized.dimensions = {};
      ["width", "height", "length", "radius"].forEach(key => {
        if (Number.isFinite(area.dimensions[key])) {
          normalized.dimensions[key] = Number(area.dimensions[key]);
        }
      });
    }

    if (Number.isFinite(area.depth)) {
      normalized.depth = Number(area.depth);
    }

    if (Number.isFinite(area.levels)) {
      normalized.levels = Number(area.levels);
    }

    if (area.bounds) {
      normalized.bounds = area.bounds;
    }

    return normalized;
  }

  normalizeDigStrategy(strategy) {
    if (!strategy) return undefined;
    const normalized = strategy.toString().toLowerCase();
    if (DIG_STRATEGIES.includes(normalized)) {
      return normalized;
    }
    if (normalized.includes("strip")) return "strip";
    if (normalized.includes("stair")) return "staircase";
    if (normalized.includes("shaft") || normalized.includes("tunnel")) return "tunnel";
    if (normalized.includes("quarry")) return "quarry";
    if (normalized.includes("pillar")) return "pillar";
    if (normalized.includes("clear")) return "clear";
    return normalized;
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
