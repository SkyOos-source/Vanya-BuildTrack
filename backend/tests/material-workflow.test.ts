import assert from "node:assert/strict";
import test from "node:test";
import { materialAllocations, materialRequests, materialUsageLogs, people, projects, restoreStoreSnapshot, snapshotStore } from "../src/data/store";
import { createMaterialAllocation, createMaterialRequest, createMaterialUsage, listMaterialAllocations, updateMaterialRequest } from "../src/features/materials/service";

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

    const assigned = createMaterialAllocation({
      material: "Cement",
      project: "Material Test Project",
      quantity: 10,
      unit: "bags",
      assignedBy: "Test Owner"
    });
    assert.equal(assigned.status, 201);
    const allocation = assigned.body.record as { id: string; engineer: string; remainingQuantity: number };
    assert.equal(allocation.engineer, "Material Test Engineer");
    assert.equal(allocation.remainingQuantity, 10);
    assert.equal(createMaterialAllocation({ material: "Cement", project: "Material Test Project", quantity: 0, unit: "bags" }).status, 400);

    const logged = createMaterialUsage({
      allocationId: allocation.id,
      engineer: "Material Test Engineer",
      quantity: 4
    });
    assert.equal(logged.status, 201);
    assert.equal(logged.body.allocation.remainingQuantity, 6);
    assert.equal(createMaterialUsage({ allocationId: allocation.id, engineer: "Material Test Engineer", quantity: 7 }).status, 400);
    assert.equal(createMaterialUsage({ allocationId: allocation.id, engineer: "Another Engineer", quantity: 1 }).status, 400);
    assert.equal(listMaterialAllocations().find((item) => item.id === allocation.id)?.remainingQuantity, 6);

    const requested = createMaterialRequest({
      material: "Sand",
      project: "Material Test Project",
      quantity: "5 bags",
      requestedBy: "Material Test Engineer"
    });
    assert.equal(requested.status, 201);
    const request = requested.body.record as { id: string; status: string };
    const approved = updateMaterialRequest(request.id, { status: "Approved", reviewedBy: "Test Owner" });
    assert.equal(approved.status, 200);
    assert.equal(approved.body.record.status, "Approved");
    assert.equal(approved.body.allocation.remainingQuantity, 5);
    assert.equal(updateMaterialRequest(request.id, { status: "Declined" }).status, 400);
    assert.equal(materialAllocations.length, 2);
    assert.equal(materialUsageLogs.length, 1);
    assert.equal(materialRequests.length, 1);
  } finally {
    restoreStoreSnapshot(original);
  }
});
