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

const enemyWeaponMatchups = [
  {
    enemies: ["zombie", "husk", "drowned", "skeleton", "stray", "wither skeleton", "wither"],
    weapon: "smite sword",
    reason: "Smite enchantments amplify damage to undead foes."
  },
  {
    enemies: ["spider", "cave spider"],
    weapon: "bane of arthropods sword",
    reason: "Bane of Arthropods slows and bursts spider mobs."
  },
  {
    enemies: ["creeper", "charged creeper"],
    weapon: "bow",
    reason: "Ranged focus avoids blast radius while detonating creepers safely."
  },
  {
    enemies: ["blaze", "ghast"],
    weapon: "power bow",
    reason: "Strong bows counter airborne fire mobs from range."
  },
  {
    enemies: ["guardian", "elder guardian"],
    weapon: "impaling trident",
    reason: "Impaling tridents shred aquatic guardians underwater."
  },
  {
    enemies: ["ravager", "piglin brute", "zoglin", "hoglin"],
    weapon: "netherite axe",
    reason: "High damage axes break through armored brutes quickly."
  },
  {
    enemies: ["phantom"],
    weapon: "crossbow",
    reason: "Crossbows pierce swooping phantoms during flight."
  }
];

const squadRoleProfiles = {
  leader: {
    summary: "Calls focus targets, synchronizes stance swaps, and keeps formation centered.",
    defaultSpacing: "midline with line of sight to every member"
  },
  tank: {
    summary: "Holds aggro up close, shielding allies and pinning priority mobs.",
    defaultSpacing: "front rank within shield bash range"
  },
  dps: {
    summary: "Maintains pressure on priority targets and pivots to new threats on command.",
    defaultSpacing: "offset flank providing burst windows"
  },
  healer: {
    summary: "Keeps regeneration, potions, or totems ready and calls for retreats when healing cooldowns lapse.",
    defaultSpacing: "protected backline within 5 blocks of tank"
  },
  scout: {
    summary: "Screens for reinforcements, marks hazards, and intercepts flankers.",
    defaultSpacing: "wide arcs 6-8 blocks out to spot ambushes"
  }
};

function normalizeWeatherValue(value) {
  if (!value || typeof value !== "string") {
    return "";
  }
  return value.toLowerCase();
}

function determineWeaponRecommendations({ enemyTypes = [], inventory = [], stanceProfile, tactic = "", traits = {}, basePrimary, baseSecondary }) {
  const normalizedEnemies = enemyTypes.map(name => normalizeItemName(name));
  const matches = [];
  const recommendedWeapons = new Set();
  const availableCheck = weaponName => (weaponName ? hasInventoryItem(inventory, weaponName) : false);

  enemyWeaponMatchups.forEach(matchup => {
    const hits = normalizedEnemies.filter(name => matchup.enemies.includes(name));
    if (hits.length > 0) {
      const weapon = normalizeOptionalName(matchup.weapon);
      if (weapon) {
        recommendedWeapons.add(weapon);
        matches.push({
          weapon,
          enemies: hits,
          reason: matchup.reason,
          available: availableCheck(weapon)
        });
      }
    }
  });

  const aggression = typeof traits?.aggression === "number" ? traits.aggression : 0.3;
  const preferMelee = !tactic.includes("ranged") && (stanceProfile?.name !== "ranged");

  let primary = normalizeOptionalName(basePrimary);
  let secondary = normalizeOptionalName(baseSecondary);

  if (matches.length > 0) {
    const priorityMatch = matches.find(entry => entry.available) || matches[0];
    if (priorityMatch?.weapon) {
      primary = priorityMatch.weapon;
    }
  }

  if (!primary) {
    if (!preferMelee) {
      primary = "bow";
    } else {
      primary = aggression > 0.6 ? "axe" : "sword";
    }
  }

  if (!secondary) {
    secondary = preferMelee ? (aggression > 0.6 ? "sword" : "shield") : "sword";
  }

  if (primary) {
    recommendedWeapons.add(primary);
  }
  if (secondary) {
    recommendedWeapons.add(secondary);
  }

  return {
    primary,
    secondary,
    loadout: Array.from(recommendedWeapons),
    matches
  };
}

