package io.github.fgd.proxyplayer;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.bukkit.Bukkit;
import org.bukkit.Location;
import org.bukkit.Material;
import org.bukkit.World;
import org.bukkit.block.Block;
import org.bukkit.block.Chest;
import org.bukkit.entity.Damageable;
import org.bukkit.entity.Entity;
import org.bukkit.entity.Player;
import org.bukkit.inventory.Inventory;
import org.bukkit.inventory.ItemStack;
import org.bukkit.inventory.PlayerInventory;
import org.bukkit.util.Vector;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.logging.Level;

/**
 * Action manager for proxy bots (Citizens NPC or real player fallback).
 */
public class ActionManager {

    private final FGDProxyPlayerPlugin plugin;
    private final BotManager botManager;
    private final Map<String, Map<Integer, ItemStack>> virtualInventories = new HashMap<>();
    private final Map<String, ChestSession> chestSessions = new HashMap<>();

    public ActionManager(FGDProxyPlayerPlugin plugin, BotManager botManager) {
        this.plugin = plugin;
        this.botManager = botManager;
    }

    // Basic actions
    public boolean dig(String botId, double x, double y, double z) {
        try {
            Location loc = botManager.getBotLocation(botId);
            if (loc == null) return false;
            World world = loc.getWorld();
            Block block = world.getBlockAt((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));
            if (block.getType() == Material.AIR) return true;
            block.breakNaturally();
            return true;
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to dig for " + botId + ": " + e.getMessage());
            return false;
        }
    }

    public boolean place(String botId, double x, double y, double z, String blockType) {
        try {
            Location loc = botManager.getBotLocation(botId);
            if (loc == null) return false;
            World world = loc.getWorld();
            Material mat = Material.matchMaterial(blockType);
            if (mat == null) return false;
            Block block = world.getBlockAt((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));
            block.setType(mat);
            return true;
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to place for " + botId + ": " + e.getMessage());
            return false;
        }
    }

    public boolean attack(String botId, String targetId) {
        try {
            Location loc = botManager.getBotLocation(botId);
            if (loc == null) return false;
            Player targetPlayer = Bukkit.getPlayerExact(targetId);
            Entity target = targetPlayer;
            if (target == null) {
                for (Entity e : loc.getWorld().getEntities()) {
                    if (e.getCustomName() != null && e.getCustomName().contains(targetId)) {
                        target = e;
                        break;
                    }
                }
            }
            if (target == null || loc.distance(target.getLocation()) > 5.0) return false;
            if (target instanceof Damageable dmg) {
                dmg.damage(1.0);
                return true;
            }
            return false;
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to attack for " + botId + ": " + e.getMessage());
            return false;
        }
    }

    public boolean useItem(String botId, String itemName, String target) {
        try {
            Player player = Bukkit.getPlayerExact(botId);
            if (player != null && player.isOnline()) {
                Material mat = Material.matchMaterial(itemName);
                if (mat == null) return false;
                player.getInventory().setItemInMainHand(new ItemStack(mat, 1));
                return true;
            }
            return true;
        } catch (Exception e) {
            plugin.getLogger().warning("Failed to use item for " + botId + ": " + e.getMessage());
            return false;
        }
    }

    public JsonObject inventory(String botId) {
        JsonObject result = new JsonObject();
        JsonArray items = new JsonArray();
        try {
            Player player = Bukkit.getPlayerExact(botId);
            if (player != null && player.isOnline()) {
                PlayerInventory inv = player.getInventory();
                for (int i = 0; i < inv.getSize(); i++) {
                    ItemStack item = inv.getItem(i);
                    if (item != null && item.getType() != Material.AIR) {
                        JsonObject obj = new JsonObject();
                        obj.addProperty("slot", i);
                        obj.addProperty("type", item.getType().toString());
                        obj.addProperty("amount", item.getAmount());
                        items.add(obj);
                    }
                }
                result.addProperty("success", true);
                result.add("items", items);
            } else {
                result.addProperty("success", true);
                result.add("items", items);
                result.addProperty("note", "No player inventory");
            }
        } catch (Exception e) {
            result.addProperty("success", false);
            result.addProperty("error", e.getMessage());
        }
        return result;
    }

    public boolean chat(String botId, String message) {
        try {
            String msg = "§6[BOT] §f" + botId + "§7: §f" + message;
            for (Player p : Bukkit.getOnlinePlayers()) {
                p.sendMessage(msg);
            }
            plugin.getLogger().info("Bot " + botId + " sent chat: " + message);
            return true;
        } catch (Exception e) {
            plugin.getLogger().warning("Failed chat for " + botId + ": " + e.getMessage());
            return false;
        }
    }

