import assert from "node:assert/strict";
import test from "node:test";
import { expenses, people, projects, restoreStoreSnapshot, snapshotStore } from "../src/data/store";
import { createExpense, createExpenseAllocation, listExpenseAllocations } from "../src/features/expenses/service";

test("allocated funds are reduced only by logged project expenses", () => {
  const original = snapshotStore();
  try {
    people.push({
      id: "expense-test-engineer",
      name: "Expense Test Engineer",
      role: "Site Engineer",
      project: "Expense Test Project",
      email: "expense-test@example.com"
    });
    projects.push({
      id: "expense-test-project",
      name: "Expense Test Project",
      site: "Test site",
      client: "Test client",
      engineer: "Expense Test Engineer",
      status: "Active",
      progress: 0,
      budget: 0,
      spent: 0,
      dueDate: "To be confirmed",
      image: "test.jpg"
    });

    const allocationResult = createExpenseAllocation({ engineer: "Expense Test Engineer", amount: 1000 });
    assert.equal(allocationResult.status, 201);
    const allocation = allocationResult.body.record as { id: string; remainingAmount: number };
    assert.equal(allocation.remainingAmount, 1000);

    const requestResult = createExpense({
      project: "Expense Test Project",
      description: "Request additional funds",
      amount: 300,
      submittedBy: "Expense Test Engineer",
      entryType: "request"
    });
    assert.equal(requestResult.status, 201);
    assert.equal(listExpenseAllocations("Expense Test Engineer")[0].remainingAmount, 1000);

    const logResult = createExpense({
      project: "Expense Test Project",
      description: "Cement purchase",
      amount: 400,
      submittedBy: "Expense Test Engineer",
      entryType: "log",
      allocationId: allocation.id
    });
    assert.equal(logResult.status, 201);
    assert.equal(listExpenseAllocations("Expense Test Engineer")[0].remainingAmount, 600);

    const overspendResult = createExpense({
      project: "Expense Test Project",
      description: "Overspend attempt",
      amount: 700,
      submittedBy: "Expense Test Engineer",
      entryType: "log",
      allocationId: allocation.id
    });
    assert.equal(overspendResult.status, 400);
    assert.equal(expenses.filter((expense) => expense.description === "Overspend attempt").length, 0);
  } finally {
    restoreStoreSnapshot(original);
  }
});
