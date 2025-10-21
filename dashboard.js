const charts = {
  cpu: null,
  mem: null,
  policy: null,
  threshold: null
};

const chartDefaults = {
  type: "line",
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        ticks: { color: "#cbd5f5", callback: value => `${value}%` },
        grid: { color: "rgba(148, 163, 184, 0.1)" }
      },
      x: {
        ticks: { color: "#94a3b8", maxRotation: 0 },
        grid: { display: false }
      }
    },
    plugins: {
      legend: {
        labels: { color: "#e2e8f0" }
      },
      tooltip: {
        callbacks: {
          label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
        }
      }
    }
  }
};

async function fetchJson(url) {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Request failed: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`Failed to load ${url}`, err);
    return null;
  }
}

function formatTimestamp(timestamp) {
  if (!timestamp) return "N/A";
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour12: false });
  } catch (err) {
    return timestamp;
  }
}

function toPercentSeries(history, key) {
  return history.map(item => Math.round((item[key] || 0) * 1000) / 10);
}

function createLabels(history) {
  return history.map(item => formatTimestamp(item.timestamp));
}

function ensureChart(key, ctx, datasets, labels, options = {}) {
  if (!ctx) return;
  const chart = charts[key];
  if (!chart) {
    charts[key] = new Chart(ctx, {
      ...chartDefaults,
      data: { labels, datasets },
      options: {
        ...chartDefaults.options,
        ...options
      }
    });
  } else {
    chart.data.labels = labels;
    chart.data.datasets = datasets;
    chart.options = {
      ...chart.options,
      ...options
    };
    chart.update();
  }
}

function updateCpuChart(snapshot) {
  const history = snapshot.metricsHistory || [];
  if (history.length === 0) return;
  const labels = createLabels(history);
  const cpuSeries = toPercentSeries(history, "cpu");
  const forecastHistory = snapshot.forecastHistory || [];
  const forecastSeries = forecastHistory.length === history.length
    ? forecastHistory.map(item => Math.round((item.cpu || 0) * 1000) / 10)
    : history.map((_, idx) => {
        const forecast = forecastHistory[idx] || forecastHistory[forecastHistory.length - 1];
        return forecast ? Math.round((forecast.cpu || 0) * 1000) / 10 : cpuSeries[idx];
      });

  const thresholds = snapshot.policyState?.dynamicThresholds || {};
  const high = Math.round((thresholds.HIGH || 0) * 1000) / 10;
  const critical = Math.round((thresholds.CRITICAL || 0) * 1000) / 10;

  ensureChart(
    "cpu",
    document.getElementById("cpuChart")?.getContext("2d"),
    [
      {
        label: "CPU Actual",
        data: cpuSeries,
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96, 165, 250, 0.25)",
        tension: 0.35,
        fill: true
      },
      {
        label: "CPU Forecast",
        data: forecastSeries,
        borderColor: "#fbbf24",
        backgroundColor: "rgba(251, 191, 36, 0.18)",
        borderDash: [6, 6],
        tension: 0.25,
        fill: false
      },
      {
        label: "High Threshold",
        data: labels.map(() => high * 1),
        borderColor: "rgba(248, 113, 113, 0.65)",
        borderDash: [4, 6],
        pointRadius: 0
      },
      {
        label: "Critical Threshold",
        data: labels.map(() => critical * 1),
        borderColor: "rgba(239, 68, 68, 0.9)",
        borderDash: [2, 4],
        pointRadius: 0
      }
    ],
    labels
  );
}