    public boolean jump(String botId) {
        try {
            Entity e = botManager.getBotEntity(botId);
            if (e == null) return false;
            Vector v = e.getVelocity();
            v.setY(0.42);
            e.setVelocity(v);
            return true;
        } catch (Exception ex) {
            return false;
        }
    }

    // Eating
    public ActionResult eat(String botId, String itemId, Integer slot) {
        try {
            Entity entity = botManager.getBotEntity(botId);
            if (!(entity instanceof Player player)) {
                return ActionResult.failure("not_player", "Bot must be a player to eat");
            }
            PlayerInventory inv = player.getInventory();
            ItemStack stack = null;
            int stackSlot = -1;
            if (slot != null && slot >= 0 && slot < inv.getSize()) {
                stack = inv.getItem(slot);
                stackSlot = slot;
            }
            if (stack == null) {
                for (int i = 0; i < inv.getSize(); i++) {
                    ItemStack cand = inv.getItem(i);
                    if (cand != null && cand.getType().isEdible()) {
                        stack = cand;
                        stackSlot = i;
                        break;
                    }
                }
            }
            if (stack == null || !stack.getType().isEdible()) {
                return ActionResult.failure("no_food", "No edible item");
            }
            int before = player.getFoodLevel();
            stack.setAmount(stack.getAmount() - 1);
            if (stack.getAmount() <= 0) inv.setItem(stackSlot, null);
            player.setFoodLevel(Math.min(20, before + 4));
            player.setSaturation(Math.min(20, player.getSaturation() + 2f));
            return ActionResult.success(player.getFoodLevel());
        } catch (Exception e) {
            return ActionResult.failure("plugin_error", e.getMessage());
        }
    }

    // Inventory helpers
    public JsonObject snapshotInventory(String botId) {
        JsonObject res = new JsonObject();
        JsonArray slots = new JsonArray();
        try {
            InventoryContainer c = resolveInventory(botId);
            for (int i = 0; i < c.size(); i++) {
                ItemStack s = c.get(i);
                if (s == null || s.getType() == Material.AIR) continue;
                JsonObject slot = new JsonObject();
                slot.addProperty("slot", i);
                slot.addProperty("itemId", s.getType().getKey().toString());
                slot.addProperty("count", s.getAmount());
                slots.add(slot);
            }
            res.addProperty("type", "inventory:snapshot");
            res.addProperty("botId", botId);
            res.add("slots", slots);
            res.addProperty("success", true);
        } catch (Exception e) {
            res.addProperty("success", false);
            res.addProperty("error", e.getMessage());
        }
        return res;
    }

    public ActionResult moveSlot(String botId, int from, int to) {
        try {
            InventoryContainer c = resolveInventory(botId);
            if (!c.isValid(from) || !c.isValid(to)) {
                return ActionResult.failure("invalid_slot", "Slot out of range");
            }
            ItemStack a = c.get(from);
            ItemStack b = c.get(to);
            c.set(from, b);
            c.set(to, a);
            return ActionResult.successWithSnapshot(snapshotInventory(botId));
        } catch (Exception e) {
            return ActionResult.failure("plugin_error", e.getMessage());
        }
    }

    public ActionResult useSlot(String botId, int slot) {
        try {
            InventoryContainer c = resolveInventory(botId);
            if (!c.isValid(slot)) return ActionResult.failure("invalid_slot", "Slot out of range");
            ItemStack s = c.get(slot);
            if (s == null || s.getType() == Material.AIR) return ActionResult.failure("empty_slot", "No item");
            Entity entity = botManager.getBotEntity(botId);
            if (entity instanceof Player p) {
                p.getInventory().setItemInMainHand(s);
                p.swingMainHand();
            }
            return ActionResult.successWithSnapshot(snapshotInventory(botId));
        } catch (Exception e) {
            return ActionResult.failure("plugin_error", e.getMessage());
        }
    }

    public ActionResult equip(String botId, String itemName, Integer preferredSlot) {
        try {
            InventoryContainer c = resolveInventory(botId);
            ItemMatch match = findItem(c, itemName, preferredSlot);
            if (match == null) return ActionResult.failure("not_found", "Item not found");
            Entity entity = botManager.getBotEntity(botId);
            if (entity instanceof Player p) {
                p.getInventory().setItemInMainHand(match.stack);
            }
            return ActionResult.successWithSnapshot(snapshotInventory(botId));
        } catch (Exception e) {
            return ActionResult.failure("plugin_error", e.getMessage());
        }
    }

