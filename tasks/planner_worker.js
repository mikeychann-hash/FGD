import { parentPort } from "node:worker_threads";

if (!parentPort) {
  throw new Error("planner_worker must be run as a worker thread");
}

parentPort.on("message", async (message) => {
  const { modulePath, exportName, task, context, shared, port } = message || {};
  const view = new Int32Array(shared);

  try {
    const module = await import(modulePath);
    const planner = exportName ? module[exportName] : module.default || module.planTask || null;
    if (typeof planner !== "function") {
      throw new Error(`Planner export not found for module ${modulePath}`);
    }
    const result = await planner(task, context);
    if (port) {
      port.postMessage({ type: "result", result });
      port.close();
    } else {
      parentPort.postMessage({ type: "result", result });
    }
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0);
  } catch (err) {
    if (port) {
      port.postMessage({ type: "error", error: err.message });
      port.close();
    } else {
      parentPort.postMessage({ type: "error", error: err.message });
    }
    Atomics.store(view, 0, 1);
    Atomics.notify(view, 0);
  }
});