function assignSquadRoles(squadMembers = [], metadataRoles = null, defaultLeader = "") {
  if (squadMembers.length === 0) {
    return [];
  }

  const desiredOrder = ["leader", "tank", "dps", "healer", "scout"];
  const parsedAssignments = new Map();

  if (metadataRoles) {
    if (Array.isArray(metadataRoles)) {
      metadataRoles.forEach(entry => {
        if (entry && typeof entry === "object") {
          const name = formatDisplayName(entry.name || entry.npc || entry.member);
          const role = normalizeOptionalName(entry.role);
          if (name && role) {
            parsedAssignments.set(name, role);
          }
        } else if (typeof entry === "string") {
          const [namePart, rolePart] = entry.split(":");
          const name = formatDisplayName(namePart);
          const role = normalizeOptionalName(rolePart);
          if (name && role) {
            parsedAssignments.set(name, role);
          }
        }
      });
    } else if (typeof metadataRoles === "object") {
      Object.entries(metadataRoles).forEach(([nameKey, roleValue]) => {
        const name = formatDisplayName(nameKey);
        const role = normalizeOptionalName(roleValue);
        if (name && role) {
          parsedAssignments.set(name, role);
        }
      });
    }
  }

  const assigned = [];
  const remainingRoles = new Set(desiredOrder);

  squadMembers.forEach(member => {
    const formattedName = formatDisplayName(member);
    if (!formattedName) {
      return;
    }
    const explicitRole = parsedAssignments.get(formattedName);
    if (explicitRole && squadRoleProfiles[explicitRole]) {
      assigned.push({ name: formattedName, role: explicitRole });
      remainingRoles.delete(explicitRole);
    }
  });

  if (defaultLeader) {
    const leaderName = formatDisplayName(defaultLeader);
    const alreadyLeader = assigned.find(entry => entry.role === "leader");
    if (!alreadyLeader && leaderName) {
      const targetMember = assigned.find(entry => entry.name === leaderName);
      if (targetMember) {
        targetMember.role = "leader";
        remainingRoles.delete("leader");
      } else if (squadMembers.includes(defaultLeader)) {
        assigned.push({ name: leaderName, role: "leader" });
        remainingRoles.delete("leader");
      }
    }
  }

  squadMembers.forEach(member => {
    const formattedName = formatDisplayName(member);
    if (!formattedName) {
      return;
    }
    const alreadyAssigned = assigned.find(entry => entry.name === formattedName);
    if (alreadyAssigned) {
      return;
    }
    const nextRole = desiredOrder.find(role => remainingRoles.has(role));
    if (nextRole) {
      assigned.push({ name: formattedName, role: nextRole });
      remainingRoles.delete(nextRole);
    } else {
      assigned.push({ name: formattedName, role: "support" });
    }
  });

  return assigned.map(entry => {
    const profile = squadRoleProfiles[entry.role];
    return {
      ...entry,
      summary: profile?.summary || "Provides support as needed.",
      spacing: profile?.defaultSpacing || "maintain flexible positioning"
    };
  });
}

