const METRICS = {
  queueDepth: 0,
  heartbeatAgeSeconds: 0,
  pluginHeartbeatAgeSeconds: 0,
  botSpawnsTotal: 0,
  botSpawnFailuresTotal: 0,
  botSpawnsById: new Map(),
  botSpawnFailuresById: new Map(),
  actionTotal: new Map(),
  actionFailuresTotal: new Map(),
  latencyBuckets: new Map([
    [0.5, 0],
    [1, 0],
    [2, 0],
    [4, 0],
    [8, 0],
    ['+Inf', 0],
  ]),
  latencySum: 0,
  latencyCount: 0,
};

function recordLatency(value) {
  METRICS.latencySum += value;
  METRICS.latencyCount += 1;
  for (const [bucket, count] of METRICS.latencyBuckets.entries()) {
    if (bucket === '+Inf' || value <= bucket) {
      METRICS.latencyBuckets.set(bucket, count + 1);
    }
  }
}

export function updateHeartbeatAge(ageSeconds) {
  const age = typeof ageSeconds === 'number' ? ageSeconds : 0;
  METRICS.heartbeatAgeSeconds = age;
  METRICS.pluginHeartbeatAgeSeconds = age;
}

function incrementMapCounter(map, key, count) {
  const current = map.get(key) || 0;
  map.set(key, current + count);
}

export function incrementSpawnSuccess(count = 1, botId = null) {
  METRICS.botSpawnsTotal += count;
  if (botId) incrementMapCounter(METRICS.botSpawnsById, botId, count);
}

export function incrementSpawnFailure(count = 1, botId = null) {
  METRICS.botSpawnFailuresTotal += count;
  if (botId) incrementMapCounter(METRICS.botSpawnFailuresById, botId, count);
}

export function resetMetrics() {
  METRICS.queueDepth = 0;
  METRICS.heartbeatAgeSeconds = 0;
  METRICS.pluginHeartbeatAgeSeconds = 0;
  METRICS.botSpawnsTotal = 0;
  METRICS.botSpawnFailuresTotal = 0;
  METRICS.actionTotal.clear();
  METRICS.actionFailuresTotal.clear();
  METRICS.botSpawnsById.clear();
  METRICS.botSpawnFailuresById.clear();
  METRICS.latencyBuckets = new Map([
    [0.5, 0],
    [1, 0],
    [2, 0],
    [4, 0],
    [8, 0],
    ['+Inf', 0],
  ]);
  METRICS.latencySum = 0;
  METRICS.latencyCount = 0;
}

function actionKey(action, botId) {
  return `${action || 'unknown'}|${botId || 'unknown'}`;
}

export function incrementAction(action, botId = null, count = 1) {
  incrementMapCounter(METRICS.actionTotal, actionKey(action, botId), count);
}

export function incrementActionFailure(action, botId = null, count = 1) {
  incrementMapCounter(METRICS.actionFailuresTotal, actionKey(action, botId), count);
}

export function bindMetricsToNpcEngine(npcEngine, stateManager) {
  if (!npcEngine) {
    return;
  }

  const updateQueueDepth = () => {
    METRICS.queueDepth = npcEngine.taskQueue?.length || 0;
    stateManager.updatePerformanceMetrics({
      queueDepth: METRICS.queueDepth,
      heartbeatAgeSeconds: METRICS.heartbeatAgeSeconds,
    });
  };

  npcEngine.on('task_queued', updateQueueDepth);
  npcEngine.on('task_dequeued', updateQueueDepth);
  npcEngine.on('task_requeued', updateQueueDepth);
  npcEngine.on('task_dropped', updateQueueDepth);

  npcEngine.on('task_assigned', updateQueueDepth);
  npcEngine.on('task_completed', ({ npcId, success }) => {
    updateQueueDepth();
    const startedAt = npcEngine.taskStartTimes?.get?.(npcId);
    if (typeof startedAt === 'number') {
      const latency = (Date.now() - startedAt) / 1000;
      recordLatency(latency);
      stateManager.updatePerformanceMetrics({
        lastLatencySeconds: latency,
        queueDepth: METRICS.queueDepth,
        heartbeatAgeSeconds: METRICS.heartbeatAgeSeconds,
      });
      npcEngine.taskStartTimes.delete(npcId);
    }
  });

  npcEngine.taskStartTimes = npcEngine.taskStartTimes || new Map();
  npcEngine.on('task_assigned', ({ npcId }) => {
    npcEngine.taskStartTimes.set(npcId, Date.now());
  });

  updateQueueDepth();
}

