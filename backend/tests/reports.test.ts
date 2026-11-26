import assert from "node:assert/strict";
import test from "node:test";
import {
  activities,
  expenses,
  materialAllocations,
  materialUsageLogs,
  materials,
  payments,
  projects,
  restoreStoreSnapshot,
  snapshotStore
} from "../src/data/store";
import { getReport } from "../src/features/reports/service";

test("monthly reports filter transactions and summarize cash and material totals", () => {
  const original = snapshotStore();
  try {
    projects.push({
      id: "report-site",
      name: "Monthly site",
      site: "North site",
      engineer: "Test engineer",
      client: "Test client",
      status: "Active",
      progress: 45,
      budget: 1000,
      spent: 0,
      dueDate: "30 Apr 2026",
      image: ""
    });
    expenses.push(
      { id: "logged-apr", project: "Monthly site", category: "Other", description: "Fuel", amount: 25.5, date: "15 Apr 2026", submittedBy: "Engineer", status: "Logged", entryType: "log" },
      { id: "paid-apr", project: "Monthly site", category: "Other", description: "Tools", amount: 15, date: "20 Apr 2026", submittedBy: "Engineer", status: "Paid", entryType: "request" },
      { id: "pending-apr", project: "Monthly site", category: "Other", description: "Pending", amount: 100, date: "20 Apr 2026", submittedBy: "Engineer", status: "Pending review", entryType: "request" },
      { id: "logged-mar", project: "Monthly site", category: "Other", description: "Earlier", amount: 70, date: "20 Mar 2026", submittedBy: "Engineer", status: "Logged", entryType: "log" }
    );
    payments.push(
      { id: "payment-apr", project: "Monthly site", amount: 200, method: "Cash", recordedBy: "Client", recordedByRole: "Client", date: "18 Apr 2026" },
      { id: "payment-mar", project: "Monthly site", amount: 900, method: "Online", recordedBy: "Client", recordedByRole: "Client", date: "18 Mar 2026" }
    );
    materials.push({
      id: "report-stock",
      material: "Cement",
      category: "Cement",
      received: "20 bags",
      used: "12 bags",
      stock: "8 bags",
      lastUpdated: "Apr 2026"
    });
    materialUsageLogs.push(
      { id: "usage-apr", allocationId: "allocation-apr", material: "Cement", project: "Monthly site", quantity: 3, unit: "bags", engineer: "Test engineer", loggedAt: "Apr 18, 2026, 9:00 AM" },
      { id: "usage-mar", allocationId: "allocation-mar", material: "Cement", project: "Monthly site", quantity: 5, unit: "bags", engineer: "Test engineer", loggedAt: "Mar 18, 2026, 9:00 AM" }
    );
    materialAllocations.push({
      id: "allocation-apr",
      material: "Cement",
      project: "Monthly site",
      engineer: "Test engineer",
      quantity: 3,
      unit: "bags",
      usedQuantity: 3,
      assignedAt: "Apr 18, 2026, 9:00 AM",
      assignedBy: "Owner"
    });
    activities.push(
      { id: "progress-apr", actor: "Engineer", action: "Progress update", project: "Monthly site", time: "Just now", kind: "progress", createdAt: "2026-04-15T10:00:00.000Z" },
      { id: "progress-mar", actor: "Engineer", action: "Earlier update", project: "Monthly site", time: "Earlier", kind: "progress", createdAt: "2026-03-15T10:00:00.000Z" }
    );

    const expensesReport = getReport("expenses", "2026-04").body;
    assert.equal(expensesReport.month, "2026-04");
    assert.equal(expensesReport.summary.totalExpenses, 40.5);
    assert.equal(expensesReport.summary.cashOut, 40.5);
    assert.equal(expensesReport.summary.cashIn, 200);
    assert.deepEqual(expensesReport.records.map((record: { id: string }) => record.id), ["logged-apr", "paid-apr", "payment-apr"]);

    const materialsReport = getReport("materials", "2026-04").body;
    assert.deepEqual(materialsReport.summary.currentStock, [{ material: "Cement", quantity: 8, unit: "bags" }]);
    assert.deepEqual(materialsReport.summary.used, [{ material: "Cement", quantity: 3, unit: "bags" }]);

    const progressReport = getReport("progress", "2026-04").body;
    assert.equal(progressReport.summary.siteCount, 1);
    assert.equal(progressReport.summary.updatesCount, 1);
    assert.deepEqual(progressReport.records[0].updates.map((update: { id: string }) => update.id), ["progress-apr"]);
  } finally {
    restoreStoreSnapshot(original);
  }
});

test("monthly reports reject malformed month values", () => {
  const response = getReport("expenses", "2026-13");
  assert.equal(response.status, 400);
});
