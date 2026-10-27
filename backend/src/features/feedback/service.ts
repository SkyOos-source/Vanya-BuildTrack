import { readAmount, readText } from "../../data/store";
import { failure, result, today } from "../shared";
import { feedback } from "./data";

export const listFeedback = () => feedback;

export function createFeedback(body: any) {
  const project = readText(body?.project);
  const comment = readText(body?.comment);
  const rating = readAmount(body?.rating);
  if (!project || !comment || rating === null || rating < 1 || rating > 5) {
    return failure(400, "Project, feedback comment, and a rating from 1 to 5 are required.");
  }
  const record = {
    id: `FDB-${String(feedback.length + 1).padStart(2, "0")}`,
    project,
    client: readText(body?.client) ?? "Ananya Rao",
    rating,
    comment,
    date: today()
  };
  feedback.unshift(record);
  return result({ record }, 201);
}