function extractDurabilityEntries(context = {}) {
  const pools = [
    context?.bridgeState?.equipmentDurability,
    context?.bridgeState?.durability,
    context?.npc?.equipmentDurability,
    context?.npc?.durability,
    context?.equipmentDurability
  ];

  const entries = [];

  pools.forEach(pool => {
    if (!pool) {
      return;
    }
    if (Array.isArray(pool)) {
      pool.forEach(item => {
        if (item && typeof item === "object") {
          const name = normalizeOptionalName(item.name || item.item || item.id);
          const current = Number.isFinite(item.current)
            ? item.current
            : Number.isFinite(item.durability)
            ? item.durability
            : null;
          const max = Number.isFinite(item.max)
            ? item.max
            : Number.isFinite(item.maxDurability)
            ? item.maxDurability
            : null;
          if (name && (Number.isFinite(current) || Number.isFinite(max))) {
            entries.push({ name, current, max });
          }
        } else if (typeof item === "string") {
          const match = item.match(/([A-Za-z\s:_-]+)\s+durability\s+(?:is\s+)?(?:now\s*)?(\d+)(?:\/(\d+))?/i);
          if (match) {
            const name = normalizeOptionalName(match[1]);
            const current = Number.parseInt(match[2], 10);
            const max = match[3] ? Number.parseInt(match[3], 10) : null;
            if (name) {
              entries.push({ name, current, max });
            }
          }
        }
      });
    } else if (typeof pool === "object") {
      Object.entries(pool).forEach(([rawName, rawValue]) => {
        const name = normalizeOptionalName(rawName);
        if (!name) {
          return;
        }
        if (typeof rawValue === "object") {
          const current = Number.isFinite(rawValue.current)
            ? rawValue.current
            : Number.isFinite(rawValue.durability)
            ? rawValue.durability
            : null;
          const max = Number.isFinite(rawValue.max)
            ? rawValue.max
            : Number.isFinite(rawValue.maxDurability)
            ? rawValue.maxDurability
            : null;
          if (Number.isFinite(current) || Number.isFinite(max)) {
            entries.push({ name, current, max });
          }
        } else if (Number.isFinite(rawValue)) {
          entries.push({ name, current: rawValue, max: null });
        } else if (typeof rawValue === "string") {
          const match = rawValue.match(/(\d+)(?:\/(\d+))?/);
          if (match) {
            const current = Number.parseInt(match[1], 10);
            const max = match[2] ? Number.parseInt(match[2], 10) : null;
            entries.push({ name, current, max });
          }
        }
      });
    }
  });

  return entries;
}

function buildDurabilityAlerts(durabilityEntries = [], focusItems = []) {
  if (durabilityEntries.length === 0) {
    return [];
  }

  const normalizedFocus = focusItems.map(normalizeOptionalName).filter(Boolean);
  const focusSet = new Set(normalizedFocus);

  return durabilityEntries
    .map(entry => {
      const ratio = Number.isFinite(entry.current) && Number.isFinite(entry.max) && entry.max > 0
        ? entry.current / entry.max
        : null;
      const isFocus = focusSet.size === 0 || focusSet.has(entry.name);
      if (!isFocus) {
        return null;
      }
      const level = ratio !== null && ratio <= 0.25 ? "critical" : ratio !== null && ratio <= 0.5 ? "low" : null;
      if (!level && ratio !== null) {
        return null;
      }
      return {
        item: entry.name,
        current: entry.current,
        max: entry.max,
        ratio,
        level: level || "unknown"
      };
    })
    .filter(Boolean);
}

function collectEnvironmentHazards({ environment = "", enemyTypes = [], context = {} }) {
  const hazards = new Set();
  const advice = [];
  const normalizedEnvironment = normalizeItemName(environment);
  const hazardFlags = Array.isArray(context?.bridgeState?.hazards)
    ? context.bridgeState.hazards.map(flag => normalizeItemName(flag))
    : [];

  hazardFlags.forEach(flag => hazards.add(flag));

  if (normalizedEnvironment.includes("nether")) {
    hazards.add("fire");
    hazards.add("lava");
  }
  if (normalizedEnvironment.includes("end")) {
    hazards.add("void fall");
  }
  if (normalizedEnvironment.includes("ocean") || normalizedEnvironment.includes("underwater")) {
    hazards.add("drowning");
  }

  if (enemyTypes.includes("blaze")) {
    hazards.add("fire");
    advice.push("Keep fire resistance handy—blaze volleys stack burn damage quickly.");
  }
  if (enemyTypes.includes("witch")) {
    hazards.add("poison");
    advice.push("Carry milk or honey to purge poison when witches connect.");
  }
  if (enemyTypes.includes("guardian") || enemyTypes.includes("elder guardian")) {
    hazards.add("mining fatigue");
  }
  if (enemyTypes.includes("hoglin") || enemyTypes.includes("ravager")) {
    hazards.add("knockback");
    advice.push("Brace near solid walls to prevent knockback launches from hoglin or ravager charges.");
  }

  const weather = normalizeWeatherValue(context?.weather || context?.bridgeState?.weather);
  if (weather.includes("storm") || weather.includes("thunder")) {
    hazards.add("lightning");
  }

  return {
    hazards: Array.from(hazards),
    advice
  };
}

