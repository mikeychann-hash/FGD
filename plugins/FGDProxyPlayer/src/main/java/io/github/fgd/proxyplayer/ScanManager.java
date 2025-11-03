package io.github.fgd.proxyplayer;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.entity.Entity;
import org.bukkit.entity.LivingEntity;
import org.bukkit.entity.Player;

import java.util.Collection;

/**
 * Manages area scanning for bot awareness
 */
public class ScanManager {

    private final FGDProxyPlayerPlugin plugin;

    public ScanManager(FGDProxyPlayerPlugin plugin) {
        this.plugin = plugin;
    }

    /**
     * Scan an area around a location and return blocks and entities
     */
    public JsonObject scanArea(String botId, double x, double y, double z, int radius) {
        JsonObject result = new JsonObject();

        try {
            World world = Bukkit.getWorlds().get(0);
            Location center = new Location(world, x, y, z);

            // Scan blocks
            JsonArray blocks = scanBlocks(center, radius);
            result.add("blocks", blocks);

            // Scan entities
            JsonArray entities = scanEntities(center, radius, botId);
            result.add("entities", entities);

            // Add metadata
            JsonObject centerObj = new JsonObject();
            centerObj.addProperty("x", x);
            centerObj.addProperty("y", y);
            centerObj.addProperty("z", z);
            result.add("center", centerObj);

            result.addProperty("radius", radius);
            result.addProperty("timestamp", System.currentTimeMillis());

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to scan area: " + e.getMessage());
            result.addProperty("error", e.getMessage());
        }

        return result;
    }

    /**
     * Scan blocks in a radius
     */
    private JsonArray scanBlocks(Location center, int radius) {
        JsonArray blocks = new JsonArray();

        int scannedCount = 0;
        int maxBlocks = 100; // Limit to prevent lag

        // Scan in a cube around the center
        for (int dx = -radius; dx <= radius && scannedCount < maxBlocks; dx++) {
            for (int dy = -radius; dy <= radius && scannedCount < maxBlocks; dy++) {
                for (int dz = -radius; dz <= radius && scannedCount < maxBlocks; dz++) {
                    // Skip air blocks and blocks too far
                    if (Math.sqrt(dx*dx + dy*dy + dz*dz) > radius) {
                        continue;
                    }

                    Block block = center.getWorld().getBlockAt(
                        center.getBlockX() + dx,
                        center.getBlockY() + dy,
                        center.getBlockZ() + dz
                    );

                    Material material = block.getType();

                    // Only report non-air blocks and interesting blocks
                    if (material != Material.AIR) {
                        JsonObject blockObj = new JsonObject();
                        blockObj.addProperty("type", material.name());
                        blockObj.addProperty("x", block.getX());
                        blockObj.addProperty("y", block.getY());
                        blockObj.addProperty("z", block.getZ());

                        // Add relative position
                        blockObj.addProperty("dx", dx);
                        blockObj.addProperty("dy", dy);
                        blockObj.addProperty("dz", dz);

                        // Add distance
                        double distance = Math.sqrt(dx*dx + dy*dy + dz*dz);
                        blockObj.addProperty("distance", Math.round(distance * 10.0) / 10.0);

                        blocks.add(blockObj);
                        scannedCount++;
                    }
                }
            }
        }

        return blocks;
    }

    /**
     * Scan entities in a radius
     */
    private JsonArray scanEntities(Location center, int radius, String excludeBotId) {
        JsonArray entities = new JsonArray();

        Collection<Entity> nearbyEntities = center.getWorld().getNearbyEntities(
            center, radius, radius, radius
        );

        for (Entity entity : nearbyEntities) {
            // Skip the bot itself
            if (entity.getCustomName() != null && entity.getCustomName().contains(excludeBotId)) {
                continue;
            }

            JsonObject entityObj = new JsonObject();
            entityObj.addProperty("type", entity.getType().name());

            Location loc = entity.getLocation();
            entityObj.addProperty("x", Math.round(loc.getX() * 10.0) / 10.0);
            entityObj.addProperty("y", Math.round(loc.getY() * 10.0) / 10.0);
            entityObj.addProperty("z", Math.round(loc.getZ() * 10.0) / 10.0);

            // Add distance
            double distance = center.distance(loc);
            entityObj.addProperty("distance", Math.round(distance * 10.0) / 10.0);

            // Add name if available
            if (entity instanceof Player) {
                entityObj.addProperty("name", ((Player) entity).getName());
                entityObj.addProperty("isPlayer", true);
            } else if (entity.getCustomName() != null) {
                entityObj.addProperty("name", entity.getCustomName());
            }

            // Add health if living entity
            if (entity instanceof LivingEntity) {
                LivingEntity living = (LivingEntity) entity;
                entityObj.addProperty("health", living.getHealth());
                entityObj.addProperty("maxHealth", living.getMaxHealth());
            }

            entities.add(entityObj);
        }

        return entities;
    }
}
