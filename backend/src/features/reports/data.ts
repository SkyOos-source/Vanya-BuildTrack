import { activities, expenses, materialUsageLogs, materials, projects } from "../../data/store";
import { listAttendance } from "../attendance/service";
import { listMaterialAllocations } from "../materials/service";

export function recordsForReport(type: string): unknown[] | null {
  const records: Record<string, unknown[]> = {
    projects,
    expenses,
    materials: [...materials, ...listMaterialAllocations(), ...materialUsageLogs],
    attendance: listAttendance(),
    progress: activities.filter((item) => item.kind === "progress")
  };
  return records[type] ?? null;
}
