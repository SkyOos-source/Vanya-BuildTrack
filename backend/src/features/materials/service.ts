import { materialAllocations, materialRequests, materialUsageLogs, nextId, people, projects, readAmount, readText } from "../../data/store";
import { materials } from "./data";
import { failure, result } from "../shared";

export const listMaterials = () => materials;
export const listMaterialRequests = () => materialRequests;
export const listMaterialAllocations = () => materialAllocations.map((allocation) => ({
  ...allocation,
  remainingQuantity: remainingQuantity(allocation)
}));
export const listMaterialUsage = () => materialUsageLogs;

function quantityToThousandths(quantity: number) {
  return Math.round(quantity * 1000);
}

function readPositiveQuantity(value: unknown) {
  const quantity = readAmount(value);
  if (quantity === null || quantity <= 0) return null;
  const thousandths = quantityToThousandths(quantity);
  if (!Number.isSafeInteger(thousandths) || Math.abs(quantity * 1000 - thousandths) > 1e-7) return null;
  return thousandths / 1000;
}

function parseQuantityText(value: unknown) {
  const text = readText(value);
  const match = text?.match(/^(\d+(?:\.\d{1,3})?)\s*(.*?)$/);
  if (!match) return null;
  const quantity = readPositiveQuantity(match[1]);
  const unit = match[2].trim();
  return quantity === null ? null : { quantity, unit };
}

function remainingQuantity(allocation: { quantity: number; usedQuantity: number }) {
  return (quantityToThousandths(allocation.quantity) - quantityToThousandths(allocation.usedQuantity)) / 1000;
}

function buildAllocation(body: any, project: string, material: string, quantity: number, unit: string, requestId?: string) {
  const projectRecord = projects.find((item) => item.name === project);
  if (!projectRecord) return null;
  return {
    id: nextId("material-allocation"),
    material,
    project,
    engineer: projectRecord.engineer,
    quantity,
    unit,
    usedQuantity: 0,
    assignedAt: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }),
    assignedBy: readText(body?.assignedBy) ?? "Owner",
    ...(requestId ? { requestId } : {})
  };
}

export function createMaterialAllocation(body: any) {
  const material = readText(body?.material);
  const project = readText(body?.project);
  const quantity = readPositiveQuantity(body?.quantity);
  const unit = readText(body?.unit) ?? "";
  if (!material || !project || quantity === null || !projects.some((item) => item.name === project)) {
    return failure(400, "Material, an existing project, and a positive quantity with no more than three decimal places are required.");
  }
  const allocation = buildAllocation(body, project, material, quantity, unit);
  if (!allocation) return failure(400, "Select an existing project.");
  materialAllocations.unshift(allocation);
  return result({ record: { ...allocation, remainingQuantity: remainingQuantity(allocation) } }, 201);
}

export function createMaterialUsage(body: any) {
  const allocationId = readText(body?.allocationId);
  const quantity = readPositiveQuantity(body?.quantity);
  const engineer = readText(body?.engineer);
  const allocation = materialAllocations.find((item) => item.id === allocationId);
  if (!allocation || !engineer || allocation.engineer.toLowerCase() !== engineer.toLowerCase()) {
    return failure(400, "Select one of your assigned materials.");
  }
  if (quantity === null) {
    return failure(400, "Used quantity must be positive and have no more than three decimal places.");
  }
  if (quantityToThousandths(quantity) > quantityToThousandths(remainingQuantity(allocation))) {
    return failure(400, `Only ${remainingQuantity(allocation)} ${allocation.unit} remains in this assignment.`);
  }
  const log = {
    id: nextId("material-usage"),
    allocationId: allocation.id,
    material: allocation.material,
    project: allocation.project,
    quantity,
    unit: allocation.unit,
    engineer,
    loggedBy: readText(body?.loggedBy) ?? engineer,
    note: readText(body?.note) ?? undefined,
    loggedAt: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" })
  };
  allocation.usedQuantity = (quantityToThousandths(allocation.usedQuantity) + quantityToThousandths(quantity)) / 1000;
  materialUsageLogs.unshift(log);
  return result({
    record: log,
    allocation: { ...allocation, remainingQuantity: remainingQuantity(allocation) }
  }, 201);
}

export function createMaterialRequest(body: any) {
  const material = readText(body?.material);
  const project = readText(body?.project);
  const quantityText = readText(body?.quantity);
  const parsedQuantity = parseQuantityText(quantityText);
  const requestedBy = readText(body?.requestedBy);
  if (!material || !project || !parsedQuantity || !requestedBy || !projects.some((item) => item.name === project)) {
    return failure(400, "Material, an existing project, a positive requested quantity, and requester are required.");
  }
  const request = {
    id: nextId("material-request"),
    material,
    project,
    quantity: `${parsedQuantity.quantity}${parsedQuantity.unit ? ` ${parsedQuantity.unit}` : ""}`,
    requestedBy,
    note: readText(body?.note) ?? undefined,
    requestedAt: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }),
    status: "Pending review"
  };
  materialRequests.unshift(request);
  return result({ record: request }, 201);
}

export function updateMaterialRequest(id: string, body: any) {
  const request = materialRequests.find((item) => item.id === id);
  if (!request) return failure(404, "Material request not found.");
  if (request.status !== "Pending review") return failure(400, "Only pending material requests can be reviewed.");
  const status = body?.status;
  if (status !== "Approved" && status !== "Declined") {
    return failure(400, "Material request status must be Approved or Declined.");
  }
  if (status === "Approved") {
    const parsedQuantity = parseQuantityText(request.quantity);
    if (!parsedQuantity) return failure(400, "The requested quantity is invalid and cannot be assigned.");
    const allocation = buildAllocation(body, request.project, request.material, parsedQuantity.quantity, parsedQuantity.unit, request.id);
    if (!allocation) return failure(400, "The request project no longer exists.");
    const engineer = people.find((person) => person.role === "Site Engineer" && person.name.toLowerCase() === request.requestedBy.toLowerCase());
    materialAllocations.unshift(allocation);
    request.status = status;
    request.reviewedBy = readText(body?.reviewedBy) ?? "Owner";
    request.reviewedAt = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
    return result({
      record: request,
      allocation: { ...allocation, remainingQuantity: remainingQuantity(allocation) },
      engineerEmail: engineer?.email
    });
  }
  request.status = status;
  request.reviewedBy = readText(body?.reviewedBy) ?? "Owner";
  request.reviewedAt = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
  return result({ record: request });
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