function determineStanceTransitions({ initialStance, squadRoles = [], enemyTypes = [] }) {
  const transitions = [];

  if (initialStance && initialStance !== "aggressive") {
    transitions.push({
      from: initialStance,
      to: "aggressive",
      trigger: "combat_event",
      condition: "Primary target health under 20% or enemy count reduced to one",
      rationale: "Finish remaining enemies quickly once they are weakened."
    });
  }

  const hasHealer = squadRoles.some(role => role.role === "healer");
  const hasTank = squadRoles.some(role => role.role === "tank");

  transitions.push({
    from: "aggressive",
    to: "defensive",
    trigger: "combat_event",
    condition: "Any ally health below 35% or shield breaks",
    rationale: "Stabilize line and give healers time to recover."
  });

  if (hasHealer) {
    transitions.push({
      from: initialStance,
      to: "defensive",
      trigger: "combat_event",
      condition: "Healer calls out potion cooldowns or healing resources depleted",
      rationale: "Shift to defensive stance while support replenishes."
    });
  }

  if (enemyTypes.includes("phantom") || enemyTypes.includes("ghast")) {
    transitions.push({
      from: initialStance,
      to: "ranged",
      trigger: "combat_event",
      condition: "Airborne threats persist for more than 10 seconds",
      rationale: "Swap to ranged focus to clear aerial mobs."
    });
  }

  if (hasTank) {
    transitions.push({
      from: "defensive",
      to: "guard",
      trigger: "combat_event",
      condition: "Tank secures aggro and allies recovered above 70% health",
      rationale: "Return to zone control once the frontline is stable."
    });
  }

  return transitions;
}

