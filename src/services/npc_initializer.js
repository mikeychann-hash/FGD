import path from "path";
import { logger } from "../../logger.js";
import { NPCRegistry } from "../../npc_registry.js";
import { NPCSpawner } from "../../npc_spawner.js";
import { NPCFinalizer } from "../../npc_finalizer.js";
import { LearningEngine } from "../../learning_engine.js";
import { NPCEngine } from "../../npc_engine.js";
import { MinecraftBridge } from "../../minecraft_bridge.js";
import { AutonomicCore } from "../../autonomic_core.js";
import { progressionEngine } from "../../core/progression_engine.js";
import { ensureNonDefaultSecret } from "../../security/secrets.js";
import { ROOT_DIR } from "../config/constants.js";

/**
 * NPC System container
 */
export class NPCSystem {
  constructor() {
    this.npcRegistry = null;
    this.npcSpawner = null;
    this.npcFinalizer = null;
    this.learningEngine = null;
    this.npcEngine = null;
    this.minecraftBridge = null;
    this.autonomicCore = null;
  }

  /**
   * Initialize Minecraft Bridge (optional)
   */
  async initializeMinecraftBridge() {
    try {
      const host = process.env.MINECRAFT_RCON_HOST || '127.0.0.1';
      const port = parseInt(process.env.MINECRAFT_RCON_PORT || '25575');
      const rawPassword = process.env.MINECRAFT_RCON_PASSWORD || '';
      const password = ensureNonDefaultSecret({
        label: 'Minecraft RCON password',
        value: rawPassword,
        fallback: 'fgd_rcon_password_change_me',
        envVar: 'MINECRAFT_RCON_PASSWORD',
        allowEmpty: true
      });

      // Only initialize if password is set (indicates intent to use RCON)
      if (password) {
        this.minecraftBridge = new MinecraftBridge({
          host,
          port,
          password,
          connectOnCreate: false // Don't auto-connect yet
        });

        logger.info('Minecraft Bridge configured', { host, port });
        console.log(`🎮 Minecraft Bridge configured for ${host}:${port}`);

        // Optionally connect
        try {
          await this.minecraftBridge.connect();
          logger.info('Minecraft Bridge connected successfully');
          console.log('✅ Minecraft Bridge connected');
        } catch (err) {
          logger.warn('Minecraft Bridge configured but not connected', { error: err.message });
          console.log('⚠️  Minecraft Bridge configured but not connected:', err.message);
        }
      } else {
        logger.info('Minecraft Bridge not configured (no RCON password set)');
        console.log('ℹ️  Minecraft Bridge not configured (set MINECRAFT_RCON_PASSWORD to enable)');
      }
    } catch (err) {
      logger.error('Failed to initialize Minecraft Bridge', { error: err.message });
      console.error('❌ Failed to initialize Minecraft Bridge:', err.message);
    }
  }

  /**
   * Initialize the NPC Engine with Minecraft Bridge
   */
  async initializeNPCEngine(io, systemState, attachTelemetryCallback, recomputeStatsCallback) {
    try {
      this.npcEngine = new NPCEngine({
        autoSpawn: false,
        defaultSpawnPosition: { x: 0, y: 64, z: 0 },
        autoRegisterFromRegistry: true,
        registry: this.npcRegistry,
        learningEngine: this.learningEngine,
        bridge: this.minecraftBridge
      });

      // Set up telemetry channel for real-time updates
      if (this.minecraftBridge) {
        this.minecraftBridge.setTelemetryChannel((event, payload) => {
          io.emit(event, payload);
        });
      }

      await this.npcEngine.registryReady;
      await this.npcEngine.learningReady;

      logger.info('NPC Engine initialized');
      console.log('✅ NPC Engine initialized');
      console.log(`   Registry: ${this.npcEngine.registry?.registryPath}`);
      console.log(`   Learning: ${this.npcEngine.learningEngine?.path}`);
      console.log(`   Bridge: ${this.minecraftBridge ? 'Connected' : 'Not configured'}`);

      const activeNPCs = this.npcEngine.registry?.listActive() || [];
      console.log(`   Active NPCs: ${activeNPCs.length}`);
      systemState.systemStats.activeBots = activeNPCs.length;

      attachTelemetryCallback(this.npcEngine);
      recomputeStatsCallback();
    } catch (err) {
      logger.error('Failed to initialize NPC engine', { error: err.message });
      console.error('❌ Failed to initialize NPC engine:', err.message);
    }
  }