    public ActionResult drop(String botId, int slot, Integer count) {
        try {
            InventoryContainer c = resolveInventory(botId);
            if (!c.isValid(slot)) return ActionResult.failure("invalid_slot", "Slot out of range");
            ItemStack s = c.get(slot);
            if (s == null || s.getType() == Material.AIR) return ActionResult.failure("empty_slot", "No item");
            int dropCount = (count == null || count <= 0 || count > s.getAmount()) ? s.getAmount() : count;
            ItemStack drop = s.clone();
            drop.setAmount(dropCount);
            Entity e = botManager.getBotEntity(botId);
            if (e != null) {
                e.getWorld().dropItemNaturally(e.getLocation(), drop);
            }
            int remaining = s.getAmount() - dropCount;
            c.set(slot, remaining > 0 ? new ItemStack(s.getType(), remaining) : null);
            return ActionResult.successWithSnapshot(snapshotInventory(botId));
        } catch (Exception ex) {
            return ActionResult.failure("plugin_error", ex.getMessage());
        }
    }

    // Chest interactions
    public JsonObject chestOpen(String botId, double x, double y, double z) {
        Player player = getOnlinePlayer(botId);
        Chest chest = null;
        Inventory virtual = null;
        if (player != null) {
            Block block = player.getWorld().getBlockAt((int) Math.floor(x), (int) Math.floor(y), (int) Math.floor(z));
            if (block.getState() instanceof Chest c) chest = c;
        }
        if (chest == null) {
            virtual = Bukkit.createInventory(null, 27, "VirtualChest");
        }
        if (chest == null && virtual == null) {
            return failureSnapshot(botId, "not_chest", "Target block is not a chest");
        }
        chestSessions.put(botId, new ChestSession(chest, player, virtual));
        if (player != null && chest != null) player.openInventory(chest.getBlockInventory());
        return buildChestSnapshot(botId, chest, virtual, x, y, z, true);
    }

    public JsonObject chestLoot(String botId, String[] items, double x, double y, double z) {
        ChestSession session = requireChestSession(botId, x, y, z);
        if (session == null) return failureSnapshot(botId, "no_chest", "Chest not open");
        InventoryContainer inv = resolveInventory(botId);
        Inventory chestInv = session.chest != null ? session.chest.getBlockInventory() : session.virtualInventory;
        for (int i = 0; i < chestInv.getSize(); i++) {
            ItemStack s = chestInv.getItem(i);
            if (s == null || s.getType() == Material.AIR) continue;
            if (items == null || items.length == 0 || matches(s, items)) {
                Map<Integer, ItemStack> leftover = inv.addItem(s.clone());
                chestInv.setItem(i, leftover.isEmpty() ? null : leftover.values().iterator().next());
            }
        }
        return buildChestSnapshot(botId, session.chest, session.virtualInventory, x, y, z, false);
    }

    public JsonObject chestDeposit(String botId, String[] items, double x, double y, double z) {
        ChestSession session = requireChestSession(botId, x, y, z);
        if (session == null) return failureSnapshot(botId, "no_chest", "Chest not open");
        Inventory chestInv = session.chest != null ? session.chest.getBlockInventory() : session.virtualInventory;
        InventoryContainer inv = resolveInventory(botId);
        for (int i = 0; i < inv.size(); i++) {
            ItemStack s = inv.get(i);
            if (s == null || s.getType() == Material.AIR) continue;
            if (items != null && items.length > 0 && !matches(s, items)) continue;
            Map<Integer, ItemStack> leftover = chestInv.addItem(s.clone());
            inv.set(i, leftover.isEmpty() ? null : leftover.values().iterator().next());
        }
        return buildChestSnapshot(botId, session.chest, session.virtualInventory, x, y, z, false);
    }

