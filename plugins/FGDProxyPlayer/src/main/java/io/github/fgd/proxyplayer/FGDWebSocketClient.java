package io.github.fgd.proxyplayer;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.bukkit.Bukkit;

import java.net.URI;
import java.util.logging.Level;

/**
 * WebSocket client for communicating with FGD Node.js backend
 */
public class FGDWebSocketClient extends WebSocketClient {

    private final FGDProxyPlayerPlugin plugin;
    private final BotManager botManager;
    private final ScanManager scanManager;
    private final Gson gson;

    public FGDWebSocketClient(URI serverUri, FGDProxyPlayerPlugin plugin, BotManager botManager, ScanManager scanManager) {
        super(serverUri);
        this.plugin = plugin;
        this.botManager = botManager;
        this.scanManager = scanManager;
        this.gson = new Gson();
    }

    @Override
    public void onOpen(ServerHandshake handshake) {
        plugin.getLogger().info("✅ Connected to FGD server");

        // Send registration message
        JsonObject registration = new JsonObject();
        registration.addProperty("type", "plugin_register");
        registration.addProperty("plugin", "FGDProxyPlayer");
        registration.addProperty("version", "1.0.0");
        send(gson.toJson(registration));
    }

    @Override
    public void onMessage(String message) {
        try {
            JsonObject json = JsonParser.parseString(message).getAsJsonObject();
            String type = json.has("type") ? json.get("type").getAsString() : "unknown";

            // Run handlers on main server thread
            Bukkit.getScheduler().runTask(plugin, () -> handleMessage(type, json));

        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to parse message: " + message, e);
        }
    }

    private void handleMessage(String type, JsonObject json) {
        switch (type) {
            case "moveBot":
                handleMoveBot(json);
                break;

            case "scanArea":
                handleScanArea(json);
                break;

            case "spawnBot":
                handleSpawnBot(json);
                break;

            case "despawnBot":
                handleDespawnBot(json);
                break;

            case "ping":
                handlePing(json);
                break;

            default:
                plugin.getLogger().warning("Unknown message type: " + type);
        }
    }

    private void handleMoveBot(JsonObject json) {
        try {
            String botId = json.get("botId").getAsString();
            JsonObject position = json.getAsJsonObject("position");

            double x = position.get("x").getAsDouble();
            double y = position.get("y").getAsDouble();
            double z = position.get("z").getAsDouble();

            boolean success = botManager.moveBot(botId, x, y, z);

            // Send response
            JsonObject response = new JsonObject();
            response.addProperty("type", "moveBot_response");
            response.addProperty("botId", botId);
            response.addProperty("success", success);
            response.add("position", position);
            send(gson.toJson(response));

        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to move bot", e);
        }
    }

    private void handleScanArea(JsonObject json) {
        try {
            String botId = json.get("botId").getAsString();
            int radius = json.has("radius") ? json.get("radius").getAsInt() : 5;
            JsonObject center = json.getAsJsonObject("center");

            double x = center.get("x").getAsDouble();
            double y = center.get("y").getAsDouble();
            double z = center.get("z").getAsDouble();

            JsonObject scanResult = scanManager.scanArea(botId, x, y, z, radius);

            // Send response
            JsonObject response = new JsonObject();
            response.addProperty("type", "scanArea_response");
            response.addProperty("botId", botId);
            response.add("result", scanResult);
            send(gson.toJson(response));

        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to scan area", e);
        }
    }

    private void handleSpawnBot(JsonObject json) {
        try {
            String botId = json.get("botId").getAsString();
            JsonObject position = json.has("position") ? json.getAsJsonObject("position") : null;

            double x = position != null ? position.get("x").getAsDouble() : 0;
            double y = position != null ? position.get("y").getAsDouble() : 64;
            double z = position != null ? position.get("z").getAsDouble() : 0;

            boolean success = botManager.spawnBot(botId, x, y, z);

            // Send response
            JsonObject response = new JsonObject();
            response.addProperty("type", "spawnBot_response");
            response.addProperty("botId", botId);
            response.addProperty("success", success);
            send(gson.toJson(response));

        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to spawn bot", e);
        }
    }

    private void handleDespawnBot(JsonObject json) {
        try {
            String botId = json.get("botId").getAsString();
            boolean success = botManager.despawnBot(botId);

            // Send response
            JsonObject response = new JsonObject();
            response.addProperty("type", "despawnBot_response");
            response.addProperty("botId", botId);
            response.addProperty("success", success);
            send(gson.toJson(response));

        } catch (Exception e) {
            plugin.getLogger().log(Level.WARNING, "Failed to despawn bot", e);
        }
    }

    private void handlePing(JsonObject json) {
        JsonObject response = new JsonObject();
        response.addProperty("type", "pong");
        response.addProperty("timestamp", System.currentTimeMillis());
        send(gson.toJson(response));
    }

    @Override
    public void onClose(int code, String reason, boolean remote) {
        String source = remote ? "server" : "client";
        plugin.getLogger().warning("❌ Disconnected from FGD server (" + source + "): " + reason);

        // Attempt reconnection after 5 seconds
        if (plugin.getConfig().getBoolean("fgd.auto-reconnect", true)) {
            Bukkit.getScheduler().runTaskLater(plugin, () -> {
                try {
                    plugin.getLogger().info("Attempting to reconnect to FGD server...");
                    this.reconnect();
                } catch (Exception e) {
                    plugin.getLogger().log(Level.WARNING, "Failed to reconnect", e);
                }
            }, 100L); // 5 seconds
        }
    }

    @Override
    public void onError(Exception ex) {
        plugin.getLogger().log(Level.SEVERE, "WebSocket error", ex);
    }
}
