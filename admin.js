/**
 * Admin Panel Module
 * Handles system administration, configuration, and monitoring
 */
(function() {
  'use strict';

  // Configuration Constants
  const CONFIG = {
    API_ENDPOINTS: {
      systemStats: '/data/system_stats.json',
      nodes: '/data/cluster_status.json',
      logs: '/data/system_logs.json',
      config: '/api/config'
    },
    LOG_REFRESH_INTERVAL: 3000, // 3 seconds
    STATS_REFRESH_INTERVAL: 5000, // 5 seconds
    MAX_LOG_ENTRIES: 100,
    ELEMENT_IDS: {
      // System Overview
      uptime: 'uptime',
      totalNodes: 'total-nodes',
      activeTasks: 'active-tasks',
      avgCpu: 'avg-cpu',
      avgMemory: 'avg-memory',
      dataProcessed: 'data-processed',
      // Node Management
      nodeList: 'node-list',
      // User Management
      totalUsers: 'total-users',
      activeUsers: 'active-users',
      // Data Management
      lastBackup: 'last-backup',
      backupSize: 'backup-size',
      // Alerts
      activeAlerts: 'active-alerts',
      incidentsToday: 'incidents-today',
      // Configuration
      maxWorkers: 'max-workers',
      maxWorkersValue: 'max-workers-value',
      logLevel: 'log-level',
      autoScaling: 'auto-scaling',
      telemetry: 'telemetry',
      // Logs
      logViewer: 'log-viewer'
    }
  };

  // Module state
  let logRefreshTimer = null;
  let statsRefreshTimer = null;
  let currentLogFilter = 'all';
  let allLogs = [];

  /**
   * Formats uptime from milliseconds to readable format
   * @param {number} ms - Uptime in milliseconds
   * @returns {string} Formatted uptime string
   */
  function formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else {
      return `${minutes}m ${seconds % 60}s`;
    }
  }

  /**
   * Formats bytes to human readable format
   * @param {number} bytes - Size in bytes
   * @returns {string} Formatted size string
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }

  /**
   * Updates system statistics display
   * @param {Object} stats - System statistics object
   */
  function updateSystemStats(stats) {
    const elements = [
      [CONFIG.ELEMENT_IDS.uptime, formatUptime(stats.uptime || 0)],
      [CONFIG.ELEMENT_IDS.totalNodes, stats.totalNodes || 0],
      [CONFIG.ELEMENT_IDS.activeTasks, stats.activeTasks || 0],
      [CONFIG.ELEMENT_IDS.avgCpu, `${stats.avgCpu || 0}%`],
      [CONFIG.ELEMENT_IDS.avgMemory, `${stats.avgMemory || 0}%`],
      [CONFIG.ELEMENT_IDS.dataProcessed, formatBytes(stats.dataProcessed || 0)]
    ];

    elements.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    });
  }

  /**
   * Loads and displays system statistics
   */
  async function loadSystemStats() {
    try {
      const res = await fetch(CONFIG.API_ENDPOINTS.systemStats);

      if (!res.ok) {
        throw new Error(`Stats request failed with status ${res.status}`);
      }

      const stats = await res.json();
      updateSystemStats(stats);

    } catch (err) {
      console.error('Unable to load system stats', err);
    }
  }

  /**
   * Loads and displays node list
   */
  async function loadNodeList() {
    const nodeListEl = document.getElementById(CONFIG.ELEMENT_IDS.nodeList);
    if (!nodeListEl) return;

    try {
      const res = await fetch(CONFIG.API_ENDPOINTS.nodes);

      if (!res.ok) {
        throw new Error(`Nodes request failed with status ${res.status}`);
      }

      const data = await res.json();
      const nodes = data.nodes || [];

      if (nodes.length === 0) {
        nodeListEl.innerHTML = '<p style="color: var(--text-secondary);">No nodes available</p>';
        return;
      }

      nodeListEl.innerHTML = nodes.map(node => `
        <div style="padding: 8px; border-bottom: 1px solid rgba(96, 165, 250, 0.1); display: flex; justify-content: space-between; align-items: center;">
          <span>${node.name}</span>
          <span style="color: ${node.status === 'healthy' ? 'var(--success)' : 'var(--danger)'};">
            ${node.status === 'healthy' ? '● Online' : '○ Offline'}
          </span>
        </div>
      `).join('');

    } catch (err) {
      console.error('Unable to load node list', err);
      nodeListEl.innerHTML = '<p style="color: var(--danger);">Failed to load nodes</p>';
    }
  }

  /**
   * Creates a log entry element
   * @param {Object} log - Log entry object
   * @returns {string} HTML string for log entry
   */
  function createLogEntry(log) {
    return `
      <div class="log-entry">
        <span class="log-time">${log.time}</span>
        <span class="log-level ${log.level}">${log.level}</span>
        <span class="log-message">${log.message}</span>
      </div>
    `;
  }

  /**
   * Filters logs by level
   * @param {string} filter - Filter type (all, info, warn, error)
   */
  function filterLogs(filter) {
    currentLogFilter = filter;
    renderLogs();
  }

  /**
   * Renders logs based on current filter
   */
  function renderLogs() {
    const logViewer = document.getElementById(CONFIG.ELEMENT_IDS.logViewer);
    if (!logViewer) return;

    let filteredLogs = allLogs;
    if (currentLogFilter !== 'all') {
      filteredLogs = allLogs.filter(log => log.level === currentLogFilter);
    }

    if (filteredLogs.length === 0) {
      logViewer.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 20px;">No logs to display</p>';
      return;
    }

    logViewer.innerHTML = filteredLogs.map(createLogEntry).join('');

    // Auto-scroll to bottom
    logViewer.scrollTop = logViewer.scrollHeight;
  }

  /**
   * Loads system logs
   */
  async function loadSystemLogs() {
    try {
      const res = await fetch(CONFIG.API_ENDPOINTS.logs);

      if (!res.ok) {
        throw new Error(`Logs request failed with status ${res.status}`);
      }

      const data = await res.json();
      allLogs = data.logs || [];

      // Keep only last MAX_LOG_ENTRIES
      if (allLogs.length > CONFIG.MAX_LOG_ENTRIES) {
        allLogs = allLogs.slice(-CONFIG.MAX_LOG_ENTRIES);
      }

      renderLogs();

    } catch (err) {
      console.error('Unable to load system logs', err);
      const logViewer = document.getElementById(CONFIG.ELEMENT_IDS.logViewer);
      if (logViewer) {
        logViewer.innerHTML = '<p style="color: var(--danger);">Failed to load logs</p>';
      }
    }
  }

  /**
   * Clears all logs from display
   */
  function clearLogs() {
    allLogs = [];
    renderLogs();
  }

  /**
   * Initializes all event listeners
   */
  function initializeEventListeners() {
    // Node Management Actions
    const nodeActions = {
      'add-node': () => alert('Add Node dialog would open here'),
      'restart-nodes': () => {
        if (confirm('Restart all nodes? This will cause temporary downtime.')) {
          console.log('Restarting all nodes...');
          alert('Nodes restart initiated');
        }
      },
      'sync-nodes': () => {
        console.log('Force syncing nodes...');
        alert('Node synchronization started');
      },
      'shutdown-cluster': () => {
        if (confirm('⚠️ EMERGENCY SHUTDOWN\n\nThis will immediately shut down the entire cluster. Are you absolutely sure?')) {
          console.log('Emergency shutdown initiated');
          alert('Emergency shutdown sequence started');
        }
      }
    };

    Object.entries(nodeActions).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', handler);
      }
    });

    // Configuration Controls
    const maxWorkersSlider = document.getElementById(CONFIG.ELEMENT_IDS.maxWorkers);
    const maxWorkersValue = document.getElementById(CONFIG.ELEMENT_IDS.maxWorkersValue);
    if (maxWorkersSlider && maxWorkersValue) {
      maxWorkersSlider.addEventListener('input', (e) => {
        maxWorkersValue.textContent = e.target.value;
      });
    }

    const saveConfigBtn = document.getElementById('save-config');
    if (saveConfigBtn) {
      saveConfigBtn.addEventListener('click', async () => {
        const config = {
          maxWorkers: parseInt(maxWorkersSlider?.value || 8, 10),
          logLevel: document.getElementById(CONFIG.ELEMENT_IDS.logLevel)?.value || 'info',
          autoScaling: document.getElementById(CONFIG.ELEMENT_IDS.autoScaling)?.checked || false,
          telemetry: document.getElementById(CONFIG.ELEMENT_IDS.telemetry)?.checked || false
        };

        try {
          console.log('Saving configuration:', config);
          // In real app, send to server
          alert('Configuration saved successfully!');
        } catch (err) {
          console.error('Failed to save configuration', err);
          alert('Failed to save configuration');
        }
      });
    }

    // User Management Actions
    const userActions = {
      'create-user': () => alert('Create User dialog would open here'),
      'manage-roles': () => alert('Role Management panel would open here'),
      'view-sessions': () => alert('Active Sessions view would open here'),
      'audit-log': () => alert('Audit Log viewer would open here')
    };

    Object.entries(userActions).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', handler);
      }
    });

    // Data Management Actions
    const dataActions = {
      'export-data': () => {
        console.log('Exporting data...');
        alert('Data export started. You will be notified when complete.');
      },
      'import-data': () => alert('Import Data dialog would open here'),
      'create-backup': () => {
        console.log('Creating backup...');
        alert('Backup creation started');
      },
      'restore-backup': () => {
        if (confirm('Restore from backup? This will overwrite current data.')) {
          console.log('Restoring backup...');
          alert('Backup restore initiated');
        }
      }
    };

    Object.entries(dataActions).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', handler);
      }
    });

    // Alert Management Actions
    const alertActions = {
      'configure-alerts': () => alert('Alert Configuration panel would open here'),
      'view-incidents': () => alert('Incident Report viewer would open here'),
      'test-alerts': () => {
        console.log('Testing alert system...');
        alert('Test alert sent to all configured channels');
      }
    };

    Object.entries(alertActions).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', handler);
      }
    });

    // Log Filter Buttons
    const logFilterButtons = {
      'filter-all': () => filterLogs('all'),
      'filter-info': () => filterLogs('info'),
      'filter-warn': () => filterLogs('warn'),
      'filter-error': () => filterLogs('error'),
      'clear-logs': clearLogs
    };

    Object.entries(logFilterButtons).forEach(([id, handler]) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', handler);
      }
    });
  }

  /**
   * Starts periodic data refreshing
   */
  function startAutoRefresh() {
    // Initial load
    loadSystemStats();
    loadNodeList();
    loadSystemLogs();

    // Set up periodic refresh
    statsRefreshTimer = setInterval(() => {
      loadSystemStats();
      loadNodeList();
    }, CONFIG.STATS_REFRESH_INTERVAL);

    logRefreshTimer = setInterval(() => {
      loadSystemLogs();
    }, CONFIG.LOG_REFRESH_INTERVAL);
  }

  /**
   * Stops periodic data refreshing
   */
  function stopAutoRefresh() {
    if (statsRefreshTimer) {
      clearInterval(statsRefreshTimer);
      statsRefreshTimer = null;
    }
    if (logRefreshTimer) {
      clearInterval(logRefreshTimer);
      logRefreshTimer = null;
    }
  }

  /**
   * Initializes the admin panel
   */
  function initialize() {
    // Update copyright year
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }

    // Initialize event listeners
    initializeEventListeners();

    // Start auto-refresh
    startAutoRefresh();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      stopAutoRefresh();
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
