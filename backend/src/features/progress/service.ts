import { nextId, readAttachment, readText } from "../../data/store";
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
    actor: readText(body?.actor) ?? "Arjun Mehta",
    action: `submitted a progress update: ${description}`,
    project,
    time: "Just now",
    kind: "progress",
    description,
    attachment: attachment ?? undefined,
    createdAt: new Date().toISOString()
  };
  activities.unshift(activity);
  return result({ record: activity }, 201);
}
