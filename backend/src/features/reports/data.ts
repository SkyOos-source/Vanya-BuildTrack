import { activities, expenses, materials, projects } from "../../data/store";
import { listAttendance } from "../attendance/service";

export function recordsForReport(type: string): unknown[] | null {
  const records: Record<string, unknown[]> = {
    projects,
    expenses,
    materials,
    attendance: listAttendance(),
    progress: activities.filter((item) => item.kind === "progress")
  };
  return records[type] ?? null;
}
