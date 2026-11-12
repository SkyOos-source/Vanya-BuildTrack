import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import type { Attendance, AttendanceLeave, AttendanceLeaveRequest, AttendanceProof, AttendanceRegularizationRequest, DashboardData, Role } from "./types";
import { StatusBadge } from "./components";
import { apiFetch } from "./api";
import { compressImageFile } from "./utils";

type AttendancePageProps = {
  data: DashboardData;
  role: Role;
  currentUser: string;
  onSubmit: (action: "check-in" | "check-out", date: string, proof: AttendanceProof) => Promise<void>;
  onRegularize: (record: Attendance, capturedAt: string, reason: string) => Promise<void>;
  onReviewRequest: (requestId: string, decision: "Approved" | "Declined") => Promise<AttendanceRegularizationRequest>;
  onReviewLeaveRequest: (requestId: string, decision: "Approved" | "Declined") => Promise<{ request: AttendanceLeaveRequest; record?: Attendance }>;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function dateLabel(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" });
}

function isSunday(date: string) {
  return new Date(`${date}T00:00:00`).getDay() === 0;
}

function attendanceStatus(record: Attendance) {
  if (record.checkIn && (record.checkOut || record.checkoutRegularization)) return "Present";
  if (record.checkIn) return "Scheduled";
  return record.status;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("This browser does not support location capture."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED
        ? "Location permission is required to record attendance."
        : error.code === error.TIMEOUT
          ? "Location capture timed out. Try again."
          : "Could not get your location. Check device location settings and try again.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const REQUESTS_PER_PAGE = 5;

function RequestPagination({ page, totalItems, onPageChange }: { page: number; totalItems: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(totalItems / REQUESTS_PER_PAGE);
  if (totalPages <= 1) return null;
  const firstItem = (page - 1) * REQUESTS_PER_PAGE + 1;
  const lastItem = Math.min(page * REQUESTS_PER_PAGE, totalItems);
  return <div className="attendance-request-pagination">
    <span>Showing {firstItem}–{lastItem} of {totalItems}</span>
    <div>
      <button className="button button-outline" type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button className="button button-outline" type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
    </div>
  </div>;
}

function localDateTimeValue(value: string) {
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function AttendanceProofCell({ proof, label, onPreview }: { proof?: AttendanceProof; label: string; onPreview: (proof: AttendanceProof, label: string) => void }) {
  if (!proof) return <span className="attendance-missing">Not recorded</span>;
  const coordinates = `${proof.latitude.toFixed(5)}, ${proof.longitude.toFixed(5)}`;
  return <div className="attendance-proof-cell">
    <button className="attendance-photo" type="button" onClick={() => onPreview(proof, label)} aria-label={`View ${label} photo`}>
      <img src={proof.image} alt={`${label} site photo`} />
      <span>View photo</span>
    </button>
    <span className="attendance-proof-time">{formatTime(proof.capturedAt)}</span>
    <a href={`https://www.google.com/maps?q=${proof.latitude},${proof.longitude}`} target="_blank" rel="noreferrer">
      ⌖ {coordinates}
    </a>
    <small>±{Math.round(proof.accuracy)} m</small>
  </div>;
}

function AttendanceTable({ records, leaves, requests, now, owner, employee, onPreview, onRegularize, onRequestRegularization }: { records: Attendance[]; leaves: AttendanceLeave[]; requests: AttendanceRegularizationRequest[]; now: number; owner: boolean; employee: boolean; onPreview: (proof: AttendanceProof, label: string) => void; onRegularize: (record: Attendance) => void; onRequestRegularization: (record: Attendance) => void }) {
  if (!records.length) return <div className="inline-empty">No attendance records have been submitted yet.</div>;
  return <div className="data-table-wrap"><table className="data-table attendance-table">
    <thead><tr><th>Date</th><th>Engineer</th><th>Locations</th><th>Check-in time</th><th>Check-in photo</th><th>Check-out time</th><th>Check-out photo</th><th>Status</th>{employee && <th>Regularization request</th>}{owner && <th>Owner action</th>}</tr></thead>
    <tbody>{records.map((record) => {
      const request = requests.find((item) => item.attendanceId === record.id);
      const canRequestRegularization = employee && Boolean(record.checkIn && !record.checkOut && !record.checkoutRegularization &&
        record.date && record.date < localDateKey(new Date(now)));
      const canRegularize = owner && Boolean(record.checkIn && !record.checkOut && !record.checkoutRegularization &&
        record.date && record.date < localDateKey(new Date(now)));
      return <tr key={record.id}>
        <td>{record.date ? new Date(`${record.date}T00:00:00`).toLocaleDateString() : "—"}</td>
        <td>{record.engineer}</td>
        <td><div className="attendance-proof-cell">
          {record.checkIn
            ? <a className="attendance-location-link" href={`https://www.google.com/maps?q=${record.checkIn.latitude},${record.checkIn.longitude}`} target="_blank" rel="noreferrer">⌖ Check-in location</a>
            : <span className="attendance-missing">Check-in location not recorded</span>}
          {record.checkOut
            ? <a className="attendance-location-link" href={`https://www.google.com/maps?q=${record.checkOut.latitude},${record.checkOut.longitude}`} target="_blank" rel="noreferrer">⌖ Check-out location</a>
            : <span className="attendance-missing">Check-out location not recorded</span>}
        </div></td>
        <td>{record.checkIn ? formatTime(record.checkIn.capturedAt) : "—"}</td>
        <td><AttendanceProofCell proof={record.checkIn} label={`${record.engineer} check-in`} onPreview={onPreview} /></td>
        <td>{record.checkOut ? formatTime(record.checkOut.capturedAt) : record.checkoutRegularization ? `${formatTime(record.checkoutRegularization.capturedAt)} · Regularized` : "—"}</td>
        <td>{record.checkOut
          ? <AttendanceProofCell proof={record.checkOut} label={`${record.engineer} check-out`} onPreview={onPreview} />
          : record.checkoutRegularization
            ? <div className="attendance-proof-cell"><strong>Owner regularization</strong><small>{record.checkoutRegularization.reason}</small><small>By {record.checkoutRegularization.regularizedBy} · {new Date(record.checkoutRegularization.regularizedAt).toLocaleString()}</small></div>
            : <AttendanceProofCell label={`${record.engineer} check-out`} onPreview={onPreview} />}
        </td>
        <td><StatusBadge status={record.checkIn
          ? attendanceStatus(record)
          : !record.checkOut
          ? leaves.find((leave) => leave.date === record.date)?.title ?? (record.date && isSunday(record.date) ? "Weekly Off" : record.status)
          : record.status} /></td>
        {employee && <td>{request?.status === "Declined"
            ? <div className="attendance-dialog-actions"><StatusBadge status={request.status} />{canRequestRegularization && <button className="button button-outline attendance-regularize-button" type="button" onClick={() => onRequestRegularization(record)}>Request again</button>}</div>
          : request
            ? <StatusBadge status={request.status} />
            : canRequestRegularization
              ? <button className="button button-outline attendance-regularize-button" type="button" onClick={() => onRequestRegularization(record)}>Request regularization</button>
              : <span className="attendance-missing">—</span>}</td>}
        {owner && <td>{canRegularize
          ? <button className="button button-outline attendance-regularize-button" type="button" onClick={() => onRegularize(record)}>Regularize</button>
          : <span className="attendance-missing">—</span>}</td>}
      </tr>
    })}</tbody>
  </table></div>;
}

export function AttendancePage({ data, role, currentUser, onSubmit, onRegularize, onReviewRequest, onReviewLeaveRequest }: AttendancePageProps) {
  const today = localDateKey(new Date());
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState(today);
  const [calendarEngineer, setCalendarEngineer] = useState("All");
  const [preview, setPreview] = useState<{ proof: AttendanceProof; label: string } | null>(null);
  const [leaves, setLeaves] = useState<AttendanceLeave[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [leaveError, setLeaveError] = useState("");
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [regularizationRecord, setRegularizationRecord] = useState<Attendance | null>(null);
  const [regularizationError, setRegularizationError] = useState("");
  const [regularizing, setRegularizing] = useState(false);
  const [regularizationRequests, setRegularizationRequests] = useState<AttendanceRegularizationRequest[]>([]);
  const [regularizationPage, setRegularizationPage] = useState(1);
  const [leaveRequests, setLeaveRequests] = useState<AttendanceLeaveRequest[]>([]);
  const [leaveRequestPage, setLeaveRequestPage] = useState(1);
  const [leaveRequestError, setLeaveRequestError] = useState("");
  const [leaveRequestBusy, setLeaveRequestBusy] = useState(false);
  const [reviewingLeaveRequestId, setReviewingLeaveRequestId] = useState<string | null>(null);
  const [requestRecord, setRequestRecord] = useState<Attendance | null>(null);
  const [requestError, setRequestError] = useState("");
  const [requestingRegularization, setRequestingRegularization] = useState(false);
  const [reviewingRequestId, setReviewingRequestId] = useState<string | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraRequestRef = useRef(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadLeaves = async () => {
      try {
        const response = await apiFetch("/api/attendance/leaves");
        const result = await response.json() as AttendanceLeave[] | { error?: string };
        if (!response.ok || !Array.isArray(result)) {
          throw new Error(!Array.isArray(result) ? result.error || "Could not load the leave calendar." : `Leave calendar request failed (${response.status}).`);
        }
        if (active) setLeaves(result);
      } catch (loadError) {
        console.error("Unable to load attendance leave calendar:", loadError);
        if (active) setLeaveError(loadError instanceof Error ? loadError.message : "Could not load the leave calendar.");
      }
    };
    void loadLeaves();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const query = role === "Employee" ? `?engineer=${encodeURIComponent(currentUser)}` : "";
    const loadRequests = async () => {
      try {
        const response = await apiFetch(`/api/attendance/regularization-requests${query}`);
        const result = await response.json() as AttendanceRegularizationRequest[] | { error?: string };
        if (!response.ok || !Array.isArray(result)) {
          throw new Error(!Array.isArray(result) ? result.error || "Could not load attendance regularization requests." : `Regularization request list failed (${response.status}).`);
        }
        if (active) setRegularizationRequests(result);
      } catch (loadError) {
        console.error("Unable to load attendance regularization requests:", loadError);
        if (active) setRequestError(loadError instanceof Error ? loadError.message : "Could not load attendance regularization requests.");
      }
    };
    void loadRequests();
    return () => { active = false; };
  }, [currentUser, data.attendance, role]);

  useEffect(() => {
    let active = true;
    const query = role === "Employee" ? `?engineer=${encodeURIComponent(currentUser)}` : "";
    const loadLeaveRequests = async () => {
      try {
        const response = await apiFetch(`/api/attendance/leave-requests${query}`);
        const result = await response.json() as AttendanceLeaveRequest[] | { error?: string };
        if (!response.ok || !Array.isArray(result)) {
          throw new Error(!Array.isArray(result) ? result.error || "Could not load leave requests." : `Leave request list failed (${response.status}).`);
        }
        if (active) setLeaveRequests(result);
      } catch (loadError) {
        console.error("Unable to load attendance leave requests:", loadError);
        if (active) setLeaveRequestError(loadError instanceof Error ? loadError.message : "Could not load leave requests.");
      }
    };
    void loadLeaveRequests();
    return () => { active = false; };
  }, [currentUser, data.attendance, role]);

  useEffect(() => {
    if (!cameraStream) return;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = cameraStream;
    return () => cameraStream.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  useEffect(() => {
    if (!photo) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(photo);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  const currentRecord = data.attendance.find((record) =>
    record.date === today && record.engineer === currentUser
  );
  const action = currentRecord?.checkIn ? "check-out" : "check-in";
  const todayLeave = leaves.find((leave) => leave.date === today);
  const approvedLeaveRecord = currentRecord?.status === "Off" && currentRecord.evidence === "Approved engineer leave";
  const todayIsOff = Boolean(todayLeave) || isSunday(today) || approvedLeaveRecord;
  const monthStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const daysInMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0).getDate();
  const calendarCells = useMemo(() => [
    ...Array.from({ length: monthStart.getDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ], [calendarMonth.getFullYear(), calendarMonth.getMonth()]);
  const monthLeaves = leaves.filter((leave) => leave.date.startsWith(`${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-`));

  const addLeave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLeaveBusy(true);
    setLeaveError("");
    try {
      const response = await apiFetch("/api/attendance/leaves", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: form.get("title"), date: form.get("date") })
      });
      const result = await response.json() as { record?: AttendanceLeave; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Could not add leave (${response.status}).`);
      setLeaves((current) => [...current, result.record!].sort((left, right) => left.date.localeCompare(right.date)));
      formElement.reset();
    } catch (saveError) {
      console.error("Unable to add attendance leave:", saveError);
      setLeaveError(saveError instanceof Error ? saveError.message : "Could not add leave.");
    } finally {
      setLeaveBusy(false);
    }
  };

  const removeLeave = async (leave: AttendanceLeave) => {
    setLeaveBusy(true);
    setLeaveError("");
    try {
      const response = await apiFetch(`/api/attendance/leaves/${leave.id}`, { method: "DELETE" });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || `Could not remove leave (${response.status}).`);
      setLeaves((current) => current.filter((item) => item.id !== leave.id));
    } catch (deleteError) {
      console.error("Unable to remove attendance leave:", deleteError);
      setLeaveError(deleteError instanceof Error ? deleteError.message : "Could not remove leave.");
    } finally {
      setLeaveBusy(false);
    }
  };

  const submitLeaveRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setLeaveRequestBusy(true);
    setLeaveRequestError("");
    try {
      const response = await apiFetch("/api/attendance/leave-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          engineer: currentUser,
          date: form.get("date"),
          reason: form.get("reason")
        })
      });
      const result = await response.json() as { request?: AttendanceLeaveRequest; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || `Could not submit leave request (${response.status}).`);
      setLeaveRequests((current) => [result.request!, ...current]);
      formElement.reset();
    } catch (submitError) {
      console.error("Unable to submit attendance leave request:", submitError);
      setLeaveRequestError(submitError instanceof Error ? submitError.message : "Could not submit leave request.");
    } finally {
      setLeaveRequestBusy(false);
    }
  };

  const reviewLeaveRequest = async (request: AttendanceLeaveRequest, decision: "Approved" | "Declined") => {
    setReviewingLeaveRequestId(request.id);
    setLeaveRequestError("");
    try {
      const reviewed = await onReviewLeaveRequest(request.id, decision);
      setLeaveRequests((current) => current.map((item) => item.id === reviewed.request.id ? reviewed.request : item));
    } catch (reviewError) {
      setLeaveRequestError(reviewError instanceof Error ? reviewError.message : "Could not review the leave request.");
    } finally {
      setReviewingLeaveRequestId(null);
    }
  };

  const submitRegularization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!regularizationRecord) return;
    const form = new FormData(event.currentTarget);
    setRegularizing(true);
    setRegularizationError("");
    try {
      await onRegularize(regularizationRecord, String(form.get("capturedAt")), String(form.get("reason")));
      setRegularizationRecord(null);
    } catch (error) {
      setRegularizationError(error instanceof Error ? error.message : "Could not regularize attendance.");
    } finally {
      setRegularizing(false);
    }
  };

  const submitRegularizationRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!requestRecord || !requestRecord.date) return;
    const form = new FormData(event.currentTarget);
    setRequestingRegularization(true);
    setRequestError("");
    try {
      const response = await apiFetch("/api/attendance/regularization-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          attendanceId: requestRecord.id,
          engineer: currentUser,
          capturedAt: new Date(String(form.get("capturedAt"))).toISOString(),
          reason: form.get("reason")
        })
      });
      const result = await response.json() as { request?: AttendanceRegularizationRequest; error?: string };
      if (!response.ok || !result.request) throw new Error(result.error || `Could not submit regularization request (${response.status}).`);
      setRegularizationRequests((current) => [result.request!, ...current.filter((item) => item.attendanceId !== result.request!.attendanceId)]);
      setRequestRecord(null);
    } catch (submitError) {
      console.error("Unable to submit attendance regularization request:", submitError);
      setRequestError(submitError instanceof Error ? submitError.message : "Could not submit regularization request.");
    } finally {
      setRequestingRegularization(false);
    }
  };

  const reviewRequest = async (request: AttendanceRegularizationRequest, decision: "Approved" | "Declined") => {
    setReviewingRequestId(request.id);
    setRequestError("");
    try {
      const reviewed = await onReviewRequest(request.id, decision);
      setRegularizationRequests((current) => current.map((item) => item.id === reviewed.id ? reviewed : item));
    } catch (reviewError) {
      setRequestError(reviewError instanceof Error ? reviewError.message : "Could not review the attendance request.");
    } finally {
      setReviewingRequestId(null);
    }
  };

  const openCamera = async (facingMode: "user" | "environment") => {
    const requestId = ++cameraRequestRef.current;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Open this page over HTTPS and allow camera access.");
      return;
    }
    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: facingMode } },
        audio: false
      });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setPhoto(null);
      setCameraOpen(true);
      setCameraStream(stream);
    } catch (cameraError) {
      if (requestId !== cameraRequestRef.current) return;
      console.error("Unable to open attendance camera:", cameraError);
      setError(cameraError instanceof DOMException && cameraError.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser settings."
        : "Could not open the camera. Check that it is connected and not being used by another app.");
    } finally {
      if (requestId === cameraRequestRef.current) setCameraLoading(false);
    }
  };

  const closeCapture = () => {
    cameraRequestRef.current += 1;
    setCaptureOpen(false);
    setCameraOpen(false);
    setCameraLoading(false);
    setCameraStream(null);
  };

  const capturePhoto = async () => {
    const video = cameraVideoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setError("Camera is not ready yet. Please wait a moment and try again.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Could not capture the camera image. Please try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Camera capture failed.")), "image/jpeg", 0.9);
      });
      setPhoto(new File([blob], `attendance-${Date.now()}.jpg`, { type: "image/jpeg" }));
      setCameraOpen(false);
      setCameraStream(null);
      setError("");
    } catch (captureError) {
      console.error("Unable to capture attendance photo:", captureError);
      setError("Could not capture the camera image. Please try again.");
    }
  };

  const submit = async () => {
    if (!photo) {
      setError("Add a photo before recording attendance.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const position = await getCurrentPosition();
      const image = await compressImageFile(photo);
      await onSubmit(action, today, {
        image,
        capturedAt: new Date().toISOString(),
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
      setPhoto(null);
      setCaptureOpen(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not submit attendance.");
    } finally {
      setSubmitting(false);
    }
  };

  const regularizationPageCount = Math.max(1, Math.ceil(regularizationRequests.length / REQUESTS_PER_PAGE));
  const displayedRegularizationPage = Math.min(regularizationPage, regularizationPageCount);
  const leaveRequestPageCount = Math.max(1, Math.ceil(leaveRequests.length / REQUESTS_PER_PAGE));
  const displayedLeaveRequestPage = Math.min(leaveRequestPage, leaveRequestPageCount);
  const visibleRegularizationRequests = regularizationRequests.slice(
    (displayedRegularizationPage - 1) * REQUESTS_PER_PAGE,
    displayedRegularizationPage * REQUESTS_PER_PAGE
  );
  const visibleLeaveRequests = leaveRequests.slice(
    (displayedLeaveRequestPage - 1) * REQUESTS_PER_PAGE,
    displayedLeaveRequestPage * REQUESTS_PER_PAGE
  );
  const engineers = [...new Set(data.attendance.map((record) => record.engineer))].sort((left, right) => left.localeCompare(right));
  const history = data.attendance
    .filter((record) => role === "Owner" || record.engineer === currentUser)
    .filter((record) => !historyDate || record.date === historyDate);

  return <div className="feature-page">
    {role === "Employee" && <section className="panel feature-panel attendance-capture-panel">
      <div className="attendance-today-card">
        <div><strong>Today: {new Date().toLocaleDateString()}</strong>
          <span>{todayIsOff && !currentRecord?.checkIn
            ? `${todayLeave?.title ?? (approvedLeaveRecord ? "Approved leave" : "Sunday")} — non-working day. Check in if you are working today.`
            : currentRecord?.checkIn && currentRecord.checkOut
            ? `You checked in at ${formatTime(currentRecord.checkIn.capturedAt)} and checked out at ${formatTime(currentRecord.checkOut.capturedAt)}.`
            : currentRecord?.checkIn
              ? `You checked in at ${formatTime(currentRecord.checkIn.capturedAt)}. Check out when you finish.`
              : "You haven't checked in yet today."}</span>
        </div>
        {!currentRecord?.checkOut && <button className="button button-primary attendance-submit" type="button" onClick={() => { setError(""); setPhoto(null); setCaptureOpen(true); setCameraOpen(false); setCameraStream(null); void openCamera("user"); }}>
          ◷ {action === "check-in" ? "Check In" : "Check Out"}
        </button>}
      </div>
    </section>}

    {role === "Owner" && <section className="panel feature-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">ENGINEER REQUESTS</span><h2 className="list-title">Attendance regularization requests</h2></div></div>
      {requestError && <p className="attendance-error" role="alert">{requestError}</p>}
      {regularizationRequests.length
        ? <div className="data-table-wrap"><table className="data-table attendance-regularization-table">
          <thead><tr><th>Engineer</th><th>Attendance date</th><th>Requested check-out</th><th>Reason</th><th>Requested</th><th>Status</th><th>Review</th></tr></thead>
          <tbody>{visibleRegularizationRequests.map((request) => <tr key={request.id}>
            <td>{request.engineer}</td>
            <td>{dateLabel(request.date)}</td>
            <td>{new Date(request.capturedAt).toLocaleString()}</td>
            <td>{request.reason}</td>
            <td>{new Date(request.requestedAt).toLocaleString()}</td>
            <td><StatusBadge status={request.status} /></td>
            <td>{request.status === "Pending review"
              ? <div className="attendance-dialog-actions">
                <button className="button button-primary" type="button" disabled={reviewingRequestId !== null} onClick={() => void reviewRequest(request, "Approved")}>{reviewingRequestId === request.id ? "Reviewing…" : "Approve"}</button>
                <button className="button button-outline" type="button" disabled={reviewingRequestId !== null} onClick={() => void reviewRequest(request, "Declined")}>Decline</button>
              </div>
              : request.reviewedBy ? `By ${request.reviewedBy}` : "—"}</td>
          </tr>)}</tbody>
        </table></div>
        : <div className="inline-empty">No attendance regularization requests have been submitted.</div>}
      <RequestPagination page={displayedRegularizationPage} totalItems={regularizationRequests.length} onPageChange={setRegularizationPage} />
    </section>}

    {role !== "Client" && <section className="panel feature-panel attendance-leave-requests-panel">
      <div className="list-toolbar"><div><span className="panel-kicker">{role === "Owner" ? "ENGINEER REQUESTS" : "TIME OFF"}</span><h2 className="list-title">{role === "Owner" ? "Engineer leave requests" : "Request a day off"}</h2></div></div>
      {role === "Employee" && <form className="attendance-leave-request-form" onSubmit={(event) => void submitLeaveRequest(event)}>
        <label>Day off<input name="date" type="date" min={today} defaultValue={today} required /></label>
        <label>Reason<textarea name="reason" maxLength={500} rows={2} placeholder="Why do you need this day off?" required /></label>
        <button className="button button-primary" type="submit" disabled={leaveRequestBusy}>{leaveRequestBusy ? "Submitting…" : "Submit leave request"}</button>
      </form>}
      {leaveRequestError && <p className="attendance-error" role="alert">{leaveRequestError}</p>}
      {leaveRequests.length
        ? <div className="data-table-wrap"><table className="data-table">
          <thead><tr>{role === "Owner" && <th>Engineer</th>}<th>Date</th><th>Reason</th><th>Requested</th><th>Status</th>{role === "Owner" && <th>Review</th>}</tr></thead>
          <tbody>{visibleLeaveRequests.map((request) => <tr key={request.id}>
            {role === "Owner" && <td>{request.engineer}</td>}
            <td>{dateLabel(request.date)}</td>
            <td>{request.reason}</td>
            <td>{new Date(request.requestedAt).toLocaleString()}</td>
            <td><StatusBadge status={request.status} /></td>
            {role === "Owner" && <td>{request.status === "Pending review"
              ? <div className="attendance-dialog-actions">
                <button className="button button-primary" type="button" disabled={reviewingLeaveRequestId !== null} onClick={() => void reviewLeaveRequest(request, "Approved")}>{reviewingLeaveRequestId === request.id ? "Reviewing…" : "Approve"}</button>
                <button className="button button-outline" type="button" disabled={reviewingLeaveRequestId !== null} onClick={() => void reviewLeaveRequest(request, "Declined")}>Decline</button>
              </div>
              : request.reviewedBy ? `By ${request.reviewedBy}` : "—"}</td>}
          </tr>)}</tbody>
        </table></div>
        : <div className="inline-empty">{role === "Owner" ? "No engineer leave requests have been submitted." : "You have not requested any days off."}</div>}
      <RequestPagination page={displayedLeaveRequestPage} totalItems={leaveRequests.length} onPageChange={setLeaveRequestPage} />
    </section>}

    <section className="panel feature-panel attendance-calendar-panel">
      <div className="attendance-calendar-heading">
        <div><span className="panel-kicker">{role === "Owner" ? "WORKSPACE CALENDAR" : "SCHEDULED DAYS OFF"}</span><h2>{role === "Owner" ? "Engineer attendance calendar" : "Leave calendar"}</h2><p>{role === "Owner" ? "View attendance by engineer or see a daily summary for the whole team." : "Scheduled leaves and Sundays are non-working days; missed attendance is not marked absent."}</p></div>
        <div className="attendance-calendar-controls">
          {role === "Owner" && <label>Engineer
            <select aria-label="Filter attendance calendar by engineer" className="select-button" value={calendarEngineer} onChange={(event) => setCalendarEngineer(event.target.value)}>
              <option value="All">All engineers</option>
              {engineers.map((engineer) => <option key={engineer} value={engineer}>{engineer}</option>)}
            </select>
          </label>}
          <div className="attendance-calendar-navigation"><button className="button button-outline" type="button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>←</button><strong>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong><button className="button button-outline" type="button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>→</button></div>
        </div>
      </div>
      <div className="attendance-calendar-layout">
        <div className="attendance-calendar-scroll">
          <div className="attendance-calendar">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong className="attendance-calendar-weekday" key={day}>{day}</strong>)}
            {calendarCells.map((day, index) => {
              if (!day) return <span className="attendance-calendar-empty" key={`empty-${index}`} />;
              const date = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
              const leave = leaves.find((item) => item.date === date);
              const dayRecords = data.attendance.filter((record) =>
                record.date === date && (role === "Owner" ? calendarEngineer === "All" || record.engineer === calendarEngineer : record.engineer === currentUser)
              );
              const dayStatuses = dayRecords.map((record) =>
                record.checkIn ? attendanceStatus(record) : record.status
              );
              const presentCount = dayStatuses.filter((status) => status === "Present").length;
              const absentCount = dayStatuses.filter((status) => status === "Absent").length;
              const scheduledCount = dayStatuses.filter((status) => status === "Scheduled").length;
              const offCount = dayStatuses.filter((status) => status === "Off").length;
              const statusDetails = dayRecords.map((record, recordIndex) => `${record.engineer}: ${dayStatuses[recordIndex]}`).join(", ");
              const isAllEngineers = role === "Owner" && calendarEngineer === "All";
              const isMixed = isAllEngineers && [presentCount, absentCount, scheduledCount, offCount].filter(Boolean).length > 1;
              const dayStatus = isAllEngineers
                ? statusDetails
                : dayStatuses[0];
              const aggregateClass = isAllEngineers
                ? isMixed ? "calendar-mixed" : presentCount ? "calendar-present" : absentCount ? "calendar-absent" : scheduledCount ? "calendar-pending" : offCount ? "calendar-off" : ""
                : dayStatus === "Present" ? "calendar-present" : dayStatus === "Absent" ? "calendar-absent" : dayStatus === "Scheduled" ? "calendar-pending" : dayStatus === "Off" ? "calendar-off" : "";
              return <div className={`attendance-calendar-day ${isSunday(date) ? "calendar-sunday" : ""} ${leave ? "calendar-leave" : ""} ${aggregateClass} ${date === today ? "calendar-today" : ""}`} key={date}>
                <span>{day}</span>
                {isAllEngineers && (presentCount + absentCount + scheduledCount + offCount > 0)
                  ? <div className="attendance-calendar-counts" title={statusDetails}>
                    <span className="count-present">Present <b>{presentCount}</b></span>
                    <span className="count-absent">Absent <b>{absentCount}</b></span>
                    <span className="count-scheduled">Awaiting <b>{scheduledCount}</b></span>
                    <span className="count-off">Off <b>{offCount}</b></span>
                  </div>
                  : dayStatus
                  ? <small title={dayStatus}>{dayStatus === "Scheduled" && dayRecords[0]?.checkIn ? "Awaiting check-out" : dayStatus}</small>
                  : leave ? <small title={leave.title}>{leave.title}</small> : isSunday(date) ? <small>Sunday</small> : null}
              </div>;
            })}
            {role === "Owner" && <div className="attendance-calendar-legend">
              <span><i className="legend-present" />Present</span>
              <span><i className="legend-absent" />Absent</span>
              <span><i className="legend-scheduled" />Scheduled / awaiting check-out</span>
              <span><i className="legend-off" />Approved leave</span>
            </div>}
          </div>
        </div>
        <aside className="attendance-leave-list">
          {role === "Owner" && <form className="attendance-leave-form" onSubmit={(event) => void addLeave(event)}>
            <label>Leave name<input name="title" placeholder="e.g. Foundation Day" required /></label>
            <label>Date<input name="date" type="date" defaultValue={today} required /></label>
            <button className="button button-primary" type="submit" disabled={leaveBusy}>＋ Add leave</button>
          </form>}
          {leaveError && <p className="attendance-error" role="alert">{leaveError}</p>}
          <strong>{monthLeaves.length ? "Leaves this month" : "No scheduled leaves this month"}</strong>
          {monthLeaves.map((leave) => <div className="attendance-leave-item" key={leave.id}><span><b>{dateLabel(leave.date)}</b><small>{leave.title}</small></span>{role === "Owner" && <button className="icon-button" type="button" aria-label={`Remove ${leave.title}`} disabled={leaveBusy} onClick={() => void removeLeave(leave)}>×</button>}</div>)}
          <small>Sundays are automatically treated as weekly off.</small>
        </aside>
      </div>
    </section>

    <section className="panel feature-panel">
      <div className="attendance-history-heading">
        <h2>Attendance History</h2>
        <div className="attendance-history-filters">
          <label>Filter Date:
            <input aria-label="Filter attendance by date" type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} />
          </label>
        </div>
      </div>
      <AttendanceTable
        records={history}
        leaves={leaves}
        requests={regularizationRequests}
        now={now}
        owner={role === "Owner"}
        employee={role === "Employee"}
        onPreview={(proof, label) => setPreview({ proof, label })}
        onRegularize={(record) => { setRegularizationError(""); setRegularizationRecord(record); }}
        onRequestRegularization={(record) => { setRequestError(""); setRequestRecord(record); }}
      />
    </section>

    {requestRecord && requestRecord.checkIn && requestRecord.date && <div className="attendance-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !requestingRegularization) setRequestRecord(null); }}>
      <form className="attendance-capture-dialog attendance-regularization-dialog" onSubmit={(event) => void submitRegularizationRequest(event)} role="dialog" aria-modal="true" aria-labelledby="attendance-request-title">
        <div className="attendance-preview-heading"><strong id="attendance-request-title">Request attendance regularization</strong><button type="button" aria-label="Close request" disabled={requestingRegularization} onClick={() => setRequestRecord(null)}>×</button></div>
        <p>Attendance date: <strong>{dateLabel(requestRecord.date)}</strong>. Enter the check-out date and time you actually left the site. The owner will review your request.</p>
        <label>Actual check-out date and time
          <input name="capturedAt" type="datetime-local" required min={localDateTimeValue(requestRecord.checkIn.capturedAt)} max={localDateTimeValue(new Date(Math.min(Date.parse(requestRecord.checkIn.capturedAt) + 24 * 60 * 60 * 1000, now)).toISOString())} defaultValue={localDateTimeValue(new Date(Date.parse(requestRecord.checkIn.capturedAt) + 8 * 60 * 60 * 1000).toISOString())} />
        </label>
        <label>Reason<textarea name="reason" required maxLength={500} rows={3} placeholder="Explain why you missed check-out." /></label>
        {requestError && <p className="attendance-error" role="alert">{requestError}</p>}
        <div className="attendance-dialog-actions"><button className="button button-outline" type="button" disabled={requestingRegularization} onClick={() => setRequestRecord(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={requestingRegularization}>{requestingRegularization ? "Sending…" : "Send request"}</button></div>
      </form>
    </div>}

    {regularizationRecord && <div className="attendance-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !regularizing) setRegularizationRecord(null); }}>
      <form className="attendance-capture-dialog attendance-regularization-dialog" onSubmit={(event) => void submitRegularization(event)} role="dialog" aria-modal="true" aria-labelledby="regularization-title">
        <div className="attendance-preview-heading"><strong id="regularization-title">Regularize check-out · {regularizationRecord.engineer}</strong><button type="button" aria-label="Close regularization" disabled={regularizing} onClick={() => setRegularizationRecord(null)}>×</button></div>
        <p>Enter the actual check-out time. This will update the record to Present and keep the regularization reason in its audit details.</p>
        <label>Actual check-out date and time<input name="capturedAt" type="datetime-local" required min={localDateTimeValue(regularizationRecord.checkIn!.capturedAt)} max={localDateTimeValue(new Date(Date.parse(regularizationRecord.checkIn!.capturedAt) + 24 * 60 * 60 * 1000).toISOString())} defaultValue={localDateTimeValue(new Date(Date.parse(regularizationRecord.checkIn!.capturedAt) + 8 * 60 * 60 * 1000).toISOString())} /></label>
        <label>Reason<textarea name="reason" required maxLength={500} rows={3} placeholder="Why was the check-out missed?" /></label>
        {regularizationError && <p className="attendance-error" role="alert">{regularizationError}</p>}
        <div className="attendance-dialog-actions"><button className="button button-outline" type="button" disabled={regularizing} onClick={() => setRegularizationRecord(null)}>Cancel</button><button className="button button-primary" type="submit" disabled={regularizing}>{regularizing ? "Saving…" : "Save regularization"}</button></div>
      </form>
    </div>}

    {captureOpen && <div className="attendance-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) closeCapture(); }}>
      <section className="attendance-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="attendance-capture-title">
        <div className="attendance-preview-heading"><strong id="attendance-capture-title">{action === "check-in" ? "Check In Selfie" : "Check Out Selfie"}</strong><button type="button" aria-label="Close photo capture" disabled={submitting} onClick={closeCapture}>×</button></div>
        {cameraLoading && <p>Opening selfie camera…</p>}
        {cameraOpen && <div className="attendance-live-camera">
          <video ref={cameraVideoRef} autoPlay muted playsInline aria-label="Live camera preview" />
          <button className="button button-primary" type="button" onClick={() => void capturePhoto()}>Capture Photo</button>
        </div>}
        {!cameraOpen && !cameraLoading && error && <button className="button button-outline attendance-photo-option" type="button" disabled={submitting} onClick={() => void openCamera("user")}>Retry selfie camera</button>}
        {previewUrl && <img className="attendance-capture-preview" src={previewUrl} alt="Selected attendance photo" />}
        <p className="attendance-location-note">Your current location will be recorded when you confirm.</p>
        {error && <p className="attendance-error" role="alert">{error}</p>}
        <div className="attendance-dialog-actions">
          <button className="button button-outline" type="button" disabled={submitting} onClick={closeCapture}>Cancel</button>
          <button className="button button-primary" type="button" disabled={submitting || !photo} onClick={() => void submit()}>
            {submitting ? "Recording…" : `Confirm ${action === "check-in" ? "Check In" : "Check Out"}`}
          </button>
        </div>
      </section>
    </div>}

    {preview && <div className="attendance-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPreview(null); }}>
      <section className="attendance-preview-dialog" role="dialog" aria-modal="true" aria-label={`${preview.label} evidence`}>
        <div className="attendance-preview-heading"><strong>{preview.label}</strong><button type="button" aria-label="Close photo preview" onClick={() => setPreview(null)}>×</button></div>
        <img src={preview.proof.image} alt={`${preview.label} site evidence`} />
        <p>{new Date(preview.proof.capturedAt).toLocaleString()}</p>
        <a href={`https://www.google.com/maps?q=${preview.proof.latitude},${preview.proof.longitude}`} target="_blank" rel="noreferrer">
          View location · {preview.proof.latitude.toFixed(6)}, {preview.proof.longitude.toFixed(6)} (±{Math.round(preview.proof.accuracy)} m) ↗
        </a>
      </section>
    </div>}
  </div>;
}
