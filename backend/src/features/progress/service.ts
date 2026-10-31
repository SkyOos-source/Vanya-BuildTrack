import { nextId, projects, readAmount, readAttachment, readText } from "../../data/store";
import { publishWorkspaceUpdate } from "../../realtime";
import { failure, result } from "../shared";
import { activities, progressUpdates } from "./data";

export const listProgress = () => progressUpdates();

export function createProgress(body: any) {
  const description = readText(body?.description);
  const project = readText(body?.project);
  const attachment = readAttachment(body?.attachment);
  const rawAttachments: unknown = body?.attachments;
  const attachments = Array.isArray(rawAttachments)
    ? rawAttachments.map(readAttachment)
    : attachment ? [attachment] : [];
  const validAttachments = attachments.filter((item): item is string => item !== null);
  const stage = body?.stage === undefined ? "Progress" : body.stage;
  const progressValue = body?.progress;
  const hasProgressValue = progressValue !== undefined && progressValue !== "";
  const completionProgress = hasProgressValue && progressValue !== null ? readAmount(progressValue) : null;
  if (!description || !project || (stage !== "Start" && stage !== "Progress" && stage !== "Completion") ||
    (hasProgressValue && (completionProgress === null || completionProgress > 100)) ||
    (body?.attachment && !attachment) ||
    (rawAttachments !== undefined &&
      (!Array.isArray(rawAttachments) || rawAttachments.length > 5 || rawAttachments.some((item, index) =>
        !attachments[index] || !attachments[index]?.startsWith("data:image/"))))) {
    return failure(400, "Progress description, project, valid photo stage, completion percentage from 0 to 100, and up to 5 valid images are required.");
  }
  const assignedProject = projects.find((item) => item.name === project);
  if (hasProgressValue && !assignedProject) {
    return failure(400, "A valid project is required to update completion.");
  }
  const activity = {
    id: nextId("progress"),
    actor: readText(body?.submittedBy) ?? readText(body?.actor) ?? "Arjun Mehta",
    action: `submitted a progress update: ${description}`,
    project,
    time: "Just now",
    kind: "progress",
    stage,
    description,
    attachment: validAttachments[0] ?? attachment ?? undefined,
    ...(validAttachments.length ? { attachments: validAttachments } : {}),
    createdAt: new Date().toISOString()
  };
  activities.unshift(activity);
  if (assignedProject && hasProgressValue && completionProgress !== null) assignedProject.progress = completionProgress;
  const push = {
    title: "Work update from Vanya BuildTrack",
    body: `${activity.actor} shared a work update for ${project}.`,
    targets: [
      { role: "owner" as const, url: "/admin/progress-updates" },
      ...(assignedProject?.client ? [{ role: "client" as const, userName: assignedProject.client, url: "/client/timeline" }] : [])
    ]
  };
  publishWorkspaceUpdate({ resource: "progress", push });
  return result({ record: activity, project: assignedProject }, 201);
}
