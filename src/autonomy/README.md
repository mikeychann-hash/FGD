# LLM-Driven Bot Autonomy System

## Overview
Token-efficient autonomous bot control system using LLMs for decision-making. Inspired by Mindcraft architecture with optimizations for minimal token usage.

## Architecture

```mermaid
graph TB
    A[Bot State] --> B[State Summarization<br/>~50-100 tokens]
    B --> C[LLM Controller]
    C --> D{LLM Provider}
    D --> E[Action Schema<br/>Validation]
    E --> F{Action Type}
    F -->|move| G[Pathfinder]
    F -->|mine/gather| H[Collectblock]
    F -->|attack| I[PvP]
    F -->|other| J[NPC Engine]
    K[Token Profiler] -.logs.-> C
    K --> L[Metrics API]
```

## Token Optimization Strategies

### 1. State Summarization
- **Before**: ~500+ tokens per decision (full state)
- **After**: ~50-100 tokens (compressed summary)
- **Savings**: **70%+ reduction**

**Compression techniques**:
- Inventory: Item counts only (no metadata)
- Entities: Top 5 by priority/distance
- Blocks: Resources only (no air/stone/dirt)
- Position: Rounded integers
- Delta updates: Only send what changed

### 2. Cached System Prompt
- Loaded once at start
- Reused for all decisions
- Includes few-shot examples
- **Savings**: ~100 tokens/decision

### 3. Strict JSON Schema
- No markdown, no explanations
- 20-word max reasoning
- Structured output guaranteed
- **Savings**: ~50 tokens/decision

### 4. Delta Updates
- Track previous state
- Send only changes
- Significant movement threshold (>5 blocks)
- **Savings**: ~30-50 tokens/decision

## API Endpoints

### Set Goal (Single Decision)
```bash
POST /api/autonomy/goal
{
  "botId": "miner_01",
  "goal": "gather wood"
}
```

Response:
```json
{
  "success": true,
  "botId": "miner_01",
  "goal": "gather wood", 
  "action": {
    "action": "gather",
    "params": { "resource": "oak_log", "count": 10 }
  },
  "taskId": "task_123",
  "tokens": 145
}
```

### Start Autonomous Loop
```bash
POST /api/autonomy/start
{
  "botId": "miner_01" ,
  "goal": "survive and gather resources",
  "interval": 10000
}
```

### Stop Autonomous Loop
```bash
POST /api/autonomy/stop
{
  "botId": "miner_01"
}
```

### Get Statistics
```bash
GET /api/autonomy/stats

# Response:
{
  "controller": {
    "activeBots": 2,
    "botIds": ["miner_01", "builder_02"],
    "decisionInterval": 10000,
    "useDeltaUpdates": true
  },
  "tokens": {
    "totalBots": 2,
    "totalTokens": 12450,
    "totalDecisions": 85,
    "avgTokensPerDecision": 146,
    "compressionRatio": 0.68
  }
}
```

### Get Bot Token Stats
```bash
GET /api/autonomy/stats/:botId

# Response:
{
  "botId": "miner_01",
  "totalTokens": 6200,
  "totalDecisions": 42,
  "avgTokensPerDecision": 148,
  "avgLatency": 1250,
  "actionCounts": {
    "move": 15,
    "mine": 12,
    "gather": 10,
    "deposit": 5
  }
}
```

### Get Token Usage History
```bash
GET /api/autonomy/history?botId=miner_01&limit=10

# Response:
{
  "count": 10,
  "history": [
    {
      "botId": "miner_01",
      "goal": "gather wood",
      "inputTokens": 85,
      "outputTokens": 60,
      "totalTokens": 145,
      "latency": 1200,
      "action": "gather",
      "timestamp": "2025-11-29T14:30:00Z"
    }
  ]
}
```

### Prometheus Metrics
```bash
GET /api/autonomy/metrics

# Response (Prometheus format):
# HELP fgd_llm_tokens_total Total LLM tokens used
# TYPE fgd_llm_tokens_total counter
fgd_llm_tokens_total{bot_id="miner_01"} 6200

# HELP fgd_llm_decisions_total Total LLM decisions made
# TYPE fgd_llm_decisions_total counter
fgd_llm_decisions_total{bot_id="miner_01"} 42

# HELP fgd_llm_avg_tokens_per_decision Average tokens per decision
# TYPE fgd_llm_avg_tokens_per_decision gauge
fgd_llm_avg_tokens_per_decision{bot_id="miner_01"} 148
```

