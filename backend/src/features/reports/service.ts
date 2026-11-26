import { failure, result } from "../shared";
import { reportForMonth } from "./data";

function isValidMonth(month: string) {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  return Boolean(match && Number(match[2]) >= 1 && Number(match[2]) <= 12);
}

export function getReport(type: string, requestedMonth?: string) {
  const month = requestedMonth ?? new Date().toISOString().slice(0, 7);
  if (!isValidMonth(month)) return failure(400, "Report month must be a valid YYYY-MM value.");
  const report = reportForMonth(type, month);
  if (!report) return failure(404, "Report type not found.");
  return result({ generatedAt: new Date().toISOString(), type, month, ...report });
}
