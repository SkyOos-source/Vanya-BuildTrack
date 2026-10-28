import { Attendance, attendanceLeaves, nextAttendanceLeaveId, nextId, readAttendanceProof, readText } from "../../data/store";
import { failure, result } from "../shared";
import { attendance } from "./data";

function hasMissedCheckOutDeadline(record: Attendance, now = Date.now()) {
  if (!record.checkIn || record.checkOut || record.checkoutRegularization) return false;
  const checkInTime = Date.parse(record.checkIn.capturedAt);
  return Number.isFinite(checkInTime) && now >= checkInTime + 24 * 60 * 60 * 1000;
}

export const listAttendance = () => attendance.map((record) => ({
  ...record,
  status: record.checkOut || record.checkoutRegularization
    ? "Present"
    : hasMissedCheckOutDeadline(record) ? "Absent" : record.status
}));
export const listAttendanceLeaves = () => attendanceLeaves;

export function createAttendanceLeave(body: any) {
  const title = readText(body?.title);
  const date = readText(body?.date);
  const parsedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!title || !date || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
    return failure(400, "A leave name and valid calendar date are required.");
  }
  if (attendanceLeaves.some((leave) => leave.date === date)) {
    return failure(409, "A leave is already scheduled for this date.");
  }
  const leave = { id: nextAttendanceLeaveId(), title, date };
  attendanceLeaves.push(leave);
  attendanceLeaves.sort((left, right) => left.date.localeCompare(right.date));
  return result({ record: leave }, 201);
}

export function deleteAttendanceLeave(id: string) {
  const index = attendanceLeaves.findIndex((leave) => leave.id === id);
  if (index < 0) return failure(404, "Leave was not found.");
  const [record] = attendanceLeaves.splice(index, 1);
  return result({ record });
}

export function regularizeAttendance(id: string, body: any) {
  const record = attendance.find((item) => item.id === id);
  if (!record) return failure(404, "Attendance record was not found.");
  if (!record.checkIn || record.checkOut || record.checkoutRegularization) {
    return failure(409, "Only attendance with a check-in and no recorded check-out can be regularized.");
  }
  const capturedAt = readText(body?.capturedAt);
  const reason = readText(body?.reason);
  const regularizedBy = readText(body?.regularizedBy);
  const checkInTime = Date.parse(record.checkIn.capturedAt);
  const checkOutTime = capturedAt ? Date.parse(capturedAt) : Number.NaN;
  if (!capturedAt || !Number.isFinite(checkOutTime) || !reason || !regularizedBy ||
    !Number.isFinite(checkInTime) || checkOutTime <= checkInTime ||
    checkOutTime > checkInTime + 24 * 60 * 60 * 1000) {
    return failure(400, "Enter a valid check-out time within 24 hours of check-in and provide the reason and owner name.");
  }
  record.checkoutRegularization = {
    capturedAt: new Date(checkOutTime).toISOString(),
    reason,
    regularizedBy,
    regularizedAt: new Date().toISOString()
  };
  record.status = "Present";
  record.evidence = "Check-in photo; check-out regularized by owner";
  return result({ record });
}

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
  if (action === "check-out" && (!record?.checkIn || record.checkOut || record.checkoutRegularization)) return failure(409, "Check in before recording a check-out.");
  if (action === "check-out" && record && hasMissedCheckOutDeadline(record)) {
    record.status = "Absent";
    return failure(409, "The check-out deadline has passed. This attendance is marked absent.");
  }
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
    record.status = "Present";
    record.evidence = "Check-in and check-out photos";
  }
  return result({ record });
}
