import { Traits } from "./traits.js";

function deepClone(value) {
  if (value == null || typeof value !== "object") {
    return value ?? null;
  }

  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (error) {
      // Fallback below
    }
  }

  if (Array.isArray(value)) {
    return value.map(deepClone);
  }

  const clone = {};
  for (const [key, nested] of Object.entries(value)) {
    clone[key] = deepClone(nested);
  }
  return clone;
}

export function ensureTraitsHelper(traitsHelper) {
  if (
    traitsHelper &&
    typeof traitsHelper.getDetailedDescription === "function" &&
    typeof traitsHelper.generate === "function"
  ) {
    return traitsHelper;
  }
  return new Traits();
}

export function cloneValue(value) {
  if (value == null || typeof value !== "object") {
    return value ?? null;
  }
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }
  return { ...value };
}

export function sanitizePersonality(personality) {
  if (!personality || typeof personality !== "object") {
    return null;
  }

  const clone = deepClone(personality);
  for (const key of Object.keys(clone)) {
    if (!Number.isFinite(clone[key])) {
      clone[key] = 0.5;
    }
  }
  return clone;
}

export function buildPersonalityBundle(personality, traitsHelper) {
  const helper = ensureTraitsHelper(traitsHelper);
  let finalPersonality = null;

  if (personality && typeof personality === "object") {
    const isValid = helper.isValidPersonality
      ? helper.isValidPersonality(personality)
      : true;
    if (isValid) {
      finalPersonality = sanitizePersonality(personality);
    }
  }

  if (!finalPersonality) {
    finalPersonality = sanitizePersonality(helper.generate());
  }

  const details = helper.getDetailedDescription(finalPersonality);
  return {
    personality: finalPersonality,
    summary: details.summary,
    traits: Array.isArray(details.traits) ? [...details.traits] : [],
  };
}

export function applyPersonalityMetadata(metadata, bundle) {
  const result = metadata ? { ...metadata } : {};
  if (bundle?.summary) {
    result.personalitySummary = bundle.summary;
  }
  if (bundle?.traits) {
    result.personalityTraits = Array.isArray(bundle.traits)
      ? [...bundle.traits]
      : bundle.traits;
  }
  return result;
}

export function deriveLearningEnrichment(learningProfile, traitsHelper) {
  if (!learningProfile || typeof learningProfile !== "object") {
    return {
      learningMetadata: null,
      personality: null,
      personalitySummary: null,
      personalityTraits: null,
    };
  }

  const enrichment = {
    learningMetadata: {
      xp: learningProfile.xp ?? 0,
      tasksCompleted: learningProfile.tasksCompleted ?? 0,
      tasksFailed: learningProfile.tasksFailed ?? 0,
      skills: learningProfile.skills ? { ...learningProfile.skills } : {},
    },
    personality: null,
    personalitySummary: null,
    personalityTraits: null,
  };

  if (learningProfile.personality) {
    const bundle = buildPersonalityBundle(
      sanitizePersonality(learningProfile.personality),
      traitsHelper
    );
    enrichment.personality = bundle.personality;
    enrichment.personalitySummary = bundle.summary;
    enrichment.personalityTraits = bundle.traits;
  }

  return enrichment;
}

export function mergeLearningIntoProfile(profile, learningProfile, traitsHelper) {
  if (!learningProfile) {
    return { ...profile };
  }

  const enrichment = deriveLearningEnrichment(learningProfile, traitsHelper);
  const metadata = profile.metadata ? { ...profile.metadata } : {};

  if (enrichment.learningMetadata) {
    metadata.learning = enrichment.learningMetadata;
  }

  const merged = {
    ...profile,
    metadata,
  };

  if (enrichment.personality) {
    merged.personality = enrichment.personality;
  }
  if (enrichment.personalitySummary) {
    merged.personalitySummary = enrichment.personalitySummary;
  }
  if (enrichment.personalityTraits) {
    merged.personalityTraits = enrichment.personalityTraits;
  }

  merged.metadata = applyPersonalityMetadata(merged.metadata, {
    summary: merged.personalitySummary ?? profile.personalitySummary,
    traits: merged.personalityTraits ?? profile.personalityTraits,
  });

  return merged;
}

export function serializeRegistryEntry(entry) {
  return {
    ...entry,
    personality: cloneValue(entry.personality),
    appearance: cloneValue(entry.appearance),
    metadata: cloneValue(entry.metadata),
    spawnPosition: cloneValue(entry.spawnPosition),
    lastKnownPosition: cloneValue(entry.lastKnownPosition),
    personalityTraits: Array.isArray(entry.personalityTraits)
      ? [...entry.personalityTraits]
      : [],
  };
}
