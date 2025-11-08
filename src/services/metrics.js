const METRICS = {
  queueDepth: 0,
  heartbeatAgeSeconds: 0,
  latencyBuckets: new Map([[0.5, 0], [1, 0], [2, 0], [4, 0], [8, 0], ['+Inf', 0]]),
  latencySum: 0,
  latencyCount: 0
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
  METRICS.heartbeatAgeSeconds = typeof ageSeconds === 'number' ? ageSeconds : 0;
}

export function bindMetricsToNpcEngine(npcEngine, stateManager) {
  if (!npcEngine) {
    return;
  }

  const updateQueueDepth = () => {
    METRICS.queueDepth = npcEngine.taskQueue?.length || 0;
    stateManager.updatePerformanceMetrics({ queueDepth: METRICS.queueDepth, heartbeatAgeSeconds: METRICS.heartbeatAgeSeconds });
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
        heartbeatAgeSeconds: METRICS.heartbeatAgeSeconds
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
      lines.push(formatHistogram().trimEnd());
      return `${lines.join('\n')}\n`;
    }
  };
}

export default {
  bindMetricsToNpcEngine,
  getPrometheusRegistry,
  updateHeartbeatAge
};
