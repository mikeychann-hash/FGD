function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function validateRegistryData(data) {
  if (!isObject(data) || !Array.isArray(data.npcs)) {
    throw new Error("Registry payload must include an 'npcs' array");
  }
  data.npcs.forEach((entry, index) => {
    if (!isObject(entry)) {
      throw new Error(`Registry entry ${index} must be an object`);
    }
    if (typeof entry.id !== 'string' || entry.id.trim().length === 0) {
      throw new Error(`Registry entry ${index} is missing an id`);
    }
    if (typeof entry.role !== 'string' || entry.role.trim().length === 0) {
      throw new Error(`Registry entry ${entry.id} is missing a role`);
    }
    if (typeof entry.npcType !== 'string' || entry.npcType.trim().length === 0) {
      throw new Error(`Registry entry ${entry.id} is missing npcType`);
    }
  });
  return true;
}

export function validateProfileData(data) {
  if (!isObject(data)) {
    throw new Error('Profile payload must be an object keyed by NPC id');
  }
  for (const [npcId, profile] of Object.entries(data)) {
    if (!isObject(profile)) {
      throw new Error(`Profile for ${npcId} must be an object`);
    }
    if (!isObject(profile.skills)) {
      throw new Error(`Profile for ${npcId} is missing skills`);
    }
    if (!isObject(profile.personality)) {
      throw new Error(`Profile for ${npcId} is missing personality metrics`);
    }
  }
  return true;
}

export default {
  validateRegistryData,
  validateProfileData,
};
