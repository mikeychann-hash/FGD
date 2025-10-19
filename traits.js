// ai/traits.js
// Personality trait generator and descriptor for NPCs

const THRESHOLDS = {
  VERY_HIGH: 0.8,
  HIGH: 0.6,
  LOW: 0.4,
  VERY_LOW: 0.2
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
}