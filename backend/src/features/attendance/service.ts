import { Attendance, nextId, readAttendanceProof, readText } from "../../data/store";
import { failure, result } from "../shared";
import { attendance } from "./data";

export const listAttendance = () => attendance;

export function recordAttendance(body: any) {
  const engineer = readText(body?.engineer);
  const date = readText(body?.date);
  const action = body?.action;
  const proof = readAttendanceProof(body?.proof);
  if (!engineer || !date || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    (action !== "check-in" && action !== "check-out") || !proof) {
    return failure(400, "Engineer, date, action, photo, and location are required.");
  }
  let record = attendance.find((item) => item.engineer === engineer && item.date === date);
  if (action === "check-in" && record?.checkIn) return failure(409, "A check-in is already recorded for today.");
  if (action === "check-out" && (!record?.checkIn || record.checkOut)) return failure(409, "Check in before recording a check-out.");
  if (!record) {
    record = {
      id: nextId("attendance"), engineer, present: "—", shift: "Full day", status: "Checked in",
      evidence: "Check-in photo", date
    } as Attendance;
    attendance.unshift(record);
  }
  if (action === "check-in") {
    record.checkIn = proof;
    record.status = "Checked in";
    record.evidence = "Check-in photo";
  } else {
    record.checkOut = proof;
    record.status = "Complete";
    record.evidence = "Check-in and check-out photos";
  }
  return result({ record });
}
