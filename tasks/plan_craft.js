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
  const name = stationName || "";
  const fuelOptions = normalizeList(metadata.fuel || metadata.fuels || metadata.requiredFuel);

  if (name.includes("furnace") || name.includes("smoker")) {
    return {
      type: "smelting",
      verb: name.includes("smoker") ? "smoke" : "smelt",
      command: null,
      requiresFuel: true,
      fuelOptions: fuelOptions.length > 0 ? fuelOptions : ["coal", "charcoal", "logs"],
      itemsPerFuel: metadata.itemsPerFuel ? resolveQuantity(metadata.itemsPerFuel, 8) : 8,
      itemsPerOperation: metadata.itemsPerOperation ? resolveQuantity(metadata.itemsPerOperation, 1) : 1,
      postCollection: `Collect finished ${metadata.output || "items"} from the ${name}.`,
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
      fuelPerBatch: metadata.fuelPerBatch ? resolveQuantity(metadata.fuelPerBatch, 1) : 1,
      bottlesPerBatch: metadata.bottlesPerBatch ? resolveQuantity(metadata.bottlesPerBatch, 3) : 3,
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
      template: normalizeItemName(metadata.template || metadata.smithingTemplate),
      notes: "Ensure the smithing template and upgrade material are available before reforging."
    };
  }

  if (name.includes("anvil")) {
    return {
      type: "anvil",
      verb: "combine",
      command: null,
      requiresFuel: false,
      xpCost: resolveQuantity(metadata.xpCost, null),
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
    notes: metadata?.notes || null
  };
}

function parseIngredients(task) {
  const rawIngredients = Array.isArray(task?.metadata?.ingredients)
    ? task.metadata.ingredients
    : [];

  const normalized = rawIngredients
    .map(entry => {
      if (typeof entry === "string") {
        return { name: normalizeItemName(entry) };
      }
      if (entry && typeof entry === "object") {
        const name = normalizeItemName(entry.name || entry.item || entry.id);
        const count = resolveQuantity(entry.count ?? entry.quantity, null);
        return { name, count };
      }
      return null;
    })
    .filter(Boolean);

  if (normalized.length > 0) {
    return normalized;
  }

  if (task?.metadata?.recipe && typeof task.metadata.recipe === "object") {
    return Object.entries(task.metadata.recipe).map(([name, count]) => ({
      name: normalizeItemName(name),
      count: resolveQuantity(count, null)
    }));
  }

  const fallback = normalizeItemName(task?.metadata?.primaryIngredient || task?.details || "materials");
  return [{ name: fallback }];
}

export function planCraftTask(task, context = {}) {
  const item = normalizeItemName(task?.metadata?.item || task.details);
  const station = normalizeItemName(task?.metadata?.station || "crafting table");
  const storage = normalizeItemName(task?.metadata?.storage || task?.metadata?.dropOff || "nearest chest");
  const targetDescription = describeTarget(task.target);
  const requiresAutomation = Boolean(task?.metadata?.automation || task?.metadata?.autocrafter);
  const stationProfile = determineStationProfile(station, task?.metadata || {});

  const inventory = extractInventory(context);
  const currentStock = countInventoryItems(inventory, item);
  const baseQuantity = resolveQuantity(task?.metadata?.quantity ?? task?.metadata?.count, 1) || 1;
  const maintainMinimum = resolveQuantity(
    task?.metadata?.maintainMinimum ?? task?.metadata?.minStock ?? task?.metadata?.maintain,
    null
  );
  const desiredStock = resolveQuantity(
    task?.metadata?.desiredStock ?? task?.metadata?.targetStock ?? task?.metadata?.restockTarget,
    null
  );
  const buffer = resolveQuantity(task?.metadata?.buffer ?? task?.metadata?.extra ?? 0, 0) || 0;
  const exactQuantity = resolveQuantity(task?.metadata?.exactQuantity, null);

  let quantity = baseQuantity;
  const quantityReasons = [];

  if (maintainMinimum && currentStock < maintainMinimum) {
    const deficit = maintainMinimum - currentStock;
    quantity = Math.max(quantity, deficit);
    quantityReasons.push(`inventory below minimum (${currentStock}/${maintainMinimum})`);
  }

  if (desiredStock && currentStock + quantity < desiredStock) {
    const required = desiredStock - currentStock;
    quantity = Math.max(quantity, required);
    quantityReasons.push(`target stock of ${desiredStock} requires ${required}`);
  }

  if (buffer > 0) {
    quantity += buffer;
    quantityReasons.push(`include buffer of ${buffer}`);
  }

  if (exactQuantity && exactQuantity > 0) {
    quantity = exactQuantity;
    quantityReasons.push(`exact quantity override to ${exactQuantity}`);
  }

  if (!Number.isFinite(quantity) || quantity <= 0) {
    quantity = 1;
  }

  const ingredients = parseIngredients(task);
  const missingIngredients = ingredients.filter(ingredient => {
    if (!ingredient?.name || ingredient.name === "unspecified item") {
      return false;
    }
    if (ingredient.count && ingredient.count > 0) {
      return !hasInventoryItem(inventory, ingredient.name, ingredient.count * quantity);
    }
    return !hasInventoryItem(inventory, ingredient.name, quantity);
  });

  const ingredientSummary = formatRequirementList(
    ingredients.map(ing => ({ ...ing, count: ing.count ? ing.count * quantity : ing.count }))
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
    const itemsPerFuel = stationProfile.itemsPerFuel || 1;
    const perBatch = stationProfile.fuelPerBatch || 1;
    const operationsNeeded = Math.max(1, Math.ceil((quantity * (stationProfile.itemsPerOperation || 1)) / itemsPerFuel));
    const fuelNeeded = Math.max(perBatch, operationsNeeded);
    const fuelOptions = stationProfile.fuelOptions || [];
    const hasFuel = fuelOptions.some(option => hasInventoryItem(inventory, option, fuelNeeded));
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
      const bottlesNeeded = Math.max(1, Math.ceil(quantity / (stationProfile.bottlesPerBatch || 3)) * (stationProfile.bottlesPerBatch || 3));
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

  const estimatedDuration = 8000 + ingredients.length * 1500 + Math.max(0, quantity - 1) * 1200;
  const resources = [item, station, storage]
    .concat(ingredients.map(ing => ing.name))
    .concat(stationProfile?.fuelOptions || [])
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
