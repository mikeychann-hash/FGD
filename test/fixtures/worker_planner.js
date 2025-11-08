export function workerPlanner(task) {
  return {
    action: task.action,
    steps: [{ description: "run in worker" }],
    preferredTraits: ["brave"]
  };
}
