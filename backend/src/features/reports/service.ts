import { failure, result } from "../shared";
import { recordsForReport } from "./data";

export function getReport(type: string) {
  const records = recordsForReport(type);
  if (!records) return failure(404, "Report type not found.");
  return result({ generatedAt: new Date().toISOString(), type, records });
}
