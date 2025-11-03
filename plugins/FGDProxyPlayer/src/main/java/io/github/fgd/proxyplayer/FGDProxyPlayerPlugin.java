package io.github.fgd.proxyplayer;

import org.bukkit.plugin.java.JavaPlugin;
import org.bukkit.command.Command;
import org.bukkit.command.CommandSender;
import org.bukkit.configuration.file.FileConfiguration;
import org.bukkit.Bukkit;

import java.net.URI;
import java.util.logging.Level;

/**
 * FGD Proxy Player Plugin
 * Bridges FGD Node.js backend with Minecraft server for hybrid bot framework
 */
public class FGDProxyPlayerPlugin extends JavaPlugin {

    private FGDWebSocketClient webSocketClient;
    private BotManager botManager;
    private ScanManager scanManager;
    private ActionManager actionManager;
    private String serverUrl;
    private boolean autoConnect;

    @Override
    public void onEnable() {
        // Save default config
        saveDefaultConfig();

        // Initialize managers
        this.botManager = new BotManager(this);
        this.scanManager = new ScanManager(this);
        this.actionManager = new ActionManager(this, botManager);

        // Load configuration
        FileConfiguration config = getConfig();
        this.serverUrl = config.getString("fgd.server-url", "ws://localhost:3000");
        this.autoConnect = config.getBoolean("fgd.auto-connect", true);

        getLogger().info("╔══════════════════════════════════════════╗");
        getLogger().info("║   FGD Proxy Player Plugin v1.0.0        ║");
        getLogger().info("║   Hybrid Bot Framework Bridge           ║");
        getLogger().info("╚══════════════════════════════════════════╝");

        // Register commands
        getCommand("fgd").setExecutor(this);

        // Auto-connect if enabled
        if (autoConnect) {
            Bukkit.getScheduler().runTaskLater(this, this::connectToFGD, 20L); // 1 second delay
        }

        getLogger().info("✅ FGDProxyPlayer enabled successfully!");
    }

    @Override
    public void onDisable() {
        // Disconnect WebSocket
        if (webSocketClient != null && webSocketClient.isOpen()) {
            webSocketClient.close();
        }

        // Remove all proxy bots
        botManager.removeAllBots();

        getLogger().info("FGDProxyPlayer disabled");
    }

    @Override
    public boolean onCommand(CommandSender sender, Command command, String label, String[] args) {
        if (!command.getName().equalsIgnoreCase("fgd")) {
            return false;
        }

        if (args.length == 0) {
            sender.sendMessage("§6FGD Proxy Player §7v1.0.0");
            sender.sendMessage("§7Usage: /fgd [reload|status|connect|disconnect]");
            return true;
        }

        switch (args[0].toLowerCase()) {
            case "reload":
                reloadConfig();
                this.serverUrl = getConfig().getString("fgd.server-url", "ws://localhost:3000");
                this.autoConnect = getConfig().getBoolean("fgd.auto-connect", true);
                sender.sendMessage("§aConfig reloaded!");
                return true;

            case "status":
                boolean connected = webSocketClient != null && webSocketClient.isOpen();
                sender.sendMessage("§6FGD Status:");
                sender.sendMessage("§7Server URL: §f" + serverUrl);
                sender.sendMessage("§7Connected: " + (connected ? "§a✓ Yes" : "§c✗ No"));
                sender.sendMessage("§7Active Bots: §f" + botManager.getBotCount());
                return true;

            case "connect":
                if (webSocketClient != null && webSocketClient.isOpen()) {
                    sender.sendMessage("§cAlready connected to FGD server!");
                    return true;
                }
                connectToFGD();
                sender.sendMessage("§aAttempting to connect to FGD server...");
                return true;

            case "disconnect":
                if (webSocketClient != null && webSocketClient.isOpen()) {
                    webSocketClient.close();
                    sender.sendMessage("§aDisconnected from FGD server");
                } else {
                    sender.sendMessage("§cNot connected to FGD server");
                }
                return true;

            default:
                sender.sendMessage("§cUnknown command. Use: reload, status, connect, disconnect");
                return true;
        }
    }

    /**
     * Connect to FGD WebSocket server
     */
    private void connectToFGD() {
        try {
            URI serverUri = new URI(serverUrl);
            webSocketClient = new FGDWebSocketClient(serverUri, this, botManager, scanManager, actionManager);
            webSocketClient.connect();
            getLogger().info("Connecting to FGD server at " + serverUrl);
        } catch (Exception e) {
            getLogger().log(Level.SEVERE, "Failed to connect to FGD server", e);
        }
    }

    public BotManager getBotManager() {
        return botManager;
    }

    public ScanManager getScanManager() {
        return scanManager;
    }

    public ActionManager getActionManager() {
        return actionManager;
    }
}
