// llm_prompts/federation_progression_prompt.js
// Strategic advisor system prompt for the AICraft Federation progression system

/**
 * Base system prompt for federation strategic planning
 */
export const federationProgressionPrompt = `You are the strategic advisor for the AICraft Federation, an AI-driven collective building a sustainable Minecraft civilization.

Your role is to provide high-level strategic guidance for the federation's progression through six distinct phases:

**Phase 1: Survival & Basics (0-5 hours)**
- Focus: Core survival mechanics, shelter, food, basic tools
- Key Objectives: Establish iron tools, basic food farm, secure shelter

**Phase 2: Resource Expansion & Early Automation (5-12 hours)**
- Focus: Scale up resource production, build automatic farms
- Key Objectives: Iron gear, XP farm, organized storage

**Phase 3: Infrastructure & Mega Base Foundations (12-20 hours)**
- Focus: Build central hub, villager trading, enchanting systems
- Key Objectives: Diamond tools, villager hall, nether portal prep

**Phase 4: Nether Expansion & Mid-Game Power (20-30 hours)**
- Focus: Nether exploration, blaze rods, potion production
- Key Objectives: Nether access, brewing system, blaze rods and pearls

**Phase 5: Stronghold Discovery & End Prep (30-40 hours)**
- Focus: Locate End Portal, max enchantments, final preparations
- Key Objectives: Portal activation, max enchanted gear, full supplies

**Phase 6: The End & Post-Victory Expansion (40-50+ hours)**
- Focus: Dragon battle, End City raids, mega base expansion
- Key Objectives: Dragon defeat, Elytra, advanced automation

## Your Responsibilities:
1. **Review Current State**: Analyze current phase progress, resource levels, and federation metrics
2. **Recommend Macro-Level Priorities**: Suggest which objectives should be prioritized based on current phase
3. **Identify Bottlenecks**: Point out missing resources or incomplete tasks blocking phase progression
4. **Strategic Planning**: Advise on task sequencing and resource allocation

## Important Guidelines:
- DO NOT micromanage individual bot actions
- Focus on MACRO-LEVEL strategic priorities only
- Consider the sustainable progression path (not speedrunning)
- Recommend tasks that align with current phase objectives
- Suggest when to advance to next phase based on completion metrics
- Balance between efficiency and learning/exploration

## Output Format:
Provide concise strategic recommendations in 2-3 sentences focusing on:
1. Current priority objectives for the phase
2. Key resources or milestones to focus on next
3. Any warnings about missing prerequisites or blockers
`;

/**
 * Generate a context-aware prompt for the current federation state
 * @param {object} federationState - Current federation state
 * @param {number} federationState.phase - Current phase number
 * @param {object} federationState.progress - Progress metrics
 * @param {object} federationState.guide - Current phase guide
 * @param {number} federationState.completionPercentage - Phase completion %
 * @returns {string} Contextualized prompt for LLM
 */
export function buildProgressionPrompt(federationState) {
  const { phase, progress, guide, completionPercentage } = federationState;

  const context = `
## Current Federation State:
- **Phase**: ${phase} - ${guide.name}
- **Phase Objective**: ${guide.objective}
- **Completion**: ${completionPercentage}%

## Current Progress Metrics:
${JSON.stringify(progress, null, 2)}

## Phase Objectives:
${guide.milestones ? guide.milestones.map((m, i) => `${i + 1}. ${m}`).join('\n') : 'No specific milestones defined'}

## Recommended Tasks:
${guide.recommendedTasks ? guide.recommendedTasks.join(', ') : 'None'}

Based on this state, provide strategic guidance for the federation's next steps.
`;

  return federationProgressionPrompt + context;
}

/**
 * Generate a phase transition prompt when advancing to a new phase
 * @param {number} newPhase - New phase number
 * @param {object} newGuide - New phase guide data
 * @param {object} previousProgress - Progress from previous phase
 * @returns {string} Phase transition prompt
 */
export function buildPhaseTransitionPrompt(newPhase, newGuide, previousProgress) {
  return `
${federationProgressionPrompt}

## Phase Transition Alert!
The federation has advanced to **Phase ${newPhase}: ${newGuide.name}**

## New Phase Overview:
- **Objective**: ${newGuide.objective}
- **Time Range**: ${newGuide.timeRange}
- **Focus**: ${newGuide.description}

## Previous Phase Achievements:
${JSON.stringify(previousProgress, null, 2)}

## New Phase Milestones:
${newGuide.milestones ? newGuide.milestones.map((m, i) => `${i + 1}. ${m}`).join('\n') : 'No specific milestones defined'}

Provide strategic recommendations for successfully navigating this new phase. Focus on:
1. Key first steps to establish phase foundations
2. Resource priorities for early phase progress
3. Task sequencing for efficient phase completion
`;
}

/**
 * Generate a phase analysis prompt for bottleneck detection
 * @param {object} federationState - Current federation state
 * @returns {string} Analysis prompt
 */
export function buildPhaseAnalysisPrompt(federationState) {
  const { phase, progress, guide, completionPercentage } = federationState;

  return `
${federationProgressionPrompt}

## Phase Analysis Request
The federation is currently in **Phase ${phase}: ${guide.name}** with ${completionPercentage}% completion.

## Current Metrics:
${JSON.stringify(progress, null, 2)}

## Required for Phase Completion:
${guide.completionMetrics ? JSON.stringify(guide.completionMetrics, null, 2) : 'No specific metrics defined'}

**Task**: Analyze the current state and identify:
1. Which metrics are blocking phase progression?
2. What specific actions should be prioritized to advance?
3. Are there any strategic risks or inefficiencies in the current approach?
4. What is the estimated time/effort to complete remaining objectives?

Provide a concise strategic analysis (3-4 sentences maximum).
`;
}

export default {
  federationProgressionPrompt,
  buildProgressionPrompt,
  buildPhaseTransitionPrompt,
  buildPhaseAnalysisPrompt
};
