// integrations/mindcraft_ce_runtime.js
// Simulated Mindcraft CE runtime that reacts to enriched mining metadata

import EventEmitter from "events";

const DEFAULT_EVENT_DELAY = 40;
const DEFAULT_MIN_DELAY = 20;

export class MindcraftCERuntime extends EventEmitter {
  constructor(options = {}) {
    super();
    this.eventDelay = options.eventDelay ?? DEFAULT_EVENT_DELAY;
    this.minimumDelay = options.minimumDelay ?? DEFAULT_MIN_DELAY;
    this.activeTasks = new Map(); // envelopeId -> timeout handles
  }

  buildEnvelopeId(envelope) {
    const npc = envelope?.npc || "unknown";
    const issuedAt = envelope?.issuedAt || Date.now();
    return `${npc}:${issuedAt}`;
  }

  async execute(envelope) {
    const envelopeId = this.buildEnvelopeId(envelope);
    const metadata = envelope?.metadata || {};
    const watchers = Array.isArray(metadata.watchers) ? metadata.watchers : [];
    const plan = metadata.plan || null;

    this.emit("plan", {
      envelope,
      npcId: envelope?.npc || null,
      plan
    });

    if (this.activeTasks.has(envelopeId)) {
      this.clearTask(envelopeId);
    }

    const timers = [];

    watchers.forEach((watch, index) => {
      const triggerDelay = this.minimumDelay + this.eventDelay * index;
      timers.push(
        setTimeout(() => {
          this.emitHazardEvent(envelope, watch, envelopeId);
        }, triggerDelay)
      );

      const needsFollowUp = this.requiresFollowUp(watch?.response?.action);
      if (needsFollowUp) {
        const mitigationDelay = triggerDelay + Math.max(10, Math.floor(this.eventDelay / 2));
        timers.push(
          setTimeout(() => {
            this.emitMitigationEvent(envelope, watch, envelopeId);
          }, mitigationDelay)
        );
      }
    });

    const completionDelay = this.minimumDelay + this.eventDelay * (watchers.length + 1);
    timers.push(
      setTimeout(() => {
        this.emit("event", {
          type: "task_complete",
          npcId: envelope?.npc || null,
          success: true,
          action: "complete",
          envelopeId
        });
        this.clearTask(envelopeId);
      }, completionDelay)
    );

    if (timers.length > 0) {
      this.activeTasks.set(envelopeId, timers);
    }

    return {
      plan,
      watchers,
      envelopeId,
      deferCompletion: true
    };
  }

  requiresFollowUp(action) {
    return ["pause", "reroute", "request_support", "request_tools"].includes(action);
  }

  emitHazardEvent(envelope, watch, envelopeId) {
    const event = {
      type: "hazard_detected",
      npcId: envelope?.npc || null,
      hazard: watch?.hazard || "unknown",
      severity: watch?.severity || "moderate",
      mitigation: watch?.mitigation,
      directive: watch?.response || null,
      envelopeId
    };

    this.emit("event", event);

    const action = watch?.response?.action;
    if (action === "pause" || action === "reroute") {
      this.emit("event", {
        type: "status",
        npcId: envelope?.npc || null,
        status: "pause",
        reason: `Hazard detected: ${watch?.hazard}`,
        directive: watch?.response || null,
        envelopeId
      });
    }

    if (action === "request_support") {
      this.emit("event", {
        type: "support_request",
        npcId: envelope?.npc || null,
        reason: `Support requested for ${watch?.hazard}`,
        directive: watch?.response || null,
        envelopeId
      });
    }

    if (action === "request_tools" && watch?.response?.request) {
      this.emit("event", {
        type: "request_tools",
        npcId: envelope?.npc || null,
        request: watch.response.request,
        hazard: watch?.hazard,
        envelopeId
      });
    }
  }

  emitMitigationEvent(envelope, watch, envelopeId) {
    const directive = watch?.response || null;
    const resumeAction = directive?.resumeAction || directive?.resume || "resume";

    this.emit("event", {
      type: "status",
      npcId: envelope?.npc || null,
      status: resumeAction === "reroute" ? "reroute" : "resume",
      reason: `Mitigation applied for ${watch?.hazard}`,
      directive: directive,
      envelopeId
    });
  }

  clearTask(envelopeId) {
    const timers = this.activeTasks.get(envelopeId) || [];
    timers.forEach(timer => clearTimeout(timer));
    this.activeTasks.delete(envelopeId);
  }

  cancel(envelopeId) {
    this.clearTask(envelopeId);
    this.emit("event", {
      type: "task_cancelled",
      envelopeId
    });
  }
}
