// core/npc_microcore.js
// Local "micro-brain" runtime for individual bots

import EventEmitter from "events";

const DEFAULT_OPTIONS = {
  tickRateMs: 200,
  scanIntervalMs: 1500,
  scanRadius: 5,
  stepDistance: 0.6,
  memorySize: 10,
  enableAutonomy: true,
  currentPhase: 1
};

const activeLoops = new Map();

/**
 * Normalize position-like input to an XYZ object.
 * @param {object|undefined|null} position - Source position
 * @returns {{x:number,y:number,z:number}}
 */
function normalizePosition(position) {
  const { x = 0, y = 0, z = 0 } = position || {};
  return { x: Number(x) || 0, y: Number(y) || 0, z: Number(z) || 0 };
}

/**
 * Internal stateful loop controller for a bot instance.
 */
class NPCMicrocore extends EventEmitter {
  constructor(bot, options = {}) {
    super();

    if (!bot || !bot.id) {
      throw new Error("NPCMicrocore requires a bot object with an id");
    }

    this.bot = bot;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.bridge = options.bridge || bot.bridge || null;
    this.running = false;
    this.timer = null;
    this.lastTick = null;
    this.pendingEvents = [];
    this.currentTask = null;
    this.currentPhase = options.currentPhase || 1;
    this.state = {
      position: normalizePosition(bot.runtime?.position || bot.position),
      velocity: { x: 0, y: 0, z: 0 },
      target: null,
      tickCount: 0,
      lastScanResult: null,
      lastScanAt: 0,
      context: Array.isArray(bot.runtime?.memory?.context)
        ? [...bot.runtime.memory.context]
        : []
    };

    if (!bot.runtime) bot.runtime = {};
    bot.runtime.position = { ...this.state.position };
    bot.runtime.status = bot.runtime.status || "idle";
    bot.runtime.lastTickAt = bot.runtime.lastTickAt || null;
    bot.runtime.memory = bot.runtime.memory || { context: [] };
    bot.runtime.velocity = bot.runtime.velocity || { x: 0, y: 0, z: 0 };
  }