    public JsonObject chestTransfer(String botId, int from, int to, Integer count, double x, double y, double z) {
        ChestSession session = requireChestSession(botId, x, y, z);
        if (session == null) return failureSnapshot(botId, "no_chest", "Chest not open");
        Inventory chestInv = session.chest != null ? session.chest.getBlockInventory() : session.virtualInventory;
        if (from < 0 || from >= chestInv.getSize() || to < 0 || to >= chestInv.getSize()) {
            return failureSnapshot(botId, "invalid_slot", "Slot out of range");
        }
        ItemStack src = chestInv.getItem(from);
        if (src == null || src.getType() == Material.AIR) return failureSnapshot(botId, "empty_slot", "Source empty");
        int moveCount = (count == null || count <= 0 || count > src.getAmount()) ? src.getAmount() : count;
        ItemStack moving = src.clone();
        moving.setAmount(moveCount);
        chestInv.setItem(to, moving);
        int remaining = src.getAmount() - moveCount;
        chestInv.setItem(from, remaining > 0 ? new ItemStack(src.getType(), remaining) : null);
        return buildChestSnapshot(botId, session.chest, session.virtualInventory, x, y, z, false);
    }

    public JsonObject chestClose(String botId) {
        ChestSession session = chestSessions.remove(botId);
        if (session != null && session.player != null) session.player.closeInventory();
        JsonObject resp = new JsonObject();
        resp.addProperty("type", "chest:closed");
        resp.addProperty("botId", botId);
        return resp;
    }

    // Helpers
    private Player getOnlinePlayer(String botId) {
        Player p = Bukkit.getPlayerExact(botId);
        if (p != null && p.isOnline()) return p;
        Entity e = botManager.getBotEntity(botId);
        if (e instanceof Player pl && pl.isOnline()) return pl;
        return null;
    }

    private InventoryContainer resolveInventory(String botId) {
        Entity e = botManager.getBotEntity(botId);
        if (e instanceof Player p) return InventoryContainer.forPlayer(p.getInventory());
        return InventoryContainer.forVirtual(virtualInventories.computeIfAbsent(botId, k -> new HashMap<>()), 36);
    }

    private ItemMatch findItem(InventoryContainer c, String itemName, Integer preferredSlot) {
        Material desired = Material.matchMaterial(itemName);
        if (desired == null) return null;
        if (preferredSlot != null && c.isValid(preferredSlot)) {
            ItemStack s = c.get(preferredSlot);
            if (s != null && s.getType() == desired) return new ItemMatch(preferredSlot, s);
        }
        for (int i = 0; i < c.size(); i++) {
            ItemStack s = c.get(i);
            if (s != null && s.getType() == desired) return new ItemMatch(i, s);
        }
        return null;
    }

    private ChestSession requireChestSession(String botId, double x, double y, double z) {
        ChestSession session = chestSessions.get(botId);
        if (session == null) return null;
        if (session.chest != null) {
            Location pos = session.chest.getLocation();
            if (pos.getBlockX() != (int) Math.floor(x) || pos.getBlockY() != (int) Math.floor(y) || pos.getBlockZ() != (int) Math.floor(z)) {
                return null;
            }
        }
        return session;
    }

    private JsonObject buildChestSnapshot(String botId, Chest chest, Inventory virtual, double x, double y, double z, boolean success) {
        JsonObject snap = new JsonObject();
        snap.addProperty("type", "chest:snapshot");
        snap.addProperty("botId", botId);
        JsonObject pos = new JsonObject();
        pos.addProperty("x", x);
        pos.addProperty("y", y);
        pos.addProperty("z", z);
        snap.add("chestPos", pos);
        JsonArray slots = new JsonArray();
        Inventory inv = chest != null ? chest.getBlockInventory() : virtual;
        for (int i = 0; i < inv.getSize(); i++) {
            ItemStack s = inv.getItem(i);
            if (s == null || s.getType() == Material.AIR) continue;
            JsonObject slot = new JsonObject();
            slot.addProperty("slot", i);
            slot.addProperty("itemId", s.getType().getKey().toString());
            slot.addProperty("count", s.getAmount());
            slots.add(slot);
        }
        snap.add("slots", slots);
        snap.addProperty("success", success);
        return snap;
    }

    private JsonObject failureSnapshot(String botId, String code, String msg) {
        JsonObject snap = new JsonObject();
        snap.addProperty("type", "chest:snapshot");
        snap.addProperty("botId", botId);
        snap.addProperty("success", false);
        snap.addProperty("error", code);
        snap.addProperty("message", msg);
        return snap;
    }

    private boolean matches(ItemStack stack, String[] items) {
        if (items == null || items.length == 0) return true;
        for (String it : items) {
            if (stack.getType().getKey().toString().equalsIgnoreCase(it) || stack.getType().name().equalsIgnoreCase(it)) {
                return true;
            }
        }
        return false;
    }

