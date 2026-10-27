import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import type { Attendance, AttendanceLeave, AttendanceProof, DashboardData, Role } from "./types";
import { StatusBadge } from "./components";

type AttendancePageProps = {
  data: DashboardData;
  role: Role;
  currentUser: string;
  onSubmit: (action: "check-in" | "check-out", date: string, proof: AttendanceProof) => Promise<void>;
  onRegularize: (record: Attendance, capturedAt: string, reason: string) => Promise<void>;
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

function attendanceStatus(record: Attendance, now: number) {
  if (record.checkIn && (record.checkOut || record.checkoutRegularization)) return "Present";
  if (record.checkIn && now >= Date.parse(record.checkIn.capturedAt) + 24 * 60 * 60 * 1000) return "Absent";
  return record.status;
}

async function compressPhoto(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the selected photo.");
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.78);
  } finally {
    bitmap.close();
  }
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

function AttendanceTable({ records, leaves, now, owner, onPreview, onRegularize }: { records: Attendance[]; leaves: AttendanceLeave[]; now: number; owner: boolean; onPreview: (proof: AttendanceProof, label: string) => void; onRegularize: (record: Attendance) => void }) {
  if (!records.length) return <div className="inline-empty">No attendance records have been submitted yet.</div>;
  return <div className="data-table-wrap"><table className="data-table attendance-table">
    <thead><tr><th>Date</th><th>Engineer</th><th>Locations</th><th>Check-in time</th><th>Check-in photo</th><th>Check-out time</th><th>Check-out photo</th><th>Status</th>{owner && <th>Owner action</th>}</tr></thead>
    <tbody>{records.map((record) => {
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
          ? attendanceStatus(record, now)
          : !record.checkOut
          ? leaves.find((leave) => leave.date === record.date)?.title ?? (record.date && isSunday(record.date) ? "Weekly Off" : record.status)
          : record.status} /></td>
        {owner && <td>{record.checkIn && !record.checkOut && !record.checkoutRegularization
          ? <button className="button button-outline attendance-regularize-button" type="button" onClick={() => onRegularize(record)}>Regularize</button>
          : <span className="attendance-missing">—</span>}</td>}
      </tr>
    })}</tbody>
  </table></div>;
}

