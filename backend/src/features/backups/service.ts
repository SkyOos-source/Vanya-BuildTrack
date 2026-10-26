import { store } from "../../data/store";
import { failure, result, today } from "../shared";
import { backups } from "./data";

export const listBackups = () => backups;

export function createBackup() {
  const backup = {
    id: `BKP-${String(backups.length + 8).padStart(3, "0")}`,
    status: "Ready to download",
    requestedAt: today(),
    requestedBy: "John Smith"
  };
  backups.unshift(backup);
  return result({ record: backup }, 201);
}

export function downloadBackup(id: string) {
  const backup = backups.find((item) => item.id === id);
  if (!backup) return failure(404, "Backup not found.");
  return result(JSON.stringify(store, null, 2), 200, {
    "Content-Type": "application/json",
    "Content-Disposition": `attachment; filename="buildtrack-${backup.id}.json"`
  });
}
