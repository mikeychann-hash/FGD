// ai/traits.js
// Personality trait generator and descriptor for NPCs

const THRESHOLDS = {
  VERY_HIGH: 0.8,
  HIGH: 0.6,
  LOW: 0.4,
  VERY_LOW: 0.2
};

const DEFAULT_BEHAVIOR_PROFILE = {
  archetype: "balanced",
  riskTolerance: 0.5,
  speedMultiplier: 1,
  efficiencyBias: 1,
  cautionMultiplier: 1
};

export class Traits {
  generate() {
    return {
      curiosity: Math.random(),
      patience: Math.random(),
      motivation: 0.5 + Math.random() * 0.5, // Start between 0.5 and 1.0
      empathy: Math.random(),
      aggression: Math.random() * 0.3, // Cap aggression at 0.3
      creativity: Math.random(),
      loyalty: Math.random()
    };
  }

  describe(personality) {
    const { curiosity, patience, motivation, empathy, aggression, creativity } = personality;
    const traits = [];

    // Primary characteristic (most dominant trait)
    if (curiosity > THRESHOLDS.VERY_HIGH) {
      traits.push("highly inquisitive");
    } else if (motivation < THRESHOLDS.VERY_LOW) {
      traits.push("exhausted");
    } else if (aggression > THRESHOLDS.HIGH) {
      traits.push("aggressive");
    } else if (patience > THRESHOLDS.VERY_HIGH) {
      traits.push("extremely patient");
    } else if (creativity > THRESHOLDS.VERY_HIGH) {
      traits.push("creative");
    } else if (empathy > THRESHOLDS.VERY_HIGH) {
      traits.push("empathetic");
    }

    // Secondary characteristics
    if (motivation > THRESHOLDS.HIGH && motivation <= THRESHOLDS.VERY_HIGH) {
      traits.push("motivated");
    } else if (motivation >= THRESHOLDS.LOW && motivation <= THRESHOLDS.HIGH) {
      traits.push("balanced");
    } else if (motivation < THRESHOLDS.LOW) {
      traits.push("tired");
    }

    if (patience > THRESHOLDS.HIGH && patience <= THRESHOLDS.VERY_HIGH) {
      traits.push("steady");
    } else if (patience < THRESHOLDS.LOW) {
      traits.push("impulsive");
    }

    return traits.length > 0 ? traits.join(" and ") : "neutral";
  }

  getDetailedDescription(personality) {
    const desc = {
      summary: this.describe(personality),
      traits: []
    };

    const { curiosity, patience, motivation, empathy, aggression, creativity, loyalty } = personality;

    if (curiosity > THRESHOLDS.HIGH) {
      desc.traits.push("Loves exploring and discovering new things");
    }
    if (patience > THRESHOLDS.HIGH) {
      desc.traits.push("Rarely gives up on difficult tasks");
    }
    if (motivation > THRESHOLDS.HIGH) {
      desc.traits.push("Eager to work and improve");
    }
    if (empathy > THRESHOLDS.HIGH) {
      desc.traits.push("Works well with others");
    }
    if (aggression > THRESHOLDS.LOW) {
      desc.traits.push("Quick to defend and protect");
    }
    if (creativity > THRESHOLDS.HIGH) {
      desc.traits.push("Thinks outside the box");
    }
    if (loyalty > THRESHOLDS.HIGH) {
      desc.traits.push("Extremely loyal and dependable");
    }

    // Add warnings for very low traits
    if (motivation < THRESHOLDS.VERY_LOW) {
      desc.traits.push("⚠️ Needs rest or encouragement");
    }
    if (patience < THRESHOLDS.VERY_LOW) {
      desc.traits.push("⚠️ May rush through tasks");
    }

    return desc;
  }

  // Adjust a specific trait value, keeping it within bounds
  adjustTrait(personality, traitName, delta) {
    if (personality.hasOwnProperty(traitName)) {
      personality[traitName] = Math.max(0, Math.min(1, personality[traitName] + delta));
    }
    return personality;
  }

  // Compare two personalities and return compatibility score (0-1)
  compatibility(personality1, personality2) {
    const traits = Object.keys(personality1);
    let totalDiff = 0;

    for (const trait of traits) {
      if (personality2.hasOwnProperty(trait)) {
        totalDiff += Math.abs(personality1[trait] - personality2[trait]);
      }
    }

    // Convert difference to similarity score
    const avgDiff = totalDiff / traits.length;
    return 1 - avgDiff;
  }

