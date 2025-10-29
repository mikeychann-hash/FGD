/**
 * Dashboard Visualization Module
 * Handles cluster monitoring, metrics visualization, and policy management
 */
(function() {
  'use strict';

  // Configuration Constants
  const CONFIG = {
    API_ENDPOINTS: {
      cluster: '/data/cluster_status.json',
      fusion: '/data/fused_knowledge.json',
      metrics: '/data/metrics.json'
    },
    CHART_COLORS: {
      cpu: '#60a5fa',
      memory: '#34d399',
      skills: '#60a5fa',
      dialogues: '#34d399',
      outcomes: '#f87171'
    },
    CHART_BORDER_COLOR: 'rgba(15, 23, 42, 0.85)',
    CHART_BORDER_WIDTH: 2,
    POLLING_INTERVAL: 5000, // 5 seconds
    ELEMENT_IDS: {
      clusterGrid: 'cluster-grid',
      cpuChart: 'cpuChart',
      memChart: 'memChart',
      fusionBar: 'fusionBar',
      fusionSkills: 'fusion-skills',
      fusionDialogues: 'fusion-dialogues',
      fusionOutcomes: 'fusion-outcomes',
      fusionLast: 'fusion-last',
      learningRate: 'learningRate',
      lrValue: 'lr-value',
      delegationBias: 'delegationBias',
      dbValue: 'db-value',
      cooldown: 'cooldown',
      cdValue: 'cd-value',
      applyPolicy: 'apply-policy'
    }
  };

  // Module state
  let chartInstances = {
    cpu: null,
    memory: null,
    fusion: null
  };
  let pollingTimer = null;
  let metricsHistory = {
    cpu: [],
    memory: [],
    timestamps: []
  };

  /**
   * Validates cluster data structure
   * @param {*} data - Data to validate
   * @returns {boolean} True if data is valid
   */
  function validateClusterData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    return Array.isArray(data.nodes);
  }

  /**
   * Validates fusion data structure
   * @param {*} data - Data to validate
   * @returns {boolean} True if data is valid
   */
  function validateFusionData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    return 'skills' in data || 'dialogues' in data || 'outcomes' in data;
  }

  /**
   * Validates metrics data structure
   * @param {*} data - Data to validate
   * @returns {boolean} True if data is valid
   */
  function validateMetricsData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    return 'cpu' in data || 'memory' in data;
  }

  /**
   * Creates a node card element
   * @param {Object} node - Node data object
   * @returns {HTMLElement} Node card element
   */
  function createNodeCard(node) {
    const card = document.createElement('div');
    card.className = 'node-card';

    const statusClass = node.status === 'healthy' ? 'ok' : 'bad';
    const statusText = node.status === 'healthy' ? 'HEALTHY' : 'OFFLINE';

    card.innerHTML = `
      <span class="status-badge ${statusClass}">${statusText}</span>
      <strong>${node.name || 'Unknown Node'}</strong>
      <small>CPU: ${node.cpu || 0}%</small>
      <small>Memory: ${node.memory || 0}%</small>
      <small>Tasks: ${node.tasks || 0}</small>
    `;

    return card;
  }

  /**
   * Renders cluster nodes grid
   * @param {Array} nodes - Array of node objects
   */
  function renderClusterNodes(nodes) {
    const gridEl = document.getElementById(CONFIG.ELEMENT_IDS.clusterGrid);
    if (!gridEl) {
      console.warn(`Cluster grid element not found`);
      return;
    }

    // Clear existing content
    gridEl.innerHTML = '';

    // Create and append node cards
    nodes.forEach(node => {
      const card = createNodeCard(node);
      gridEl.appendChild(card);
    });
  }

  /**
   * Updates metrics history with new data point
   * @param {Object} metrics - Current metrics snapshot
   */
  function updateMetricsHistory(metrics) {
    const MAX_HISTORY = 15; // 15 data points for rolling window

    metricsHistory.cpu.push(metrics.cpu || 0);
    metricsHistory.memory.push(metrics.memory || 0);
    metricsHistory.timestamps.push(new Date().toLocaleTimeString());

    // Keep only last MAX_HISTORY items
    if (metricsHistory.cpu.length > MAX_HISTORY) {
      metricsHistory.cpu.shift();
      metricsHistory.memory.shift();
      metricsHistory.timestamps.shift();
    }
  }

  /**
   * Creates or updates CPU utilization chart
   */
  function renderCPUChart() {
    const canvasEl = document.getElementById(CONFIG.ELEMENT_IDS.cpuChart);
    if (!canvasEl) {
      console.warn(`CPU chart canvas not found`);
      return;
    }

    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context from CPU canvas');
      return;
    }

    // Destroy existing chart to prevent memory leaks
    if (chartInstances.cpu) {
      chartInstances.cpu.destroy();
    }

    // Create new chart instance
    chartInstances.cpu = new Chart(ctx, {
      type: 'line',
      data: {
        labels: metricsHistory.timestamps,
        datasets: [{
          label: 'CPU %',
          data: metricsHistory.cpu,
          borderColor: CONFIG.CHART_COLORS.cpu,
          backgroundColor: `${CONFIG.CHART_COLORS.cpu}33`,
          fill: true,
          tension: 0.4,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  /**
   * Creates or updates memory allocation chart
   */
  function renderMemoryChart() {
    const canvasEl = document.getElementById(CONFIG.ELEMENT_IDS.memChart);
    if (!canvasEl) {
      console.warn(`Memory chart canvas not found`);
      return;
    }

    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context from memory canvas');
      return;
    }

    // Destroy existing chart to prevent memory leaks
    if (chartInstances.memory) {
      chartInstances.memory.destroy();
    }

    // Create new chart instance
    chartInstances.memory = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: metricsHistory.timestamps,
        datasets: [{
          label: 'Memory %',
          data: metricsHistory.memory,
          backgroundColor: CONFIG.CHART_COLORS.memory,
          borderColor: CONFIG.CHART_BORDER_COLOR,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  /**
   * Creates or updates fusion knowledge bar chart in sidebar
   * @param {Object} metrics - Fusion metrics
   */
  function renderFusionChart(metrics) {
    const canvasEl = document.getElementById(CONFIG.ELEMENT_IDS.fusionBar);
    if (!canvasEl) {
      console.warn(`Fusion chart canvas not found`);
      return;
    }

    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context from fusion canvas');
      return;
    }

    // Destroy existing chart to prevent memory leaks
    if (chartInstances.fusion) {
      chartInstances.fusion.destroy();
    }

    // Create new chart instance
    chartInstances.fusion = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: ['Skills', 'Dialogues', 'Outcomes'],
        datasets: [{
          data: [metrics.skills, metrics.dialogues, metrics.outcomes],
          backgroundColor: [
            CONFIG.CHART_COLORS.skills,
            CONFIG.CHART_COLORS.dialogues,
            CONFIG.CHART_COLORS.outcomes
          ],
          borderColor: CONFIG.CHART_BORDER_COLOR,
          borderWidth: 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        scales: {
          x: {
            beginAtZero: true
          }
        },
        plugins: {
          legend: {
            display: false
          }
        }
      }
    });
  }

  /**
   * Updates fusion knowledge summary in sidebar
   * @param {Object} metrics - Fusion metrics
   */
  function updateFusionSummary(metrics) {
    const elementMap = [
      [CONFIG.ELEMENT_IDS.fusionSkills, metrics.skills],
      [CONFIG.ELEMENT_IDS.fusionDialogues, metrics.dialogues],
      [CONFIG.ELEMENT_IDS.fusionOutcomes, metrics.outcomes],
      [CONFIG.ELEMENT_IDS.fusionLast, metrics.lastSync]
    ];

    elementMap.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    });

    // Render fusion chart
    renderFusionChart(metrics);
  }

  /**
   * Extracts fusion metrics from data object
   * @param {Object} data - The fusion data object
   * @returns {Object} Metrics containing skills, dialogues, outcomes counts
   */
  function extractFusionMetrics(data) {
    return {
      skills: Object.keys(data.skills || {}).length,
      dialogues: Object.keys(data.dialogues || {}).length,
      outcomes: (data.outcomes || []).length,
      lastSync: data.lastSync || 'N/A'
    };
  }

  /**
   * Loads cluster status from server
   */
  async function loadClusterData() {
    try {
      const res = await fetch(CONFIG.API_ENDPOINTS.cluster);

      if (!res.ok) {
        throw new Error(`Cluster request failed with status ${res.status}`);
      }

      const data = await res.json();

      if (!validateClusterData(data)) {
        throw new Error('Invalid cluster data format');
      }

      renderClusterNodes(data.nodes);

    } catch (err) {
      console.error('Unable to load cluster data', err);
      // Show error in cluster grid
      const gridEl = document.getElementById(CONFIG.ELEMENT_IDS.clusterGrid);
      if (gridEl) {
        gridEl.innerHTML = '<p style="color: #f87171;">Unable to load cluster data</p>';
      }
    }
  }

  /**
   * Loads fusion knowledge data from server
   */
  async function loadFusionData() {
    try {
      const res = await fetch(CONFIG.API_ENDPOINTS.fusion);

      if (!res.ok) {
        throw new Error(`Fusion request failed with status ${res.status}`);
      }

      const data = await res.json();

      if (!validateFusionData(data)) {
        throw new Error('Invalid fusion data format');
      }

      const metrics = extractFusionMetrics(data);
      updateFusionSummary(metrics);

    } catch (err) {
      console.error('Unable to load fusion data', err);
      // Update fusion summary with zeros
      updateFusionSummary({
        skills: 0,
        dialogues: 0,
        outcomes: 0,
        lastSync: 'Error'
      });
    }
  }

  /**
   * Loads metrics data from server
   */
  async function loadMetricsData() {
    try {
      const res = await fetch(CONFIG.API_ENDPOINTS.metrics);

      if (!res.ok) {
        throw new Error(`Metrics request failed with status ${res.status}`);
      }

      const data = await res.json();

      if (!validateMetricsData(data)) {
        throw new Error('Invalid metrics data format');
      }

      updateMetricsHistory(data);
      renderCPUChart();
      renderMemoryChart();

    } catch (err) {
      console.error('Unable to load metrics data', err);
      // Continue with empty/default metrics
    }
  }

  /**
   * Loads all dashboard data
   */
  async function loadDashboardData() {
    await Promise.all([
      loadClusterData(),
      loadFusionData(),
      loadMetricsData()
    ]);
  }

  /**
   * Starts polling for data updates
   */
  function startPolling() {
    // Initial load
    loadDashboardData();

    // Set up polling interval
    pollingTimer = setInterval(() => {
      loadDashboardData();
    }, CONFIG.POLLING_INTERVAL);
  }

  /**
   * Stops polling for data updates
   */
  function stopPolling() {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  /**
   * Initializes policy control panel event listeners
   */
  function initializePolicyControls() {
    // Learning Rate slider
    const lrSlider = document.getElementById(CONFIG.ELEMENT_IDS.learningRate);
    const lrValue = document.getElementById(CONFIG.ELEMENT_IDS.lrValue);
    if (lrSlider && lrValue) {
      lrSlider.addEventListener('input', (e) => {
        lrValue.textContent = e.target.value;
      });
    }

    // Delegation Bias slider
    const dbSlider = document.getElementById(CONFIG.ELEMENT_IDS.delegationBias);
    const dbValue = document.getElementById(CONFIG.ELEMENT_IDS.dbValue);
    if (dbSlider && dbValue) {
      dbSlider.addEventListener('input', (e) => {
        dbValue.textContent = e.target.value;
      });
    }

    // Cooldown slider
    const cdSlider = document.getElementById(CONFIG.ELEMENT_IDS.cooldown);
    const cdValue = document.getElementById(CONFIG.ELEMENT_IDS.cdValue);
    if (cdSlider && cdValue) {
      cdSlider.addEventListener('input', (e) => {
        cdValue.textContent = e.target.value;
      });
    }

    // Apply Policy button
    const applyBtn = document.getElementById(CONFIG.ELEMENT_IDS.applyPolicy);
    if (applyBtn) {
      applyBtn.addEventListener('click', handlePolicyApply);
    }
  }

  /**
   * Handles policy apply button click
   */
  async function handlePolicyApply() {
    const lrSlider = document.getElementById(CONFIG.ELEMENT_IDS.learningRate);
    const dbSlider = document.getElementById(CONFIG.ELEMENT_IDS.delegationBias);
    const cdSlider = document.getElementById(CONFIG.ELEMENT_IDS.cooldown);

    const policy = {
      learningRate: parseFloat(lrSlider.value),
      delegationBias: parseFloat(dbSlider.value),
      cooldown: parseInt(cdSlider.value, 10)
    };

    try {
      const res = await fetch('/api/policy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(policy)
      });

      if (!res.ok) {
        throw new Error(`Policy update failed with status ${res.status}`);
      }

      console.log('Policy applied successfully:', policy);
      // Optionally show success feedback to user

    } catch (err) {
      console.error('Failed to apply policy', err);
      // Optionally show error feedback to user
      alert('Failed to apply policy. Check console for details.');
    }
  }

  /**
   * Initializes the dashboard
   */
  function initialize() {
    // Update copyright year
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }

    // Initialize policy controls
    initializePolicyControls();

    // Start data polling
    startPolling();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      stopPolling();

      // Destroy all chart instances
      Object.values(chartInstances).forEach(chart => {
        if (chart) {
          chart.destroy();
        }
      });
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
