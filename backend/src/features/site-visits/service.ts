import { nextId, projects, readText } from "../../data/store";
import { siteVisits } from "./data";
import { failure, result } from "../shared";

export const listSiteVisits = () => siteVisits;

export function createSiteVisit(body: any) {
  const project = readText(body?.project);
  const engineer = readText(body?.engineer);
  const date = readText(body?.date);
  if (!project || !engineer || !date) return failure(400, "Project, engineer, and visit date are required.");
  const selectedProject = projects.find((item) => item.name === project);
  const visit = {
    id: nextId("visit"),
    project,
    site: selectedProject?.site ?? "Project site",
    engineer,
    date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    status: "Scheduled"
  };
  siteVisits.unshift(visit);
  return result({ record: visit }, 201);
}

export function updateSiteVisit(id: string, body: any) {
  const visit = siteVisits.find((item) => item.id === id);
  if (!visit) return failure(404, "Site visit not found.");
  const status = body?.status;
  if (status !== "Scheduled" && status !== "Completed" && status !== "Cancelled") {
    return failure(400, "Site visit status must be Scheduled, Completed, or Cancelled.");
  }
  visit.status = status;
  return result({ record: visit });
}
