// src/services/service_container.js
// Lightweight service registry for core systems

let container = {
  npcSystem: null,
  npcSpawner: null,
  npcRegistry: null,
  progressionEngine: null,
  policyEngine: null,
  minecraftBridge: null,
  mineflayerBridge: null,
  status: {},
};

export function setServiceContainer(services) {
  container = { ...container, ...services };
}

export function getServiceContainer() {
  return container;
}

export function getServiceStatus() {
  return container.status || {};
}
