/**
 * Fusion Data Visualization Module
 * Handles loading, validation, and rendering of fused knowledge data
 */
(function() {
  'use strict';

  // Configuration Constants
  const CONFIG = {
    API_ENDPOINT: '/data/fused_knowledge.json',
    CHART_COLORS: {
      skills: '#60a5fa',
      dialogues: '#34d399',
      outcomes: '#f87171'
    },
    CHART_BORDER_COLOR: 'rgba(15, 23, 42, 0.85)',
    CHART_BORDER_WIDTH: 2,
    CHART_HOVER_OFFSET: 10,
    ELEMENT_IDS: {
      chartCanvas: 'fusionPie',
      dataDisplay: 'fusionData',
      errorDisplay: 'fusionError',
      loadingIndicator: 'fusionLoading',
      skills: 'fusion-skills',
      dialogues: 'fusion-dialogues',
      outcomes: 'fusion-outcomes',
      lastSync: 'fusion-last',
      skillsDetail: 'fusion-skills-detail',
      dialoguesDetail: 'fusion-dialogues-detail',
      outcomesDetail: 'fusion-outcomes-detail',
      lastSyncDetail: 'fusion-last-detail'
    }
  };

  // Module state
  let chartInstance = null;

  /**
   * Extracts metric counts from data object
   * @param {Object} data - The fusion data object
   * @returns {Object} Metrics containing skills, dialogues, outcomes counts
   */
  function extractMetrics(data) {
    return {
      skills: Object.keys(data.skills || {}).length,
      dialogues: Object.keys(data.dialogues || {}).length,
      outcomes: (data.outcomes || []).length,
      lastSync: data.lastSync || 'N/A'
    };
  }

  /**
   * Validates that data has the expected structure
   * @param {*} data - Data to validate
   * @returns {boolean} True if data is valid
   */
  function validateData(data) {
    if (!data || typeof data !== 'object') {
      return false;
    }
    // Check that at least one expected property exists
    return 'skills' in data || 'dialogues' in data || 'outcomes' in data;
  }

  /**
   * Shows loading state
   */
  function showLoading() {
    const loadingEl = document.getElementById(CONFIG.ELEMENT_IDS.loadingIndicator);
    if (loadingEl) {
      loadingEl.style.display = 'block';
    }
  }

  /**
   * Hides loading state
   */
  function hideLoading() {
    const loadingEl = document.getElementById(CONFIG.ELEMENT_IDS.loadingIndicator);
    if (loadingEl) {
      loadingEl.style.display = 'none';
    }
  }

  /**
   * Displays error message to user
   * @param {string} message - Error message to display
   */
  function showError(message) {
    // Try to use dedicated error element first
    const errorEl = document.getElementById(CONFIG.ELEMENT_IDS.errorDisplay);
    const targetEl = errorEl || document.getElementById(CONFIG.ELEMENT_IDS.dataDisplay);

    if (targetEl) {
      targetEl.textContent = message;
      targetEl.style.color = '#ef4444'; // Red color for errors
    }
  }

  /**
   * Updates all DOM elements with extracted metrics
   * @param {Object} metrics - Metrics object with counts
   */
  function updateMetricsDisplay(metrics) {
    const elementMap = [
      [CONFIG.ELEMENT_IDS.skills, metrics.skills],
      [CONFIG.ELEMENT_IDS.dialogues, metrics.dialogues],
      [CONFIG.ELEMENT_IDS.outcomes, metrics.outcomes],
      [CONFIG.ELEMENT_IDS.lastSync, metrics.lastSync],
      [CONFIG.ELEMENT_IDS.skillsDetail, metrics.skills],
      [CONFIG.ELEMENT_IDS.dialoguesDetail, metrics.dialogues],
      [CONFIG.ELEMENT_IDS.outcomesDetail, metrics.outcomes],
      [CONFIG.ELEMENT_IDS.lastSyncDetail, metrics.lastSync]
    ];

    elementMap.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) {
        el.textContent = value;
      }
    });
  }

  /**
   * Creates or updates the fusion data chart
   * @param {Object} metrics - Metrics object with counts
   */
  function renderChart(metrics) {
    const canvasEl = document.getElementById(CONFIG.ELEMENT_IDS.chartCanvas);

    if (!canvasEl) {
      console.warn(`Chart canvas element '${CONFIG.ELEMENT_IDS.chartCanvas}' not found`);
      return;
    }

    const ctx = canvasEl.getContext('2d');
    if (!ctx) {
      console.error('Failed to get 2D context from canvas');
      return;
    }

    // Destroy existing chart instance to prevent memory leaks
    if (chartInstance) {
      chartInstance.destroy();
    }

    // Create new chart instance
    chartInstance = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Skills', 'Dialogues', 'Outcomes'],
        datasets: [{
          data: [metrics.skills, metrics.dialogues, metrics.outcomes],
          backgroundColor: [
            CONFIG.CHART_COLORS.skills,
            CONFIG.CHART_COLORS.dialogues,
            CONFIG.CHART_COLORS.outcomes
          ],
          borderWidth: CONFIG.CHART_BORDER_WIDTH,
          borderColor: CONFIG.CHART_BORDER_COLOR,
          hoverOffset: CONFIG.CHART_HOVER_OFFSET
        }]
      },
      options: {
        plugins: {
          legend: {
            position: 'bottom'
          }
        }
      }
    });
  }

  /**
   * Renders the complete fusion data visualization
   * @param {Object} data - The fusion data object
   */
  function render(data) {
    if (!validateData(data)) {
      showError('Invalid data format received from server');
      return;
    }

    const metrics = extractMetrics(data);

    // Render chart
    renderChart(metrics);

    // Update metrics display
    updateMetricsDisplay(metrics);

    // Display raw data JSON
    const dataEl = document.getElementById(CONFIG.ELEMENT_IDS.dataDisplay);
    if (dataEl) {
      dataEl.textContent = JSON.stringify(data, null, 2);
      dataEl.style.color = ''; // Reset any error styling
    }
  }

  /**
   * Loads and renders fusion data from the server
   */
  async function loadFusionData() {
    showLoading();

    try {
      const res = await fetch(CONFIG.API_ENDPOINT);

      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }

      const data = await res.json();
      render(data);

    } catch (err) {
      console.error('Unable to load fusion data', err);
      showError('Unable to load fusion data. Check the server logs for details.');
    } finally {
      hideLoading();
    }
  }

  /**
   * Initializes the fusion page
   */
  function initialize() {
    // Update copyright year
    const yearEl = document.getElementById('year');
    if (yearEl) {
      yearEl.textContent = new Date().getFullYear();
    }

    // Load fusion data
    loadFusionData();
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialize);
  } else {
    initialize();
  }

})();
