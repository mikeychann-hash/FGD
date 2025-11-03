package io.github.fgd.proxyplayer;

import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.World;
import org.bukkit.entity.ArmorStand;
import org.bukkit.entity.EntityType;
import org.bukkit.entity.Player;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Manages proxy bot entities (armor stands or NPCs)
 */
public class BotManager {

    private final FGDProxyPlayerPlugin plugin;
    private final Map<String, UUID> bots; // botId -> entity UUID

    public BotManager(FGDProxyPlayerPlugin plugin) {
        this.plugin = plugin;
        this.bots = new HashMap<>();
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

            // Create invisible armor stand as proxy bot
            ArmorStand bot = (ArmorStand) world.spawnEntity(location, EntityType.ARMOR_STAND);
            bot.setCustomName("§6[BOT] §f" + botId);
            bot.setCustomNameVisible(true);
            bot.setGravity(false);
            bot.setInvulnerable(true);
            bot.setVisible(false); // Invisible armor stand
            bot.setMarker(true); // No collision

            bots.put(botId, bot.getUniqueId());
            plugin.getLogger().info("Spawned bot " + botId + " at " + x + ", " + y + ", " + z);

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
}
