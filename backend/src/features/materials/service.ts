import { materialAllocations, materialCategories, materialRequests, materialUsageLogs, nextId, people, projects, readAmount, readText } from "../../data/store";
import { materials } from "./data";
import { failure, result } from "../shared";

export const listMaterials = () => materials;
export const listMaterialCategories = () => materialCategories;
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

function addQuantityText(left: unknown, right: unknown) {
  const leftQuantity = parseQuantityText(left);
  const rightQuantity = parseQuantityText(right);
  if (!leftQuantity || !rightQuantity) return null;
  const leftUnit = leftQuantity.unit.toLowerCase();
  const rightUnit = rightQuantity.unit.toLowerCase();
  if (leftUnit !== rightUnit && !(leftQuantity.quantity === 0 && !leftUnit)) return null;
  const total = quantityToThousandths(leftQuantity.quantity) + quantityToThousandths(rightQuantity.quantity);
  if (!Number.isSafeInteger(total)) return null;
  const unit = rightQuantity.unit || leftQuantity.unit;
  return `${total / 1000}${unit ? ` ${unit}` : ""}`;
}

function formatQuantity(quantity: number, unit: string) {
  return `${quantity}${unit ? ` ${unit}` : ""}`;
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
  const inventory = materials.find((item) => item.material.toLowerCase() === material?.toLowerCase());
  const available = inventory && parseQuantityText(inventory.stock);
  if (!material || !project || quantity === null || !inventory || !available || !projects.some((item) => item.name === project)) {
    return failure(400, "Select a material with available stock and an existing site or project.");
  }
  if (available.unit.toLowerCase() !== (readText(body?.unit) ?? available.unit).toLowerCase()) {
    return failure(400, "Material assignment unit must match the available stock unit.");
  }
  const availableThousandths = quantityToThousandths(available.quantity);
  const assignedThousandths = quantityToThousandths(quantity);
  if (assignedThousandths > availableThousandths) {
    return failure(400, `Only ${inventory.stock} is available to assign.`);
  }
  const allocation = buildAllocation(body, project, material, quantity, available.unit);
  if (!allocation) return failure(400, "Select an existing project.");
  inventory.stock = formatQuantity((availableThousandths - assignedThousandths) / 1000, available.unit);
  inventory.lastUpdated = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
  materialAllocations.unshift(allocation);
  return result({ record: { ...allocation, remainingQuantity: remainingQuantity(allocation) }, material: inventory }, 201);
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
  if (!material || !materialCategories.some((category) => category.name.toLowerCase() === material.toLowerCase()) ||
    !project || !parsedQuantity || !requestedBy || !projects.some((item) => item.name === project)) {
    return failure(400, "Select an existing material category, project, and positive requested quantity.");
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
  if (body?.recordMissingMaterial === true) {
    if (request.status !== "Approved") return failure(400, "Only approved material requests can be recorded in inventory.");
    if (materials.some((item) =>
      (item.category ?? item.material).toLowerCase() === request.material.toLowerCase()
    )) {
      return failure(409, "This material already has an inventory record.");
    }
    const parsedQuantity = parseQuantityText(request.quantity);
    if (!parsedQuantity) return failure(400, "The requested quantity is invalid and cannot be recorded.");
    let materialCategory = materialCategories.find((item) => item.name.toLowerCase() === request.material.toLowerCase());
    if (!materialCategory) {
      const categoryResult = createMaterialCategory({
        name: request.material,
        createdBy: readText(request.reviewedBy) ?? "Owner"
      });
      if (categoryResult.body.error) return failure(categoryResult.status ?? 400, categoryResult.body.error);
      materialCategory = categoryResult.body.record;
    }
    if (!materialCategory) return failure(400, "The material category could not be created.");
    const stockResult = createMaterial({
      category: materialCategory.name,
      received: request.quantity,
      submittedBy: readText(request.reviewedBy) ?? "Owner"
    });
    if (stockResult.body.error) return failure(stockResult.status ?? 400, stockResult.body.error);
    const inventory = materials.find((item) =>
      (item.category ?? item.material).toLowerCase() === request.material.toLowerCase()
    );
    if (!inventory) return failure(500, "The approved material could not be recorded in inventory.");
    inventory.stock = formatQuantity(0, parsedQuantity.unit);
    inventory.lastUpdated = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
    return result({ record: request, material: inventory, materialCategory });
  }
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
    const reviewedBy = readText(body?.reviewedBy) ?? "Owner";
    let materialCategory = materialCategories.find((item) => item.name.toLowerCase() === request.material.toLowerCase());
    let inventory = materials.find((item) =>
      (item.category ?? item.material).toLowerCase() === request.material.toLowerCase()
    );
    let available = inventory && parseQuantityText(inventory.stock);
    let hasEnoughStock = Boolean(available &&
      available.unit.toLowerCase() === parsedQuantity.unit.toLowerCase() &&
      quantityToThousandths(available.quantity) >= quantityToThousandths(parsedQuantity.quantity));
    if (!hasEnoughStock && body?.addStock !== true) {
      return failure(409, "Material stock is missing or insufficient. Add the requested quantity before approving.");
    }
    if (!hasEnoughStock && body?.addStock === true) {
      if (!materialCategory) {
        const categoryResult = createMaterialCategory({ name: request.material, createdBy: reviewedBy });
        if (categoryResult.body.error) return failure(categoryResult.status ?? 400, categoryResult.body.error);
        materialCategory = categoryResult.body.record;
      }
      if (!materialCategory) return failure(400, "The material category could not be created.");
      const stockResult = createMaterial({
        category: materialCategory.name,
        received: request.quantity,
        submittedBy: reviewedBy
      });
      if (stockResult.body.error) return failure(stockResult.status ?? 400, stockResult.body.error);
      inventory = materials.find((item) =>
        (item.category ?? item.material).toLowerCase() === request.material.toLowerCase()
      );
      available = inventory && parseQuantityText(inventory.stock);
      hasEnoughStock = Boolean(available &&
        available.unit.toLowerCase() === parsedQuantity.unit.toLowerCase() &&
        quantityToThousandths(available.quantity) >= quantityToThousandths(parsedQuantity.quantity));
    }
    if (!inventory || !available || !hasEnoughStock) {
      return failure(409, "Material stock is still insufficient after recording the requested quantity.");
    }
    inventory.stock = formatQuantity(
      (quantityToThousandths(available.quantity) - quantityToThousandths(parsedQuantity.quantity)) / 1000,
      available.unit
    );
    inventory.lastUpdated = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
    materialAllocations.unshift(allocation);
    request.status = status;
    request.reviewedBy = reviewedBy;
    request.reviewedAt = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
    return result({
      record: request,
      allocation: { ...allocation, remainingQuantity: remainingQuantity(allocation) },
      engineerEmail: engineer?.email,
      material: inventory,
      ...(body?.addStock === true && materialCategory ? { materialCategory } : {})
    });
  }
  request.status = status;
  request.reviewedBy = readText(body?.reviewedBy) ?? "Owner";
  request.reviewedAt = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
  return result({ record: request });
}