## Valid Actions

| Action | Params | Description |
|--------|--------|-------------|
| `move` | `{x, y, z, range?}` | Move to position using pathfinder |
| `mine` | `{blockType, count?, x?, y?, z?}` | Mine specific blocks |
| `craft` | `{item, count?}` | Craft items |
| `attack` | `{entityType?, entityId?}` | Attack entities |
| `gather` | `{resource, count?}` | Gather resources (auto-pathfind + collect) |
| `explore` | `{direction?, distance?}` | Explore in a direction |
| `deposit` | `{chestPos?, items?}` | Deposit items in chest |
| `eat` | `{allowGoldenApple?}` | Eat food |
| `equip` | `{item, destination?}` | Equip item |
| `follow` | `{targetId?, targetPos?, range?}` | Follow entity/position |
| `guard` | `{x?, y?, z?, radius?}` | Guard area |
| `idle` | `{}` | Do nothing |

## Few-Shot Examples

The system includes 5 few-shot examples to guide the LLM:

1. **Gather wood**: `{action: "gather", params: {resource: "oak_log", count: 10}}`
2. **Return home**: `{action: "move", params: {x: 0, y: 64, z: 0}}`
3. **Mine iron**: `{action: "mine", params: {blockType: "iron_ore", count: 3}}`
4. **Defend against zombies**: `{action: "attack", params: {entityType: "zombie"}}`
5. **Craft planks**: `{action: "craft", params: {item: "oak_planks", count: 4}}`

## Usage Example (Node.js)

```javascript
import { getLLMController } from './src/autonomy/llm_controller.js';

// Initialize controller
const controller = getLLMController({
  npcEngine: yourNpcEngine,
  bridge: yourMineflayerBridge,
  temperature: 0.2,
  maxTokens: 200,
  useDeltaUpdates: true
});

// Make a single decision
const result = await controller.executeDecision('bot_1', 'gather wood');
console.log(`Action: ${result.action.action}, Tokens: ${result.tokens}`);

// Start autonomous loop
controller.startAutonomousLoop('bot_1', {
  goal: 'survive and gather resources',
  interval: 10000 // 10 seconds
});

// Stop loop later
controller.stopAutonomousLoop('bot_1');
```

## Monitoring & Alerts

The token profiler automatically emits alerts for:
- Single decision >300 tokens (threshold)
- Average usage >200 tokens/decision (drift alert)
- Latency >5 seconds (performance alert)

Listen to alerts:
```javascript
import { getTokenProfiler } from './src/autonomy/token_profiler.js';

const profiler = getTokenProfiler();
profiler.on('alert', (alert) => {
  console.warn(`⚠️  ${alert.type}: ${alert.message}`);
});
```

## Performance Targets

| Metric | Target | Actual (Estimated) |
|--------|--------|-----|
| Tokens per decision | <150 | ~145 |
| Decision latency | <2s | ~1.2s |
| Memory overhead | <10MB | ~5MB |
| Token savings vs baseline | >70% | ~72% |

## Integration with Mineflayer

The system leverages existing Mineflayer plugins:

- **mineflayer-pathfinder**: A* pathfinding for `move` action
- **mineflayer-collectblock**: Automated block gathering
- **mineflayer-pvp**: Combat actions
- **mineflayer-auto-eat**: Survival (eat action)

## Files Created

```
src/autonomy/
├── state_summarizer.js    # State compression (500→50 tokens)
├── action_schema.js        # Action validation & task conversion
├── llm_controller.js       # Decision-making controller
└── token_profiler.js       # Usage tracking & metrics

src/api/
└── autonomy.js             # REST API routes
```

## Next Steps

1. **Testing**: Run unit tests for state summarizer
2. **Integration**: Complete npc_engine integration
3. **Monitoring**: Set up dashboard for token metrics
4. **Optimization**: Tune system prompt based on real-world usage

## Related Documentation

- [Mindcraft Architecture](https://github.com/mindcraft-bots/mindcraft)
- [Mineflayer Pathfinder](https://github.com/PrismarineJS/mineflayer-pathfinder)
- [LLM Bridge](./llm_bridge.js)
- [NPC Engine](./npc_engine.js)
