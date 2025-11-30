package io.github.fgd.proxyplayer;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.Player;
import org.bukkit.scheduler.BukkitRunnable;
import org.bukkit.scheduler.BukkitTask;
import net.citizensnpcs.api.CitizensAPI;
import net.citizensnpcs.api.npc.NPC;
import net.citizensnpcs.api.npc.NPCRegistry;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Manages proxy bot entities (armor stands or NPCs)
 */
public class BotManager {

  private final FGDProxyPlayerPlugin plugin;
  private final Map<String, UUID> bots; // botId -> entity UUID
  private final Map<String, BukkitTask> navigationTasks;
  private final double stepSize;
  private final double arriveTolerance;
  private final NPCRegistry npcRegistry;

  public BotManager(FGDProxyPlayerPlugin plugin) {
    this.plugin = plugin;
    this.bots = new HashMap<>();
    this.navigationTasks = new HashMap<>();
    this.stepSize = plugin.getConfig().getDouble("fgd.path.stepSize", 0.5);
    this.arriveTolerance = plugin.getConfig().getDouble("fgd.path.tolerance", 1.5);
    this.npcRegistry = CitizensAPI.getNPCRegistry();
  }

    /**
     * Spawn a bot at the specified location
     */
    public boolean spawnBot(String botId, double x, double y, double z) {
        try {
            // Get default world or first world
            World world = Bukkit.getWorlds().get(0);

            Location location = new Location(world, x, y, z);

            // Try to find an online player first (for testing with real players)
            Player player = Bukkit.getPlayerExact(botId);
            if (player != null && player.isOnline()) {
                plugin.getLogger().info("Bot " + botId + " is a real player, teleporting instead");
                player.teleport(location);
                bots.put(botId, player.getUniqueId());
                return true;
            }

            // Create Citizens NPC (player-type)
            NPC npc = npcRegistry.createNPC(org.bukkit.entity.EntityType.PLAYER, botId);
            npc.spawn(location);
            npc.setProtected(true);
            bots.put(botId, npc.getEntity().getUniqueId());
            plugin.getLogger().info("Spawned bot " + botId + " (Citizens NPC) at " + x + ", " + y + ", " + z);

            return true;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to spawn bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Move a bot to a new location
     */
  public boolean moveBot(String botId, double x, double y, double z) {
    try {
      UUID entityId = bots.get(botId);
      if (entityId == null) {
        plugin.getLogger().warning("Bot " + botId + " not found, spawning...");
        return spawnBot(botId, x, y, z);
      }

      World world = Bukkit.getWorlds().get(0);
      var entity = Bukkit.getEntity(entityId);

      if (entity == null || !entity.isValid()) {
        plugin.getLogger().warning("Bot entity " + botId + " is invalid, respawning...");
        bots.remove(botId);
        return spawnBot(botId, x, y, z);
      }

      Location newLocation = new Location(world, x, y, z, entity.getLocation().getYaw(), entity.getLocation().getPitch());
      entity.teleport(newLocation);

      return true;

    } catch (Exception e) {
      plugin.getLogger().warning("Failed to move bot " + botId + ": " + e.getMessage());
      return false;
    }
  }

  /**
   * Navigate bot smoothly toward a target with small steps (works for armor stands and players)
   */
  public boolean navigateBot(String botId, double x, double y, double z, double tolerance, long timeoutMs) {
    UUID entityId = bots.get(botId);
    if (entityId == null) {
      plugin.getLogger().warning("Bot " + botId + " not found, spawning...");
      return spawnBot(botId, x, y, z);
    }
    var entity = Bukkit.getEntity(entityId);
    if (entity == null || !entity.isValid()) {
      plugin.getLogger().warning("Bot entity " + botId + " invalid, respawning...");
      bots.remove(botId);
      return spawnBot(botId, x, y, z);
    }
    NPC npc = CitizensAPI.getNPCRegistry().getByUniqueIdGlobal(entityId);
    if (npc != null) {
      net.citizensnpcs.api.ai.Navigator nav = npc.getNavigator();
      nav.getDefaultParameters().distanceMargin(tolerance > 0 ? tolerance : arriveTolerance);
      nav.getDefaultParameters().timeout((int) (timeoutMs / 50)); // ticks
      nav.setTarget(new Location(entity.getWorld(), x, y, z));
      return true;
    }

    // fallback to stepper
    Location target = new Location(entity.getWorld(), x, y, z);
    long maxTicks = Math.max(1, timeoutMs / 50);
    final Location[] lastPos = {entity.getLocation()};
    final int[] stuckTicks = {0};
    BukkitTask existing = navigationTasks.remove(botId);
    if (existing != null) existing.cancel();

    BukkitTask task = new BukkitRunnable() {
      long ticks = 0;
      @Override
      public void run() {
        var e = Bukkit.getEntity(entityId);
        if (e == null || !e.isValid()) {
          cancel();
          navigationTasks.remove(botId);
          return;
        }
        Location current = e.getLocation();
        double dist = current.distance(target);
        if (dist <= arriveTolerance) {
          e.teleport(target);
          cancel();
          navigationTasks.remove(botId);
          return;
        }
        // stuck detection
        if (current.distance(lastPos[0]) < 0.05) {
          stuckTicks[0]++;
        } else {
          stuckTicks[0] = 0;
        }
        lastPos[0] = current.clone();
        if (stuckTicks[0] > 40 || ticks++ > maxTicks) { // ~2s stuck or timeout
          cancel();
          navigationTasks.remove(botId);
          return;
        }
        double dx = target.getX() - current.getX();
        double dy = target.getY() - current.getY();
        double dz = target.getZ() - current.getZ();
        double len = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (len < 1e-6) {
          cancel();
          navigationTasks.remove(botId);
          return;
        }
        double factor = stepSize / len;
        Location next = current.clone().add(dx * factor, dy * factor, dz * factor);
        e.teleport(next);
      }
    }.runTaskTimer(plugin, 1L, 2L);

    navigationTasks.put(botId, task);
    return true;
  }

    /**
     * Despawn a bot
     */
    public boolean despawnBot(String botId) {
        try {
            UUID entityId = bots.remove(botId);
            if (entityId == null) {
                return false;
            }

            var entity = Bukkit.getEntity(entityId);
            if (entity != null && entity.isValid()) {
                entity.remove();
            }

            plugin.getLogger().info("Despawned bot " + botId);
            return true;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to despawn bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Remove all bots
     */
    public void removeAllBots() {
        for (String botId : bots.keySet()) {
            despawnBot(botId);
        }
    }

    /**
     * Get bot count
     */
    public int getBotCount() {
        return bots.size();
    }

    /**
     * Get bot location
     */
    public Location getBotLocation(String botId) {
        UUID entityId = bots.get(botId);
        if (entityId == null) {
            return null;
        }

        var entity = Bukkit.getEntity(entityId);
        return entity != null ? entity.getLocation() : null;
    }

    /**
     * Get the underlying Bukkit entity for a bot (player or armor stand)
     */
    public org.bukkit.entity.Entity getBotEntity(String botId) {
        UUID entityId = bots.get(botId);
        if (entityId == null) {
            return null;
        }
        return Bukkit.getEntity(entityId);
    }

    /**
     * Teleport bot to a position (used for simple navigation fallback)
     */
    public boolean teleportBot(String botId, double x, double y, double z) {
        UUID entityId = bots.get(botId);
        if (entityId == null) return false;
        var entity = Bukkit.getEntity(entityId);
        if (entity == null) return false;
        World world = entity.getWorld();
        return entity.teleport(new Location(world, x, y, z, entity.getLocation().getYaw(), entity.getLocation().getPitch()));
    }

    /**
     * Navigate bot smoothly toward a target with small steps (works for armor stands and players)
     */
    public boolean navigateTo(String botId, double x, double y, double z) {
      return navigateBot(botId, x, y, z);
    }
}
