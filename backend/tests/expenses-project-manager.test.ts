import assert from "node:assert/strict";
import test from "node:test";
import {
  expenseAllocations,
  expenses,
  people,
  projects,
  restoreStoreSnapshot,
  snapshotStore
} from "../src/data/store";
import { authorizeApiRequest, scopeApiResponse, scopeWorkspaceUpdate } from "../src/features/auth/access";
import type { AuthenticatedSession } from "../src/features/auth/session";
import { createExpense, createExpenseAllocation } from "../src/features/expenses/service";
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

function request(method: string, path: string, body: Record<string, unknown> = {}) {
  return { method, path, body } as unknown as Request;
}

test("project managers can log allocated expenses only for the assigned site", async () => {
  const original = snapshotStore();
  try {
    projects.push(
      {
        id: "manager-site",
        name: "Manager site",
        site: "North site",
        engineer: "Engineer One",
        projectManager: manager.name,
        client: "Client One",
        status: "Active",
        progress: 10,
        budget: 1000,
        spent: 0,
        dueDate: "30 Nov 2026",
        image: ""
      },
      {
        id: "other-site",
        name: "Other site",
        site: "South site",
        engineer: "Engineer Two",
        projectManager: "Another Manager",
        client: "Client Two",
        status: "Active",
        progress: 10,
        budget: 1000,
        spent: 0,
        dueDate: "30 Nov 2026",
        image: ""
      }
    );
    people.push({
      id: "manager-one",
      name: manager.name,
      email: manager.email,
      role: "Project Manager",
      project: "Manager site"
    });

    const allocationResult = createExpenseAllocation({
      assignee: manager.name,
      assigneeRole: "Project Manager",
      project: "Manager site",
      amount: 100,
      assignedBy: owner.name
    });
    assert.equal(allocationResult.status, 201);
    const allocation = allocationResult.body.record;
    assert.equal(allocation.assigneeRole, "Project Manager");
    assert.equal(allocation.project, "Manager site");

    const validLog = {
      allocationId: allocation.id,
      entryType: "log",
      project: "Manager site",
      submittedBy: "Forged"
    };
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses", validLog), manager).allowed, true);
    assert.equal(validLog.project, "Manager site");
    assert.equal(validLog.submittedBy, manager.name);
    assert.equal(validLog.requireAllocation, true);

    const mismatchedLog = {
      allocationId: allocation.id,
      entryType: "log",
      project: "Other site"
    };
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses", mismatchedLog), manager).allowed, false);
    assert.equal(authorizeApiRequest(request("POST", "/api/expenses/allocations", {}), manager).allowed, false);

    const loggedExpense = await createExpense({
      ...validLog,
      description: "Site transport",
      amount: 25
    });
    assert.equal(loggedExpense.status, 201);
    assert.equal(loggedExpense.body.record.project, "Manager site");
    assert.equal(loggedExpense.body.record.allocationId, allocation.id);

    const visibleAllocations = scopeApiResponse("/api/expenses/allocations", expenseAllocations, manager) as typeof expenseAllocations;
    assert.equal(authorizeApiRequest(request("GET", "/api/expenses/allocations"), manager).allowed, true);
    assert.deepEqual(visibleAllocations.map((item) => item.id), [allocation.id]);
    const scopedDashboard = scopeApiResponse("/api/dashboard", { expenseAllocations }, manager) as { expenseAllocations: typeof expenseAllocations };
    assert.deepEqual(scopedDashboard.expenseAllocations.map((item) => item.id), [allocation.id]);
    assert.equal(scopeWorkspaceUpdate({
      resource: "expenseAllocations",
      allocation,
      project: "Manager site"
    }, manager)?.resource, "expenseAllocations");
    assert.equal(scopeWorkspaceUpdate({
      resource: "expenseAllocations",
      allocation,
      project: "Other site"
    }, manager), undefined);

    const invalidAssignment = createExpenseAllocation({
      assignee: manager.name,
      assigneeRole: "Project Manager",
      project: "Other site",
      amount: 100
    });
    assert.equal(invalidAssignment.status, 400);
    assert.equal(expenses[0].allocationId, allocation.id);
  } finally {
    restoreStoreSnapshot(original);
  }
});
