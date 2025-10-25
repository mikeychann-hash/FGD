// tasks/plan_craft.js
// Planning logic for crafting requests

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  formatRequirementList,
  resolveQuantity,
  countInventoryItems
} from "./helpers.js";

// Constants for time estimation
const BASE_CRAFT_TIME_MS = 8000;
const TIME_PER_INGREDIENT_MS = 1500;
const TIME_PER_ADDITIONAL_ITEM_MS = 1200;

function normalizeList(value) {
  if (!value) {
    return [];
  }
  if (Array.isArray(value)) {
    return value
      .map(entry => (typeof entry === "string" ? normalizeItemName(entry) : normalizeItemName(entry?.name || entry?.item)))
      .filter(name => name && name !== "unspecified item");
  }
  if (typeof value === "string") {
    const normalized = normalizeItemName(value);
    return normalized && normalized !== "unspecified item" ? [normalized] : [];
  }
  if (typeof value === "object") {
    return Object.values(value)
      .map(entry => normalizeItemName(entry))
      .filter(name => name && name !== "unspecified item");
  }
  return [];
}

function determineStationProfile(stationName, metadata = {}) {
  if (!stationName || typeof stationName !== "string") {
    // Default to crafting table if station is invalid
    stationName = "crafting table";
  }

  const name = stationName.toLowerCase().trim();
  const safeMetadata = metadata && typeof metadata === "object" ? metadata : {};
  const fuelOptions = normalizeList(safeMetadata.fuel || safeMetadata.fuels || safeMetadata.requiredFuel);

  if (name.includes("furnace") || name.includes("smoker")) {
    return {
      type: "smelting",
      verb: name.includes("smoker") ? "smoke" : "smelt",
      command: null,
      requiresFuel: true,
      fuelOptions: fuelOptions.length > 0 ? fuelOptions : ["coal", "charcoal", "logs"],
      itemsPerFuel: safeMetadata.itemsPerFuel ? resolveQuantity(safeMetadata.itemsPerFuel, 8) : 8,
      itemsPerOperation: safeMetadata.itemsPerOperation ? resolveQuantity(safeMetadata.itemsPerOperation, 1) : 1,
      postCollection: `Collect finished ${safeMetadata.output || "items"} from the ${name}.`,
      notes: "Furnace operations consume fuel; ensure hopper outputs aren't clogged."
    };
  }

  if (name.includes("brewing")) {
    return {
      type: "brewing",
      verb: "brew",
      command: null,
      requiresFuel: true,
      fuelOptions: fuelOptions.length > 0 ? fuelOptions : ["blaze powder"],
      fuelPerBatch: safeMetadata.fuelPerBatch ? resolveQuantity(safeMetadata.fuelPerBatch, 1) : 1,
      bottlesPerBatch: safeMetadata.bottlesPerBatch ? resolveQuantity(safeMetadata.bottlesPerBatch, 3) : 3,
      postCollection: "Collect finished potions and clear the brewing stand.",
      notes: "Brewing requires blaze powder fuel and filled bottles; queue reagents in order."
    };
  }

  if (name.includes("smithing")) {
    return {
      type: "smithing",
      verb: "reforge",
      command: null,
      requiresFuel: false,
      template: normalizeItemName(safeMetadata.template || safeMetadata.smithingTemplate),
      notes: "Ensure the smithing template and upgrade material are available before reforging."
    };
  }

  if (name.includes("anvil")) {
    return {
      type: "anvil",
      verb: "combine",
      command: null,
      requiresFuel: false,
      xpCost: resolveQuantity(safeMetadata.xpCost, null),
      notes: "Combining items on an anvil consumes XP levels and damages the anvil over time."
    };
  }

  if (name.includes("stonecutter")) {
    return {
      type: "stonecutting",
      verb: "cut",
      command: null,
      requiresFuel: false,
      notes: "Stonecutting converts blocks efficiently; confirm exact patterns before cutting."
    };
  }

  return {
    type: "crafting",
    verb: "craft",
    command: "/craft",
    requiresFuel: false,
    notes: safeMetadata?.notes || null
  };
}

