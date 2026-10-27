import { useEffect, useRef, useState, type ChangeEvent } from "react";
import type { Attendance, AttendanceProof, DashboardData, Role } from "./types";
import { StatusBadge } from "./components";

type AttendancePageProps = {
  data: DashboardData;
  role: Role;
  currentUser: string;
  onSubmit: (action: "check-in" | "check-out", date: string, proof: AttendanceProof) => Promise<void>;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
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

function AttendanceTable({ records, onPreview }: { records: Attendance[]; onPreview: (proof: AttendanceProof, label: string) => void }) {
  if (!records.length) return <div className="inline-empty">No attendance records have been submitted yet.</div>;
  return <div className="data-table-wrap"><table className="data-table attendance-table">
    <thead><tr><th>Date</th><th>Engineer</th><th>Location</th><th>Check-in time</th><th>Check-in photo</th><th>Check-out time</th><th>Check-out photo</th><th>Status</th></tr></thead>
    <tbody>{records.map((record) => {
      const location = record.checkIn ?? record.checkOut;
      return <tr key={record.id}>
        <td>{record.date ? new Date(`${record.date}T00:00:00`).toLocaleDateString() : "—"}</td>
        <td>{record.engineer}</td>
        <td>{location
          ? <a className="attendance-location-link" href={`https://www.google.com/maps?q=${location.latitude},${location.longitude}`} target="_blank" rel="noreferrer">⌖ View location</a>
          : <span className="attendance-missing">Not recorded</span>}</td>
        <td>{record.checkIn ? formatTime(record.checkIn.capturedAt) : "—"}</td>
        <td><AttendanceProofCell proof={record.checkIn} label={`${record.engineer} check-in`} onPreview={onPreview} /></td>
        <td>{record.checkOut ? formatTime(record.checkOut.capturedAt) : "—"}</td>
        <td><AttendanceProofCell proof={record.checkOut} label={`${record.engineer} check-out`} onPreview={onPreview} /></td>
        <td><StatusBadge status={record.status} /></td>
      </tr>;
    })}</tbody>
  </table></div>;
}

export function AttendancePage({ data, role, currentUser, onSubmit }: AttendancePageProps) {
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
  const cameraVideoRef = useRef<HTMLVideoElement>(null);

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
          <span>{currentRecord?.checkIn && currentRecord.checkOut
            ? `You checked in at ${formatTime(currentRecord.checkIn.capturedAt)} and checked out at ${formatTime(currentRecord.checkOut.capturedAt)}.`
            : currentRecord?.checkIn
              ? `You checked in at ${formatTime(currentRecord.checkIn.capturedAt)}. Check out when you finish.`
              : "You haven't checked in yet today."}</span>
        </div>
        {!currentRecord?.checkOut && <button className="button button-primary attendance-submit" type="button" onClick={() => { setError(""); setPhoto(null); setCaptureOpen(true); setCameraOpen(false); setCameraStream(null); }}>
          ◷ {action === "check-in" ? "Check In" : "Check Out"}
        </button>}
      </div>
    </section>}

    {role === "Owner" && <section className="attendance-overview">
      <div><strong>{checkedIn}</strong><span>Engineers checked in today</span></div>
      <div><strong>{todayRecords.length}</strong><span>Attendance records today</span></div>
      <div><strong>{checkedOut}</strong><span>Check-outs completed</span></div>
    </section>}

    <section className="panel feature-panel">
      <div className="attendance-history-heading">
        <h2>{role === "Owner" ? "Attendance History" : "Attendance History"}</h2>
        <label>Filter Date:
          <input aria-label="Filter attendance by date" type="date" value={historyDate} onChange={(event) => setHistoryDate(event.target.value)} />
        </label>
      </div>
      <AttendanceTable
        records={history}
        onPreview={(proof, label) => setPreview({ proof, label })}
      />
    </section>

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
