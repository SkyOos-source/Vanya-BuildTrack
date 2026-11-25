import assert from "node:assert/strict";
import test from "node:test";
import { activities, projects, type Project } from "../src/data/store";
import { createProgress } from "../src/features/progress/service";

test("100% progress updates require and retain a completion summary", async () => {
  const project: Project = {
    id: "PRJ-COMPLETE-TEST",
    name: "Completion summary test",
    site: "Test site",
    client: "Test client",
    engineer: "Test engineer",
    status: "Active",
    progress: 10,
    budget: 0,
    spent: 0,
    dueDate: "",
    image: ""
  };
  const previousProjects = [...projects];
  const previousActivities = [...activities];

  try {
    projects.push(project);
    const body = { description: "Final work complete", project: project.name, progress: "100" };
    const missingSummary = await createProgress(body);
    assert.equal(missingSummary.status, 400);
    assert.equal(project.progress, 10);

    const saved = await createProgress({ ...body, completionSummary: "All work is complete and inspected." });
    assert.equal(saved.status, 201);
    assert.equal((saved.body as { record: { completionSummary?: string } }).record.completionSummary, "All work is complete and inspected.");
    assert.equal(project.progress, 100);
  } finally {
    projects.splice(0, projects.length, ...previousProjects);
    activities.splice(0, activities.length, ...previousActivities);
  }
});