function parseIngredients(task) {
  if (!task) {
    return [];
  }

  const rawIngredients = Array.isArray(task?.metadata?.ingredients)
    ? task.metadata.ingredients
    : [];

  const normalized = rawIngredients
    .map(entry => {
      if (typeof entry === "string") {
        const name = normalizeItemName(entry);
        return name && name !== "unspecified item" ? { name } : null;
      }
      if (entry && typeof entry === "object") {
        const name = normalizeItemName(entry.name || entry.item || entry.id);
        if (!name || name === "unspecified item") {
          return null;
        }
        let count = resolveQuantity(entry.count ?? entry.quantity, null);
        // Validate count is a positive finite number
        if (count !== null && (!Number.isFinite(count) || count <= 0)) {
          count = null;
        }
        return { name, count };
      }
      return null;
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  if (task?.metadata?.recipe && typeof task.metadata.recipe === "object") {
    const recipeEntries = Object.entries(task.metadata.recipe)
      .map(([name, count]) => {
        const normalizedName = normalizeItemName(name);
        if (!normalizedName || normalizedName === "unspecified item") {
          return null;
        }
        let resolvedCount = resolveQuantity(count, null);
        if (resolvedCount !== null && (!Number.isFinite(resolvedCount) || resolvedCount <= 0)) {
          resolvedCount = null;
        }
        return { name: normalizedName, count: resolvedCount };
      })
      .filter(Boolean);

    if (recipeEntries.length > 0) {
      return recipeEntries;
    }
  }

  const fallback = normalizeItemName(task?.metadata?.primaryIngredient || task?.details || "materials");
  if (!fallback || fallback === "unspecified item") {
    return [];
  }
  return [{ name: fallback }];
}

export function planCraftTask(task, context = {}) {
  // Input validation
  if (!task) {
    throw new Error("planCraftTask requires a valid task object");
  }

  const item = normalizeItemName(task?.metadata?.item || task?.details);

  if (!item || item === "unspecified item") {
    throw new Error("planCraftTask requires a valid item name in task.metadata.item or task.details");
  }

  const station = normalizeItemName(task?.metadata?.station || "crafting table");
  const storage = normalizeItemName(task?.metadata?.storage || task?.metadata?.dropOff || "nearest chest");

  // Validate target description is available
  const targetDescription = task?.target ? describeTarget(task.target) : "the designated location";

  const requiresAutomation = Boolean(task?.metadata?.automation || task?.metadata?.autocrafter);
  const stationProfile = determineStationProfile(station, task?.metadata || {});

  const inventory = extractInventory(context);
  const currentStock = countInventoryItems(inventory, item);

  // Validate and sanitize all quantity-related inputs
  let baseQuantity = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.count, 1) || 1;
  baseQuantity = Number.isFinite(baseQuantity) && baseQuantity > 0 ? Math.floor(baseQuantity) : 1;

  let maintainMinimum = resolveQuantity(
    task?.metadata?.maintainMinimum ?? task?.metadata?.minStock ?? task?.metadata?.maintain,
    null
  );
  maintainMinimum = maintainMinimum && Number.isFinite(maintainMinimum) && maintainMinimum > 0
    ? Math.floor(maintainMinimum)
    : null;

  let desiredStock = resolveQuantity(
    task?.metadata?.desiredStock ?? task?.metadata?.targetStock ?? task?.metadata?.restockTarget,
    null
  );
  desiredStock = desiredStock && Number.isFinite(desiredStock) && desiredStock > 0
    ? Math.floor(desiredStock)
    : null;

  let buffer = resolveQuantity(task?.metadata?.buffer ?? task?.metadata?.extra ?? 0, 0) || 0;
  buffer = Number.isFinite(buffer) && buffer >= 0 ? Math.floor(buffer) : 0;

  let exactQuantity = resolveQuantity(task?.metadata?.exactQuantity, null);
  exactQuantity = exactQuantity && Number.isFinite(exactQuantity) && exactQuantity > 0
    ? Math.floor(exactQuantity)
    : null;

  let quantity = baseQuantity;
  const quantityReasons = [];

  if (maintainMinimum && Number.isFinite(currentStock) && currentStock < maintainMinimum) {
    const deficit = maintainMinimum - currentStock;
    if (Number.isFinite(deficit) && deficit > 0) {
      quantity = Math.max(quantity, deficit);
      quantityReasons.push(`inventory below minimum (${currentStock}/${maintainMinimum})`);
    }
  }

  if (desiredStock && Number.isFinite(currentStock) && currentStock + quantity < desiredStock) {
    const required = desiredStock - currentStock;
    if (Number.isFinite(required) && required > 0) {
      quantity = Math.max(quantity, required);
      quantityReasons.push(`target stock of ${desiredStock} requires ${required}`);
    }
  }

  if (buffer > 0) {
    const newQuantity = quantity + buffer;
    if (Number.isFinite(newQuantity)) {
      quantity = newQuantity;
      quantityReasons.push(`include buffer of ${buffer}`);
    }
  }

  if (exactQuantity && exactQuantity > 0) {
    quantity = exactQuantity;
    quantityReasons.push(`exact quantity override to ${exactQuantity}`);
  }

  // Final safety check
  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = 1;
  }

  quantity = Math.floor(quantity);

  const ingredients = parseIngredients(task);

  // Validate ingredients array
  if (!Array.isArray(ingredients) || ingredients.length === 0) {
    throw new Error("planCraftTask requires at least one valid ingredient");
  }

  const missingIngredients = ingredients.filter(ingredient => {
    if (!ingredient?.name || ingredient.name === "unspecified item") {
      return false;
    }
    const ingredientCount = ingredient.count && Number.isFinite(ingredient.count) && ingredient.count > 0
      ? ingredient.count
      : null;

    if (ingredientCount) {
      const requiredAmount = ingredientCount * quantity;
      return Number.isFinite(requiredAmount) && !hasInventoryItem(inventory, ingredient.name, requiredAmount);
    }
    return !hasInventoryItem(inventory, ingredient.name, quantity);
  });

  const ingredientSummary = formatRequirementList(
    ingredients.map(ing => ({
      ...ing,
      count: ing.count && Number.isFinite(ing.count) ? ing.count * quantity : ing.count
    }))
  );
  const missingSummary = formatRequirementList(missingIngredients);

  const steps = [];

  if (maintainMinimum || desiredStock || buffer > 0 || quantityReasons.length > 0) {
    const reasonText = quantityReasons.length > 0
      ? quantityReasons.join("; ")
      : "Maintain healthy stock levels before heading out.";
    steps.push(
      createStep({
        title: "Assess stock levels",
        type: "analysis",
        description: `Inventory shows ${currentStock} ${item}. ${reasonText}.`,
        metadata: {
          currentStock,
          maintainMinimum,
          desiredStock,
          buffer,
          plannedQuantity: quantity
        }
      })
    );
  }

  const restockIngredientsDescription = missingSummary
    ? `Acquire missing components for ${item}: ${missingSummary}.`
    : `Acquire missing components for ${item} before starting.`;
  const verifyIngredientsDescription = ingredientSummary
    ? `Confirm ingredients for ${item} x${quantity}: ${ingredientSummary}.`
    : `Confirm ingredients for ${item} x${quantity} are available.`;

  steps.push(
    createStep({
      title: missingIngredients.length > 0 ? "Restock ingredients" : "Verify ingredients",
      type: "inventory",
      description:
        missingIngredients.length > 0 ? restockIngredientsDescription : verifyIngredientsDescription,
      metadata: { ingredients, missing: missingIngredients, quantity }
    })
  );

  if (task?.metadata?.subcomponents) {
    const rawSubcomponents = task.metadata.subcomponents;
    const normalizedSubcomponents = Array.isArray(rawSubcomponents)
      ? rawSubcomponents.map(entry =>
          typeof entry === "string"
            ? { name: normalizeItemName(entry) }
            : {
                name: normalizeItemName(entry?.name || entry?.item),
                count: resolveQuantity(entry?.count ?? entry?.quantity, null)
              }
        )
      : Object.entries(rawSubcomponents).map(([name, count]) => ({
          name: normalizeItemName(name),
          count: resolveQuantity(count, null)
        }));
    const subcomponentsSummary = formatRequirementList(normalizedSubcomponents) || "required subcomponents";

    steps.push(
      createStep({
        title: "Craft subcomponents",
        type: "preparation",
        description: `Craft prerequisite parts (${subcomponentsSummary}).`,
        metadata: { subcomponents: normalizedSubcomponents }
      })
    );
  }

  steps.push(
    createStep({
      title: "Move to workstation",
      type: "movement",
      description: `Travel to ${station} located at ${targetDescription}.`,
      metadata: { station, process: stationProfile.type }
    })
  );

  let fuelStatus = null;
  if (stationProfile.requiresFuel) {
    // Validate fuel calculation inputs to prevent division by zero
    let itemsPerFuel = stationProfile.itemsPerFuel || 1;
    itemsPerFuel = Number.isFinite(itemsPerFuel) && itemsPerFuel > 0 ? itemsPerFuel : 1;

    let perBatch = stationProfile.fuelPerBatch || 1;
    perBatch = Number.isFinite(perBatch) && perBatch > 0 ? perBatch : 1;

    let itemsPerOperation = stationProfile.itemsPerOperation || 1;
    itemsPerOperation = Number.isFinite(itemsPerOperation) && itemsPerOperation > 0 ? itemsPerOperation : 1;

    const operationsNeeded = Math.max(1, Math.ceil((quantity * itemsPerOperation) / itemsPerFuel));
    const fuelNeeded = Math.max(perBatch, operationsNeeded);
    const fuelOptions = Array.isArray(stationProfile.fuelOptions) ? stationProfile.fuelOptions : [];
    const hasFuel = fuelOptions.length > 0 && fuelOptions.some(option => hasInventoryItem(inventory, option, fuelNeeded));
    fuelStatus = { fuelNeeded, fuelOptions, hasFuel };
    const fuelList = fuelOptions.length > 0 ? fuelOptions.join(", ") : "fuel";

    steps.push(
      createStep({
        title: "Load fuel",
        type: "inventory",
        description: `Insert approximately ${fuelNeeded} ${fuelList} into the ${station} to power the process.`,
        metadata: { fuelOptions, fuelNeeded }
      })
    );

    if (stationProfile.type === "brewing") {
      let bottlesPerBatch = stationProfile.bottlesPerBatch || 3;
      bottlesPerBatch = Number.isFinite(bottlesPerBatch) && bottlesPerBatch > 0 ? bottlesPerBatch : 3;
      const bottlesNeeded = Math.max(1, Math.ceil(quantity / bottlesPerBatch) * bottlesPerBatch);
      steps.push(
        createStep({
          title: "Prep bottles",
          type: "inventory",
          description: `Fill and place ${bottlesNeeded} water bottles plus initial reagents into the brewing stand.`,
          metadata: { bottlesNeeded }
        })
      );
    }

    if (stationProfile.type === "smelting") {
      steps.push(
        createStep({
          title: "Queue inputs",
          type: "inventory",
          description: `Load raw ingredients for ${item} into the ${station} input slots.`,
          metadata: { ingredients, quantity }
        })
      );
    }
  }

  if (!stationProfile.requiresFuel && stationProfile.type === "smithing" && stationProfile.template) {
    steps.push(
      createStep({
        title: "Slot smithing template",
        type: "preparation",
        description: `Place the ${stationProfile.template} template into the smithing table before combining materials.`,
        metadata: { template: stationProfile.template }
      })
    );
  }

  if (!stationProfile.requiresFuel && stationProfile.type === "anvil" && stationProfile.xpCost) {
    steps.push(
      createStep({
        title: "Verify XP levels",
        type: "analysis",
        description: `Ensure at least ${stationProfile.xpCost} XP levels are available to complete the anvil combination.`,
        metadata: { xpCost: stationProfile.xpCost }
      })
    );
  }

  if (requiresAutomation) {
    steps.push(
      createStep({
        title: "Configure automation",
        type: "configuration",
        description: `Load the recipe into the ${station} autocrafter and prime input buffers.`
      })
    );
  }

  const craftVerb = stationProfile.verb || "craft";
  const craftDescription = quantity > 1
    ? `Use the ${station} to ${craftVerb} ${quantity}x ${item}, arranging ingredients per recipe.`
    : `Use the ${station} to ${craftVerb} ${item}, arranging ingredients per recipe.`;
  let craftCommand = null;
  if (stationProfile.command === "/craft") {
    const craftCommandBase = `/craft ${item.replace(/\s+/g, "_")}`;
    craftCommand = quantity > 1 ? `${craftCommandBase} ${quantity}` : craftCommandBase;
  }

  steps.push(
    createStep({
      title: "Craft item",
      type: "action",
      description: craftDescription,
      command: craftCommand
    })
  );

  if (stationProfile.postCollection) {
    steps.push(
      createStep({
        title: "Collect output",
        type: "action",
        description: stationProfile.postCollection,
        metadata: { station }
      })
    );
  }

  if (task?.metadata?.qualityCheck) {
    steps.push(
      createStep({
        title: "Inspect output",
        type: "quality",
        description: `Verify enchantments or durability on the crafted ${item} before delivery.`
      })
    );
  }

  steps.push(
    createStep({
      title: "Store output",
      type: "storage",
      description: `Place the crafted ${item} into the ${storage} and report quantity produced.`,
      metadata: { container: storage, quantity }
    })
  );

  // Calculate estimated duration using constants
  const ingredientCount = Array.isArray(ingredients) ? ingredients.length : 0;
  const additionalItems = Math.max(0, quantity - 1);
  const estimatedDuration = BASE_CRAFT_TIME_MS + ingredientCount * TIME_PER_INGREDIENT_MS + additionalItems * TIME_PER_ADDITIONAL_ITEM_MS;

  // Build resources list with proper null/undefined handling
  const resources = [item, station, storage]
    .concat(Array.isArray(ingredients) ? ingredients.map(ing => ing?.name).filter(Boolean) : [])
    .concat(Array.isArray(stationProfile?.fuelOptions) ? stationProfile.fuelOptions : [])
    .concat(stationProfile?.template ? [stationProfile.template] : [])
    .filter(Boolean);
  const uniqueResources = [...new Set(resources.filter(name => name && name !== "unspecified item"))];

  const risks = [];
  if (missingIngredients.length > 0) {
    risks.push("Insufficient ingredients could delay crafting.");
  }
  if (fuelStatus && !fuelStatus.hasFuel) {
    risks.push("Fuel reserves are low; gather additional fuel before processing.");
  }
  if (maintainMinimum && currentStock + quantity < maintainMinimum) {
    risks.push(`Even after crafting, stock may remain below minimum (${maintainMinimum}).`);
  }
  if (desiredStock && currentStock + quantity < desiredStock) {
    risks.push(`Plan crafts ${quantity}, still short of desired stock ${desiredStock}.`);
  }
  if (requiresAutomation) {
    risks.push("Autocrafter misconfiguration may waste materials.");
  }
  if (stationProfile.type === "anvil") {
    risks.push("Combining items may reduce anvil durability; prepare a backup anvil.");
  }
  if (stationProfile.type === "brewing") {
    risks.push("Brewing sequences are timing-sensitive; avoid swapping reagents mid-cycle.");
  }

  const notes = [];
  if (task?.metadata?.deliverTo) {
    notes.push(`Deliver finished items to ${task.metadata.deliverTo}.`);
  }
  if (task?.metadata?.recipeBook) {
    notes.push("Ensure the recipe book is unlocked for this item.");
  }
  if (task?.metadata?.upcomingUse) {
    notes.push(`Crafting supports upcoming need: ${task.metadata.upcomingUse}.`);
  }
  if (quantityReasons.length > 0) {
    notes.push(`Quantity rationale: ${quantityReasons.join("; ")}.`);
  }
  if (stationProfile.notes) {
    notes.push(stationProfile.notes);
  }
  if (fuelStatus && fuelStatus.fuelOptions?.length > 0) {
    notes.push(`Fuel options: ${fuelStatus.fuelOptions.join(", ")}; estimated need ${fuelStatus.fuelNeeded}.`);
  }

  return createPlan({
    task,
    summary: quantity > 1 ? `Craft ${quantity}x ${item} using the ${station}.` : `Craft ${item} using the ${station}.`,
    steps,
    estimatedDuration,
    resources: uniqueResources,
    risks,
    notes
  });
}
