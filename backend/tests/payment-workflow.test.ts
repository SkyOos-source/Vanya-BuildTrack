import assert from "node:assert/strict";
import test from "node:test";
import { people, payments, projects, restoreStoreSnapshot, snapshotStore, type Project } from "../src/data/store";
import { authorizeApiRequest, scopeApiResponse } from "../src/features/auth/access";
import { createPayment } from "../src/features/payments/service";
import type { AuthenticatedSession } from "../src/features/auth/session";
import type { Request } from "express";

const client: AuthenticatedSession = { name: "Payment Client", email: "payment-client@example.com", role: "client" };
const owner: AuthenticatedSession = { name: "Payment Owner", email: "payment-owner@example.com", role: "owner" };

function request(method: string, path: string, body: Record<string, unknown> = {}) {
  return { method, path, body, query: {} } as unknown as Request;
}

function project(id: string, name: string, assignedClient: string): Project {
  return {
    id,
    name,
    site: `${name} site`,
    client: assignedClient,
    engineer: "Unassigned",
    status: "Active",
    progress: 10,
    budget: 0,
    spent: 0,
    dueDate: "To be confirmed",
    image: ""
  };
}

test("owners and assigned clients can record project payments with online proof", () => {
  const original = snapshotStore();
  try {
    projects.push(project("payment-project", "Payment Project", client.name), project("other-project", "Other Project", "Other Client"));
    people.push({
      id: "payment-client-person",
      name: client.name,
      email: client.email,
      role: "Client",
      project: "Payment Project"
    });

    assert.equal(authorizeApiRequest(request("GET", "/api/payments"), client).allowed, true);
    assert.equal(createPayment({
      project: "Payment Project",
      amount: 10,
      method: "Online",
      recordedBy: client.name,
      recordedByRole: "Client"
    }).status, 400);
    assert.equal(createPayment({
      project: "Payment Project",
      amount: 10.001,
      method: "Cash",
      recordedBy: client.name,
      recordedByRole: "Client"
    }).status, 400);

    const clientBody = { project: "Payment Project", recordedBy: "Forged", recordedByRole: "Owner" };
    assert.equal(authorizeApiRequest(request("POST", "/api/payments", clientBody), client).allowed, true);
    assert.equal(clientBody.recordedBy, client.name);
    assert.equal(clientBody.recordedByRole, "Client");
    const paymentImage = "data:image/jpeg;base64,/9j/AA==";
    const online = createPayment({
      project: "Payment Project",
      amount: 10.25,
      method: "Online",
      proofImage: paymentImage,
      recordedBy: client.name,
      recordedByRole: "Client"
    });
    assert.equal(online.status, 201);
    assert.equal((online.body.record as { proofImage: string }).proofImage, paymentImage);

    const ownerBody = { project: "Other Project", recordedBy: "Forged", recordedByRole: "Client" };
    assert.equal(authorizeApiRequest(request("POST", "/api/payments", ownerBody), owner).allowed, true);
    assert.equal(ownerBody.recordedBy, owner.name);
    assert.equal(ownerBody.recordedByRole, "Owner");
    const cash = createPayment({ ...ownerBody, amount: 50, method: "Cash" });
    assert.equal(cash.status, 201);
    assert.equal((cash.body.record as { proofImage?: string }).proofImage, undefined);

    assert.equal(authorizeApiRequest(request("POST", "/api/payments", { project: "Other Project" }), client).allowed, false);
    assert.deepEqual((scopeApiResponse("/api/payments", payments, client) as Array<{ project: string }>).map((item) => item.project), ["Payment Project"]);
  } finally {
    restoreStoreSnapshot(original);
  }
});
