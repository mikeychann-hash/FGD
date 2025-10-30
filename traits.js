// ai/traits.js
// Personality trait generator and descriptor for NPCs

const THRESHOLDS = {
  VERY_HIGH: 0.8,
  HIGH: 0.6,
  LOW: 0.4,
  VERY_LOW: 0.2
};

const GENERATION_DEFAULTS = {
  MOTIVATION_MIN: 0.5,
  MOTIVATION_MAX: 1.0,
  AGGRESSION_MIN: 0.0,
  AGGRESSION_MAX: 1.0 // Changed from 0.3 to allow full range
};

const REQUIRED_TRAITS = ['curiosity', 'patience', 'motivation', 'empathy', 'aggression', 'creativity', 'loyalty'];

export class Traits {
  /**
   * Generates a random personality trait set for an NPC
   * @returns {Object} Personality object with traits as values between 0 and 1
   */
  generate() {
    return {
      curiosity: Math.random(),
      patience: Math.random(),
      motivation: GENERATION_DEFAULTS.MOTIVATION_MIN + Math.random() * (GENERATION_DEFAULTS.MOTIVATION_MAX - GENERATION_DEFAULTS.MOTIVATION_MIN),
      empathy: Math.random(),
      aggression: GENERATION_DEFAULTS.AGGRESSION_MIN + Math.random() * (GENERATION_DEFAULTS.AGGRESSION_MAX - GENERATION_DEFAULTS.AGGRESSION_MIN),
      creativity: Math.random(),
      loyalty: Math.random()
    };
  }

  /**
   * Validates that a personality object has all required traits with valid values
   * @param {Object} personality - The personality object to validate
   * @returns {boolean} True if valid, false otherwise
   */
  isValidPersonality(personality) {
    if (!personality || typeof personality !== 'object') {
      return false;
    }
    return REQUIRED_TRAITS.every(trait =>
      typeof personality[trait] === 'number' &&
      personality[trait] >= 0 &&
      personality[trait] <= 1
    );
  }

  /**
   * Generates a brief text description of a personality
   * @param {Object} personality - The personality object to describe
   * @returns {string} A brief description like "highly inquisitive and motivated"
   */
  describe(personality) {
    if (!this.isValidPersonality(personality)) {
      return "neutral";
    }

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

  /**
   * Generates a detailed description object with summary and trait list
   * @param {Object} personality - The personality object to describe
   * @returns {Object} Object with summary string and traits array
   */
  getDetailedDescription(personality) {
    if (!this.isValidPersonality(personality)) {
      return {
        summary: "neutral",
        traits: []
      };
    }

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

  /**
   * Adjusts a specific trait value, keeping it within bounds (0-1)
   * Returns a new personality object without mutating the original
   * @param {Object} personality - The personality object to adjust
   * @param {string} traitName - The name of the trait to adjust
   * @param {number} delta - The amount to add to the trait (can be negative)
   * @returns {Object} A new personality object with the adjusted trait
   */
  adjustTrait(personality, traitName, delta) {
    if (!this.isValidPersonality(personality)) {
      throw new Error('Invalid personality object');
    }
    if (typeof traitName !== 'string' || !REQUIRED_TRAITS.includes(traitName)) {
      throw new Error(`Invalid trait name: ${traitName}`);
    }
    if (typeof delta !== 'number' || !isFinite(delta)) {
      throw new Error('Delta must be a finite number');
    }

    return {
      ...personality,
      [traitName]: Math.max(0, Math.min(1, personality[traitName] + delta))
    };
  }

  /**
   * Compares two personalities and returns a compatibility score
   * Higher scores indicate more similar personalities
   * @param {Object} personality1 - First personality object
   * @param {Object} personality2 - Second personality object
   * @returns {number} Compatibility score between 0 (incompatible) and 1 (very compatible)
   */
  compatibility(personality1, personality2) {
    if (!this.isValidPersonality(personality1) || !this.isValidPersonality(personality2)) {
      throw new Error('Both personality objects must be valid');
    }

    let totalDiff = 0;

    for (const trait of REQUIRED_TRAITS) {
      totalDiff += Math.abs(personality1[trait] - personality2[trait]);
    }

    // Convert difference to similarity score
    const avgDiff = totalDiff / REQUIRED_TRAITS.length;
    return 1 - avgDiff;
  }
}