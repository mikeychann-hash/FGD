// tasks/craft_multi_station.js
// Multi-station orchestration and parallel processing

import { normalizeItemName } from "./helpers.js";

/**
 * Distribute items across multiple stations for parallel processing
 * @param {number} totalItems - Total items to process
 * @param {number} stationCount - Number of available stations
 * @param {string} stationType - Type of station (furnace, brewing_stand, etc.)
 * @returns {Object} Distribution plan
 */
export function distributeAcrossStations(totalItems, stationCount, stationType = "furnace") {
  if (!Number.isFinite(totalItems) || totalItems <= 0) {
    return { error: "Valid item count required" };
  }

  if (!Number.isFinite(stationCount) || stationCount <= 0) {
    stationCount = 1;
  }

  const itemsPerStation = Math.ceil(totalItems / stationCount);
  const distribution = [];

  let remaining = totalItems;
  for (let i = 0; i < stationCount; i++) {
    const amount = Math.min(itemsPerStation, remaining);
    distribution.push({
      station: i + 1,
      items: amount,
      percentage: ((amount / totalItems) * 100).toFixed(1) + "%"
    });
    remaining -= amount;
  }

  // Calculate time savings
  const singleStationTime = stationType === "furnace" ? totalItems * 10 : totalItems * 20;
  const parallelTime = itemsPerStation * (stationType === "furnace" ? 10 : 20);
  const timeSaved = singleStationTime - parallelTime;

  return {
    totalItems: totalItems,
    stationCount: stationCount,
    stationType: stationType,
    distribution: distribution,
    itemsPerStation: itemsPerStation,
    timeSavings: {
      singleStation: `${singleStationTime}s`,
      parallel: `${parallelTime}s`,
      saved: `${timeSaved}s`,
      efficiency: `${((timeSaved / singleStationTime) * 100).toFixed(1)}%`
    },
    recommendation: `Split ${totalItems} items across ${stationCount} ${stationType}s: ${itemsPerStation} per station`
  };
}

/**
 * Create a pipeline for multi-stage crafting
 * @param {Array} stages - Array of stage objects {name, station, duration}
 * @returns {Object} Pipeline schedule
 */
export function createCraftingPipeline(stages = []) {
  if (!Array.isArray(stages) || stages.length === 0) {
    return { error: "Stages array required" };
  }

  const schedule = [];
  let currentTime = 0;

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const nextStage = stages[i + 1];

    schedule.push({
      stage: i + 1,
      name: stage.name,
      station: stage.station,
      startTime: currentTime,
      duration: stage.duration || 60,
      endTime: currentTime + (stage.duration || 60),
      status: i === 0 ? "ready" : "waiting"
    });

    // If there's a next stage, determine when it can start
    if (nextStage) {
      // Start next stage when current is 50% complete for overlapping efficiency
      const overlapStart = currentTime + Math.floor((stage.duration || 60) * 0.5);
      schedule[i].overlap = true;
      schedule[i].nextStageStart = overlapStart;
    }

    currentTime += stage.duration || 60;
  }

  const totalDuration = currentTime;
  const overlappedDuration = schedule.length > 1
    ? schedule[schedule.length - 1].endTime
    : totalDuration;

  return {
    stages: stages.length,
    schedule: schedule,
    timing: {
      sequential: `${totalDuration}s`,
      withOverlap: `${overlappedDuration}s`,
      timeSaved: `${totalDuration - overlappedDuration}s`
    },
    recommendation: "Start stage 2 when stage 1 is 50% complete for optimal throughput"
  };
}

/**
 * Optimize multi-station workflow
 * @param {Array} tasks - Array of tasks to complete
 * @param {Object} availableStations - Available stations by type
 * @returns {Object} Optimized workflow
 */
export function optimizeMultiStationWorkflow(tasks = [], availableStations = {}) {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { error: "Tasks array required" };
  }

  const workflow = [];
  const stationUsage = {};

  // Initialize station usage tracking
  for (const [stationType, count] of Object.entries(availableStations)) {
    stationUsage[stationType] = Array(count).fill(null).map((_, i) => ({
      id: i + 1,
      busy: false,
      currentTask: null,
      freeAt: 0
    }));
  }

  // Assign tasks to stations
  for (const task of tasks) {
    const requiredStation = task.station || "crafting_table";
    const stations = stationUsage[requiredStation];

    if (!stations || stations.length === 0) {
      workflow.push({
        task: task.name,
        status: "blocked",
        reason: `No ${requiredStation} available`
      });
      continue;
    }

    // Find next available station
    const nextAvailable = stations.reduce((earliest, current) =>
      current.freeAt < earliest.freeAt ? current : earliest
    );

    const startTime = nextAvailable.freeAt;
    const duration = task.duration || 30;
    const endTime = startTime + duration;

    workflow.push({
      task: task.name,
      station: requiredStation,
      stationId: nextAvailable.id,
      startTime: startTime,
      endTime: endTime,
      duration: duration,
      status: "scheduled"
    });

    // Update station availability
    nextAvailable.freeAt = endTime;
    nextAvailable.busy = true;
  }

  const totalDuration = Math.max(...workflow.map(w => w.endTime || 0));

  return {
    tasks: tasks.length,
    workflow: workflow,
    totalDuration: `${totalDuration}s`,
    stationUsage: stationUsage,
    efficiency: `${((tasks.reduce((sum, t) => sum + (t.duration || 30), 0) / totalDuration) * 100).toFixed(1)}%`,
    recommendation: "Tasks optimally scheduled across available stations"
  };
}