function buildHealthProtocols({ squadRoles = [], fallbackPlan = "", allies = [] }) {
  const protocols = [];
  const frontline = squadRoles.find(role => role.role === "tank") || squadRoles.find(role => role.role === "leader");

  if (frontline) {
    protocols.push({
      trigger: "combat_update",
      threshold: 0.35,
      actor: frontline.name,
      action: "Signal defensive swap and raise shields",
      followUp: "npc_engine.replanTask('combat')"
    });
  }

  const healer = squadRoles.find(role => role.role === "healer");
  if (healer) {
    protocols.push({
      trigger: "combat_update",
      threshold: 0.5,
      actor: healer.name,
      action: "Deploy splash healing or regeneration and call retreat if cooldowns empty",
      followUp: "plan_safety.retreat"
    });
  }

  protocols.push({
    trigger: "combat_update",
    threshold: 0.25,
    actor: "squad",
    action: `Fallback to ${fallbackPlan || "a safe rally point"} immediately if no healer response.`,
    followUp: "plan_safety.retreat"
  });

  if (Array.isArray(allies) && allies.length > 0) {
    allies.forEach(ally => {
      if (!ally?.name || !Number.isFinite(ally?.maxHealth)) {
        return;
      }
      const threshold = ally.maxHealth * 0.3;
      protocols.push({
        trigger: "combat_update",
        thresholdAbsolute: threshold,
        actor: formatDisplayName(ally.name),
        action: "Auto-trigger shield wall and rotate to rear if health dips under 30%",
        followUp: "npc_engine.replanTask('combat')"
      });
    });
  }

  return protocols;
}

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
  const environment = normalizeItemName(
    task?.metadata?.environment ||
      context?.environment ||
      context?.bridgeState?.environment?.biome ||
      "overworld"
  );
  const timeOfDay = normalizeOptionalName(
    task?.metadata?.timeOfDay || context?.timeOfDay || context?.bridgeState?.timeOfDay
  );
  const weather = normalizeOptionalName(
    task?.metadata?.weather || context?.weather || context?.bridgeState?.weather
  );
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
  const candidateLeaderName = explicitLeaderName
    ? formatDisplayName(explicitLeaderName)
    : squadDisplayNames[0] || (support ? formatDisplayName(support) : "");
  const assignedRoles = assignSquadRoles(
    squadDisplayNames,
    task?.metadata?.squadRoles,
    candidateLeaderName
  );
  const squadLeaderName = assignedRoles.find(role => role.role === "leader")?.name || candidateLeaderName;
  const flankers = assignedRoles.length > 0
    ? assignedRoles.filter(role => ["dps", "scout"].includes(role.role)).map(role => role.name)
    : squadDisplayNames.slice(1, 3);
  const coverMembers = assignedRoles.length > 0
    ? assignedRoles.filter(role => ["healer", "support"].includes(role.role)).map(role => role.name)
    : squadDisplayNames.slice(3);
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

  const inventory = extractInventory(context);

  const environmentProfile = environmentProfiles.find(profile => {
    try {
      return profile.matches(environment);
    } catch (error) {
      return false;
    }
  });

  const environmentHazards = collectEnvironmentHazards({
    environment,
    enemyTypes,
    context: { ...context, weather }
  });
  const allies = Array.isArray(context?.bridgeState?.allies)
    ? context.bridgeState.allies
    : [];

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
  const weaponRecommendations = determineWeaponRecommendations({
    enemyTypes,
    inventory,
    stanceProfile,
    tactic,
    traits: context?.npc?.traits,
    basePrimary: stanceWeaponPreference.primary || (tactic.includes("ranged") ? "bow" : "sword"),
    baseSecondary: stanceWeaponPreference.secondary || (tactic.includes("shield") ? "shield" : "sword")
  });

  const primaryWeapon = normalizeOptionalName(
    task?.metadata?.primaryWeapon ||
      weaponRecommendations.primary ||
      stanceWeaponPreference.primary ||
      (tactic.includes("ranged") ? "bow" : "sword")
  );
  const secondaryWeapon = normalizeOptionalName(
    task?.metadata?.secondaryWeapon ||
      weaponRecommendations.secondary ||
      stanceWeaponPreference.secondary ||
      (tactic.includes("shield") ? "shield" : "sword")
  );

  const requiredEquipment = Array.from(
    new Set([primaryWeapon, secondaryWeapon, "armor", ...stanceExtras, ...weaponRecommendations.loadout].filter(Boolean))
  );
  const stanceWeaponsDisplay = [primaryWeapon, secondaryWeapon, ...stanceExtras]
    .filter(Boolean)
    .map(formatDisplayName);

  const potions = Array.isArray(task?.metadata?.potions)
    ? task.metadata.potions.map(normalizeItemName)
    : task?.metadata?.potions
    ? [normalizeItemName(task.metadata.potions)]
    : [];
  const missingEquipment = requiredEquipment.filter(item => !hasInventoryItem(inventory, item));
  const missingPotions = potions.filter(item => !hasInventoryItem(inventory, item));
  const counterItems = Array.from(recommendedCounterItems);
  const missingCounterItems = counterItems.filter(item => !hasInventoryItem(inventory, item));
  const missingPotionsSummary = formatRequirementList(missingPotions);
  const counterItemsSummary = formatRequirementList(counterItems);

  const steps = [];

  const weaponMatchDescription = weaponRecommendations.matches
    .map(match => {
      const enemyList = formatList(match.enemies.map(formatDisplayName));
      const availability = match.available ? "" : " (retrieve or craft first)";
      return `${formatDisplayName(match.weapon)} vs ${enemyList}${availability}.`;
    })
    .join(" ");
  const durabilityEntries = extractDurabilityEntries(context);
  const durabilityAlerts = buildDurabilityAlerts(durabilityEntries, requiredEquipment);
  const stanceTransitions = determineStanceTransitions({
    initialStance: stanceProfile?.name,
    squadRoles: assignedRoles,
    enemyTypes
  });
  const healthProtocols = buildHealthProtocols({
    squadRoles: assignedRoles,
    fallbackPlan: backupPlan,
    allies
  });

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
      metadata: {
        equipment: requiredEquipment,
        missing: missingEquipment,
        optimalWeapons: weaponRecommendations.matches
      }
    })
  );

  if (weaponRecommendations.matches.length > 0) {
    steps.push(
      createStep({
        title: "Align weapons to targets",
        type: "strategy",
        description: weaponMatchDescription,
        metadata: { matches: weaponRecommendations.matches }
      })
    );
  }

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

  if (stanceTransitions.length > 0) {
    const transitionDescription = stanceTransitions
      .map(
        transition =>
          `Swap from ${formatDisplayName(transition.from)} to ${formatDisplayName(transition.to)} when ${transition.condition}.`
      )
      .join(" ");
    steps.push(
      createStep({
        title: "Plan stance transitions",
        type: "adaptation",
        description: `Monitor combat events and call for replans as needed. ${transitionDescription}`,
        metadata: {
          transitions: stanceTransitions,
          replanTrigger: "combat_event",
          instructions: "npc_engine.replanTask('combat')"
        }
      })
    );
  }

  if (durabilityAlerts.length > 0) {
    const durabilityDescription = durabilityAlerts
      .map(alert => {
        const ratioText = Number.isFinite(alert.current) && Number.isFinite(alert.max)
          ? `${alert.current}/${alert.max}`
          : alert.current
          ? `${alert.current} durability`
          : "low durability";
        return `${formatDisplayName(alert.item)} ${alert.level} — ${ratioText}.`;
      })
      .join(" ");
    steps.push(
      createStep({
        title: "Monitor weapon durability",
        type: "maintenance",
        description: `Inspect combat gear durability before each engagement. ${durabilityDescription}`,
        metadata: { alerts: durabilityAlerts }
      })
    );
  }

  if (healthProtocols.length > 0) {
    const protocolDescription = healthProtocols
      .map(protocol => {
        const thresholdText = protocol.thresholdAbsolute
          ? `below ${Math.round(protocol.thresholdAbsolute)}`
          : `${Math.round((protocol.threshold || 0) * 100)}%`; 
        return `${protocol.actor} reacts if health ${protocol.thresholdAbsolute ? "drops" : "falls"} ${thresholdText}: ${protocol.action}.`;
      })
      .join(" ");
    steps.push(
      createStep({
        title: "Stabilize when injured",
        type: "contingency",
        description: `Leverage safety sub-plans when health thresholds are crossed. ${protocolDescription}`,
        metadata: {
          protocols: healthProtocols,
          replan: "combat_update"
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
  const weatherValue = weather || "";
  if (timeOfDay === "night") {
    conditionAdvice.push("Night visibility is low—carry torches and leverage shields against surprise hits.");
  }
  if (timeOfDay === "night" && enemyTypes.includes("skeleton")) {
    conditionAdvice.push("Avoid trading open-field shots with skeletons at night; pull them into cover or wait for dawn.");
  }
  if (timeOfDay === "day" && enemyTypes.includes("zombie")) {
    conditionAdvice.push("Use daylight to weaken zombies in exposed areas when possible.");
  }
  if (weatherValue.includes("storm") || weatherValue.includes("thunder")) {
    conditionAdvice.push("Thunderstorms spawn extra mobs and can trigger charged creepers—limit time in open terrain.");
  }
  if (weatherValue.includes("rain") && enemyTypes.includes("blaze")) {
    conditionAdvice.push("Rain hampers blaze fireballs—fight them outdoors to capitalize on the weather.");
  }
  if (environmentHazards.advice.length > 0) {
    conditionAdvice.push(...environmentHazards.advice);
  }

  if (conditionAdvice.length > 0) {
    steps.push(
      createStep({
        title: "Adapt to conditions",
        type: "awareness",
        description: conditionAdvice.join(" "),
        metadata: { timeOfDay, weather, hazards: environmentHazards.hazards }
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
    if (assignedRoles.length > 0) {
      const roleDetails = assignedRoles
        .map(role => `${role.name}: ${formatDisplayName(role.role)} — ${role.summary} (${role.spacing}).`)
        .join(" ");
      squadDescriptionParts.push(roleDetails);
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
          stance: stanceProfile.name,
          roles: assignedRoles
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
          hazards: (environmentProfile.hazards || []).concat(environmentHazards.hazards || []),
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
  if (weatherValue.includes("storm") || weatherValue.includes("thunder")) {
    risks.push("Thunderstorms may summon charged creepers and lightning strikes.");
  } else if (weatherValue.includes("rain")) {
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
  if (weaponRecommendations.matches.some(match => !match.available)) {
    risks.push("Optimal weapon enchantments are missing; expect longer time-to-kill on priority targets.");
  }
  if (durabilityAlerts.some(alert => alert.level === "critical")) {
    risks.push("Critical durability reported—swap or repair weapons before they break mid-fight.");
  } else if (durabilityAlerts.some(alert => alert.level === "low")) {
    risks.push("Several weapons are at half durability; carry backups in case they fail mid-combat.");
  }
  prioritizedEnemies.forEach(detail => {
    if (detail.risk && !risks.includes(detail.risk)) {
      risks.push(detail.risk);
    }
  });
  const hazardRiskMessages = {
    fire: "Fire hazard present—maintain fire resistance and extinguishers.",
    lava: "Lava exposure nearby—carry blocks and avoid knockback toward edges.",
    drowning: "Underwater combat risks drowning without respiration gear.",
    poison: "Poison damage possible—keep antidotes or milk ready.",
    "mining fatigue": "Mining fatigue beams can prevent emergency escapes—break line of sight often.",
    knockback: "High knockback threats—anchor near solid walls to avoid being launched.",
    lightning: "Lightning strikes likely during storms—avoid tall metal structures.",
    "void fall": "Void exposure—any knockback could be fatal without slow falling."
  };
  const combinedHazards = new Set([...(environmentProfile?.hazards || []), ...(environmentHazards.hazards || [])]);
  combinedHazards.forEach(hazard => {
    const normalizedHazard = normalizeItemName(hazard);
    const message = hazardRiskMessages[normalizedHazard];
    if (message && !risks.includes(message)) {
      risks.push(message);
    } else if (!message && hazard && !risks.includes(hazard)) {
      risks.push(`Environmental hazard: ${formatDisplayName(hazard)} may disrupt combat.`);
    }
  });

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
  if (weaponRecommendations.matches.length > 0) {
    const weaponNote = `Weapon counters: ${weaponRecommendations.matches
      .map(match => `${formatDisplayName(match.weapon)} vs ${formatList(match.enemies.map(formatDisplayName))}`)
      .join("; ")}.`;
    if (!notes.includes(weaponNote)) {
      notes.push(weaponNote);
    }
  }
  if (stanceTransitions.length > 0) {
    const transitionNote = `Stance transitions queued: ${stanceTransitions
      .map(transition => `${formatDisplayName(transition.from)}→${formatDisplayName(transition.to)} when ${transition.condition}`)
      .join("; ")}.`;
    if (!notes.includes(transitionNote)) {
      notes.push(transitionNote);
    }
  }
  if (healthProtocols.length > 0) {
    const protocolNote = `Health triggers: ${healthProtocols
      .map(protocol => {
        const thresholdText = protocol.thresholdAbsolute
          ? `${Math.round(protocol.thresholdAbsolute)} HP`
          : `${Math.round((protocol.threshold || 0) * 100)}%`;
        return `${protocol.actor} → ${protocol.action} @ ${thresholdText}`;
      })
      .join("; ")}.`;
    if (!notes.includes(protocolNote)) {
      notes.push(protocolNote);
    }
  }
  if (durabilityAlerts.length > 0) {
    const durabilityNote = `Durability alerts: ${durabilityAlerts
      .map(alert => `${formatDisplayName(alert.item)} ${alert.level}${alert.max ? ` (${alert.current}/${alert.max})` : ""}`)
      .join("; ")}.`;
    if (!notes.includes(durabilityNote)) {
      notes.push(durabilityNote);
    }
  }
  if (environmentHazards.hazards.length > 0) {
    const hazardNote = `Hazard flags: ${environmentHazards.hazards.map(formatDisplayName).join(", ")}.`;
    if (!notes.includes(hazardNote)) {
      notes.push(hazardNote);
    }
  }
  if (squadDisplayNames.length > 0) {
    const squadRoleDetails = assignedRoles.length > 0
      ? assignedRoles.map(role => `${role.name}=${formatDisplayName(role.role)}`).join(", ")
      : [];
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
    if (squadRoleDetails && squadRoleDetails.length > 0) {
      squadNoteParts.push(`Assignments: ${squadRoleDetails}`);
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
