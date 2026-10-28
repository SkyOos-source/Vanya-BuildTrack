import { sendPushNotification, type PushMessage } from "./push";

export type WorkspaceUpdate = { resource: "materials" | "materialRequests" | "expenses" | "progress"; push?: PushMessage };

type WorkspaceUpdateListener = (update: WorkspaceUpdate) => void;

const listeners = new Set<WorkspaceUpdateListener>();

export function subscribeToWorkspaceUpdates(listener: WorkspaceUpdateListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function publishWorkspaceUpdate(update: WorkspaceUpdate): void {
  for (const listener of listeners) listener(update);
  if (update.push) void sendPushNotification(update.push);
}
