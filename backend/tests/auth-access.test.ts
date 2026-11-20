import assert from "node:assert/strict";
import test from "node:test";
import type { Request } from "express";
import { expenseAllocations, materialAllocations, ownerAccounts, ownerProfiles, people, projects, quotations, type Project, type Quote } from "../src/data/store";
import { authorizeApiRequest, scopeApiResponse } from "../src/features/auth/access";
import type { AuthenticatedSession } from "../src/features/auth/session";
import { createProject } from "../src/features/projects/service";
import { createPerson, updatePerson } from "../src/features/people/service";
import { getWorkspaceOwnerContacts } from "../src/features/profiles/service";

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

test("workspace owner contacts include every owner account", () => {
  const ownerAccountsBefore = [...ownerAccounts];
  const ownerProfilesBefore = { ...ownerProfiles };
  try {
    ownerAccounts.splice(0, ownerAccounts.length,
      { email: "first@example.com", name: "First Owner", salt: "", passwordHash: "" },
      { email: "second@example.com", name: "Second Owner", salt: "", passwordHash: "" }
    );
    ownerProfiles["first@example.com"] = { phone: "+14155550111", image: "" };
    ownerProfiles["second@example.com"] = { phone: "+14155550112", image: "" };

    assert.deepEqual(getWorkspaceOwnerContacts().body.owners, [
      { id: "owner-first@example.com", name: "First Owner", phone: "+14155550111" },
      { id: "owner-second@example.com", name: "Second Owner", phone: "+14155550112" }
    ]);
  } finally {
    ownerAccounts.splice(0, ownerAccounts.length, ...ownerAccountsBefore);
    for (const email of Object.keys(ownerProfiles)) delete ownerProfiles[email];
    Object.assign(ownerProfiles, ownerProfilesBefore);
  }
});

test("engineers can only create project records for assigned projects and identity is session-derived", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  const allocationsBefore = [...expenseAllocations];
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
    assert.equal(authorizeApiRequest(request("GET", "/api/expenses/allocations"), employee).allowed, true);
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses/allocations"), employee).allowed, false);

    const allowedBody = { project: "Alpha", actor: "Forged Name", submittedBy: "Forged Name" };
    assert.equal(authorizeApiRequest(request("POST", "/api/progress", allowedBody), employee).allowed, true);
    assert.equal(allowedBody.actor, employee.name);
    assert.equal(allowedBody.submittedBy, employee.name);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
    expenseAllocations.splice(0, expenseAllocations.length, ...allocationsBefore);
  }
});

test("engineers can read quotations only for their assigned projects", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  const quotationsBefore = [...quotations];
  try {
    projects.splice(0, projects.length,
      project("p1", "Alpha", employee.name, client.name),
      project("p2", "Beta", "Another Engineer", "Another Client")
    );
    people.splice(0, people.length,
      {
        id: "e1",
        name: employee.name,
        email: employee.email,
        role: "Site Engineer",
        project: "Alpha"
      },
      { id: "c1", name: client.name, email: client.email, role: "Client", project: "Alpha", phone: "+14155550123" },
      { id: "c2", name: "Client Two", email: "client2@example.com", role: "Client", project: "Beta", phone: "+14155550124" }
    );
    quotations.splice(0, quotations.length, quote("q1", "Alpha", client.name), quote("q2", "Beta", "Another Client"));

    assert.equal(authorizeApiRequest(request("GET", "/api/quotations"), employee).allowed, true);
    assert.deepEqual(scopeApiResponse("/api/quotations", quotations, employee), [quotations[0]]);
    const scopedPeople = scopeApiResponse("/api/people", people, employee) as typeof people;
    assert.deepEqual(scopedPeople.map((person) => person.name), [employee.name, client.name]);
    assert.equal(scopedPeople.find((person) => person.role === "Client")?.phone, "+14155550123");
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
    quotations.splice(0, quotations.length, ...quotationsBefore);
  }
});

test("engineers can only log expenses against their own funds and assigned projects", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  const allocationsBefore = [...expenseAllocations];
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
    expenseAllocations.splice(0, expenseAllocations.length, {
      id: "allocation-e1",
      engineer: employee.name,
      amount: 100,
      assignedAt: "16 Nov 2026",
      assignedBy: owner.name
    });

    const forgedAllocation = { project: "Alpha", entryType: "log", allocationId: "allocation-other" };
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses", forgedAllocation), employee).allowed, false);
    const unassignedProject = { project: "Beta", entryType: "log", allocationId: "allocation-e1" };
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses", unassignedProject), employee).allowed, false);

    const validLog = { project: "Alpha", entryType: "log", allocationId: "allocation-e1", submittedBy: "Forged Name" };
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses", validLog), employee).allowed, true);
    assert.equal(validLog.submittedBy, employee.name);
    assert.equal((validLog as Record<string, unknown>).requireAllocation, true);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
    expenseAllocations.splice(0, expenseAllocations.length, ...allocationsBefore);
  }
});

