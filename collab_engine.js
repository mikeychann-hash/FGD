// collab_engine.js
// Lightweight coordination layer for collaborative NPC plans

import EventEmitter from "events";

import { NodeSyncManager } from "./node_sync_manager.js";
import { TaskGraph } from "./tasks/helpers.js";

function cloneSerializable(value) {
  if (value == null) {
    return value;
  }
  if (typeof globalThis.structuredClone === "function") {
    try {
      return globalThis.structuredClone(value);
    } catch (err) {
      // fallback below
    }
  }
  return JSON.parse(JSON.stringify(value));
}

export function defaultPartitioner(participants, metadata = {}) {
  const assignments = new Map();
  if (!Array.isArray(participants) || participants.length === 0) {
    return assignments;
  }

  const area = metadata.workArea || metadata.area;
  if (area?.start && area?.end) {
    const start = area.start;
    const end = area.end;
    const x1 = Number(start.x ?? 0);
    const x2 = Number(end.x ?? x1);
    const z1 = Number(start.z ?? 0);
    const z2 = Number(end.z ?? z1);
    const y1 = start.y ?? null;
    const y2 = end.y ?? y1;
    const direction = x2 >= x1 ? 1 : -1;
    const width = Math.max(1, Math.abs(x2 - x1) + 1);
    const segmentWidth = Math.max(1, Math.ceil(width / participants.length));

    participants.forEach((participant, index) => {
      const offset = segmentWidth * index;
      const segmentStartX = x1 + (offset * direction);
      const segmentEndX = index === participants.length - 1
        ? x2
        : segmentStartX + ((segmentWidth - 1) * direction);
      assignments.set(participant.npcId, {
        area: {
          start: { x: segmentStartX, y: y1, z: z1 },
          end: { x: segmentEndX, y: y2, z: z2 }
        },
        index
      });
    });
    return assignments;
  }

  participants.forEach((participant, index) => {
    assignments.set(participant.npcId, { slot: index });
  });
  return assignments;
}

export class CollaborationEngine extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessions = new Map();
    this.syncManager = options.syncManager || null;
    this.autoStartSync = options.autoStartSync ?? false;
    this.partitionStrategy = options.partitioner || defaultPartitioner;

    if (!this.syncManager && this.autoStartSync) {
      this.syncManager = new NodeSyncManager(options.syncConfigPath);
    }
  }

  setSyncManager(syncManager) {
    this.syncManager = syncManager;
  }

  createSession({ id = null, plan = null, participants = [], metadata = {} } = {}) {
    const sessionId = id || `collab_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    if (this.sessions.has(sessionId)) {
      throw new Error(`Session ${sessionId} already exists`);
    }

    const planSnapshot = plan ? cloneSerializable(plan) : null;
    const graph = planSnapshot?.taskGraph ? TaskGraph.fromJSON(planSnapshot.taskGraph) : null;

    const session = {
      id: sessionId,
      plan: planSnapshot,
      graph,
      participants: new Map(),
      assignments: new Map(),
      metadata: { ...metadata },
      status: "active",
      createdAt: Date.now()
    };

    this.sessions.set(sessionId, session);

    if (Array.isArray(participants)) {
      participants.forEach(participant => this.addParticipant(sessionId, participant));
    }

    const snapshot = this.serializeSession(sessionId);
    this.emit("session_created", snapshot);
    this.broadcast("collab_session_created", snapshot);

    return snapshot;
  }

  serializeSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return null;
    }
    return {
      id: session.id,
      plan: session.plan ? cloneSerializable(session.plan) : null,
      taskGraph: session.graph ? session.graph.toJSON() : null,
      participants: [...session.participants.values()].map(participant => ({
        ...participant,
        assignment: participant.assignment ? cloneSerializable(participant.assignment) : null
      })),
      assignments: Object.fromEntries(
        [...session.assignments.entries()].map(([npcId, assignment]) => [npcId, cloneSerializable(assignment)])
      ),
      metadata: { ...session.metadata },
      status: session.status,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt || null
    };
  }

  addParticipant(sessionId, participant) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown collaboration session ${sessionId}`);
    }
    if (!participant || typeof participant.npcId !== "string") {
      throw new Error("Participant must include an npcId");
    }
    const entry = {
      npcId: participant.npcId,
      role: participant.role || null,
      capabilities: Array.isArray(participant.capabilities) ? [...participant.capabilities] : [],
      progress: participant.progress ?? 0,
      metadata: participant.metadata ? { ...participant.metadata } : {},
      assignment: null
    };
    session.participants.set(entry.npcId, entry);
    session.updatedAt = Date.now();

    const snapshot = this.serializeSession(sessionId);
    this.emit("participant_added", { sessionId, participant: entry });
    this.broadcast("collab_participant_added", { sessionId, participant: entry });
    return snapshot;
  }

  removeParticipant(sessionId, npcId) {
    const session = this.sessions.get(sessionId);
    if (!session || !session.participants.has(npcId)) {
      return false;
    }
    const removed = session.participants.get(npcId);
    session.participants.delete(npcId);
    session.assignments.delete(npcId);
    session.updatedAt = Date.now();

    this.emit("participant_removed", { sessionId, npcId, participant: removed });
    this.broadcast("collab_participant_removed", { sessionId, npcId });
    return true;
  }

  allocateWork(sessionId, options = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown collaboration session ${sessionId}`);
    }
    const participants = [...session.participants.values()];
    const partitioner = options.partitioner || this.partitionStrategy;
    const assignments = partitioner(participants, session.metadata, session);

    session.assignments = assignments;
    for (const participant of participants) {
      participant.assignment = assignments.get(participant.npcId) || null;
    }
    session.updatedAt = Date.now();

    const payload = {
      sessionId,
      assignments: Object.fromEntries(
        [...assignments.entries()].map(([npcId, assignment]) => [npcId, cloneSerializable(assignment)])
      )
    };

    this.emit("assignments_updated", payload);
    this.broadcast("collab_assignments_updated", payload);
    return payload;
  }

  updateProgress(sessionId, npcId, progress, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Unknown collaboration session ${sessionId}`);
    }
    const participant = session.participants.get(npcId);
    if (!participant) {
      throw new Error(`NPC ${npcId} is not part of session ${sessionId}`);
    }
    participant.progress = Math.max(0, Math.min(100, Number(progress) || 0));
    participant.metadata = { ...participant.metadata, ...metadata };
    session.updatedAt = Date.now();

    const payload = {
      sessionId,
      npcId,
      progress: participant.progress,
      metadata: participant.metadata
    };
    this.emit("progress_updated", payload);
    this.broadcast("collab_progress_updated", payload);
    return payload;
  }

  completeSession(sessionId, metadata = {}) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return false;
    }
    session.status = "completed";
    session.completedAt = Date.now();
    session.metadata = { ...session.metadata, ...metadata };

    const snapshot = this.serializeSession(sessionId);
    this.emit("session_completed", snapshot);
    this.broadcast("collab_session_completed", snapshot);
    return true;
  }

  getSession(sessionId) {
    return this.serializeSession(sessionId);
  }

  broadcast(eventType, data) {
    if (this.syncManager?.broadcastClusterEvent) {
      this.syncManager.broadcastClusterEvent(eventType, data);
    }
  }
}