function updateMemChart(snapshot) {
  const history = snapshot.metricsHistory || [];
  if (history.length === 0) return;
  const labels = createLabels(history);
  const memSeries = toPercentSeries(history, "mem");
  const forecastHistory = snapshot.forecastHistory || [];
  const forecastSeries = forecastHistory.length === history.length
    ? forecastHistory.map(item => Math.round((item.mem || 0) * 1000) / 10)
    : history.map((_, idx) => {
        const forecast = forecastHistory[idx] || forecastHistory[forecastHistory.length - 1];
        return forecast ? Math.round((forecast.mem || 0) * 1000) / 10 : memSeries[idx];
      });

  ensureChart(
    "mem",
    document.getElementById("memChart")?.getContext("2d"),
    [
      {
        label: "Memory Actual",
        data: memSeries,
        borderColor: "#34d399",
        backgroundColor: "rgba(52, 211, 153, 0.22)",
        tension: 0.35,
        fill: true
      },
      {
        label: "Memory Forecast",
        data: forecastSeries,
        borderColor: "#f59e0b",
        backgroundColor: "rgba(245, 158, 11, 0.18)",
        borderDash: [6, 6],
        tension: 0.25,
        fill: false
      }
    ],
    labels
  );
}

function updatePolicyTrendChart(snapshot) {
  const history = snapshot.metricsHistory || [];
  if (history.length === 0) return;
  const labels = createLabels(history);
  const cpuSeries = toPercentSeries(history, "cpu");
  const forecastHistory = snapshot.forecastHistory || [];
  const forecastSeries = forecastHistory.length === history.length
    ? forecastHistory.map(item => Math.round((item.cpu || 0) * 1000) / 10)
    : cpuSeries;

  ensureChart(
    "policy",
    document.getElementById("policyTrendChart")?.getContext("2d"),
    [
      {
        label: "CPU Actual",
        data: cpuSeries,
        borderColor: "#60a5fa",
        backgroundColor: "rgba(96, 165, 250, 0.2)",
        tension: 0.3,
        fill: true
      },
      {
        label: "CPU Forecast",
        data: forecastSeries,
        borderColor: "#fbbf24",
        borderDash: [8, 6],
        fill: false,
        tension: 0.2
      }
    ],
    labels
  );
}

function updateThresholdChart(policyState) {
  if (!policyState?.thresholdHistory || policyState.thresholdHistory.length === 0) return;
  const history = policyState.thresholdHistory.slice(-60);
  const labels = history.map(item => formatTimestamp(item.timestamp));
  const dataFor = key => history.map(item => Math.round((item[key] || 0) * 1000) / 10);

  ensureChart(
    "threshold",
    document.getElementById("thresholdChart")?.getContext("2d"),
    [
      {
        label: "Critical",
        data: dataFor("CRITICAL"),
        borderColor: "rgba(239, 68, 68, 0.9)",
        tension: 0.2,
        fill: false
      },
      {
        label: "High",
        data: dataFor("HIGH"),
        borderColor: "rgba(248, 113, 113, 0.8)",
        tension: 0.2,
        fill: false
      },
      {
        label: "Medium",
        data: dataFor("MEDIUM"),
        borderColor: "rgba(250, 204, 21, 0.7)",
        tension: 0.2,
        fill: false
      },
      {
        label: "Low",
        data: dataFor("LOW"),
        borderColor: "rgba(56, 189, 248, 0.7)",
        tension: 0.2,
        fill: false
      }
    ],
    labels,
    {
      scales: {
        ...chartDefaults.options.scales,
        y: {
          ...chartDefaults.options.scales.y,
          max: 100
        }
      }
    }
  );
}

function updatePolicySummary(state, recommendations) {
  const list = document.getElementById("policy-summary-list");
  if (!list || !state) return;
  list.innerHTML = "";

  const items = [
    ["Learning Rate", state.learningRate?.toFixed(2)],
    ["Delegation Bias", state.delegationBias?.toFixed(2)],
    ["Cooldown", `${state.cooldown} ms`],
    ["Recommended Interval", recommendations?.scanInterval ? `${recommendations.scanInterval} ms` : "Auto"],
    ["Last Adjustment", state.lastAdjustment ? new Date(state.lastAdjustment).toLocaleString() : "N/A"]
  ];

  items.forEach(([label, value]) => {
    const li = document.createElement("li");
    li.innerHTML = `<span>${label}</span><strong>${value ?? "–"}</strong>`;
    list.appendChild(li);
  });
}

