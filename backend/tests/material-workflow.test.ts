import assert from "node:assert/strict";
import test from "node:test";
import { materialAllocations, materialCategories, materialRequests, materialUsageLogs, materials, people, projects, restoreStoreSnapshot, snapshotStore } from "../src/data/store";
import { createMaterial, createMaterialAllocation, createMaterialCategory, createMaterialRequest, createMaterialUsage, listMaterialAllocations, updateMaterialRequest } from "../src/features/materials/service";

test("engineers can consume assigned material and approved requests create additional assignments", () => {
  const original = snapshotStore();
  try {
    people.push({
      id: "material-test-engineer",
      name: "Material Test Engineer",
      role: "Site Engineer",
      project: "Material Test Project",
      email: "material-test@example.com"
    });
    projects.push({
      id: "material-test-project",
      name: "Material Test Project",
      site: "Test site",
      client: "Test client",
      engineer: "Material Test Engineer",
      status: "Active",
      progress: 0,
      budget: 0,
      spent: 0,
      dueDate: "To be confirmed",
      image: "test.jpg"
    });

    const category = createMaterialCategory({ name: "Cement", createdBy: "Test Owner" });
    assert.equal(category.status, 201);
    assert.equal(createMaterialCategory({ name: "cement" }).status, 409);
    const stock = createMaterial({
      category: "Cement",
      received: "10 bags",
      submittedBy: "Test Owner"
    });
    assert.equal(stock.status, 201);
    assert.equal(createMaterial({ category: "Missing", received: "2 bags" }).status, 400);
    const repeatedStock = createMaterial({ category: "CEMENT", received: "5 bags" });
    assert.equal(repeatedStock.status, 200);
    assert.equal(repeatedStock.body.record.id, stock.body.record.id);
    assert.equal(repeatedStock.body.record.received, "15 bags");
    assert.equal(repeatedStock.body.record.stock, "15 bags");
    assert.equal(createMaterial({ category: "Cement", received: "2 kg" }).status, 400);
    assert.equal(materials[0].stock, "15 bags");
    createMaterialCategory({ name: "Sand" });
    assert.equal(createMaterialAllocation({
      material: "Unrecorded material",
      project: "Material Test Project",
      quantity: 1
    }).status, 400);

    const assigned = createMaterialAllocation({
      material: "Cement",
      project: "Material Test Project",
      quantity: 10,
      assignedBy: "Test Owner"
    });
    assert.equal(assigned.status, 201);
    const allocation = assigned.body.record as { id: string; engineer: string; remainingQuantity: number };
    assert.equal(allocation.engineer, "Material Test Engineer");
    assert.equal(allocation.remainingQuantity, 10);
    assert.equal(assigned.body.record.unit, "bags");
    assert.equal(materials[0].stock, "5 bags");
    assert.equal(createMaterialAllocation({ material: "Cement", project: "Material Test Project", quantity: 6 }).status, 400);
    assert.equal(createMaterialAllocation({ material: "Cement", project: "Material Test Project", quantity: 0, unit: "bags" }).status, 400);

    const logged = createMaterialUsage({
      allocationId: allocation.id,
      engineer: "Material Test Engineer",
      loggedBy: "Test Owner",
      quantity: 4
    });
    assert.equal(logged.status, 201);
    assert.equal(logged.body.allocation.remainingQuantity, 6);
    assert.equal(logged.body.record.loggedBy, "Test Owner");
    assert.equal(createMaterialUsage({ allocationId: allocation.id, engineer: "Material Test Engineer", quantity: 7 }).status, 400);
    assert.equal(createMaterialUsage({ allocationId: allocation.id, engineer: "Another Engineer", quantity: 1 }).status, 400);
    assert.equal(listMaterialAllocations().find((item) => item.id === allocation.id)?.remainingQuantity, 6);

    assert.equal(createMaterialRequest({
      material: "Unlisted category",
      project: "Material Test Project",
      quantity: "5 bags",
      requestedBy: "Material Test Engineer"
    }).status, 400);
    const requested = createMaterialRequest({
      material: "Sand",
      project: "Material Test Project",
      quantity: "5 bags",
      requestedBy: "Material Test Engineer"
    });
    assert.equal(requested.status, 201);
    const request = requested.body.record as { id: string; status: string };
    assert.equal(updateMaterialRequest(request.id, { status: "Approved", reviewedBy: "Test Owner" }).status, 409);
    assert.equal(request.status, "Pending review");
    const approved = updateMaterialRequest(request.id, { status: "Approved", addStock: true, reviewedBy: "Test Owner" });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.record.status, "Approved");
    assert.equal(approved.body.allocation.remainingQuantity, 5);
    assert.equal(materials.find((item) => item.category === "Sand")?.stock, "0 bags");
    assert.equal(updateMaterialRequest(request.id, { status: "Declined" }).status, 400);
    const stockedRequest = createMaterialRequest({
      material: "Cement",
      project: "Material Test Project",
      quantity: "1 bags",
      requestedBy: "Material Test Engineer"
    });
    const stockedApproval = updateMaterialRequest(stockedRequest.body.record.id, { status: "Approved" });
    assert.equal(stockedApproval.status, 200);
    assert.equal(materials.find((item) => item.category === "Cement")?.stock, "4 bags");
    const shortStockRequest = createMaterialRequest({
      material: "Cement",
      project: "Material Test Project",
      quantity: "6 bags",
      requestedBy: "Material Test Engineer"
    });
    const toppedUpApproval = updateMaterialRequest(shortStockRequest.body.record.id, { status: "Approved", addStock: true });
    assert.equal(toppedUpApproval.status, 200);
    assert.equal(materials.find((item) => item.category === "Cement")?.received, "21 bags");
    assert.equal(materials.find((item) => item.category === "Cement")?.stock, "4 bags");
    materialRequests.push({
      id: "legacy-material-request",
      material: "Bricks",
      project: "Material Test Project",
      quantity: "3 bags",
      requestedBy: "Material Test Engineer",
      requestedAt: "Today",
      status: "Pending review"
    });
    const addedStockApproval = updateMaterialRequest("legacy-material-request", { status: "Approved", addStock: true, reviewedBy: "Test Owner" });
    assert.equal(addedStockApproval.status, 200);
    assert.equal(materialCategories.some((item) => item.name === "Bricks"), true);
    assert.equal(materials.find((item) => item.category === "Bricks")?.received, "3 bags");
    assert.equal(materials.find((item) => item.category === "Bricks")?.stock, "0 bags");
    createMaterialCategory({ name: "Legacy tiles" });
    const legacyApprovedRequest = createMaterialRequest({
      material: "Legacy tiles",
      project: "Material Test Project",
      quantity: "2 bags",
      requestedBy: "Material Test Engineer"
    }).body.record as { id: string; status: string };
    legacyApprovedRequest.status = "Approved";
    const allocationsBeforeInventoryRepair = materialAllocations.length;
    const repairedInventory = updateMaterialRequest(legacyApprovedRequest.id, { recordMissingMaterial: true });
    assert.equal(repairedInventory.status, 200);
    assert.equal(repairedInventory.body.material.received, "2 bags");
    assert.equal(repairedInventory.body.material.stock, "0 bags");
    assert.equal(materialAllocations.length, allocationsBeforeInventoryRepair);
    assert.equal(updateMaterialRequest(legacyApprovedRequest.id, { recordMissingMaterial: true }).status, 409);
    assert.equal(materialAllocations.length, 5);
    assert.equal(materialCategories.length, 4);
    assert.equal(materials.length, 4);
    assert.equal(materialUsageLogs.length, 1);
    assert.equal(materialRequests.length, 5);
    const legacySnapshot = JSON.parse(original) as Record<string, unknown>;
    delete legacySnapshot.materialCategories;
    restoreStoreSnapshot(JSON.stringify(legacySnapshot));
    assert.equal(materialCategories.length, 0);
  } finally {
    restoreStoreSnapshot(original);
  }
});