export function createMaterial(body: any) {
  const category = readText(body?.category);
  const receivedQuantity = parseQuantityText(readText(body?.received) ?? readText(body?.quantity));
  const selectedCategory = materialCategories.find((item) => item.name.toLowerCase() === category?.toLowerCase());
  if (!selectedCategory || !receivedQuantity) {
    return failure(400, "Select an existing category and enter a positive quantity with no more than three decimal places.");
  }
  const received = `${receivedQuantity.quantity}${receivedQuantity.unit ? ` ${receivedQuantity.unit}` : ""}`;
  const existing = materials.find((item) =>
    (item.category ?? item.material).toLowerCase() === selectedCategory.name.toLowerCase()
  );
  const now = new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" });
  if (existing) {
    const totalReceived = addQuantityText(existing.received, received);
    const totalStock = addQuantityText(existing.stock, received);
    if (totalReceived === null || totalStock === null) {
      return failure(400, "The added quantity must use the same unit as the existing category stock.");
    }
    existing.material = selectedCategory.name;
    existing.category = selectedCategory.name;
    existing.received = totalReceived;
    existing.stock = totalStock;
    existing.lastUpdated = now;
    existing.submittedBy = readText(body?.submittedBy) ?? existing.submittedBy;
    return result({ record: existing });
  }
  const material = {
    id: nextId("material"),
    material: selectedCategory.name,
    category: selectedCategory.name,
    received,
    used: "0",
    stock: received,
    lastUpdated: now,
    submittedBy: readText(body?.submittedBy) ?? undefined
  };
  materials.unshift(material);
  return result({ record: material }, 201);
}

export function createMaterialCategory(body: any) {
  const name = readText(body?.name);
  if (!name) return failure(400, "Category name is required.");
  if (materialCategories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
    return failure(409, "That material category already exists.");
  }
  const category = {
    id: nextId("material-category"),
    name,
    createdAt: new Date().toLocaleString("en", { dateStyle: "medium", timeStyle: "short" }),
    createdBy: readText(body?.createdBy) ?? undefined
  };
  materialCategories.unshift(category);
  return result({ record: category }, 201);
}
