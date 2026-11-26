import assert from "node:assert/strict";
import test from "node:test";
import { people, projects, restoreStoreSnapshot, snapshotStore, type Project } from "../src/data/store";
import { authorizeApiRequest, scopeApiResponse } from "../src/features/auth/access";
import type { AuthenticatedSession } from "../src/features/auth/session";
import { createExpenseAllocation } from "../src/features/expenses/service";
import { createMaterial, createMaterialAllocation, createMaterialCategory } from "../src/features/materials/service";
import { createProject, updateProject } from "../src/features/projects/service";
import type { Request } from "express";

const engineers: AuthenticatedSession[] = [
  { name: "Engineer One", email: "engineer-one@example.com", role: "employee" },
  { name: "Engineer Two", email: "engineer-two@example.com", role: "employee" }
];
const managers: AuthenticatedSession[] = [
  { name: "Manager One", email: "manager-one@example.com", role: "project_manager" },
  { name: "Manager Two", email: "manager-two@example.com", role: "project_manager" }
];

function request(method: string, path: string, body: Record<string, unknown> = {}) {
  return { method, path, body } as unknown as Request;
}

test("owners can assign multiple engineers and project managers to a site", () => {
  const original = snapshotStore();
  try {
    projects.splice(0, projects.length);
    people.splice(0, people.length,
      ...engineers.map((person, index) => ({
        id: `engineer-${index + 1}`,
        name: person.name,
        email: person.email,
        role: "Site Engineer" as const,
        project: "No assigned sites"
      })),
      ...managers.map((person, index) => ({
        id: `manager-${index + 1}`,
        name: person.name,
        email: person.email,
        role: "Project Manager" as const,
        project: index === 0 ? "Shared site" : "No assigned sites"
      }))
    );

    const created = createProject({
      name: "Shared site",
      site: "North location",
      engineers: engineers.map((person) => person.name),
      projectManagers: managers.map((person) => person.name)
    });
    assert.equal(created.status, 201);
    const site = created.body.record as Project;
    assert.deepEqual(site.engineers, engineers.map((person) => person.name));
    assert.deepEqual(site.projectManagers, managers.map((person) => person.name));
    assert.equal(site.engineer, engineers[0].name);
    assert.equal(site.projectManager, managers[0].name);

    for (const assignee of [...engineers, ...managers]) {
      assert.equal(authorizeApiRequest(request("GET", "/api/projects"), assignee).allowed, true);
      assert.deepEqual(scopeApiResponse("/api/projects", projects, assignee), [site]);
    }
    const managerFunds = createExpenseAllocation({
      assignee: managers[1].name,
      assigneeRole: "Project Manager",
      project: site.name,
      amount: 100
    });
    assert.equal(managerFunds.status, 201);
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses", {
      allocationId: managerFunds.body.record.id,
      entryType: "log",
      project: site.name
    }), managers[1]).allowed, true);

    const category = createMaterialCategory({ name: "Cement" });
    assert.equal(category.status, 201);
    assert.equal(createMaterial({ category: "Cement", received: "5 bags" }).status, 201);
    const assignment = createMaterialAllocation({
      project: site.name,
      material: "Cement",
      engineer: engineers[1].name,
      quantity: 2
    });
    assert.equal(assignment.status, 201);
    assert.equal(assignment.body.record.engineer, engineers[1].name);
    assert.equal(createMaterialAllocation({
      project: site.name,
      material: "Cement",
      engineer: "Unassigned Engineer",
      quantity: 1
    }).status, 400);

    const changed = updateProject(site.id, {
      engineers: [engineers[1].name],
      engineer: engineers[1].name,
      projectManagers: [],
      projectManager: "Unassigned"
    });
    assert.equal(changed.status, 200);
    assert.deepEqual(site.engineers, [engineers[1].name]);
    assert.deepEqual(site.projectManagers, []);
    assert.equal(scopeApiResponse("/api/projects", projects, engineers[0]).length, 0);
    assert.equal(scopeApiResponse("/api/projects", projects, managers[0]).length, 0);
  } finally {
    restoreStoreSnapshot(original);
  }
});
