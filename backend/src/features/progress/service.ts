import { nextId, projects, readAttachment, readText } from "../../data/store";
import { publishWorkspaceUpdate } from "../../realtime";
import { failure, result } from "../shared";
import { activities, progressUpdates } from "./data";

export const listProgress = () => progressUpdates();

export function createProgress(body: any) {
  const description = readText(body?.description);
  const project = readText(body?.project);
  const attachment = readAttachment(body?.attachment);
  if (!description || !project || (body?.attachment && !attachment)) {
    return failure(400, "Progress description, project, and a supported attachment are required.");
  }
  const activity = {
    id: nextId("progress"),
    actor: readText(body?.submittedBy) ?? readText(body?.actor) ?? "Arjun Mehta",
    action: `submitted a progress update: ${description}`,
    project,
    time: "Just now",
    kind: "progress",
    description,
    attachment: attachment ?? undefined,
    createdAt: new Date().toISOString()
  };
  activities.unshift(activity);
  const assignedProject = projects.find((item) => item.name === project);
  const push = {
    title: "Work update from Vanya BuildTrack",
    body: `${activity.actor} shared a work update for ${project}.`,
    targets: [
      { role: "owner" as const, url: "/admin/progress-updates" },
      ...(assignedProject?.client ? [{ role: "client" as const, userName: assignedProject.client, url: "/client/timeline" }] : [])
    ]
  };
  publishWorkspaceUpdate({ resource: "progress", push });
  return result({ record: activity }, 201);
}
