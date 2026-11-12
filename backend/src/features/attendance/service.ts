import { Attendance, AttendanceLeaveRequest, AttendanceRegularizationRequest, attendance, attendanceLeaveRequests, attendanceLeaves, attendanceRegularizationRequests, nextAttendanceLeaveId, nextId, people, readAttendanceProof, readText } from "../../data/store";
import { failure, result } from "../shared";

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isAttendanceDayComplete(date: string, now = new Date()) {
  return date < dateKey(now);
}

function noCheckInStatus(date: string, now: Date) {
  const leave = attendanceLeaves.find((item) => item.date === date);
  if (new Date(`${date}T00:00:00`).getDay() === 0 || leave) return leave?.title ?? "Weekly Off";
  const today = dateKey(now);
  const endOfToday = new Date(`${today}T00:00:00`);
  endOfToday.setDate(endOfToday.getDate() + 1);
  return date < today || date === today && now >= endOfToday ? "Absent" : "Scheduled";
}

function ensureExpectedAttendanceForEngineers(now = new Date()) {
  const today = dateKey(now);
  for (const person of people.filter((item) => item.role === "Site Engineer")) {
    const datedRecords = attendance.filter((record) => record.engineer === person.name && record.date && record.date <= today);
    const firstDate = datedRecords.reduce((earliest, record) => record.date! < earliest ? record.date! : earliest, today);
    const date = new Date(`${firstDate}T00:00:00`);
    while (dateKey(date) <= today) {
      const currentDate = dateKey(date);
      if (!attendance.some((record) => record.engineer === person.name && record.date === currentDate)) {
        const approvedLeave = attendanceLeaveRequests.some((request) =>
          request.engineer === person.name && request.date === currentDate && request.status === "Approved"
        );
        attendance.unshift({
          id: `AUTO-${person.id}-${currentDate}`,
          engineer: person.name,
          present: "—",
          shift: "Full day",
          status: approvedLeave ? "Off" : noCheckInStatus(currentDate, now),
          evidence: approvedLeave ? "Approved engineer leave" : "No check-in recorded",
          date: currentDate
        });
      }
      date.setDate(date.getDate() + 1);
    }
  }
}

function hasMissedCheckOutDeadline(record: Attendance, now = Date.now()) {
  if (!record.checkIn || record.checkOut || record.checkoutRegularization) return false;
  const checkInTime = Date.parse(record.checkIn.capturedAt);
  return Number.isFinite(checkInTime) && now >= checkInTime + 24 * 60 * 60 * 1000;
}

function attendanceStatus(record: Attendance, now: Date) {
  if (record.checkOut || record.checkoutRegularization) return "Present";
  if (record.checkIn) return "Scheduled";
  if (record.status === "Off") return "Off";
  return record.date ? noCheckInStatus(record.date, now) : record.status;
}

export const listAttendance = () => {
  const now = new Date();
  ensureExpectedAttendanceForEngineers(now);
  attendance.forEach((record) => { record.status = attendanceStatus(record, now); });
  return [...attendance].sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
};
export const listAttendanceLeaves = () => attendanceLeaves;
export const listAttendanceRegularizationRequests = (engineer?: string) => attendanceRegularizationRequests
  .filter((request) => !engineer || request.engineer === engineer);

export const listAttendanceLeaveRequests = (engineer?: string) => attendanceLeaveRequests
  .filter((request) => !engineer || request.engineer === engineer)
  .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt));

export function createAttendanceLeaveRequest(body: any) {
  const engineer = readText(body?.engineer);
  const date = readText(body?.date);
  const reason = readText(body?.reason);
  const parsedDate = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!engineer || !people.some((person) => person.role === "Site Engineer" && person.name === engineer) ||
    !date || !parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date ||
    !reason || reason.length > 500) {
    return failure(400, "A valid engineer, leave date, and reason of up to 500 characters are required.");
  }
  if (date < dateKey(new Date())) return failure(400, "Leave requests must be for today or a future date.");
  if (attendanceLeaves.some((leave) => leave.date === date) || new Date(`${date}T00:00:00`).getDay() === 0) {
    return failure(409, "This date is already a scheduled non-working day.");
  }
  if (attendance.some((record) => record.engineer === engineer && record.date === date && record.checkIn)) {
    return failure(409, "Leave cannot be requested for a day with a recorded check-in.");
  }
  if (attendanceLeaveRequests.some((request) =>
    request.engineer === engineer && request.date === date && request.status !== "Declined"
  )) {
    return failure(409, "A leave request already exists for this engineer and date.");
  }
  const request: AttendanceLeaveRequest = {
    id: nextId("attendance-leave-request"),
    engineer,
    date,
    reason,
    requestedAt: new Date().toISOString(),
    status: "Pending review"
  };
  attendanceLeaveRequests.unshift(request);
  return result({ request }, 201);
}

