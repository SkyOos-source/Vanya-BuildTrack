import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { people, projects, restoreStoreSnapshot, snapshotStore, workRequests, type Project, type WorkRequest } from "../src/data/store";
import { authorizeApiRequest, scopeApiResponse } from "../src/features/auth/access";
import type { AuthenticatedSession } from "../src/features/auth/session";
import { createWorkRequest, reviewWorkRequest } from "../src/features/work-requests/service";

const client: AuthenticatedSession = { name: "Client One", email: "client@example.com", role: "client" };
const engineer: AuthenticatedSession = { name: "Engineer One", email: "engineer@example.com", role: "employee" };
const projectManager: AuthenticatedSession = { name: "Manager One", email: "manager@example.com", role: "project_manager" };
const photo = "data:image/jpeg;base64,/9j/AA==";

function project(id: string, name: string, clientName: string, engineerName: string, managerName: string): Project {
  return {
    id,
    name,
    site: `${name} site`,
    client: clientName,
    engineer: engineerName,
    projectManager: managerName,
    status: "Active",
    progress: 10,
    budget: 100,
    spent: 0,
    dueDate: "30 Nov 2026",
    image: ""
  };
}

function request(method: string, path: string, body: Record<string, unknown> = {}) {
  return { method, path, body, query: {} } as unknown as Request;
}

test("clients can submit photo-backed work requests and assigned staff can review them once", () => {
  const original = snapshotStore();
  try {
    projects.push(project("p1", "Alpha", client.name, engineer.name, projectManager.name));
    projects.push(project("p2", "Beta", "Other Client", "Other Engineer", "Other Manager"));
    people.push(
      { id: "c1", name: client.name, email: client.email, role: "Client", project: "Alpha" },
      { id: "e1", name: engineer.name, email: engineer.email, role: "Site Engineer", project: "Alpha" },
      { id: "m1", name: projectManager.name, email: projectManager.email, role: "Project Manager", project: "Alpha" }
    );

    assert.equal(authorizeApiRequest(request("POST", "/api/work-requests", { project: "Alpha" }), client).allowed, true);
    assert.equal(authorizeApiRequest(request("POST", "/api/work-requests", { project: "Beta" }), client).allowed, false);
    assert.equal(authorizeApiRequest(request("GET", "/api/work-requests"), engineer).allowed, true);
    assert.equal(authorizeApiRequest(request("GET", "/api/work-requests"), projectManager).allowed, true);
    assert.equal(authorizeApiRequest(request("POST", "/api/work-requests", { project: "Alpha" }), projectManager).allowed, false);

    const body = {
      project: "Alpha",
      requestedBy: client.name,
      requesterEmail: client.email,
      description: "Please add a storage shelf near the kitchen.",
      photos: [photo]
    };
    assert.equal(authorizeApiRequest(request("POST", "/api/work-requests", body), client).allowed, true);
    assert.equal(body.requestedBy, client.name);
    assert.equal(body.requesterEmail, client.email);
    const created = createWorkRequest(body);
    assert.equal(created.status, 201);
    const record = created.body.record as WorkRequest;
    assert.equal(record.photos.length, 1);
    assert.equal(record.status, "Pending review");

    assert.equal(authorizeApiRequest(request("PATCH", `/api/work-requests/${record.id}`, {}), engineer).allowed, true);
    assert.equal(authorizeApiRequest(request("PATCH", `/api/work-requests/${record.id}`, {}), projectManager).allowed, true);
    const reviewed = reviewWorkRequest(record.id, {
      status: "Approved",
      reviewedBy: engineer.name,
      reviewedByRole: "Site Engineer"
    });
    assert.equal(reviewed.body.record.status, "Approved");
    assert.equal(reviewWorkRequest(record.id, { status: "Declined", reviewedBy: engineer.name, reviewedByRole: "Site Engineer" }).status, 409);

    const otherProjectRequest = { ...record, id: "WREQ-other", project: "Beta" };
    workRequests.push(otherProjectRequest);
    assert.deepEqual(scopeApiResponse("/api/work-requests", workRequests, client).map((item: WorkRequest) => item.id), [record.id]);
  } finally {
    restoreStoreSnapshot(original);
  }
});

test("work requests reject empty descriptions and invalid or excessive photos", () => {
  const original = snapshotStore();
  try {
    projects.push(project("p1", "Alpha", client.name, engineer.name, projectManager.name));
    const base = {
      project: "Alpha",
      requestedBy: client.name,
      requesterEmail: client.email,
      description: "Repair the entry step"
    };
    assert.equal(createWorkRequest({ ...base, description: " " }).status, 400);
    assert.equal(createWorkRequest({ ...base, photos: ["data:image/png;base64,invalid"] }).status, 400);
    assert.equal(createWorkRequest({ ...base, photos: Array(6).fill(photo) }).status, 400);
  } finally {
    restoreStoreSnapshot(original);
  }
});
