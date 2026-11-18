import assert from "node:assert/strict";
import test from "node:test";
import { expenseAllocations, expenses, people, projects, restoreStoreSnapshot, snapshotStore } from "../src/data/store";
import { createExpense, createExpenseAllocation, listExpenseAllocations, updateExpense } from "../src/features/expenses/service";

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
    for (const invalidAmount of [0, -1, 1.234]) {
      assert.equal(createExpenseAllocation({ engineer: "Expense Test Engineer", amount: invalidAmount }).status, 400);
    }
    assert.equal(createExpenseAllocation({ engineer: "Missing Engineer", amount: 100 }).status, 400);

    const requestResult = createExpense({
      project: "Expense Test Project",
      description: "Request additional funds",
      amount: 300,
      submittedBy: "Expense Test Engineer",
      entryType: "request"
    });
    assert.equal(requestResult.status, 201);
    assert.equal(listExpenseAllocations("Expense Test Engineer")[0].remainingAmount, 1000);
    for (const invalidAmount of [0, -1, 0.001]) {
      assert.equal(createExpense({
        project: "Expense Test Project",
        description: "Invalid amount",
        amount: invalidAmount,
        submittedBy: "Expense Test Engineer",
        entryType: "log",
        allocationId: allocation.id
      }).status, 400);
    }
    assert.equal(createExpense({
      project: "Expense Test Project",
      description: "Unsupported attachment",
      amount: 10,
      submittedBy: "Expense Test Engineer",
      entryType: "log",
      allocationId: allocation.id,
      attachment: "not-an-image-or-pdf"
    }).status, 400);
    assert.equal(listExpenseAllocations("Expense Test Engineer")[0].remainingAmount, 1000);
    assert.equal(createExpense({
      project: "Missing Project",
      description: "Invalid project",
      amount: 10,
      submittedBy: "Expense Test Engineer",
      entryType: "log",
      allocationId: allocation.id
    }).status, 400);
    assert.equal(createExpense({
      project: "Expense Test Project",
      description: "Invalid allocation owner",
      amount: 10,
      submittedBy: "Another Engineer",
      entryType: "log",
      allocationId: allocation.id
    }).status, 400);

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
    const loggedRecord = logResult.body.record as { id: string };
    const approvalResult = updateExpense(loggedRecord.id, { status: "Approved" });
    assert.equal(approvalResult.status, 400);
    assert.equal((approvalResult.body as { error: string }).error, "Logged expenses are recorded immediately and do not require approval.");
    assert.equal(expenses.find((expense) => expense.id === loggedRecord.id)?.status, "Logged");

    const overspendResult = createExpense({
      project: "Expense Test Project",
      description: "Overspend",
      amount: 700,
      submittedBy: "Expense Test Engineer",
      entryType: "log",
      allocationId: allocation.id
    });
    assert.equal(overspendResult.status, 201);
    assert.equal(listExpenseAllocations("Expense Test Engineer").find((item) => item.id === allocation.id)?.remainingAmount, -100);
    assert.equal(expenses.filter((expense) => expense.description === "Overspend").length, 1);

    const additionalAllocationResult = createExpenseAllocation({ engineer: "Expense Test Engineer", amount: 50 });
    assert.equal(additionalAllocationResult.status, 201);
    const additionalAllocation = additionalAllocationResult.body.record as { id: string; remainingAmount: number };
    assert.equal(additionalAllocation.remainingAmount, 50);
    const allocationBalances = listExpenseAllocations("Expense Test Engineer");
    assert.equal(allocationBalances.find((item) => item.id === allocation.id)?.remainingAmount, -100);
    assert.equal(allocationBalances.reduce((total, item) => total + item.remainingAmount, 0), -50);

    const decimalAllocationResult = createExpenseAllocation({ engineer: "Expense Test Engineer", amount: 0.3 });
    assert.equal(decimalAllocationResult.status, 201);
    const decimalAllocation = decimalAllocationResult.body.record as { id: string };
    for (const [description, amount] of [["Ten paise", 0.1], ["Twenty paise", 0.2]] as const) {
      assert.equal(createExpense({
        project: "Expense Test Project",
        description,
        amount,
        submittedBy: "Expense Test Engineer",
        entryType: "log",
        allocationId: decimalAllocation.id
      }).status, 201);
    }
    assert.equal(listExpenseAllocations("Expense Test Engineer").find((item) => item.id === decimalAllocation.id)?.remainingAmount, 0);
    assert.equal(createExpense({
      project: "Expense Test Project",
      description: "One paise overspend",
      amount: 0.01,
      submittedBy: "Expense Test Engineer",
      entryType: "log",
      allocationId: decimalAllocation.id
    }).status, 201);
    assert.equal(listExpenseAllocations("Expense Test Engineer").find((item) => item.id === decimalAllocation.id)?.remainingAmount, -0.01);
    assert.equal(expenseAllocations.length, 3);
  } finally {
    restoreStoreSnapshot(original);
  }
});