test("engineers can only log usage against their own material assignments", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  const materialAllocationsBefore = [...materialAllocations];
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
      project: "Alpha"
    });
    materialAllocations.splice(0, materialAllocations.length,
      { id: "material-a1", material: "Cement", project: "Alpha", engineer: employee.name, quantity: 10, unit: "bags", usedQuantity: 0, assignedAt: "16 Nov 2026", assignedBy: owner.name },
      { id: "material-b1", material: "Sand", project: "Beta", engineer: "Another Engineer", quantity: 10, unit: "bags", usedQuantity: 0, assignedAt: "16 Nov 2026", assignedBy: owner.name }
    );

    assert.equal(authorizeApiRequest(request("POST", "/api/material-allocations", { project: "Alpha" }), employee).allowed, false);
    assert.equal(authorizeApiRequest(request("POST", "/api/materials", { project: "Alpha" }), employee).allowed, false);
    assert.equal(authorizeApiRequest(request("POST", "/api/material-usage", { project: "Alpha", allocationId: "material-b1" }), employee).allowed, false);
    const validLog = { project: "Alpha", allocationId: "material-a1", engineer: "Forged Name" };
    assert.equal(authorizeApiRequest(request("POST", "/api/material-usage", validLog), employee).allowed, true);
    assert.equal(validLog.engineer, employee.name);
    const ownerLog: Record<string, unknown> = { project: "Alpha", allocationId: "material-a1", engineer: employee.name };
    assert.equal(authorizeApiRequest(request("POST", "/api/material-usage", ownerLog), owner).allowed, true);
    assert.equal(ownerLog.loggedBy, owner.name);
    assert.equal(authorizeApiRequest(request("PATCH", "/api/material-requests/MREQ-1", { status: "Approved" }), employee).allowed, false);
    assert.equal(authorizeApiRequest(request("PATCH", "/api/material-requests/MREQ-1", { status: "Approved" }), owner).allowed, true);
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
    materialAllocations.splice(0, materialAllocations.length, ...materialAllocationsBefore);
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
    people.splice(0, people.length,
      { id: "c1", name: client.name, email: client.email, role: "Client", project: "Alpha" },
      { id: "e1", name: employee.name, email: employee.email, role: "Site Engineer", project: "Alpha", phone: "+14155550123" },
      { id: "e2", name: "Engineer Two", email: "engineer2@example.com", role: "Site Engineer", project: "Beta", phone: "+14155550124" }
    );
    quotations.splice(0, quotations.length,
      quote("q1", "Alpha", client.name),
      quote("q2", "Beta", "Another Client")
    );

    assert.equal(authorizeApiRequest(request("PATCH", "/api/quotations/q2"), client).allowed, false);
    assert.equal(authorizeApiRequest(request("PATCH", "/api/quotations/q1"), client).allowed, true);
    assert.equal(authorizeApiRequest(request("POST", "/api/projects"), client).allowed, false);
    assert.equal(authorizeApiRequest(request("GET", "/api/people"), client).allowed, true);
    const scopedPeople = scopeApiResponse("/api/people", people, client) as typeof people;
    assert.deepEqual(scopedPeople.map((person) => person.name), [client.name, employee.name]);
    assert.equal(scopedPeople.find((person) => person.role === "Site Engineer")?.phone, "+14155550123");
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
    const projectWithoutQuotationAmount = createProject({
      name: "Beta",
      site: "Beta site",
      engineer: employee.name,
      quotationAmount: 250000
    });
    assert.equal(projectWithoutQuotationAmount.status, 201);
    assert.equal(projectWithoutQuotationAmount.body.record?.quotationAmount, 0);
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

test("unassigning a client removes the project from both client and project records", () => {
  const projectsBefore = [...projects];
  const peopleBefore = [...people];
  try {
    projects.splice(0, projects.length, project("p1", "Alpha", "Engineer One", "Client One"));
    people.splice(0, people.length, {
      id: "c1",
      name: "Client One",
      email: "client@example.com",
      role: "Client",
      project: "Alpha",
      phone: "+14155550123"
    });

    const response = updatePerson("c1", {
      name: "Client One",
      email: "client@example.com",
      project: "No assigned sites"
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.record?.project, "No assigned sites");
    assert.equal(projects[0].client, "Unassigned");
  } finally {
    projects.splice(0, projects.length, ...projectsBefore);
    people.splice(0, people.length, ...peopleBefore);
  }
});

test("owners retain access across workspace routes", () => {
  assert.equal(authorizeApiRequest(request("POST", "/api/projects"), owner).allowed, true);
});
