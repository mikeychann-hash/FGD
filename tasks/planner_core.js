import { Worker, MessageChannel, receiveMessageOnPort } from "node:worker_threads";

const planners = new Map();
const WORKER_PATH = new URL("./planner_worker.js", import.meta.url);

function getMetadata(action) {
  return planners.get(action) || null;
}

export function registerPlanner(action, handler, options = {}) {
  if (!action || typeof handler !== "function") {
    throw new Error("registerPlanner requires an action string and handler function");
  }
  planners.set(action, {
    handler,
    modulePath: options.modulePath || null,
    exportName: options.exportName || null,
    parallel: options.parallel === true
  });
}

function structuredCloneSafe(value) {
  if (typeof structuredClone === "function") {
    try {
      return structuredClone(value);
    } catch (err) {
      return null;
    }
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (err) {
    return null;
  }
}

function runPlannerInWorkerSync(metadata, task, context) {
  if (!metadata.modulePath) {
    return null;
  }

  const shared = new SharedArrayBuffer(4);
  const view = new Int32Array(shared);
  const { port1, port2 } = new MessageChannel();
  let result = null;
  let error = null;

  const worker = new Worker(WORKER_PATH, {
    workerData: null,
    type: 'module'
  });

  worker.on("error", (err) => {
    error = err;
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0);
  });

  worker.postMessage({
    modulePath: metadata.modulePath,
    exportName: metadata.exportName,
    task,
    context,
    shared,
    port: port2
  }, [port2]);

  Atomics.wait(view, 0, 0);

  const messageEnvelope = receiveMessageOnPort(port1);
  port1.close();

  if (!messageEnvelope?.message && !error) {
    // If no message arrived but we were notified, treat as failure
    error = new Error(`Planner worker for ${metadata.modulePath} returned no result`);
  }

  const message = messageEnvelope?.message;
  if (message?.type === "result") {
    result = message.result;
  } else if (message?.type === "error") {
    error = new Error(message.error);
  }

  worker.terminate();
  if (error) {
    throw error;
  }
  return result;
}

export function hasPlanner(action) {
  return planners.has(action);
}

export function getPlanner(action) {
  const metadata = getMetadata(action);
  return metadata?.handler || null;
}

export function planTask(action, task, context = {}) {
  const metadata = getMetadata(action);
  if (!metadata) {
    return null;
  }

  const { handler } = metadata;
  if (!metadata.parallel) {
    return handler(task, context);
  }

  const safeContext = structuredCloneSafe(context);
  if (!safeContext) {
    return handler(task, context);
  }

  try {
    const result = runPlannerInWorkerSync(metadata, task, safeContext);
    if (result != null) {
      return result;
    }
  } catch (err) {
    console.warn(`⚠️  Planner worker failed for action ${action}: ${err.message}`);
  }
  return handler(task, context);
}

export function executePlanner(task, context = {}) {
  if (!task || typeof task !== "object") {
    return null;
  }
  const action = task.action;
  if (!action) {
    return null;
  }
  return planTask(action, task, context);
}

export function listRegisteredPlanners() {
  return Array.from(planners.keys());
}

export default {
  registerPlanner,
  hasPlanner,
  getPlanner,
  executePlanner,
  planTask,
  listRegisteredPlanners
};