function formatHistogram() {
  let output = '# HELP fgd_task_latency_seconds Task execution latency in seconds\n';
  output += '# TYPE fgd_task_latency_seconds histogram\n';
  let cumulative = 0;
  for (const [bucket, count] of METRICS.latencyBuckets.entries()) {
    cumulative = count;
    output += `fgd_task_latency_seconds_bucket{le="${bucket}"} ${cumulative}\n`;
  }
  output += `fgd_task_latency_seconds_sum ${METRICS.latencySum}\n`;
  output += `fgd_task_latency_seconds_count ${METRICS.latencyCount}\n`;
  return output;
}

export function getPrometheusRegistry() {
  return {
    contentType: 'text/plain; version=0.0.4',
    async metrics() {
      const lines = [];
      lines.push('# HELP fgd_task_queue_depth Number of tasks pending execution');
      lines.push('# TYPE fgd_task_queue_depth gauge');
      lines.push(`fgd_task_queue_depth ${METRICS.queueDepth}`);
      lines.push('# HELP fgd_bridge_heartbeat_age_seconds Seconds since last plugin heartbeat');
      lines.push('# TYPE fgd_bridge_heartbeat_age_seconds gauge');
      lines.push(`fgd_bridge_heartbeat_age_seconds ${METRICS.heartbeatAgeSeconds}`);
      lines.push('# HELP fgd_minecraft_plugin_heartbeat_age_seconds Seconds since last plugin heartbeat (bridge view)');
      lines.push('# TYPE fgd_minecraft_plugin_heartbeat_age_seconds gauge');
      lines.push(`fgd_minecraft_plugin_heartbeat_age_seconds ${METRICS.pluginHeartbeatAgeSeconds}`);
      lines.push('# HELP fgd_bot_spawns_total Total bot spawn attempts (successful)');
      lines.push('# TYPE fgd_bot_spawns_total counter');
      lines.push(`fgd_bot_spawns_total ${METRICS.botSpawnsTotal}`);
      for (const [botId, value] of METRICS.botSpawnsById.entries()) {
        lines.push(`fgd_bot_spawns_total{botId="${botId}"} ${value}`);
      }
      lines.push('# HELP fgd_bot_spawn_failures_total Total bot spawn failures');
      lines.push('# TYPE fgd_bot_spawn_failures_total counter');
      lines.push(`fgd_bot_spawn_failures_total ${METRICS.botSpawnFailuresTotal}`);
      for (const [botId, value] of METRICS.botSpawnFailuresById.entries()) {
        lines.push(`fgd_bot_spawn_failures_total{botId="${botId}"} ${value}`);
      }
      lines.push('# HELP fgd_action_total Total in-world actions executed');
      lines.push('# TYPE fgd_action_total counter');
      for (const [key, value] of METRICS.actionTotal.entries()) {
        const [action, bot] = key.split('|');
        lines.push(`fgd_action_total{action="${action}",bot="${bot}"} ${value}`);
      }
      lines.push('# HELP fgd_action_failures_total Failed in-world actions');
      lines.push('# TYPE fgd_action_failures_total counter');
      for (const [key, value] of METRICS.actionFailuresTotal.entries()) {
        const [action, bot] = key.split('|');
        lines.push(`fgd_action_failures_total{action="${action}",bot="${bot}"} ${value}`);
      }
      lines.push(formatHistogram().trimEnd());
      return `${lines.join('\n')}\n`;
    },
  };
}

export default {
  bindMetricsToNpcEngine,
  getPrometheusRegistry,
  updateHeartbeatAge,
  incrementSpawnSuccess,
  incrementSpawnFailure,
  incrementAction,
  incrementActionFailure,
  resetMetrics,
};
