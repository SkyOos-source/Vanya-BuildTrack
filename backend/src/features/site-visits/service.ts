import { nextId, people, projects, readCompressedImage, readText, type SiteVisitProof } from "../../data/store";
import { siteVisits } from "./data";
import { failure, result } from "../shared";

export const listSiteVisits = () => siteVisits;

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function readSiteVisitProof(value: unknown): SiteVisitProof | null {
  if (!value || typeof value !== "object") return null;
  const proof = value as Record<string, unknown>;
  const image = readCompressedImage(proof.image);
  if (!image ||
    typeof proof.capturedAt !== "string" ||
    !Number.isFinite(Date.parse(proof.capturedAt))) return null;
  return { image, capturedAt: new Date(proof.capturedAt).toISOString() };
}

export function createSiteVisit(body: any) {
  const project = readText(body?.project);
  const engineer = readText(body?.engineer);
  const date = readText(body?.date);
  if (!project || !engineer || !date || !validDate(date)) {
    return failure(400, "A project, engineer, and valid visit date are required.");
  }
  const selectedProject = projects.find((item) => item.name === project);
  if (!selectedProject) return failure(400, "Choose a valid project.");
  if (!people.some((person) => person.role === "Site Engineer" && person.name === engineer) &&
    selectedProject.engineer !== engineer) {
    return failure(400, "Choose a valid site engineer.");
  }
  const visit = {
    id: nextId("visit"),
    project,
    site: selectedProject.site,
    engineer,
    date,
    purpose: readText(body?.description) ?? undefined,
    status: "Scheduled"
  };
  siteVisits.unshift(visit);
  return result({ record: visit }, 201);
}

export function updateSiteVisit(id: string, body: any) {
  const visit = siteVisits.find((item) => item.id === id);
  if (!visit) return failure(404, "Site visit not found.");
  const action = body?.action;
  const engineer = readText(body?.engineer);
  const proof = readSiteVisitProof(body?.proof);
  if (!engineer || engineer !== visit.engineer) return failure(403, "This site visit is assigned to another engineer.");
  if (action !== "check-in" && action !== "check-out") {
    return failure(400, "Choose check-in or check-out for this site visit.");
  }
  if (!proof) return failure(400, "A valid site photo and capture time are required.");
  if (action === "check-in") {
    if (visit.status !== "Scheduled") return failure(409, "This visit is no longer scheduled for check-in.");
    visit.checkIn = proof;
    visit.status = "Checked in";
  } else {
    if (visit.status !== "Checked in" || !visit.checkIn) {
      return failure(409, "Check in with a photo before checking out.");
    }
    if (Date.parse(proof.capturedAt) <= Date.parse(visit.checkIn.capturedAt)) {
      return failure(400, "The check-out photo must be captured after check-in.");
    }
    visit.checkOut = proof;
    visit.status = "Completed";
  }
  return result({ record: visit });
}
