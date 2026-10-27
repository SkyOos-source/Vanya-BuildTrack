import { nextId, projects, readText } from "../../data/store";
import { materials } from "./data";
import { failure, result } from "../shared";

export const listMaterials = () => materials;

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
    lastUpdated: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
  };
  materials.unshift(material);
  return result({ record: material }, 201);
}
