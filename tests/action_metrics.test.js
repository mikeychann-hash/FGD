import { getPrometheusRegistry, resetMetrics, incrementAction, incrementActionFailure } from '../src/services/metrics.js';

describe('Action metrics', () => {
  beforeEach(() => resetMetrics());

  test('increments action totals with labels', async () => {
    incrementAction('mine', 'bot1', 2);
    incrementActionFailure('mine', 'bot1', 1);
    const registry = getPrometheusRegistry();
    const out = await registry.metrics();
    expect(out).toContain('fgd_action_total{action="mine",bot="bot1"} 2');
    expect(out).toContain('fgd_action_failures_total{action="mine",bot="bot1"} 1');
  });
});