export function AttendancePage({ data, role, currentUser, onSubmit, onRegularize }: AttendancePageProps) {
  const today = localDateKey(new Date());
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [historyDate, setHistoryDate] = useState("");
  const [preview, setPreview] = useState<{ proof: AttendanceProof; label: string } | null>(null);
  const [leaves, setLeaves] = useState<AttendanceLeave[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [leaveError, setLeaveError] = useState("");
  const [leaveBusy, setLeaveBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [regularizationRecord, setRegularizationRecord] = useState<Attendance | null>(null);
  const [regularizationError, setRegularizationError] = useState("");
  const [regularizing, setRegularizing] = useState(false);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    const loadLeaves = async () => {
      try {
        const response = await fetch("/api/attendance/leaves");
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
  const todayIsOff = Boolean(todayLeave) || isSunday(today);
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
      const response = await fetch("/api/attendance/leaves", {
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
      const response = await fetch(`/api/attendance/leaves/${leave.id}`, { method: "DELETE" });
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

  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file for attendance evidence.");
      return;
    }
    setError("");
    setCameraOpen(false);
    setCameraStream(null);
    setPhoto(file);
  };

  const openCamera = async () => {
    setError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Open this page over HTTPS or use Upload Photo.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
      setPhoto(null);
      setCameraOpen(true);
      setCameraStream(stream);
    } catch (cameraError) {
      console.error("Unable to open attendance camera:", cameraError);
      setError(cameraError instanceof DOMException && cameraError.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser settings or use Upload Photo."
        : "Could not open the camera. Check that it is connected and not being used by another app.");
    }
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
      const image = await compressPhoto(photo);
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

  const todayRecords = data.attendance.filter((record) => record.date === today);
  const checkedIn = todayRecords.filter((record) => record.checkIn).length;
  const checkedOut = todayRecords.filter((record) => record.checkOut).length;
  const history = data.attendance
    .filter((record) => role === "Owner" || record.engineer === currentUser)
    .filter((record) => !historyDate || record.date === historyDate);

  return <div className="feature-page">
    {role === "Employee" && <section className="panel feature-panel attendance-capture-panel">
      <div className="attendance-today-card">
        <div><strong>Today: {new Date().toLocaleDateString()}</strong>
          <span>{todayIsOff && !currentRecord?.checkIn
            ? `${todayLeave?.title ?? "Sunday"} — no attendance is expected today.`
            : currentRecord?.checkIn && currentRecord.checkOut
            ? `You checked in at ${formatTime(currentRecord.checkIn.capturedAt)} and checked out at ${formatTime(currentRecord.checkOut.capturedAt)}.`
            : currentRecord?.checkIn
              ? `You checked in at ${formatTime(currentRecord.checkIn.capturedAt)}. Check out when you finish.`
              : "You haven't checked in yet today."}</span>
        </div>
        {!currentRecord?.checkOut && !(todayIsOff && !currentRecord?.checkIn) && <button className="button button-primary attendance-submit" type="button" onClick={() => { setError(""); setPhoto(null); setCaptureOpen(true); setCameraOpen(false); setCameraStream(null); }}>
          ◷ {action === "check-in" ? "Check In" : "Check Out"}
        </button>}
      </div>
    </section>}

    {role === "Owner" && <section className="attendance-overview">
      <div><strong>{checkedIn}</strong><span>Engineers checked in today</span></div>
      <div><strong>{todayRecords.length}</strong><span>Attendance records today</span></div>
      <div><strong>{checkedOut}</strong><span>Check-outs completed</span></div>
    </section>}

    <section className="panel feature-panel attendance-calendar-panel">
      <div className="attendance-calendar-heading">
        <div><span className="panel-kicker">{role === "Owner" ? "WORKSPACE CALENDAR" : "SCHEDULED DAYS OFF"}</span><h2>{role === "Owner" ? "Yearly leave calendar" : "Leave calendar"}</h2><p>{role === "Owner" ? "Add and manage leave dates visible to all site engineers." : "Scheduled leaves and Sundays are non-working days; missed attendance is not marked absent."}</p></div>
        <div className="attendance-calendar-navigation"><button className="button button-outline" type="button" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>←</button><strong>{calendarMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong><button className="button button-outline" type="button" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>→</button></div>
      </div>
      <div className="attendance-calendar-layout">
        <div className="attendance-calendar">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => <strong className="attendance-calendar-weekday" key={day}>{day}</strong>)}
          {calendarCells.map((day, index) => {
            if (!day) return <span className="attendance-calendar-empty" key={`empty-${index}`} />;
            const date = `${calendarMonth.getFullYear()}-${String(calendarMonth.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const leave = leaves.find((item) => item.date === date);
            const dayRecord = data.attendance.find((record) => record.date === date && record.engineer === currentUser);
            const dayStatus = dayRecord?.checkIn ? attendanceStatus(dayRecord, now) : undefined;
            return <div className={`attendance-calendar-day ${isSunday(date) ? "calendar-sunday" : ""} ${leave ? "calendar-leave" : ""} ${dayStatus === "Present" ? "calendar-present" : ""} ${dayStatus === "Absent" ? "calendar-absent" : ""} ${dayStatus === "Checked in" ? "calendar-pending" : ""} ${date === today ? "calendar-today" : ""}`} key={date}>
              <span>{day}</span>
              {dayStatus
                ? <small title={dayStatus}>{dayStatus === "Checked in" ? "Awaiting check-out" : dayStatus}</small>
                : leave ? <small title={leave.title}>{leave.title}</small> : isSunday(date) ? <small>Sunday</small> : null}
            </div>;
          })}
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
        <h2>{role === "Owner" ? "Attendance History" : "Attendance History"}</h2>
        <label>Filter Date:
          <input aria-label="Filter attendance by date" type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} />
        </label>
      </div>
      <AttendanceTable
        records={history}
        leaves={leaves}
        now={now}
        owner={role === "Owner"}
        onPreview={(proof, label) => setPreview({ proof, label })}
        onRegularize={(record) => { setRegularizationError(""); setRegularizationRecord(record); }}
      />
    </section>

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

    {captureOpen && <div className="attendance-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !submitting) { setCaptureOpen(false); setCameraOpen(false); setCameraStream(null); } }}>
      <section className="attendance-capture-dialog" role="dialog" aria-modal="true" aria-labelledby="attendance-capture-title">
        <div className="attendance-preview-heading"><strong id="attendance-capture-title">{action === "check-in" ? "Check In Photo" : "Check Out Photo"}</strong><button type="button" aria-label="Close photo capture" disabled={submitting} onClick={() => { setCaptureOpen(false); setCameraOpen(false); setCameraStream(null); }}>×</button></div>
        <div className="attendance-photo-options" aria-label="Choose attendance photo">
          <button className="button button-outline attendance-photo-option" type="button" disabled={submitting} onClick={() => void openCamera()}>▣ Take Photo</button>
          <label className="button button-outline attendance-photo-option">↑ Upload Photo
            <input type="file" accept="image/*" onChange={selectPhoto} />
          </label>
        </div>
        {cameraOpen && <div className="attendance-live-camera">
          <video ref={cameraVideoRef} autoPlay muted playsInline aria-label="Live camera preview" />
          <button className="button button-primary" type="button" onClick={() => void capturePhoto()}>Capture Photo</button>
        </div>}
        {previewUrl && <img className="attendance-capture-preview" src={previewUrl} alt="Selected attendance photo" />}
        <p className="attendance-location-note">Your current location will be recorded when you confirm.</p>
        {error && <p className="attendance-error" role="alert">{error}</p>}
        <div className="attendance-dialog-actions">
          <button className="button button-outline" type="button" disabled={submitting} onClick={() => { setCaptureOpen(false); setCameraOpen(false); setCameraStream(null); }}>Cancel</button>
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
