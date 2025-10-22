// tasks/plan_combat.js
// Planning logic for combat engagements

import {
  createPlan,
  createStep,
  describeTarget,
  normalizeItemName,
  extractInventory,
  hasInventoryItem,
  formatRequirementList,
  resolveQuantity
} from "./helpers.js";

function formatDisplayName(name) {
  if (!name) {
    return "Unknown";
  }
  return name
    .split(" ")
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function normalizeOptionalName(value) {
  const normalized = normalizeItemName(value);
  return normalized === "unspecified item" ? "" : normalized;
}

function formatList(values = []) {
  if (!Array.isArray(values) || values.length === 0) {
    return "";
  }
  if (values.length === 1) {
    return values[0];
  }
  const last = values[values.length - 1];
  return `${values.slice(0, -1).join(", ")} and ${last}`;
}

const enemyProfiles = {
  "charged creeper": {
    priority: 1,
    reason: "Explosion is instantly lethal in close quarters.",
    dodge: "Pepper with ranged attacks and retreat before detonation.",
    risk: "Charged creeper blast radius will obliterate armor and terrain."
  },
  creeper: {
    priority: 1,
    reason: "Explodes for massive burst damage.",
    dodge: "Keep 6-block distance, strike, then backpedal to avoid the fuse.",
    risk: "Explosion can be fatal and destroy nearby structures."
  },
  "wither skeleton": {
    priority: 1,
    reason: "Inflicts wither effect and high melee damage.",
    dodge: "Use shield blocks and strafe to avoid their sweeping attacks.",
    risk: "Wither effect drains health rapidly if multiple hits land."
  },
  ghast: {
    priority: 1,
    reason: "Fireballs deal splash damage and knockback over voids.",
    dodge: "Strafe laterally and reflect fireballs with melee swings or arrows.",
    risk: "Fireball knockback can throw you into lava or off ledges."
  },
  evoker: {
    priority: 1,
    reason: "Summons vex and fang attacks if left alive.",
    dodge: "Close distance quickly, circle around fangs, and burst them down.",
    risk: "Vex summons overwhelm unprepared fighters quickly."
  },
  blaze: {
    priority: 2,
    reason: "Ranged fireballs ignite and stagger combatants.",
    dodge: "Strafe between fireball volleys and use cover while closing in.",
    risk: "Sustained fire damage requires fire resistance or constant dodging."
  },
  "cave spider": {
    priority: 2,
    reason: "Applies poison on hit and moves unpredictably.",
    dodge: "Block tunnel entries and backstep during leap attacks.",
    risk: "Poison stacks can be lethal without milk or regeneration."
  },
  "enderman": {
    priority: 2,
    reason: "High damage teleporting strikes once provoked.",
    dodge: "Fight under a two-block shelter and avoid prolonged eye contact.",
    risk: "Teleporting hits bypass shields if player is exposed."
  },
  "wither": {
    priority: 1,
    reason: "Boss-level destruction and wither skull projectiles.",
    dodge: "Use cover to block skulls, strafe constantly, and drink milk to clear wither.",
    risk: "Wither explosions devastate terrain and health rapidly."
  },
  "elder guardian": {
    priority: 1,
    reason: "Mining fatigue beams hinder escape and combat.",
    dodge: "Break line of sight behind blocks to interrupt the laser.",
    risk: "Mining fatigue prevents quick retreat or potion brewing underwater."
  },
  "guardian": {
    priority: 2,
    reason: "High ranged laser damage underwater.",
    dodge: "Use cover pillars to reset laser charge and strafe underwater.",
    risk: "Continuous beam damage stacks quickly without cover."
  },
  skeleton: {
    priority: 2,
    reason: "Accurate ranged attacks chip health from afar.",
    dodge: "Strafe side-to-side and close the gap to disable bow fire.",
    risk: "Arrow fire can knock you into hazards if ignored."
  },
  pillager: {
    priority: 2,
    reason: "Crossbow bolts penetrate shields when reloading.",
    dodge: "Use shield timing and strafe between reloads to flank them.",
    risk: "Bolts cause heavy knockback when fired in volleys."
  },
  vindicator: {
    priority: 2,
    reason: "Axe swings ignore shields and deal burst damage.",
    dodge: "Backstep out of swing range, then counterattack while they recover.",
    risk: "Shield-ignoring axes can drop health fast at close range."
  },
  witch: {
    priority: 1,
    reason: "Throws harmful splash potions and self-heals.",
    dodge: "Approach in zigzags to avoid potions and burst with melee or arrows.",
    risk: "Lingering poison and weakness potions prolong fights dangerously."
  },
  ravager: {
    priority: 1,
    reason: "Massive charge attacks break defenses and deal heavy damage.",
    dodge: "Side-step charges and attack from the flanks after it lunges.",
    risk: "Charge knockback can launch fighters into hazards."
  },
  spider: {
    priority: 3,
    reason: "Fast leaps can interrupt positioning.",
    dodge: "Maintain vertical advantage or backpedal during leap windup.",
    risk: "Leap knockback can push you off ledges in caves."
  },
  zombie: {
    priority: 4,
    reason: "Slow melee threat but swarms overwhelm.",
    dodge: "Kite backwards, using knockback to keep distance from the group.",
    risk: "Large packs can corner you if spacing is lost."
  },
  husk: {
    priority: 3,
    reason: "Applies hunger effect on hit.",
    dodge: "Circle strafe to avoid swing range and counter when exposed.",
    risk: "Hunger drains food, reducing regeneration mid-fight."
  },
  drowned: {
    priority: 3,
    reason: "Can throw tridents for burst ranged damage.",
    dodge: "Dive under trident arcs and close distance quickly when they throw.",
    risk: "Trident hits can be lethal without armor."
  },
  "stray": {
    priority: 2,
    reason: "Applies slowness arrows making dodging harder.",
    dodge: "Use cover and shields, then rush before additional arrows land.",
    risk: "Slowness makes retreat difficult in open biomes."
  },
  "hoglin": {
    priority: 2,
    reason: "Charges deal high knockback and damage.",
    dodge: "Sidestep charges and counterattack while it recoils.",
    risk: "Knockback can send you into lava in the Nether."
  },
  "piglin brute": {
    priority: 1,
    reason: "Massive melee damage without cooldown.",
    dodge: "Use shields and sprint strafe to avoid consecutive hits.",
    risk: "Two hits can defeat even armored fighters."
  },
  "zoglin": {
    priority: 2,
    reason: "Aggressive knockback even to armored players.",
    dodge: "Circle strafe and strike after it lunges past you.",
    risk: "Knockback can cause fall damage or lava spills."
  },
  "phantom": {
    priority: 3,
    reason: "Aerial dives harass from above when sleep deprived.",
    dodge: "Look up and strafe when they swoop, striking during their dive path.",
    risk: "Repeated dives add chip damage while other threats engage."
  }
};

const defaultEnemyProfile = {
  priority: 4,
  reason: "Standard hostile threat—monitor but lower urgency.",
  dodge: "Circle strafe to reduce incoming hits and retreat if pressure mounts.",
  risk: "Unknown enemy behavior—remain alert for special attacks."
};

const enemyCountermeasures = {
  "charged creeper": ["blast protection armor", "bow"],
  creeper: ["blast protection armor", "shield"],
  "wither skeleton": ["milk bucket", "smite sword"],
  ghast: ["bow", "fire resistance potion"],
  evoker: ["milk bucket", "bow"],
  blaze: ["fire resistance potion", "bow"],
  "cave spider": ["milk bucket", "instant health potion"],
  enderman: ["pumpkin helmet", "looting sword"],
  wither: ["milk bucket", "regeneration potion", "smite sword"],
  "elder guardian": ["water breathing potion", "milk bucket", "doors"],
  guardian: ["depth strider boots", "water breathing potion", "doors"],
  skeleton: ["shield", "projectile protection armor"],
  pillager: ["shield", "projectile protection armor"],
  vindicator: ["shield", "strength potion"],
  witch: ["milk bucket", "instant health potion"],
  ravager: ["shield", "strength potion"],
  spider: ["sweeping edge sword"],
  zombie: ["smite sword"],
  husk: ["milk bucket"],
  drowned: ["shield", "respiration helmet"],
  stray: ["shield", "milk bucket"],
  hoglin: ["fire resistance potion", "shield"],
  "piglin brute": ["netherite armor", "shield"],
  zoglin: ["shield", "feather falling boots"],
  phantom: ["bow", "slow falling potion"]
};

const stanceProfiles = {
  aggressive: {
    name: "aggressive",
    description: "Lead the charge and overwhelm targets with burst damage while keeping momentum.",
    engagementDistance: "close-range pressure within 2-3 blocks",
    weaponPreference: {
      primary: "axe",
      secondary: "shield",
      extras: ["sword"]
    },
    squadAdvice: "Point leader rushes the highest priority threat while allies collapse from both flanks."
  },
  defensive: {
    name: "defensive",
    description: "Hold ground with shield blocks and controlled counterattacks to mitigate incoming damage.",
    engagementDistance: "tight formation within 3-4 blocks of allies",
    weaponPreference: {
      primary: "sword",
      secondary: "shield",
      extras: ["totem of undying"]
    },
    squadAdvice: "Leader anchors the line; flankers focus on intercepting threats targeting the backline."
  },
  guard: {
    name: "guard",
    description: "Protect objectives by rotating between chokepoints and intercepting attackers before they breach.",
    engagementDistance: "mid-range control between 4-5 blocks",
    weaponPreference: {
      primary: "sword",
      secondary: "shield",
      extras: ["crossbow"]
    },
    squadAdvice: "Leader calls rotations; one ally watches rear arcs while another provides cover fire."
  },
  ranged: {
    name: "ranged",
    description: "Keep distance and wear down enemies with arrows or crossbow bolts while kiting.",
    engagementDistance: "standoff range at 6-10 blocks",
    weaponPreference: {
      primary: "bow",
      secondary: "sword",
      extras: ["crossbow"]
    },
    squadAdvice: "Leader tags targets; flankers push to create crossfire while support maintains cover fire."
  },
  stealth: {
    name: "stealth",
    description: "Approach unseen, strike from cover, then disengage before the enemy can respond.",
    engagementDistance: "ambush range within 4 blocks from concealment",
    weaponPreference: {
      primary: "sword",
      secondary: "bow",
      extras: ["potion of invisibility"]
    },
    squadAdvice: "Leader signals synchronized strikes while allies cut off escape paths quietly."
  }
};

const environmentProfiles = [
  {
    matches: env => env.includes("nether"),
    description: "Use fireproof blocks for cover and keep fire resistance active while avoiding lava edges.",
    hazards: ["Lava pools, fire damage, and narrow ledges increase knockback danger."],
    counterItems: ["fire resistance potion"]
  },
  {
    matches: env => env.includes("ocean") || env.includes("underwater") || env.includes("sea"),
    description: "Maintain water breathing and night vision while using blocks or doors to reset guardian lasers.",
    hazards: ["Limited mobility and drowning risk if respiration expires."],
    counterItems: ["water breathing potion", "doors", "night vision potion"]
  },
  {
    matches: env => env.includes("end"),
    description: "Place water buckets or scaffolding to prevent void falls and keep slow falling active when near ledges.",
    hazards: ["Void falls are lethal and endermen aggro easily on open platforms."],
    counterItems: ["slow falling potion", "water bucket"]
  },
  {
    matches: env => env.includes("cave") || env.includes("ravine") || env.includes("mine"),
    description: "Light choke points, clear drop hazards, and fight from secure tunnels to avoid surprise attacks.",
    hazards: ["Low visibility and uneven terrain enable ambushes."],
    counterItems: ["torches", "blocks"]
  }
];

export function planCombatTask(task, context = {}) {
  const target = normalizeItemName(task?.metadata?.targetEntity || task.details || "hostile mob");
  const targetDescription = describeTarget(task.target);
  const backupPlan = normalizeItemName(task?.metadata?.fallback || "retreat to base");
  const tactic = normalizeItemName(task?.metadata?.tactic || "melee");
  const enemyCount = resolveQuantity(task?.metadata?.count ?? task?.metadata?.enemyCount, 1) || 1;
  const support = normalizeOptionalName(task?.metadata?.support || "");
  const environment = normalizeItemName(task?.metadata?.environment || context?.environment || "overworld");
  const timeOfDay = normalizeOptionalName(task?.metadata?.timeOfDay || context?.timeOfDay);
  const weather = normalizeOptionalName(task?.metadata?.weather || context?.weather);
  const stanceKey = normalizeOptionalName(
    task?.metadata?.stance ||
    context?.npc?.stance ||
    context?.stance ||
    (tactic.includes("ranged") ? "ranged" : "guard")
  ) || "guard";
  const stanceProfile = stanceProfiles[stanceKey] || stanceProfiles.guard;
  const squadMembersRaw = Array.isArray(task?.metadata?.squadMembers)
    ? task.metadata.squadMembers
    : Array.isArray(task?.metadata?.squad)
    ? task.metadata.squad
    : Array.isArray(task?.metadata?.team)
    ? task.metadata.team
    : [];
  const squadMembers = squadMembersRaw
    .map(entry => {
      if (!entry) {
        return null;
      }
      if (typeof entry === "string") {
        return entry;
      }
      if (typeof entry === "object") {
        return entry.name || entry.label || entry.id || entry.role || null;
      }
      return null;
    })
    .filter(Boolean);
  const squadDisplayNames = squadMembers.map(formatDisplayName);
  const explicitLeaderName = task?.metadata?.squadLeader || task?.metadata?.leader;
  const squadLeaderName = explicitLeaderName
    ? formatDisplayName(explicitLeaderName)
    : squadDisplayNames[0] || (support ? formatDisplayName(support) : "");
  const flankers = squadDisplayNames.slice(1, 3);
  const coverMembers = squadDisplayNames.slice(3);
  const additionalTargets = [];

  if (Array.isArray(task?.metadata?.enemyTypes)) {
    additionalTargets.push(...task.metadata.enemyTypes.map(normalizeItemName));
  }
  if (Array.isArray(task?.metadata?.additionalHostiles)) {
    additionalTargets.push(...task.metadata.additionalHostiles.map(normalizeItemName));
  }
  if (typeof task?.metadata?.secondaryTarget === "string") {
    additionalTargets.push(normalizeItemName(task.metadata.secondaryTarget));
  }

  const enemyTypes = [...new Set([target, ...additionalTargets].filter(Boolean))];
  const enemyDetails = enemyTypes.map(name => ({
    name,
    displayName: formatDisplayName(name),
    ...(enemyProfiles[name] || defaultEnemyProfile)
  }));

  const explicitPriority = Array.isArray(task?.metadata?.priorityTargets)
    ? task.metadata.priorityTargets.map(normalizeItemName).filter(Boolean)
    : [];

  const explicitSet = new Set(explicitPriority);
  const explicitDetails = explicitPriority
    .map(name => enemyDetails.find(detail => detail.name === name) || {
      name,
      displayName: formatDisplayName(name),
      ...defaultEnemyProfile
    });

  const remainingEnemies = enemyDetails.filter(detail => !explicitSet.has(detail.name));

  const prioritizedEnemies = [
    ...explicitDetails,
    ...remainingEnemies.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      return a.displayName.localeCompare(b.displayName);
    })
  ];

  const priorityDescription = prioritizedEnemies.length > 1
    ? prioritizedEnemies
        .map((detail, index) => `${index + 1}. ${detail.displayName} - ${detail.reason}`)
        .join("; ")
    : `Focus on eliminating ${prioritizedEnemies[0]?.displayName || formatDisplayName(target)} quickly.`;

  const dodgeAdviceList = prioritizedEnemies.map(detail => ({
    enemy: detail.displayName,
    dodge: detail.dodge
  }));

  const dodgeDescription = dodgeAdviceList.length > 0
    ? dodgeAdviceList
        .map(entry => `${entry.enemy}: ${entry.dodge}`)
        .join(" ")
    : "Maintain spacing, strafe, and disengage if health drops critically.";

  const recommendedCounterItems = new Set();

  enemyTypes.forEach(name => {
    const counters = enemyCountermeasures[name];
    if (Array.isArray(counters)) {
      counters.forEach(item => {
        const normalized = normalizeItemName(item);
        if (normalized && normalized !== "unspecified item") {
          recommendedCounterItems.add(normalized);
        }
      });
    }
  });

  const environmentProfile = environmentProfiles.find(profile => {
    try {
      return profile.matches(environment);
    } catch (error) {
      return false;
    }
  });

  if (environmentProfile?.counterItems) {
    environmentProfile.counterItems.forEach(item => {
      const normalized = normalizeItemName(item);
      if (normalized && normalized !== "unspecified item") {
        recommendedCounterItems.add(normalized);
      }
    });
  }

  const stanceWeaponPreference = stanceProfile?.weaponPreference || {};
  const stanceExtras = Array.isArray(stanceWeaponPreference.extras)
    ? stanceWeaponPreference.extras.map(normalizeOptionalName).filter(Boolean)
    : [];

  const primaryWeapon = normalizeOptionalName(
    task?.metadata?.primaryWeapon ||
      stanceWeaponPreference.primary ||
      (tactic.includes("ranged") ? "bow" : "sword")
  );
  const secondaryWeapon = normalizeOptionalName(
    task?.metadata?.secondaryWeapon ||
      stanceWeaponPreference.secondary ||
      (tactic.includes("shield") ? "shield" : "")
  );

  const requiredEquipment = [primaryWeapon, secondaryWeapon, "armor", ...stanceExtras].filter(Boolean);
  const stanceWeaponsDisplay = [primaryWeapon, secondaryWeapon, ...stanceExtras]
    .filter(Boolean)
    .map(formatDisplayName);

  const potions = Array.isArray(task?.metadata?.potions)
    ? task.metadata.potions.map(normalizeItemName)
    : task?.metadata?.potions
    ? [normalizeItemName(task.metadata.potions)]
    : [];

  const inventory = extractInventory(context);
  const missingEquipment = requiredEquipment.filter(item => !hasInventoryItem(inventory, item));
  const missingPotions = potions.filter(item => !hasInventoryItem(inventory, item));
  const counterItems = Array.from(recommendedCounterItems);
  const missingCounterItems = counterItems.filter(item => !hasInventoryItem(inventory, item));
  const missingPotionsSummary = formatRequirementList(missingPotions);
  const counterItemsSummary = formatRequirementList(counterItems);

  const steps = [];

  const missingEquipmentSummary = formatRequirementList(missingEquipment);
  const prepareDescription = missingEquipment.length > 0
    ? missingEquipmentSummary
      ? `Acquire combat gear (${missingEquipmentSummary}) and equip before engaging ${target}.`
      : `Acquire necessary combat gear and equip before engaging ${target}.`
    : `Equip enchanted weapons, shields, armor, and carry potions or golden apples before engaging ${target}.`;

  steps.push(
    createStep({
      title: "Prepare",
      type: "preparation",
      description: prepareDescription,
      metadata: { equipment: requiredEquipment, missing: missingEquipment }
    })
  );

  if (potions.length > 0) {
    steps.push(
      createStep({
        title: "Buff up",
        type: "preparation",
        description:
          missingPotions.length > 0
            ? missingPotionsSummary
              ? `Brew or retrieve potions (${missingPotionsSummary}) prior to combat.`
              : "Brew or retrieve potions prior to combat."
            : `Consume or carry potions (${potions.join(", ")}) to gain advantages.`,
        metadata: { potions, missing: missingPotions }
      })
    );
  }

  if (task?.metadata?.traps) {
    steps.push(
      createStep({
        title: "Set traps",
        type: "preparation",
        description: `Deploy traps or defensive structures before provoking ${target}.`,
        metadata: { traps: task.metadata.traps }
      })
    );
  }

  if (counterItems.length > 0) {
    steps.push(
      createStep({
        title: "Prepare countermeasures",
        type: "preparation",
        description:
          missingCounterItems.length > 0
            ? counterItemsSummary
              ? `Secure specialized countermeasures (${counterItemsSummary}) before engaging.`
              : "Secure specialized countermeasures before engaging."
            : `Equip specialized countermeasures (${counterItemsSummary}) to neutralize enemy abilities.`,
        metadata: { counterItems, missing: missingCounterItems }
      })
    );
  }

  if (prioritizedEnemies.length > 0) {
    steps.push(
      createStep({
        title: "Prioritize threats",
        type: "strategy",
        description: priorityDescription,
        metadata: {
          priority: prioritizedEnemies.map(detail => ({
            enemy: detail.displayName,
            priority: detail.priority,
            reason: detail.reason
          }))
        }
      })
    );
  }

  if (dodgeAdviceList.length > 0) {
    steps.push(
      createStep({
        title: "Position and dodge",
        type: "maneuver",
        description: dodgeDescription,
        metadata: { dodges: dodgeAdviceList }
      })
    );
  }

  if (stanceProfile?.description) {
    const stanceDescriptionParts = [
      `${formatDisplayName(stanceProfile.name)} stance: ${stanceProfile.description}`
    ];
    if (stanceProfile.engagementDistance) {
      stanceDescriptionParts.push(`Maintain ${stanceProfile.engagementDistance}.`);
    }
    if (stanceWeaponsDisplay.length > 0) {
      stanceDescriptionParts.push(`Favor ${formatList(stanceWeaponsDisplay)} for primary damage.`);
    }
    if (stanceProfile.squadAdvice) {
      stanceDescriptionParts.push(stanceProfile.squadAdvice);
    }

    steps.push(
      createStep({
        title: "Adopt stance",
        type: "strategy",
        description: stanceDescriptionParts.join(" "),
        metadata: {
          stance: stanceProfile.name,
          engagementDistance: stanceProfile.engagementDistance,
          preferredWeapons: {
            primary: primaryWeapon,
            secondary: secondaryWeapon,
            extras: stanceExtras
          }
        }
      })
    );
  }

  const engageDescriptionParts = [
    `Engage ${target} near ${targetDescription} using ${tactic} tactics while maintaining spacing to avoid damage.`
  ];

  if (prioritizedEnemies.length > 1) {
    engageDescriptionParts.push(
      `Eliminate threats following the priority order: ${prioritizedEnemies
        .map(detail => detail.displayName)
        .join(", ")}.`
    );
  }

  if (stanceProfile?.engagementDistance) {
    engageDescriptionParts.push(`Maintain ${stanceProfile.engagementDistance} as part of the ${formatDisplayName(stanceProfile.name)} stance.`);
  }
  if (stanceWeaponsDisplay.length > 0) {
    engageDescriptionParts.push(`Keep ${formatList(stanceWeaponsDisplay)} ready for focus targets.`);
  }

  const conditionAdvice = [];
  if (timeOfDay === "night") {
    conditionAdvice.push("Night visibility is low—carry torches and leverage shields against surprise hits.");
  }
  if (timeOfDay === "night" && enemyTypes.includes("skeleton")) {
    conditionAdvice.push("Avoid trading open-field shots with skeletons at night; pull them into cover or wait for dawn.");
  }
  if (timeOfDay === "day" && enemyTypes.includes("zombie")) {
    conditionAdvice.push("Use daylight to weaken zombies in exposed areas when possible.");
  }
  if (weather.includes("storm") || weather.includes("thunder")) {
    conditionAdvice.push("Thunderstorms spawn extra mobs and can trigger charged creepers—limit time in open terrain.");
  }
  if (weather.includes("rain") && enemyTypes.includes("blaze")) {
    conditionAdvice.push("Rain hampers blaze fireballs—fight them outdoors to capitalize on the weather.");
  }

  if (conditionAdvice.length > 0) {
    steps.push(
      createStep({
        title: "Adapt to conditions",
        type: "awareness",
        description: conditionAdvice.join(" "),
        metadata: { timeOfDay, weather }
      })
    );
  }

  if (squadLeaderName || squadDisplayNames.length > 0) {
    const squadDescriptionParts = [];
    if (squadLeaderName) {
      squadDescriptionParts.push(`Designate ${squadLeaderName} as squad lead to call focus targets.`);
    }
    if (flankers.length > 0) {
      squadDescriptionParts.push(`${formatList(flankers)} flank to collapse hostile attention.`);
    }
    if (coverMembers.length > 0) {
      squadDescriptionParts.push(`${formatList(coverMembers)} provide overwatch and cover fire.`);
    }
    if (!stanceProfile.squadAdvice && squadDescriptionParts.length === 0) {
      squadDescriptionParts.push("Coordinate roles to maintain pressure on the primary target.");
    }
    squadDescriptionParts.push("Sync callouts using Collab Engine tactics for focus fire and retreats.");

    steps.push(
      createStep({
        title: "Coordinate squad",
        type: "coordination",
        description: squadDescriptionParts.join(" "),
        metadata: {
          leader: squadLeaderName,
          flankers,
          cover: coverMembers,
          squad: squadDisplayNames,
          stance: stanceProfile.name
        }
      })
    );
  }

  if (environmentProfile?.description) {
    steps.push(
      createStep({
        title: "Control the battlefield",
        type: "maneuver",
        description: environmentProfile.description,
        metadata: {
          environment,
          hazards: environmentProfile.hazards || [],
          counterItems: environmentProfile.counterItems
            ? environmentProfile.counterItems.map(normalizeItemName)
            : []
        }
      })
    );
  }

  steps.push(
    createStep({
      title: "Engage",
      type: "action",
      description: engageDescriptionParts.join(" "),
      metadata: {
        enemyCount,
        tactic,
        priorityOrder: prioritizedEnemies.map(detail => detail.displayName)
      }
    })
  );

  if (support) {
    const supportDisplay = formatDisplayName(support);
    steps.push(
      createStep({
        title: "Coordinate support",
        type: "communication",
        description: `Coordinate with ${supportDisplay} for focus fire or healing as needed.`,
        metadata: { support: supportDisplay }
      })
    );
  }

  steps.push(
    createStep({
      title: "Secure area",
      type: "cleanup",
      description: `Light up surroundings, eliminate remaining threats, and collect drops from ${target}.`
    })
  );

  steps.push(
    createStep({
      title: "Fallback plan",
      type: "contingency",
      description: `If overwhelmed, ${backupPlan} and regroup before another attempt.`,
      metadata: { fallback: backupPlan }
    })
  );

  const estimatedDuration = 9000 + enemyCount * 1200;
  const resources = [
    ...new Set(
      [
        ...requiredEquipment,
        ...potions,
        ...counterItems,
        ...prioritizedEnemies.map(detail => detail.displayName.toLowerCase()),
        target,
        support
      ].filter(name => name && name !== "unspecified item")
    )
  ];

  const risks = [];
  if (missingEquipment.length > 0) {
    risks.push("Missing equipment could reduce combat effectiveness.");
  }
  if (enemyCount > 3) {
    risks.push("Multiple hostiles present—expect extended fight.");
  }
  if (environment.includes("nether")) {
    risks.push("Fire and lava hazards require resistance.");
  }
  if (timeOfDay === "night") {
    risks.push("Nighttime reduces visibility and increases hostile spawn rates.");
  }
  if (weather.includes("storm") || weather.includes("thunder")) {
    risks.push("Thunderstorms may summon charged creepers and lightning strikes.");
  } else if (weather.includes("rain")) {
    risks.push("Rain reduces visibility and can slow movement on uneven terrain.");
  }
  if (stanceKey === "aggressive") {
    risks.push("Aggressive stance exposes the leader to burst damage if support lags.");
  }
  if (stanceKey === "stealth") {
    risks.push("Breaking stealth early will forfeit the ambush advantage.");
  }
  if (missingCounterItems.length > 0) {
    risks.push("Missing specialized countermeasures leaves you vulnerable to unique enemy abilities.");
  }
  prioritizedEnemies.forEach(detail => {
    if (detail.risk && !risks.includes(detail.risk)) {
      risks.push(detail.risk);
    }
  });
  if (environmentProfile?.hazards) {
    environmentProfile.hazards.forEach(hazard => {
      if (!risks.includes(hazard)) {
        risks.push(hazard);
      }
    });
  }

  const notes = [];
  if (task?.metadata?.lootPriority) {
    notes.push(`Collect priority loot: ${task.metadata.lootPriority}.`);
  }
  if (task?.metadata?.spawnControl) {
    notes.push(`Disable spawner at ${describeTarget(task.metadata.spawnControl)} if possible.`);
  }
  if (environmentProfile?.description) {
    const battlefieldNote = `Battlefield control guidance: ${environmentProfile.description}`;
    if (!notes.includes(battlefieldNote)) {
      notes.push(battlefieldNote);
    }
  }
  if (timeOfDay) {
    const timeNote = `Time of day: ${formatDisplayName(timeOfDay)}.`;
    if (!notes.includes(timeNote)) {
      notes.push(timeNote);
    }
  }
  if (weather) {
    const weatherNote = `Weather: ${formatDisplayName(weather)}.`;
    if (!notes.includes(weatherNote)) {
      notes.push(weatherNote);
    }
  }
  if (squadDisplayNames.length > 0) {
    const squadNoteParts = [];
    if (squadLeaderName) {
      squadNoteParts.push(`Lead: ${squadLeaderName}`);
    }
    if (flankers.length > 0) {
      squadNoteParts.push(`Flankers: ${formatList(flankers)}`);
    }
    if (coverMembers.length > 0) {
      squadNoteParts.push(`Cover: ${formatList(coverMembers)}`);
    }
    const squadNote = `Squad roles (${formatDisplayName(stanceProfile.name)} stance): ${squadNoteParts.join("; ")}.`;
    if (!notes.includes(squadNote)) {
      notes.push(squadNote);
    }
  }

  return createPlan({
    task,
    summary: `Defeat ${target} near ${targetDescription}.`,
    steps,
    estimatedDuration,
    resources,
    risks,
    notes
  });
}