export function reviewAttendanceLeaveRequest(id: string, body: any, reviewedBy: string) {
  const request = attendanceLeaveRequests.find((item) => item.id === id);
  if (!request) return failure(404, "Leave request was not found.");
  if (request.status !== "Pending review") return failure(409, "This leave request has already been reviewed.");
  const decision = body?.decision;
  if (decision !== "Approved" && decision !== "Declined") {
    return failure(400, "Choose an approval decision.");
  }
  let record: Attendance | undefined;
  if (decision === "Approved") {
    record = attendance.find((item) => item.engineer === request.engineer && item.date === request.date);
    if (record?.checkIn) return failure(409, "This leave request cannot be approved because attendance has already been checked in.");
    if (!record) {
      const person = people.find((item) => item.role === "Site Engineer" && item.name === request.engineer);
      record = {
        id: nextId("attendance"),
        engineer: request.engineer,
        present: "—",
        shift: "Full day",
        status: "Off",
        evidence: "Approved engineer leave",
        date: request.date
      };
      if (person) record.project = person.project;
      attendance.unshift(record);
    } else {
      record.status = "Off";
      record.evidence = "Approved engineer leave";
    }
  }
  request.status = decision;
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date().toISOString();
  return result({ request, ...(record ? { record } : {}) });
}

export function createAttendanceRegularizationRequest(body: any) {
  const attendanceId = readText(body?.attendanceId);
  const engineer = readText(body?.engineer);
  const capturedAt = readText(body?.capturedAt);
  const reason = readText(body?.reason);
  const record = attendance.find((item) => item.id === attendanceId && item.engineer === engineer);
  if (!attendanceId || !engineer || !capturedAt || !reason || !record) {
    return failure(400, "A valid attendance record, engineer, check-out time, and reason are required.");
  }
  if (!record.date || !record.checkIn || record.checkOut || record.checkoutRegularization) {
    return failure(409, "Only attendance with a check-in and no recorded check-out can be requested for regularization.");
  }
  if (!isAttendanceDayComplete(record.date)) {
    return failure(409, "Attendance can be regularized after the day is complete.");
  }
  if (attendanceRegularizationRequests.some((request) => request.attendanceId === record.id && request.status === "Pending review")) {
    return failure(409, "A regularization request for this attendance is already pending review.");
  }
  const checkInTime = Date.parse(record.checkIn.capturedAt);
  const checkOutTime = Date.parse(capturedAt);
  if (!Number.isFinite(checkOutTime) || !Number.isFinite(checkInTime) ||
    checkOutTime <= checkInTime || checkOutTime > checkInTime + 24 * 60 * 60 * 1000 || checkOutTime > Date.now()) {
    return failure(400, "Enter a past check-out time within 24 hours of check-in.");
  }
  const request: AttendanceRegularizationRequest = {
    id: nextId("attendance-regularization-request"),
    attendanceId: record.id,
    engineer,
    date: record.date,
    capturedAt: new Date(checkOutTime).toISOString(),
    reason,
    requestedAt: new Date().toISOString(),
    status: "Pending review"
  };
  attendanceRegularizationRequests.unshift(request);
  return result({ request }, 201);
}

export function reviewAttendanceRegularizationRequest(id: string, body: any, reviewedBy: string) {
  const request = attendanceRegularizationRequests.find((item) => item.id === id);
  if (!request) return failure(404, "Attendance regularization request was not found.");
  if (request.status !== "Pending review") return failure(409, "This request has already been reviewed.");
  const decision = body?.decision;
  if (decision !== "Approved" && decision !== "Declined") {
    return failure(400, "Choose an approval decision.");
  }
  let record: Attendance | undefined;
  if (decision === "Approved") {
    const regularization = regularizeAttendance(request.attendanceId, {
      capturedAt: request.capturedAt,
      reason: `Engineer request: ${request.reason}`,
      regularizedBy: reviewedBy
    });
    if (regularization.status && regularization.status >= 400) return regularization;
    record = attendance.find((item) => item.id === request.attendanceId);
  }
  request.status = decision;
  request.reviewedBy = reviewedBy;
  request.reviewedAt = new Date().toISOString();
  return result({ request, ...(record ? { record } : {}) });
}

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
  if (!record.date || !isAttendanceDayComplete(record.date)) {
    return failure(409, "Attendance can be regularized after the day is complete.");
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
    return failure(409, "The check-out deadline has passed. Submit a regularization request instead.");
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
