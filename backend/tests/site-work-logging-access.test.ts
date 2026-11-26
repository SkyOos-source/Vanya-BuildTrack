import assert from "node:assert/strict";
import test from "node:test";
import { people, projects, restoreStoreSnapshot, snapshotStore, type Project } from "../src/data/store";
import { authorizeApiRequest, scopeWorkspaceUpdate } from "../src/features/auth/access";
import type { AuthenticatedSession } from "../src/features/auth/session";
import type { Request } from "express";

const manager: AuthenticatedSession = {
  name: "Manager One",
  email: "manager@example.com",
  role: "project_manager"
};
const owner: AuthenticatedSession = {
  name: "Owner One",
  email: "owner@example.com",
  role: "owner"
};

function project(id: string, name: string, managerName?: string): Project {
  return {
    id,
    name,
    site: `${name} site`,
    engineer: "Engineer One",
    projectManager: managerName,
    client: "Client One",
    status: "Active",
    progress: 10,
    budget: 100,
    spent: 0,
    dueDate: "30 Nov 2026",
    image: ""
  };
}

function request(method: string, path: string, body: Record<string, unknown> = {}) {
  return { method, path, body } as unknown as Request;
}

test("project managers can submit progress only for assigned projects", () => {
  const original = snapshotStore();
  try {
    projects.splice(0, projects.length,
      project("manager-site", "Manager site", manager.name),
      project("other-site", "Other site", "Another Manager")
    );
    people.splice(0, people.length, {
      id: "manager-one",
      name: manager.name,
      email: manager.email,
      role: "Project Manager",
      project: "Manager site"
    });

    const body = { project: "Manager site", actor: "Forged", submittedBy: "Forged" };
    assert.equal(authorizeApiRequest(request("POST", "/api/progress", body), manager).allowed, true);
    assert.equal(body.actor, manager.name);
    assert.equal(body.submittedBy, manager.name);
    assert.equal(authorizeApiRequest(request("POST", "/api/progress", { project: "Other site" }), manager).allowed, false);
    assert.equal(authorizeApiRequest(request("POST", "/api/progress"), manager).allowed, false);
    assert.equal(scopeWorkspaceUpdate({ resource: "progress", project: "Manager site" }, manager)?.resource, "progress");
    assert.equal(scopeWorkspaceUpdate({ resource: "progress", project: "Other site" }, manager), undefined);
  } finally {
    restoreStoreSnapshot(original);
  }
});

test("owners can log site progress, expenses, and material use as themselves", () => {
  const original = snapshotStore();
  try {
    projects.splice(0, projects.length, project("owner-site", "Owner site"));

    const progressBody = { project: "Owner site", actor: "Forged", submittedBy: "Forged" };
    assert.equal(authorizeApiRequest(request("POST", "/api/progress", progressBody), owner).allowed, true);
    assert.equal(progressBody.actor, owner.name);
    assert.equal(progressBody.submittedBy, owner.name);

    const expenseBody = { project: "Owner site", entryType: "log", submittedBy: "Forged" };
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses", expenseBody), owner).allowed, true);
    assert.equal(expenseBody.submittedBy, owner.name);

    const materialBody = { allocationId: "site-material", loggedBy: "Forged" };
    assert.equal(authorizeApiRequest(request("POST", "/api/material-usage", materialBody), owner).allowed, true);
    assert.equal(materialBody.loggedBy, owner.name);
  } finally {
    restoreStoreSnapshot(original);
  }
});
