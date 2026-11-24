import { nextId, people, projects, readCompressedImage, readProject, readText, type SiteVisitProof } from "../../data/store";
import { siteVisits } from "./data";
import { failure, result } from "../shared";
import { R2StorageError, uploadBase64Image } from "../../object-storage/r2";

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
    !Number.isFinite(Date.parse(proof.capturedAt)) ||
    typeof proof.latitude !== "number" ||
    typeof proof.longitude !== "number" ||
    typeof proof.accuracy !== "number" ||
    !Number.isFinite(proof.latitude) ||
    !Number.isFinite(proof.longitude) ||
    !Number.isFinite(proof.accuracy) ||
    proof.latitude < -90 || proof.latitude > 90 ||
    proof.longitude < -180 || proof.longitude > 180 ||
    proof.accuracy < 0) return null;
  return {
    image,
    capturedAt: new Date(proof.capturedAt).toISOString(),
    latitude: proof.latitude,
    longitude: proof.longitude,
    accuracy: proof.accuracy,
    ...(typeof proof.locationName === "string" && proof.locationName.trim()
      ? { locationName: proof.locationName.trim().slice(0, 300) }
      : {})
  };
}

export async function createSiteVisit(body: any) {
  const action = body?.action;
  if (action === "check-in") {
    const engineer = readText(body?.engineer);
    const proof = readSiteVisitProof(body?.proof);
    if (!engineer) return failure(400, "Engineer name is required.");
    if (!proof) return failure(400, "A valid site photo and capture time are required.");
    let uploadedProof: typeof proof = proof;
    try {
      uploadedProof = { ...proof, image: await uploadBase64Image(proof.image, "site-visits") };
    } catch (error) {
      return failure(error instanceof R2StorageError ? 503 : 500, error instanceof R2StorageError ? error.message : "Site visit photo could not be uploaded.");
    }

    const activeVisit = siteVisits.find((item) => item.engineer === engineer && item.status === "Checked in");
    if (activeVisit) return failure(409, "Check out of the current site before starting another visit.");

    let projectName = readText(body?.project);
    let siteName = readText(body?.site);
    if (body?.createProject === true || body?.createProject === "true") {
      const newProjectName = readText(body?.name);
      if (!newProjectName) return failure(400, "A new project/site name is required.");
      projectName = newProjectName;
      siteName = readText(body?.site) ?? newProjectName;
      if (projects.some((item) => item.name.toLowerCase() === newProjectName.toLowerCase())) {
        return failure(409, "A project/site with this name already exists.");
      }
      const project = readProject({
        name: projectName,
        site: siteName,
        engineer,
        status: "Planning",
        progress: 0,
        budget: 0,
        spent: 0,
        quotationAmount: 0,
        dueDate: "To be confirmed"
      }, nextId("project"));
      if (!project) return failure(400, "Could not create the new project/site.");
      projects.unshift(project);
    }
    if (!projectName) return failure(400, "Choose a project/site or create a new one.");
    const selectedProject = projects.find((item) => item.name === projectName);
    if (!selectedProject) return failure(400, "Choose a valid project/site.");

    const date = /^\d{4}-\d{2}-\d{2}$/.test(readText(body?.date) ?? "")
      ? readText(body?.date)!
      : new Date().toISOString().slice(0, 10);
    const visit = {
      id: nextId("visit"),
      project: selectedProject.name,
      site: selectedProject.site,
      engineer,
      date,
      purpose: readText(body?.description) ?? undefined,
      status: "Checked in",
      checkIn: uploadedProof
    };
    siteVisits.unshift(visit);
    return result({ record: visit, project: body?.createProject ? selectedProject : undefined }, 201);
  }

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

export async function updateSiteVisit(id: string, body: any) {
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
  let uploadedProof: typeof proof = proof;
  try {
    uploadedProof = { ...proof, image: await uploadBase64Image(proof.image, "site-visits") };
  } catch (error) {
    return failure(error instanceof R2StorageError ? 503 : 500, error instanceof R2StorageError ? error.message : "Site visit photo could not be uploaded.");
  }
  if (action === "check-in") {
    if (visit.status !== "Scheduled") return failure(409, "This visit is no longer scheduled for check-in.");
    visit.checkIn = uploadedProof;
    visit.status = "Checked in";
  } else {
    if (visit.status !== "Checked in" || !visit.checkIn) {
      return failure(409, "Check in with a photo before checking out.");
    }
    if (Date.parse(proof.capturedAt) <= Date.parse(visit.checkIn.capturedAt)) {
      return failure(400, "The check-out photo must be captured after check-in.");
    }
    visit.checkOut = uploadedProof;
    visit.status = "Completed";
  }
  return result({ record: visit });
}
