package io.github.fgd.proxyplayer;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.kyori.adventure.text.Component;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.entity.*;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.util.Vector;

import java.util.UUID;

/**
 * Manages bot actions: dig, place, attack, useItem, inventory, chat, jump
 */
public class ActionManager {

    private final FGDProxyPlayerPlugin plugin;
    private final BotManager botManager;

    public ActionManager(FGDProxyPlayerPlugin plugin, BotManager botManager) {
        this.plugin = plugin;
        this.botManager = botManager;
    }

    /**
     * Dig (break) a block at the specified position
     */
    public boolean dig(String botId, double x, double y, double z) {
        try {
            Location botLocation = botManager.getBotLocation(botId);
            if (botLocation == null) {
                plugin.getLogger().warning("Bot " + botId + " not found for dig action");
                return false;
            }

            World world = botLocation.getWorld();
            Block block = world.getBlockAt((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));

            if (block.getType() == Material.AIR) {
                return true; // Already air
            }

            // Break the block (drops items naturally)
            block.breakNaturally();
            plugin.getLogger().info("Bot " + botId + " broke block at " + x + ", " + y + ", " + z);

            return true;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to dig block for bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Place a block at the specified position
     */
    public boolean place(String botId, double x, double y, double z, String blockType) {
        try {
            Location botLocation = botManager.getBotLocation(botId);
            if (botLocation == null) {
                plugin.getLogger().warning("Bot " + botId + " not found for place action");
                return false;
            }

            World world = botLocation.getWorld();
            Block block = world.getBlockAt((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));

            // Parse material type
            Material material;
            try {
                material = Material.valueOf(blockType.toUpperCase());
            } catch (IllegalArgumentException e) {
                plugin.getLogger().warning("Invalid block type: " + blockType);
                return false;
            }

            // Set the block type
            block.setType(material);
            plugin.getLogger().info("Bot " + botId + " placed " + blockType + " at " + x + ", " + y + ", " + z);

            return true;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to place block for bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Attack an entity
     */
    public boolean attack(String botId, String targetId) {
        try {
            Location botLocation = botManager.getBotLocation(botId);
            if (botLocation == null) {
                plugin.getLogger().warning("Bot " + botId + " not found for attack action");
                return false;
            }

            // Try to find target entity by name
            Entity targetEntity = null;
            Player targetPlayer = Bukkit.getPlayerExact(targetId);

            if (targetPlayer != null && targetPlayer.isOnline()) {
                targetEntity = targetPlayer;
            } else {
                // Search for nearby entities with matching custom name
                for (Entity entity : botLocation.getWorld().getEntities()) {
                    if (entity.getCustomName() != null && entity.getCustomName().contains(targetId)) {
                        targetEntity = entity;
                        break;
                    }
                }
            }

            if (targetEntity == null) {
                plugin.getLogger().warning("Target entity " + targetId + " not found for attack");
                return false;
            }

            // Check if entity is within reasonable attack range (5 blocks)
            if (botLocation.distance(targetEntity.getLocation()) > 5.0) {
                plugin.getLogger().warning("Target " + targetId + " too far for attack");
                return false;
            }

            // Apply damage
            if (targetEntity instanceof Damageable) {
                ((Damageable) targetEntity).damage(1.0);
                plugin.getLogger().info("Bot " + botId + " attacked " + targetId);
                return true;
            }

            return false;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to attack for bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Use an item
     */
    public boolean useItem(String botId, String itemName, String target) {
        try {
            Location botLocation = botManager.getBotLocation(botId);
            if (botLocation == null) {
                plugin.getLogger().warning("Bot " + botId + " not found for useItem action");
                return false;
            }

            // For armor stands, we can't really "use" items, but we can simulate effects
            // If this is a real player bot, we can manipulate their inventory
            Player player = Bukkit.getPlayerExact(botId);
            if (player != null && player.isOnline()) {
                Material material;
                try {
                    material = Material.valueOf(itemName.toUpperCase());
                } catch (IllegalArgumentException e) {
                    plugin.getLogger().warning("Invalid item type: " + itemName);
                    return false;
                }

                ItemStack item = new ItemStack(material, 1);
                player.getInventory().setItemInMainHand(item);
                plugin.getLogger().info("Bot " + botId + " equipped " + itemName);
                return true;
            }

            plugin.getLogger().info("Bot " + botId + " used item " + itemName + " (simulated)");
            return true;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to use item for bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Get bot inventory
     */
    public JsonObject inventory(String botId) {
        JsonObject result = new JsonObject();
        JsonArray items = new JsonArray();

        try {
            // Check if bot is a real player
            Player player = Bukkit.getPlayerExact(botId);
            if (player != null && player.isOnline()) {
                PlayerInventory inv = player.getInventory();

                // Get all items in inventory
                for (int i = 0; i < inv.getSize(); i++) {
                    ItemStack item = inv.getItem(i);
                    if (item != null && item.getType() != Material.AIR) {
                        JsonObject itemObj = new JsonObject();
                        itemObj.addProperty("slot", i);
                        itemObj.addProperty("type", item.getType().toString());
                        itemObj.addProperty("amount", item.getAmount());
                        items.add(itemObj);
                    }
                }

                result.addProperty("success", true);
                result.add("items", items);
                plugin.getLogger().info("Retrieved inventory for bot " + botId + ": " + items.size() + " items");
            } else {
                // Bot is an armor stand, no real inventory
                result.addProperty("success", true);
                result.add("items", items);
                result.addProperty("note", "Bot is armor stand, no inventory");
            }

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to get inventory for bot " + botId + ": " + e.getMessage());
            result.addProperty("success", false);
            result.addProperty("error", e.getMessage());
        }

        return result;
    }

    /**
     * Send a chat message
     */
    public boolean chat(String botId, String message) {
        try {
            // Broadcast message as if from bot
            String formattedMessage = "§6[BOT] §f" + botId + "§7: §f" + message;
            Component component = Component.text(formattedMessage);

            for (Player player : Bukkit.getOnlinePlayers()) {
                player.sendMessage(component);
            }

            plugin.getLogger().info("Bot " + botId + " sent chat: " + message);
            return true;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to send chat for bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Make bot jump (apply upward velocity)
     */
    public boolean jump(String botId) {
        try {
            Location botLocation = botManager.getBotLocation(botId);
            if (botLocation == null) {
                plugin.getLogger().warning("Bot " + botId + " not found for jump action");
                return false;
            }

            Entity entity = Bukkit.getEntity(getBotEntityId(botId));
            if (entity == null) {
                return false;
            }

            // Apply upward velocity for jump effect
            Vector velocity = entity.getVelocity();
            velocity.setY(0.42); // Standard Minecraft jump velocity
            entity.setVelocity(velocity);

            plugin.getLogger().info("Bot " + botId + " jumped");
            return true;

        } catch (Exception e) {
            plugin.getLogger().warning("Failed to jump for bot " + botId + ": " + e.getMessage());
            return false;
        }
    }

    /**
     * Helper to get bot entity UUID (accessing BotManager's internal map)
     */
    private UUID getBotEntityId(String botId) {
        // This is a workaround - in production, BotManager should expose this
        Location loc = botManager.getBotLocation(botId);
        if (loc == null) return null;

        // Find entity at location
        for (Entity entity : loc.getWorld().getNearbyEntities(loc, 0.5, 0.5, 0.5)) {
            if (entity instanceof ArmorStand || entity instanceof Player) {
                return entity.getUniqueId();
            }
        }
        return null;
    }
}