  /**
   * Initialize Autonomic Core with Progression Engine integration
   */
  async initializeAutonomicCore(io) {
    try {
      this.autonomicCore = new AutonomicCore();
      await this.autonomicCore.init();

      // Connect NPC engine and bridge for phase coordination
      if (this.npcEngine) {
        this.autonomicCore.setNPCEngine(this.npcEngine);
      }

      // Listen for phase changes and propagate to all systems
      progressionEngine.on("phaseChanged", (data) => {
        console.log(`🌍 [Server] Phase changed to ${data.phase}: ${data.guide.name}`);

        // Update NPC engine phase
        if (this.npcEngine && typeof this.npcEngine.setPhase === "function") {
          this.npcEngine.setPhase(data.phase);
        }

        // Broadcast via WebSocket
        io.emit("progression:phaseChanged", data);
      });

      progressionEngine.on("progressUpdate", (data) => {
        io.emit("progression:progressUpdate", data);
      });

      progressionEngine.on("metricUpdate", (data) => {
        io.emit("progression:metricUpdate", data);
      });

      console.log('✅ Autonomic Core and Progression Engine initialized');
      logger.info('Autonomic Core and Progression Engine initialized');
    } catch (err) {
      logger.error('Failed to initialize Autonomic Core', { error: err.message });
      console.error('❌ Failed to initialize Autonomic Core:', err.message);
    }
  }

  /**
   * Initialize complete NPC system
   */
  async initialize(io, systemState, attachTelemetryCallback, recomputeStatsCallback) {
    try {
      logger.info('Initializing NPC system');

      // Initialize learning engine
      this.learningEngine = new LearningEngine(path.join(ROOT_DIR, 'data', 'npc_profiles.json'));
      await this.learningEngine.initialize();

      // Initialize NPC registry
      this.npcRegistry = new NPCRegistry({
        registryPath: path.join(ROOT_DIR, 'data', 'npc_registry.json')
      });
      await this.npcRegistry.load();

      await this.learningEngine.reconcileWithRegistry(this.npcRegistry);

      // Initialize spawner
      this.npcSpawner = new NPCSpawner({
        registry: this.npcRegistry,
        learningEngine: this.learningEngine,
        autoSpawn: false // Don't auto-spawn via spawner
      });
      await this.npcSpawner.initialize();

      // Initialize finalizer
      this.npcFinalizer = new NPCFinalizer({
        archivePath: path.join(ROOT_DIR, 'data', 'npc_archive.json'),
        registry: this.npcRegistry,
        learningEngine: this.learningEngine
      });
      await this.npcFinalizer.load();

      // Initialize Minecraft Bridge (optional)
      await this.initializeMinecraftBridge();

      // Initialize NPC Engine with all components
      await this.initializeNPCEngine(io, systemState, attachTelemetryCallback, recomputeStatsCallback);

      // Initialize Autonomic Core with Progression Engine
      await this.initializeAutonomicCore(io);

      logger.info('NPC system initialized successfully');
    } catch (err) {
      logger.error('Failed to initialize NPC system', { error: err.message });
      throw err;
    }
  }

  /**
   * Save NPC system state during shutdown
   */
  async save() {
    if (this.npcRegistry) {
      await this.npcRegistry.save();
      logger.info('NPC registry saved');
    }
    if (this.learningEngine) {
      await this.learningEngine.forceSave();
      logger.info('Learning engine saved');
    }
  }
}
