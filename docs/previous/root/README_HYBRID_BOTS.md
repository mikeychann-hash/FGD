# 🧠 FGD vs. Mineflayer: Hybrid Bot Architecture  
**Version:** 1.0 • **Last Updated:** November 2025  
**Scope:** Design overview for “Mineflayer-like” bots within the AICraft Federation Governance Dashboard (FGD)

---

## 🏗️ Overview

This document compares **Mineflayer**, the established Node.js Minecraft automation library, with the **AICraft Federation Governance Dashboard (FGD)** framework, and defines how FGD will evolve to include *Mineflayer-like* realism and embodiment while retaining its scalable AI governance model.

FGD will merge **Mineflayer’s embodiment** (physical presence, awareness, and reactive control) with **FGD’s intelligence stack** (governance, LLM integration, and persistence).

---

## ⚔️ Core Comparison

| # | Subsystem | **Mineflayer** | **FGD** | **Hybrid Direction** |
|---|------------|----------------|----------|-----------------------|
| **1️⃣ Connection & Integration** | Each bot logs in as its own Minecraft client using the full protocol. Realistic but resource heavy. | Centralized RCON / WebSocket bridge—one connection manages many NPCs. | 💡 **Keep FGD’s centralized bridge**, add a lightweight plugin that streams entity data (block scans, mob detection) for sensory feedback without spawning hundreds of TCP clients. |
| **2️⃣ Entity / World Awareness** | Maintains full chunk memory (`prismarine-world`, `prismarine-entity`) tracking every block and item. | Abstracted awareness—bots track coordinates, roles, and goals. | 🧠 Extend the bridge/plugin to return **selective awareness** (“scan 5-block radius”) rather than full chunk syncs. |
| **3️⃣ Movement & Physics** | Simulates gravity, velocity, collisions, and pixel-accurate pathfinding. | Simplified teleportation or static positioning. | 🦾 Add a **lightweight physics layer** with step-based motion and direction interpolation for believable but efficient movement. |
| **4️⃣ Behavior Engine** | Event-driven AI (`on('chat')`, `on('entityMoved')`), strong tactical control. | Planner-driven autonomy via `autonomic_core` and `tasks/`. | 🧩 **Retain FGD’s planners** but give each bot a **local event loop (“micro-brain”)** handling reactive updates, movement, and survival behavior.<br>→ *FGD decides what to do; micro-brain decides how to do it.* |
| **5️⃣ Communication & Coordination** | Bots act independently—behave like individual players. | Centralized federation, shared policy control. | 📡 Preserve federation control while adding per-bot async messaging or simulated chat for emergent group coordination. |
| **6️⃣ LLM / AI Layer** | External integrations (MindCraft, Voyager) add LLMs. | LLMs are native (`llm_bridge.js`, `autonomic_core.js`) controlling spawn, task, and policy. | 🧬 **Keep this intact.** FGD already outperforms Mineflayer—LLMs remain core to the design. |
| **7️⃣ Persistence & Learning** | Stateless; no built-in memory. | `learning_engine` + `knowledge_store` provide adaptive, persistent cognition. | 🗃️ Maintain as-is; later integrate **short-term task memory** with **long-term fusion knowledge** for richer learning. |
| **8️⃣ Performance & Scaling** | Each bot = one Node process + protocol socket → poor scaling beyond ~15 bots. | One backend controls hundreds of bots. | ⚙️ **FGD wins.** Keep centralized orchestration for large federations. |
| **9️⃣ Ease of Control & Debugging** | Manual scripting; minimal visualization. | Built-in dashboards, REST API, and WebSocket feeds. | 🧩 Keep FGD’s dashboards as the “central mind,” optionally add a **debug viewer** (like Prismarine Viewer) to visualize individual bots. |

---

## 🧬 Hybrid Vision Diagram

```
┌────────────────────────────────────────────────────────────┐
│                 🧠 Federation Layer (FGD Core)              │
│  - LLM Command Surface (llm_bridge.js)                      │
│  - Governance Core (autonomic_core.js / policy_engine.js)   │
│  - Knowledge + Learning Persistence                         │
└──────────────▲──────────────────────────────────────────────┘
               │  Goals / Policies
               ▼
┌────────────────────────────────────────────────────────────┐
│           🤖 Local Behavior Core (“Micro-Brain”)            │
│  - Per-bot event loop and reactive AI                      │
│  - Movement, pathing, task execution                        │
│  - Local state awareness (position, status, context)        │
└──────────────▲──────────────────────────────────────────────┘
               │  Commands / Updates
               ▼
┌────────────────────────────────────────────────────────────┐
│       ⚙️ Minecraft Integration Layer (Bridge + Plugin)       │
│  - Central RCON / WebSocket bridge                          │
│  - Lightweight data stream (block / mob scans)              │
│  - Simplified physics and motion commands                   │
└────────────────────────────────────────────────────────────┘
```

---

## 🧩 Summary

**Mineflayer** → excels at *embodied realism* (physics, full world awareness).  
**FGD** → excels at *intelligence, governance, persistence, and scale*.  

The **hybrid model** combines both:
- FGD’s scalable intelligence and coordination, **plus**
- Mineflayer-style embodiment and reactivity.

Result: an adaptive, learning-capable Federation where each bot behaves like a real player but thinks like a distributed AI agent.

---

## 🧾 Implementation Notes

- Extend `minecraft_bridge.js` to support bi-directional data streaming (entity and block awareness).  
- Introduce `npc_microcore.js` to manage per-bot ticks, movement, and local events.  
- Update `npc_spawner.js` to initialize both macro (task planner) and micro (event loop) layers.  
- Keep all learning, persistence, and governance modules unchanged.  
- Optionally implement a small Paper plugin (`FGDProxyPlayer`) to spawn visual player-like entities for true in-world embodiment.

---

## 🧩 License & Versioning

- This hybrid specification is distributed under the same **GPL-3.0 license** as the FGD core.  
- Proposed milestone: **FGD v2.2 “Embodied Federation”**

---

**Author:** Theseus / AICraft Federation Core Design  
**Reviewed by:** Codex Integration Team  
**Date:** November 2025  
