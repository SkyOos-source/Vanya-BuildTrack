import { sendPushNotification, type PushMessage } from "./push";
import type { ExpenseAllocation, SiteVisit } from "./data/store";

export type WorkspaceUpdate = {
  resource: "materials" | "materialCategories" | "materialRequests" | "materialAllocations" | "materialUsage" | "expenses" | "expenseAllocations" | "progress" | "quotations" | "payments" | "paymentRequests" | "siteVisits" | "attendance" | "workRequests";
  project?: string;
  push?: PushMessage;
  visit?: SiteVisit;
  allocation?: ExpenseAllocation;
  materialAllocation?: import("./data/store").MaterialAllocation;
  engineer?: string;
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
