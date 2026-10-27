import { activities, attendance, expenses, materials, projects } from "../../data/store";

export function recordsForReport(type: string): unknown[] | null {
  const records: Record<string, unknown[]> = {
    projects,
    expenses,
    materials,
    attendance,
    progress: activities.filter((item) => item.kind === "progress")
  };
  return records[type] ?? null;
}
