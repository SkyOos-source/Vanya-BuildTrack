import { sendPushNotification, type PushMessage } from "./push";
import type { SiteVisit } from "./data/store";

export type WorkspaceUpdate = {
  resource: "materials" | "materialRequests" | "expenses" | "progress" | "quotations" | "siteVisits" | "attendance";
  push?: PushMessage;
  visit?: SiteVisit;
  action?: "scheduled" | "check-in" | "check-out";
};

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