  /**
   * Starts the microcore tick loop.
   */
  start() {
    if (this.running) return;
    this.running = true;
    const interval = Math.max(50, this.options.tickRateMs);
    this.timer = setInterval(() => this.onTick(), interval);
    this.emit("statusUpdate", this.#buildStatusPayload("microcore:start"));
  }

  /**
   * Stops the microcore tick loop.
   */
  stop() {
    if (!this.running) return;
    this.running = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.emit("statusUpdate", this.#buildStatusPayload("microcore:stop"));
  }

  /**
   * Handles incoming events from macro systems.
   * @param {object} event - Event payload
   */
  handleEvent(event) {
    if (!event) return;
    this.pendingEvents.push(event);
  }

  /**
   * Main tick handler that advances microcore state.
   */
  onTick() {
    const now = Date.now();
    const delta = this.lastTick ? now - this.lastTick : this.options.tickRateMs;
    this.lastTick = now;
    this.state.tickCount += 1;

    // Drain event queue
    while (this.pendingEvents.length) {
      const evt = this.pendingEvents.shift();
      this.#processEvent(evt);
    }

    this.update(delta);

    if (
      this.options.scanIntervalMs > 0 &&
      now - this.state.lastScanAt >= this.options.scanIntervalMs
    ) {
      this.state.lastScanAt = now;
      this.#performScan();
    }

    this.emit("statusUpdate", this.#buildStatusPayload("microcore:tick"));
  }

  /**
   * Performs physics-lite updates each tick.
   * @param {number} deltaMs - Milliseconds since last tick
   */
  update(deltaMs) {
    if (!this.state.target) {
      this.state.velocity = { x: 0, y: 0, z: 0 };
      return;
    }

    const currentPos = normalizePosition(this.bot.runtime?.position || this.state.position);
    const target = normalizePosition(this.state.target);

    const diff = {
      x: target.x - currentPos.x,
      y: target.y - currentPos.y,
      z: target.z - currentPos.z
    };
    const distance = Math.sqrt(diff.x ** 2 + diff.y ** 2 + diff.z ** 2);

    if (distance < 0.001) {
      this.#completeMovement(target);
      return;
    }

    const maxStep = this.options.stepDistance * (deltaMs / this.options.tickRateMs);
    const step = Math.min(distance, Math.max(maxStep, 0.01));
    const direction = {
      x: diff.x / distance,
      y: diff.y / distance,
      z: diff.z / distance
    };
    const delta = {
      x: direction.x * step,
      y: direction.y * step,
      z: direction.z * step
    };

    const nextPosition = {
      x: currentPos.x + delta.x,
      y: currentPos.y + delta.y,
      z: currentPos.z + delta.z
    };

    this.state.velocity = { ...delta };
    this.bot.runtime.position = { ...nextPosition };
    this.bot.runtime.velocity = { ...delta };
    this.state.position = { ...nextPosition };
    this.bot.runtime.lastTickAt = new Date().toISOString();
    this.bot.runtime.status = this.currentTask ? "working" : "idle";

    this.emit("move", {
      botId: this.bot.id,
      position: { ...nextPosition },
      velocity: { ...delta },
      timestamp: this.bot.runtime.lastTickAt
    });

    if (this.bridge?.moveBot) {
      Promise.resolve(
        this.bridge.moveBot(this.bot, delta.x, delta.y, delta.z, {
          currentPosition: currentPos,
          nextPosition
        })
      ).catch(err => {
        this.emit("error", { botId: this.bot.id, error: err });
      });
    }
  }

  /**
   * Queues a movement target for the bot.
   * @param {{x:number,y:number,z:number}} target
   */
  setMovementTarget(target) {
    this.state.target = normalizePosition(target);
    this.bot.runtime.status = "moving";
    this.emit("statusUpdate", this.#buildStatusPayload("microcore:move_set"));
  }

  /**
   * Assigns a task context for the bot.
   * @param {object} task
   */
  setTask(task) {
    this.currentTask = task || null;
    if (task?.memory) {
      this.#remember(task.memory);
    }
    this.emit("statusUpdate", this.#buildStatusPayload("microcore:task_set"));
  }

  /**
   * Creates a payload summarizing the bot status.
   * @param {string} reason - Event reason tag
   * @returns {object}
   */
  #buildStatusPayload(reason) {
    return {
      botId: this.bot.id,
      reason,
      tick: this.state.tickCount,
      position: { ...this.bot.runtime.position },
      velocity: { ...this.bot.runtime.velocity },
      task: this.currentTask ? { ...this.currentTask } : null,
      status: this.bot.runtime.status,
      memory: [...this.state.context],
      lastScan: this.state.lastScanResult,
      lastTickAt: this.bot.runtime.lastTickAt
    };
  }

  #processEvent(event) {
    if (event.type === "moveTo" && event.position) {
      this.setMovementTarget(event.position);
      return;
    }

    if (event.type === "task" && event.task) {
      this.setTask(event.task);
      return;
    }

    if (event.type === "scan") {
      this.#performScan(true);
      return;
    }

    if (event.type === "phaseUpdate" && typeof event.phase === "number") {
      this.currentPhase = event.phase;
      this.#remember(`Phase changed to ${event.phase}`);
      return;
    }

    if (event.memory) {
      this.#remember(event.memory);
    }
  }

  #completeMovement(target) {
    this.state.position = { ...target };
    this.bot.runtime.position = { ...target };
    this.bot.runtime.velocity = { x: 0, y: 0, z: 0 };
    this.state.velocity = { x: 0, y: 0, z: 0 };
    this.state.target = null;
    this.emit("move", {
      botId: this.bot.id,
      position: { ...target },
      velocity: { x: 0, y: 0, z: 0 },
      timestamp: new Date().toISOString()
    });

    if (this.currentTask) {
      this.emit("taskComplete", {
        botId: this.bot.id,
        task: { ...this.currentTask },
        position: { ...target }
      });
      this.currentTask = null;
      this.bot.runtime.status = "idle";
    }
  }

  #remember(memory) {
    if (!memory) return;
    const asString = typeof memory === "string" ? memory : JSON.stringify(memory);
    this.state.context.unshift({
      value: asString,
      at: new Date().toISOString()
    });
    this.state.context = this.state.context.slice(0, this.options.memorySize);
    this.bot.runtime.memory.context = [...this.state.context];
  }

  #performScan(force = false) {
    if (!this.bridge?.scanArea) {
      if (force) {
        this.state.lastScanResult = {
          timestamp: new Date().toISOString(),
          note: "Scan unavailable"
        };
        this.emit("statusUpdate", this.#buildStatusPayload("microcore:scan_unavailable"));
      }
      return;
    }

    const radius = this.options.scanRadius;
    Promise.resolve(this.bridge.scanArea(this.bot, radius))
      .then(result => {
        const payload = {
          timestamp: new Date().toISOString(),
          radius,
          ...result
        };
        this.state.lastScanResult = payload;
        this.bot.runtime.lastScan = payload;
        this.emit("statusUpdate", this.#buildStatusPayload("microcore:scan"));

        // Phase-aware autonomous behavior
        if (this.options.enableAutonomy && !this.currentTask) {
          this.#evaluateAutonomousAction(result);
        }
      })
      .catch(error => {
        this.emit("error", { botId: this.bot.id, error });
      });
  }

  /**
   * Evaluate autonomous actions based on scan results and current phase
   * @param {object} scanResult - Scan result data
   * @private
   */
  #evaluateAutonomousAction(scanResult) {
    if (!scanResult || !this.bot) return;

    const role = this.bot.role || this.bot.type;
    const blocks = scanResult.blocks || [];
    const entities = scanResult.entities || [];

    // Phase-aware autonomous behaviors
    switch (this.currentPhase) {
      case 1: // Survival & Basics
        if (role === "miner" && blocks.some(b => b.type?.includes("ore"))) {
          this.#remember("Detected ore nearby - mining priority");
        } else if (role === "builder" && blocks.some(b => b.type === "log")) {
          this.#remember("Detected wood nearby - gathering priority");
        } else if (role === "farmer" && blocks.some(b => b.type?.includes("wheat") || b.type?.includes("crop"))) {
          this.#remember("Detected crops nearby - harvesting priority");
        }
        break;

      case 2: // Resource Expansion & Early Automation
        if (role === "miner" && blocks.some(b => b.type?.includes("iron_ore"))) {
          this.#remember("Iron ore detected - automation material priority");
        } else if (role === "builder" && blocks.length > 5) {
          this.#remember("Suitable building area detected");
        }
        break;

      case 3: // Infrastructure & Mega Base Foundations
        if (role === "builder") {
          this.#remember("Infrastructure phase - large build focus");
        } else if (role === "miner" && blocks.some(b => b.type?.includes("diamond"))) {
          this.#remember("Diamond ore detected - tool upgrade priority");
        }
        break;

      case 4: // Nether Expansion
        if (role === "explorer" || role === "scout") {
          this.#remember("Nether phase - exploration priority");
        } else if (role === "guard" && entities.length > 0) {
          this.#remember("Entities detected - combat readiness");
        }
        break;

      case 5: // End Prep
        if (role === "miner" || role === "gatherer") {
          this.#remember("End prep phase - resource gathering for final battle");
        }
        break;

      case 6: // Post-Dragon
        if (role === "builder") {
          this.#remember("Post-dragon phase - mega base expansion");
        }
        break;

      default:
        break;
    }
  }

  /**
   * Update current phase (called from external systems)
   * @param {number} phase - New phase number
   */
  setPhase(phase) {
    if (typeof phase === "number" && phase >= 1 && phase <= 6) {
      this.currentPhase = phase;
      this.#remember(`Phase updated to ${phase}`);
    }
  }

  /**
   * Get current phase
   * @returns {number} Current phase number
   */
  getPhase() {
    return this.currentPhase;
  }
}

/**
 * Start (or restart) the microcore loop for a bot.
 * @param {object} bot - Bot runtime reference
 * @param {object} [options] - Loop options
 * @returns {NPCMicrocore}
 */
export function startLoop(bot, options = {}) {
  const id = bot?.id;
  if (!id) {
    throw new Error("startLoop requires a bot with an id");
  }

  if (activeLoops.has(id)) {
    const existing = activeLoops.get(id);
    existing.stop();
  }

  const loop = new NPCMicrocore(bot, options);
  loop.start();
  activeLoops.set(id, loop);
  return loop;
}

/**
 * Stops and removes a loop for the provided bot.
 * @param {object|string} bot - Bot or bot id
 */
export function stopLoop(bot) {
  const id = typeof bot === "string" ? bot : bot?.id;
  if (!id || !activeLoops.has(id)) return;
  const loop = activeLoops.get(id);
  loop.stop();
  activeLoops.delete(id);
}

export { NPCMicrocore };
