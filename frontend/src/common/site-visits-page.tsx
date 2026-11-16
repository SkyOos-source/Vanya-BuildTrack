import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Role, SiteVisit, SiteVisitProof } from "./types";
import { StatusBadge } from "./components";
import { captureCameraPhoto, compressImageFile, siteVisitDateParts } from "./utils";

export type SiteVisitAction = "check-in" | "check-out";

function VisitProof({ proof, label }: { proof?: SiteVisitProof; label: string }) {
  if (!proof) return null;
  return <a className="visit-proof" href={proof.image} target="_blank" rel="noreferrer">
    <img src={proof.image} alt={`${label} photo`} />
    <span>{label}<small>{new Date(proof.capturedAt).toLocaleString()}</small></span>
  </a>;
}

export function SiteVisitsPage({ visits, role, currentUser, onSchedule, onAction }: {
  visits: SiteVisit[];
  role: Role;
  currentUser: string;
  onSchedule: () => void;
  onAction: (visit: SiteVisit, action: SiteVisitAction, proof: SiteVisitProof) => Promise<void>;
}) {
  const [capture, setCapture] = useState<{ visit: SiteVisit; action: SiteVisitAction } | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [engineerFilter, setEngineerFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [visitDateFilter, setVisitDateFilter] = useState("");
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraRequestRef = useRef(0);
  useEffect(() => {
    if (!cameraStream) return;
    if (cameraVideoRef.current) cameraVideoRef.current.srcObject = cameraStream;
    return () => cameraStream.getTracks().forEach((track) => track.stop());
  }, [cameraStream]);

  const openCamera = async (facingMode: "user" | "environment") => {
    const requestId = ++cameraRequestRef.current;
    setError("");
    setCameraOpen(false);
    setCameraReady(false);
    setCameraStream(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is unavailable. Open this page over HTTPS and allow camera access.");
      return;
    }
    setCameraLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: facingMode } }, audio: false });
      if (requestId !== cameraRequestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      setCameraStream(stream);
      setCameraOpen(true);
    } catch (cameraError) {
      if (requestId !== cameraRequestRef.current) return;
      console.error("Unable to open the site visit camera:", cameraError);
      setError(cameraError instanceof DOMException && cameraError.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser settings."
        : "Could not open the camera. Check that it is connected and not being used by another app.");
    } finally {
      if (requestId === cameraRequestRef.current) setCameraLoading(false);
    }
  };

  const closeCapture = () => {
    cameraRequestRef.current += 1;
    setCapture(null);
    setCameraOpen(false);
    setCameraReady(false);
    setCameraLoading(false);
    setCameraStream(null);
  };

  const visitDateKey = (value: string) => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, "0")}-${String(parsed.getDate()).padStart(2, "0")}`;
  };
  const availableEngineers = [...new Set(visits.map((visit) => visit.engineer))].sort((left, right) => left.localeCompare(right));
  const availableProjects = [...new Set(visits
    .filter((visit) => role !== "Employee" || visit.engineer === currentUser)
    .map((visit) => visit.project))].sort((left, right) => left.localeCompare(right));
  const visibleVisits = visits
    .filter((visit) => role !== "Employee" || visit.engineer === currentUser)
    .filter((visit) => role !== "Owner" || engineerFilter === "All" || visit.engineer === engineerFilter)
    .filter((visit) => role !== "Employee" || projectFilter === "All" || visit.project === projectFilter)
    .filter((visit) => !visitDateFilter || visitDateKey(visit.date) === visitDateFilter)
    .slice()
    .sort((left, right) => visitDateKey(left.date).localeCompare(visitDateKey(right.date)));

  const submitProof = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const video = cameraVideoRef.current;
    if (!capture || !cameraReady || !video) {
      setError("Camera is not ready yet. Please wait a moment and try again.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const { file, capturedAt } = await captureCameraPhoto(video, "site-visit");
      const proof = { image: await compressImageFile(file), capturedAt };
      await onAction(capture.visit, capture.action, proof);
      setCapture(null);
      setCameraOpen(false);
      setCameraReady(false);
      setCameraStream(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save the site visit photo.");
    } finally {
      setSaving(false);
    }
  };

  return <>
    <section className="panel feature-panel">
      <div className="list-toolbar">
        <div><span className="panel-kicker">FIELD SCHEDULE</span><h2 className="list-title">{role === "Employee" ? "My site visits" : "Engineer site visits"}</h2></div>
        {(role === "Owner" || role === "Employee") && <div className="toolbar-actions">
          {role === "Owner"
            ? <select className="select-button" aria-label="Filter site visits by engineer" value={engineerFilter} onChange={(event) => setEngineerFilter(event.target.value)}>
              <option value="All">All engineers</option>
              {availableEngineers.map((engineer) => <option key={engineer} value={engineer}>{engineer}</option>)}
            </select>
            : <select className="select-button" aria-label="Filter site visits by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="All">All projects</option>
              {availableProjects.map((project) => <option key={project} value={project}>{project}</option>)}
            </select>}
          <label className="work-progress-date-filter"><input aria-label="Filter site visits by date" type="date" value={visitDateFilter} onChange={(event) => setVisitDateFilter(event.target.value)} /></label>
          {role === "Owner" && <button className="button button-primary" onClick={onSchedule}>＋ Schedule visit</button>}
        </div>}
      </div>
      {visibleVisits.length
        ? <div className="visit-cards">{visibleVisits.map((visit) => {
          const date = siteVisitDateParts(visit.date);
          return <article className="visit-card" key={visit.id}>
          <div className="visit-card-date"><span>{date.month}</span><strong>{date.day}</strong><small>{date.label}</small></div>
          <div className="visit-card-content">
            <h3>{visit.project}</h3>
            <p>⌖ {visit.site} · {role === "Owner" ? `Assigned engineer: ${visit.engineer}` : "Assigned to you"}</p>
            {visit.purpose && <div className="visit-purpose">{visit.purpose}</div>}
            {(visit.checkIn || visit.checkOut) && <div className="visit-proofs"><VisitProof proof={visit.checkIn} label="Check-in photo" /><VisitProof proof={visit.checkOut} label="Check-out photo" /></div>}
          </div>
          <div className="visit-card-end">
            <StatusBadge status={visit.status} />
            {role === "Employee" && visit.status === "Scheduled" && <button className="button button-primary" onClick={() => { setError(""); setCameraOpen(false); setCameraStream(null); setCapture({ visit, action: "check-in" }); void openCamera("user"); }}>Check in with photo</button>}
            {role === "Employee" && visit.status === "Checked in" && <button className="button button-primary" onClick={() => { setError(""); setCameraOpen(false); setCameraStream(null); setCapture({ visit, action: "check-out" }); void openCamera("user"); }}>Check out with photo</button>}
          </div>
        </article>;
        })}</div>
        : <div className="inline-empty">{role === "Employee" ? projectFilter !== "All" || visitDateFilter ? "No site visits match these filters." : "No site visits have been scheduled for you yet." : engineerFilter !== "All" || visitDateFilter ? "No site visits match these filters." : "No site visits have been scheduled yet."}</div>}
    </section>

    {capture && <div className="attendance-preview-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) closeCapture();
    }}>
      <form className="attendance-capture-dialog site-visit-capture-dialog" onSubmit={(event) => void submitProof(event)} role="dialog" aria-modal="true" aria-labelledby="site-visit-capture-title">
        <div className="attendance-preview-heading"><strong id="site-visit-capture-title">{capture.action === "check-in" ? "Site visit check-in" : "Site visit check-out"}</strong>
          <button type="button" aria-label="Close dialog" disabled={saving} onClick={closeCapture}>×</button>
        </div>
        <p>{capture.visit.project} · {capture.visit.site}<br />{capture.action === "check-in" ? "Your photo will be captured when you confirm check-in." : "Your photo will be captured when you confirm check-out."}</p>
        {cameraLoading && <p>Opening selfie camera…</p>}
        {cameraOpen && <div className="attendance-live-camera"><video ref={cameraVideoRef} autoPlay muted playsInline aria-label="Live camera preview" onLoadedData={() => setCameraReady(true)} /></div>}
        {!cameraOpen && !cameraLoading && error && <button className="button button-outline attendance-photo-option" type="button" disabled={saving} onClick={() => void openCamera("user")}>Retry selfie camera</button>}
        {error && <p className="attendance-error" role="alert">{error}</p>}
        <div className="attendance-dialog-actions"><button className="button button-outline" type="button" disabled={saving} onClick={closeCapture}>Cancel</button><button className="button button-primary" type="submit" disabled={saving || !cameraReady}>{saving ? "Capturing & saving…" : capture.action === "check-in" ? "Confirm check-in" : "Confirm check-out"}</button></div>
      </form>
    </div>}
  </>;
}
