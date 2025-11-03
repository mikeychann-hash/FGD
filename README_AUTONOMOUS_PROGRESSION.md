# 🧠 FGD Autonomous Progression Expansion (v2.3)
### Integration of the "Minecraft Sustainable Progression" path into the Federation AI System

---

## 🎯 Objective
Upgrade the FGD hybrid system so that **bots no longer require manual commands** to act.  
They will automatically **progress through Minecraft phases** (survival → automation → Nether → Dragon → post-game) based on the _Minecraft_Sustainable_Progression_README.md_ guide.

---

## 📦 Overview
FGD already contains:
- `minecraft_bridge.js` → movement + action surface
- `core/npc_microcore.js` → per-bot reactive loop
- `npc_engine.js` + `autonomic_core.js` → governance and scheduling
- `llm_bridge.js` → LLM provider logic
- `policy_engine.js` → system policy control

We now add:
- **`progression_engine.js`** → central controller for sustainable phase logic
- **`tasks/` integration hooks** → phase-aware planner scheduling
- **`npc_microcore.js` autonomy expansion** → local self-behavior without commands
- **Updated README references and phase dashboards**

---

## 🧩 1. Create `core/progression_engine.js`

Purpose:
Manage sustainable world progression through defined phases (1–6).  
Each phase defines objectives, required resources, recommended tasks, and unlock conditions.

```js
// core/progression_engine.js
import EventEmitter from "events";
import { policyEngine } from "../policy_engine.js";
import { learningEngine } from "../learning_engine.js";
import { llmBridge } from "../llm_bridge.js";
import { npcEngine } from "../npc_engine.js";

export class ProgressionEngine extends EventEmitter {
  constructor() {
    super();
    this.phase = 1;
    this.objectives = {};
    this.activeGoals = [];
    this.progressData = {};
  }

  async init() {
    console.log("🌍 [ProgressionEngine] Initialized.");
    await this.loadPhase(1);
  }

  async loadPhase(phaseNumber) {
    this.phase = phaseNumber;
    const guide = await this.#fetchPhaseGuide(phaseNumber);
    this.objectives = guide.objectives;
    this.activeGoals = guide.recommended_tasks;
    policyEngine.applyPhasePolicies(phaseNumber);
    this.emit("phaseChanged", guide);
    console.log(`🧭 Entered Phase ${phaseNumber}: ${guide.objective}`);
  }

  async updateFederationState(metrics) {
    this.progressData = metrics;
    if (this.#checkPhaseCompletion(metrics)) {
      await this.loadPhase(this.phase + 1);
    }
  }

  async #fetchPhaseGuide(phase) {
    const guides = {
      1: { objective: "Survive and build a base", recommended_tasks: ["plan_mine", "plan_build_shelter", "plan_farm"] },
      2: { objective: "Automate core farms", recommended_tasks: ["plan_farm", "plan_smelter", "plan_storage"] },
      3: { objective: "Infrastructure and villagers", recommended_tasks: ["plan_villager_hall", "plan_build_hub"] },
      4: { objective: "Nether expansion", recommended_tasks: ["plan_nether_explore", "plan_forge"] },
      5: { objective: "End prep", recommended_tasks: ["plan_enchant", "plan_gather_pearls"] },
      6: { objective: "Post-dragon automation", recommended_tasks: ["plan_build_mega_base", "plan_elytra"] }
    };
    return guides[phase] || guides[6];
  }

  #checkPhaseCompletion(metrics) {
    if (this.phase === 1 && metrics.food > 50 && metrics.shelters >= 1) return true;
    if (this.phase === 2 && metrics.automations >= 3) return true;
    if (this.phase === 3 && metrics.villagers >= 5) return true;
    if (this.phase === 4 && metrics.netherAccess === true) return true;
    if (this.phase === 5 && metrics.portalReady === true) return true;
    return false;
  }
}

export const progressionEngine = new ProgressionEngine();
```

---

## 🧠 2. Update `autonomic_core.js`

Add integration at startup:
```js
import { progressionEngine } from "./core/progression_engine.js";

await progressionEngine.init();
progressionEngine.on("phaseChanged", guide => {
  npcEngine.scheduleBatch(guide.recommended_tasks);
  llmBridge.broadcastStrategy(guide);
});
```

---

## ⚙️ 3. Expand `npc_microcore.js`

Let bots self-act according to local environment data:
```js
if (bot.role === "miner" && nearbyBlocks.includes("ore")) await bridge.dig(bot, targetOre);
else if (bot.role === "builder" && taskQueue.includes("build")) await bridge.place(bot, nextPos, "minecraft:oak_planks");
else if (bot.role === "farmer" && nearbyBlocks.includes("wheat")) await bridge.harvest(bot);
```

This ensures local autonomy; planners only set direction.

---

## 🧩 4. Extend `policy_engine.js`

Add method:
```js
applyPhasePolicies(phase) {
  switch(phase) {
    case 1: this.policy.maxBots = 5; break;
    case 2: this.policy.maxBots = 10; this.policy.allowFarming = true; break;
    case 3: this.policy.enableTrading = true; break;
    case 4: this.policy.enableNether = true; break;
    case 5: this.policy.allowCombat = true; break;
    default: this.policy.freeMode = true;
  }
  console.log(`[PolicyEngine] Updated policies for Phase ${phase}`);
}
```

---

## 💬 5. Add `llm_bridge` support prompt

Add a new system prompt file `llm_prompts/federation_progression_prompt.js`:
```js
export const federationProgressionPrompt = `
You are the strategic advisor for the AICraft Federation.
Review current phase, metrics, and advise the federation on next sustainable goals.
Do not micromanage bots; recommend macro-level priorities only.
`;
```

---

## 🧾 6. Update `server.js`

Inject federation status into WebSocket telemetry:
```js
telemetryChannel.emit("progression:update", {
  phase: progressionEngine.phase,
  objectives: progressionEngine.objectives,
  goals: progressionEngine.activeGoals
});
```

---

## 📊 7. Add Dashboard Tab (optional)

Add `dashboard_progression.html` with live display of:
```
Current Phase: 2 - Early Automation
Active Tasks: plan_farm, plan_storage
Phase Objectives: Automate food and smelting
Progress: 67%
```

---

## ✅ 8. Summary of New Files / Updates

| File | Purpose |
|------|----------|
| `core/progression_engine.js` | Tracks world phases and triggers new tasks |
| `llm_prompts/federation_progression_prompt.js` | LLM advisor context |
| `npc_microcore.js` | Adds self-running reactive behaviors |
| `autonomic_core.js` | Connects progression → planners |
| `policy_engine.js` | Defines phase-based federation policies |
| `dashboard_progression.html` | Optional visualization panel |

---

## 🧩 9. Expected Behavior After Merge
- Bots autonomously progress from **Phase 1 → Phase 6** using learning metrics.  
- No manual commands needed; LLM only gives high-level strategy updates.  
- Federation policies unlock new behaviors automatically per phase.  
- Dashboard displays current progression and goals in real time.

---

## 🧠 10. Commit Summary
```
feat(autonomy): integrate sustainable progression system
- add core/progression_engine.js
- expand microcore for self-driven bot actions
- add LLM strategic advisor prompt
- connect progression to autonomic_core and policy_engine
- optional progression dashboard UI
```

---

**Author:** Theseus  
**Target Version:** `FGD v2.3 – Autonomous Federation Progression`
