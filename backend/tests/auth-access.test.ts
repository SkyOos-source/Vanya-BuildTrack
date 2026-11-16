import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { people, projects, quotations, type Project, type Quote } from "../src/data/store";
import { authorizeApiRequest, scopeApiResponse } from "../src/features/auth/access";
import type { AuthenticatedSession } from "../src/features/auth/session";
import { createProject } from "../src/features/projects/service";
import { createPerson } from "../src/features/people/service";

const employee: AuthenticatedSession = { name: "Engineer One", email: "engineer@example.com", role: "employee" };
const client: AuthenticatedSession = { name: "Client One", email: "client@example.com", role: "client" };
const owner: AuthenticatedSession = { name: "Owner One", email: "owner@example.com", role: "owner" };

function project(id: string, name: string, engineer: string, clientName: string): Project {
  return {
    id,
    name,
    engineer,
    client: clientName,
    site: `${name} site`,
    status: "Active",
    progress: 10,
    budget: 100,
    spent: 0,
    dueDate: "30 Nov 2026",
    image: "example.jpg"
  };
}

function quote(id: string, projectName: string, clientName: string): Quote {
  return {
    id,
    project: projectName,
    title: `${projectName} quote`,
    client: clientName,
    amount: 100,
    date: "16 Nov 2026",
    status: "Awaiting review"
  };
}

function request(method: string, path: string, body: Record<string, unknown> = {}, query: Record<string, unknown> = {}) {
  return { method, path, body, query } as unknown as Request;
}

test("unauthenticated requests are denied and project access is role-scoped", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  try {
    projects.splice(0, projects.length,
      project("p1", "Alpha", employee.name, client.name),
      project("p2", "Beta", "Another Engineer", "Another Client")
    );
    people.splice(0, people.length,
      { id: "e1", name: employee.name, email: employee.email, role: "Site Engineer", project: "No assigned sites" },
      { id: "c1", name: client.name, email: client.email, role: "Client", project: "Alpha" }
    );

    assert.deepEqual(authorizeApiRequest(request("GET", "/api/dashboard")), {
      allowed: false,
      status: 401,
      error: "Sign-in is required to access this API."
    });
    assert.deepEqual(scopeApiResponse("/api/projects", projects, client), [projects[0]]);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
  }
});

test("engineers can only create project records for assigned projects and identity is session-derived", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  try {
    projects.splice(0, projects.length,
      project("p1", "Alpha", employee.name, client.name),
      project("p2", "Beta", "Another Engineer", "Another Client")
    );
    people.splice(0, people.length, {
      id: "e1",
      name: employee.name,
      email: employee.email,
      role: "Site Engineer",
      project: "No assigned sites"
    });

    const deniedBody = { project: "Beta", actor: "Forged Name" };
    assert.equal(authorizeApiRequest(request("POST", "/api/progress", deniedBody), employee).allowed, false);

    const allowedBody = { project: "Alpha", actor: "Forged Name", submittedBy: "Forged Name" };
    assert.equal(authorizeApiRequest(request("POST", "/api/progress", allowedBody), employee).allowed, true);
    assert.equal(allowedBody.actor, employee.name);
    assert.equal(allowedBody.submittedBy, employee.name);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
  }
});

test("clients can review only quotations for their assigned project", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  const quotationsBefore = [...quotations];
  try {
    projects.splice(0, projects.length,
      project("p1", "Alpha", employee.name, client.name),
      project("p2", "Beta", "Another Engineer", "Another Client")
    );
    people.splice(0, people.length, {
      id: "c1",
      name: client.name,
      email: client.email,
      role: "Client",
      project: "Alpha"
    });
    quotations.splice(0, quotations.length,
      quote("q1", "Alpha", client.name),
      quote("q2", "Beta", "Another Client")
    );

    assert.equal(authorizeApiRequest(request("PATCH", "/api/quotations/q2"), client).allowed, false);
    assert.equal(authorizeApiRequest(request("PATCH", "/api/quotations/q1"), client).allowed, true);
    assert.equal(authorizeApiRequest(request("POST", "/api/projects"), client).allowed, false);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
    quotations.splice(0, quotations.length, ...quotationsBefore);
  }
});

test("ambiguous same-role display names cannot access name-keyed assignments", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  try {
    projects.splice(0, projects.length, project("p1", "Alpha", employee.name, client.name));
    people.splice(0, people.length,
      { id: "e1", name: employee.name, email: employee.email, role: "Site Engineer", project: "Alpha" },
      { id: "e2", name: employee.name, email: "second@example.com", role: "Site Engineer", project: "Alpha" }
    );
    assert.equal(authorizeApiRequest(request("GET", "/api/projects"), employee).allowed, false);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
  }
});

test("duplicate project names are excluded from scoped access", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  try {
    projects.splice(0, projects.length,
      project("p1", "Alpha", employee.name, client.name),
      project("p2", "Alpha", employee.name, client.name)
    );
    people.splice(0, people.length, {
      id: "e1",
      name: employee.name,
      email: employee.email,
      role: "Site Engineer",
      project: "Alpha"
    });
    assert.deepEqual(scopeApiResponse("/api/projects", projects, employee), []);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
  }
});

test("duplicate project and person names are rejected at creation", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  try {
    projects.splice(0, projects.length, project("p1", "Alpha", employee.name, client.name));
    people.splice(0, people.length, {
      id: "e1",
      name: employee.name,
      email: employee.email,
      role: "Site Engineer",
      project: "Alpha"
    });

    assert.equal(createProject({ name: "alpha" }).status, 409);
    assert.equal(createPerson({
      name: "engineer one",
      email: "new@example.com",
      role: "Site Engineer",
      password: "password123",
      phone: "+14155550123"
    }).status, 409);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
  }
});

test("owners retain access across workspace routes", () => {
  assert.equal(authorizeApiRequest(request("POST", "/api/projects"), owner).allowed, true);
});
