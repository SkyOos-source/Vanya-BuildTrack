import assert from "node:assert/strict";
import test from "node:test";
import { paymentRequests, projects, restoreStoreSnapshot, snapshotStore } from "../src/data/store";

test("restoring a workspace snapshot rolls back array mutations in place", () => {
  const original = snapshotStore();
  try {
    const originalLength = projects.length;
    projects.push({
      id: "snapshot-project",
      name: "Before failure",
      site: "Test site",
      client: "Test client",
      engineer: "Test engineer",
      status: "Active",
      progress: 10,
      budget: 100,
      spent: 0,
      dueDate: "30 Nov 2026",
      image: "example.jpg"
    });

    test("payment requests persist across workspace snapshots", () => {
      const original = snapshotStore();
      try {
        paymentRequests.push({
          id: "PREQ-snapshot",
          project: "Snapshot project",
          amount: 125,
          requestedBy: "Owner",
          requestedByEmail: "owner@example.com",
          requestedAt: "2026-11-26T00:00:00.000Z",
          status: "Pending"
        });
        const snapshot = snapshotStore();
        paymentRequests[0].status = "Cancelled";

        restoreStoreSnapshot(snapshot);

        assert.equal(paymentRequests[0].id, "PREQ-snapshot");
        assert.equal(paymentRequests[0].status, "Pending");
      } finally {
        restoreStoreSnapshot(original);
      }
    });
    const snapshot = snapshotStore();
    projects[originalLength].name = "After failure";
    projects.push({ ...projects[originalLength], id: "second-project" });

    restoreStoreSnapshot(snapshot);

    assert.equal(projects.length, originalLength + 1);
    assert.equal(projects[originalLength].name, "Before failure");
  } finally {
    restoreStoreSnapshot(original);
  }
});