    private UUID getBotEntityId(String botId) {
        Location loc = botManager.getBotLocation(botId);
        if (loc == null) return null;
        for (Entity e : loc.getWorld().getNearbyEntities(loc, 0.5, 0.5, 0.5)) {
            if (e instanceof Player) return e.getUniqueId();
        }
        return null;
    }

    // Inner helper classes
    private static class InventoryContainer {
        private final PlayerInventory playerInventory;
        private final Map<Integer, ItemStack> virtual;
        private final int size;

        private InventoryContainer(PlayerInventory inv) {
            this.playerInventory = inv;
            this.virtual = null;
            this.size = inv.getSize();
        }

        private InventoryContainer(Map<Integer, ItemStack> virtual, int size) {
            this.playerInventory = null;
            this.virtual = virtual;
            this.size = size;
        }

        public static InventoryContainer forPlayer(PlayerInventory inv) {
            return new InventoryContainer(inv);
        }

        public static InventoryContainer forVirtual(Map<Integer, ItemStack> virtual, int size) {
            return new InventoryContainer(virtual, size);
        }

        public int size() { return size; }

        public boolean isValid(int slot) { return slot >= 0 && slot < size; }

        public ItemStack get(int slot) {
            if (!isValid(slot)) return null;
            if (playerInventory != null) return playerInventory.getItem(slot);
            return virtual.get(slot);
        }

        public void set(int slot, ItemStack stack) {
            if (!isValid(slot)) return;
            if (playerInventory != null) {
                playerInventory.setItem(slot, stack);
            } else {
                if (stack == null || stack.getType() == Material.AIR) virtual.remove(slot);
                else virtual.put(slot, stack);
            }
        }

        public Map<Integer, ItemStack> addItem(ItemStack stack) {
            Map<Integer, ItemStack> leftover = new HashMap<>();
            if (playerInventory != null) {
                Map<Integer, ItemStack> res = playerInventory.addItem(stack);
                if (res != null) leftover.putAll(res);
                return leftover;
            }
            ItemStack remaining = stack.clone();
            // merge
            for (int i = 0; i < size; i++) {
                ItemStack ex = virtual.get(i);
                if (ex == null || ex.getType() == Material.AIR) continue;
                if (!ex.isSimilar(remaining)) continue;
                int space = ex.getMaxStackSize() - ex.getAmount();
                if (space <= 0) continue;
                int move = Math.min(space, remaining.getAmount());
                ex.setAmount(ex.getAmount() + move);
                remaining.setAmount(remaining.getAmount() - move);
                virtual.put(i, ex);
                if (remaining.getAmount() <= 0) break;
            }
            if (remaining.getAmount() > 0) {
                for (int i = 0; i < size; i++) {
                    ItemStack ex = virtual.get(i);
                    if (ex == null || ex.getType() == Material.AIR) {
                        virtual.put(i, remaining);
                        remaining = null;
                        break;
                    }
                }
            }
            if (remaining != null && remaining.getAmount() > 0) {
                leftover.put(0, remaining);
            }
            return leftover;
        }
    }

    private static class ItemMatch {
        final int slot;
        final ItemStack stack;
        ItemMatch(int slot, ItemStack stack) { this.slot = slot; this.stack = stack; }
    }

    private static class ChestSession {
        final Chest chest;
        final Player player;
        final Inventory virtualInventory;
        ChestSession(Chest chest, Player player, Inventory virtualInventory) {
            this.chest = chest;
            this.player = player;
            this.virtualInventory = virtualInventory;
        }
    }

    public static class ActionResult {
        private final boolean success;
        private final String errorCode;
        private final String message;
        private final Integer hunger;
        private final JsonObject snapshot;

        private ActionResult(boolean success, String errorCode, String message, Integer hunger, JsonObject snapshot) {
            this.success = success;
            this.errorCode = errorCode;
            this.message = message;
            this.hunger = hunger;
            this.snapshot = snapshot;
        }

        public static ActionResult success(int hunger) { return new ActionResult(true, null, null, hunger, null); }
        public static ActionResult successWithSnapshot(JsonObject snap) { return new ActionResult(true, null, null, null, snap); }
        public static ActionResult failure(String code, String msg) { return new ActionResult(false, code, msg, null, null); }

        public boolean isSuccess() { return success; }
        public String getErrorCode() { return errorCode; }
        public String getMessage() { return message; }
        public Integer getHunger() { return hunger; }
        public JsonObject getSnapshot() { return snapshot; }
    }
}