  classify(personality) {
    if (!personality) return DEFAULT_BEHAVIOR_PROFILE.archetype;
    const { patience, curiosity, aggression, empathy } = personality;

    if (patience > THRESHOLDS.VERY_HIGH && aggression < THRESHOLDS.LOW) {
      return "cautious";
    }
    if (curiosity > THRESHOLDS.VERY_HIGH) {
      return "adventurous";
    }
    if (aggression > THRESHOLDS.HIGH) {
      return "aggressive";
    }
    if (empathy > THRESHOLDS.VERY_HIGH) {
      return "supportive";
    }
    return "balanced";
  }

  getBehaviorProfile(personality) {
    if (!personality) {
      return { ...DEFAULT_BEHAVIOR_PROFILE };
    }

    const archetype = this.classify(personality);
    const riskToleranceBase = 0.4 + personality.curiosity * 0.3 - personality.patience * 0.2;
    const aggressionBias = personality.aggression * 0.3;
    const empathyBias = personality.empathy * 0.1;

    const profile = {
      archetype,
      riskTolerance: Math.min(1, Math.max(0, riskToleranceBase + aggressionBias - empathyBias)),
      speedMultiplier: 1,
      efficiencyBias: 1 + personality.motivation * 0.15,
      cautionMultiplier: 1
    };

    if (archetype === "cautious") {
      profile.speedMultiplier *= 0.9;
      profile.cautionMultiplier = 1.2;
      profile.riskTolerance = Math.max(0.1, profile.riskTolerance - 0.2);
    } else if (archetype === "adventurous") {
      profile.speedMultiplier *= 1.1;
      profile.riskTolerance = Math.min(1, profile.riskTolerance + 0.2);
    } else if (archetype === "aggressive") {
      profile.speedMultiplier *= 1.15;
      profile.riskTolerance = Math.min(1, profile.riskTolerance + 0.25);
      profile.efficiencyBias *= 0.95;
    } else if (archetype === "supportive") {
      profile.speedMultiplier *= 0.95;
      profile.efficiencyBias *= 1.1;
      profile.riskTolerance = Math.max(0.2, profile.riskTolerance - 0.1);
    }

    if (personality.patience > THRESHOLDS.HIGH) {
      profile.efficiencyBias *= 1.05;
    }

    if (personality.creativity > THRESHOLDS.HIGH) {
      profile.efficiencyBias *= 1.05;
    }

    return profile;
  }

  getTaskModifiers(personality, taskType) {
    const behavior = this.getBehaviorProfile(personality);
    const modifiers = {
      speed: behavior.speedMultiplier,
      riskTolerance: behavior.riskTolerance,
      efficiency: behavior.efficiencyBias,
      caution: behavior.cautionMultiplier
    };

    switch (taskType) {
      case "mining": {
        modifiers.speed *= personality.curiosity > THRESHOLDS.HIGH ? 1.05 : 1;
        modifiers.caution *= personality.patience > THRESHOLDS.HIGH ? 1.1 : 1;
        break;
      }
      case "building": {
        modifiers.efficiency *= personality.creativity > THRESHOLDS.HIGH ? 1.1 : 1;
        break;
      }
      case "gathering": {
        modifiers.speed *= personality.motivation > THRESHOLDS.HIGH ? 1.05 : 1;
        break;
      }
      case "exploring": {
        modifiers.speed *= personality.curiosity > THRESHOLDS.HIGH ? 1.1 : 1;
        modifiers.riskTolerance *= 1.05;
        break;
      }
      case "guard": {
        modifiers.riskTolerance *= 1 + personality.aggression * 0.5;
        break;
      }
      default:
        break;
    }

    return modifiers;
  }

  summarizeForPrompt(personality) {
    if (!personality) {
      return {
        archetype: DEFAULT_BEHAVIOR_PROFILE.archetype,
        summary: "neutral",
        dominantTraits: []
      };
    }

    const behavior = this.getBehaviorProfile(personality);
    const detailed = this.getDetailedDescription(personality);
    return {
      archetype: behavior.archetype,
      summary: this.describe(personality),
      dominantTraits: detailed.traits,
      behavior,
      motivation: personality.motivation,
      curiosity: personality.curiosity,
      patience: personality.patience
    };
  }
}