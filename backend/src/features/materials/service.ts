import { materialRequests, nextId, projects, readText } from "../../data/store";
import { materials } from "./data";
import { failure, result } from "../shared";

export const listMaterials = () => materials;
export const listMaterialRequests = () => materialRequests;

export function createMaterialRequest(body: any) {
  const material = readText(body?.material);
  const project = readText(body?.project);
  const quantity = readText(body?.quantity);
  const requestedBy = readText(body?.requestedBy);
  if (!material || !project || !quantity || !requestedBy || !projects.some((item) => item.name === project)) {
    return failure(400, "Material, project, requested quantity, and requester are required.");
  }
  const request = {
    id: nextId("material-request"),
    material,
    project,
    quantity,
    requestedBy,
    note: readText(body?.note) ?? undefined,
    requestedAt: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }),
    status: "Pending review"
  };
  materialRequests.unshift(request);
  return result({ record: request }, 201);
}

export function createMaterial(body: any) {
  const materialName = readText(body?.material);
  const project = readText(body?.project);
  const received = readText(body?.received);
  if (!materialName || !project || !received || !projects.some((item) => item.name === project)) {
    return failure(400, "Material, project, and received quantity are required.");
  }
  const material = {
    id: nextId("material"),
    material: materialName,
    project,
    received,
    used: readText(body?.used) ?? "0",
    stock: readText(body?.stock) ?? received,
    lastUpdated: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }),
    submittedBy: readText(body?.submittedBy) ?? undefined
  };
  materials.unshift(material);
  return result({ record: material }, 201);
}