function updateContextBadges(context) {
  const container = document.getElementById("context-badges");
  if (!container) return;
  container.innerHTML = "";
  if (!context) return;

  const badges = [];
  badges.push({
    label: context.minersActive ? "Miners Active" : "Miners Idle",
    tone: context.minersActive ? "accent" : "muted"
  });
  badges.push({
    label: `${context.activeTaskCount || 0} Active Task${context.activeTaskCount === 1 ? "" : "s"}`,
    tone: (context.activeTaskCount || 0) > 0 ? "accent" : "muted"
  });
  if (context.lastActiveAt) {
    badges.push({
      label: `Last Active ${formatTimestamp(context.lastActiveAt)}`,
      tone: "muted"
    });
  }

  badges.forEach(badge => {
    const span = document.createElement("span");
    span.className = `badge badge--${badge.tone}`;
    span.textContent = badge.label;
    container.appendChild(span);
  });
}

function updateActionLog(actionLog = []) {
  const list = document.getElementById("policy-action-log");
  if (!list) return;
  list.innerHTML = "";

  if (!Array.isArray(actionLog) || actionLog.length === 0) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = "No recent actions";
    list.appendChild(li);
    return;
  }

  actionLog.slice(-10).reverse().forEach(entry => {
    const li = document.createElement("li");
    li.className = entry.success ? "success" : "failure";
    const time = formatTimestamp(entry.timestamp);
    const forecastCpu = entry.forecast?.cpu ? `${Math.round(entry.forecast.cpu * 100)}%` : "–";
    li.innerHTML = `
      <div class="action-row">
        <span class="action-type">${entry.type}</span>
        <span class="action-priority">${entry.priority?.toUpperCase() || ""}</span>
      </div>
      <p>${entry.description || ""}</p>
      <div class="action-meta">
        <span>${time}</span>
        <span>Forecast CPU: ${forecastCpu}</span>
        ${entry.error ? `<span class="error">${entry.error}</span>` : ""}
      </div>
    `;
    list.appendChild(li);
  });
}

function updatePolicyControls(state) {
  if (!state) return;
  const lr = document.getElementById("learningRate");
  const db = document.getElementById("delegationBias");
  const cd = document.getElementById("cooldown");
  const lrValue = document.getElementById("lr-value");
  const dbValue = document.getElementById("db-value");
  const cdValue = document.getElementById("cd-value");

  if (lr) {
    lr.value = state.learningRate;
    if (lrValue) lrValue.textContent = Number(state.learningRate).toFixed(2);
  }
  if (db) {
    db.value = state.delegationBias;
    if (dbValue) dbValue.textContent = Number(state.delegationBias).toFixed(2);
  }
  if (cd) {
    cd.value = state.cooldown;
    if (cdValue) cdValue.textContent = state.cooldown;
  }
}

async function refreshAutonomic() {
  const snapshot = await fetchJson("/data/autonomic_snapshot.json");
  if (!snapshot) return;
  updateCpuChart(snapshot);
  updateMemChart(snapshot);
  updatePolicyTrendChart(snapshot);
  updateThresholdChart(snapshot.policyState);
  updatePolicySummary(snapshot.policyState, snapshot.recommendations);
  updateContextBadges(snapshot.context);
  updateActionLog(snapshot.actionLog);
  updatePolicyControls(snapshot.policyState);
}

async function refreshFusion() {
  const data = await fetchJson("/data/fused_knowledge.json");
  if (!data) return;

  const map = [
    ["fusion-skills", Object.keys(data.skills || {}).length],
    ["fusion-dialogues", Object.keys(data.dialogues || {}).length],
    ["fusion-outcomes", (data.outcomes || []).length],
    ["fusion-last", data.metadata?.lastMerge || "N/A"]
  ];

  map.forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  });
}

async function tick() {
  await Promise.all([refreshAutonomic(), refreshFusion()]);
  setTimeout(tick, 10000);
}

tick();
