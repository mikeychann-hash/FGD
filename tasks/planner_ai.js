function normalizeTraits(list = []) {
  return Array.isArray(list)
    ? list.map(trait => String(trait).toLowerCase())
    : [];
}

export function applyPersonalityBias(plan, context = {}) {
  if (!plan || typeof plan !== "object") {
    return plan;
  }

  const npcTraits = normalizeTraits(
    context?.npc?.personalityTraits ||
      context?.npc?.metadata?.personalityTraits ||
      context?.npc?.personality?.traits
  );

  const preferredTraits = normalizeTraits(plan.preferredTraits || plan.metadata?.preferredTraits);
  if (preferredTraits.length === 0 || npcTraits.length === 0) {
    return plan;
  }

  const matches = preferredTraits.filter(trait => npcTraits.includes(trait));
  const biasScore = matches.length;
  const adjustedPlan = {
    ...plan,
    personalityBias: {
      score: biasScore,
      matches,
      totalPreferred: preferredTraits.length
    }
  };

  if (biasScore > 0 && typeof adjustedPlan.estimatedDuration === "number") {
    const bonus = Math.min(0.25, biasScore * 0.05);
    adjustedPlan.estimatedDuration = Math.round(adjustedPlan.estimatedDuration * (1 - bonus));
  }

  return adjustedPlan;
}

export default {
  applyPersonalityBias
};
