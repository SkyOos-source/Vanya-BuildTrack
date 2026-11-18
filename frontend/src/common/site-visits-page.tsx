import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Project, Role, SiteVisit, SiteVisitProof } from "./types";
import { StatusBadge } from "./components";
import { captureCameraPhoto, compressImageFile, reverseGeocode, siteVisitDateParts } from "./utils";

export type SiteVisitAction = "check-in" | "check-out";

function VisitProof({ proof, label, fallbackLocation }: { proof?: SiteVisitProof; label: string; fallbackLocation: string }) {
  if (!proof) return null;
  return <div className="visit-proof">
    <a href={proof.image} target="_blank" rel="noreferrer" aria-label={`Open ${label} photo`}>
      <img src={proof.image} alt={`${label} photo`} />
    </a>
    <span>{label}<small>{new Date(proof.capturedAt).toLocaleString()}</small><a href={`https://www.google.com/maps?q=${proof.latitude},${proof.longitude}`} target="_blank" rel="noreferrer">⌖ {proof.locationName || fallbackLocation || "Location name unavailable"} · ±{Math.round(proof.accuracy)} m</a></span>
  </div>;
}

function getCurrentPosition(): Promise<GeolocationPosition> {
  if (!navigator.geolocation) {
    return Promise.reject(new Error("This browser does not support location capture."));
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      resolve,
      (error) => reject(new Error(error.code === error.PERMISSION_DENIED
        ? "Location permission is required to record the site visit."
        : error.code === error.TIMEOUT
          ? "Location capture timed out. Try again."
          : "Could not get your location. Check device location settings and try again.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  });
}

export function SiteVisitsPage({ visits, projects, role, currentUser, onAction, onCheckIn }: {
  visits: SiteVisit[];
  projects: Project[];
  role: Role;
  currentUser: string;
  onAction: (visit: SiteVisit, action: SiteVisitAction, proof: SiteVisitProof) => Promise<void>;
  onCheckIn: (project: string, site: string, createProject: boolean, proof: SiteVisitProof) => Promise<void>;
}) {
  const [capture, setCapture] = useState<{ visit?: SiteVisit; action: SiteVisitAction } | null>(null);
  const [selectedProject, setSelectedProject] = useState(projects[0]?.name ?? "");
  const [createProject, setCreateProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSite, setNewProjectSite] = useState("");
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [engineerFilter, setEngineerFilter] = useState("All");
  const [projectFilter, setProjectFilter] = useState("All");
  const [siteFilter, setSiteFilter] = useState("All");
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
  const availableSites = [...new Set(visits.map((visit) => visit.site))].sort((left, right) => left.localeCompare(right));
  const visibleVisits = visits
    .filter((visit) => role !== "Employee" || visit.engineer === currentUser)
    .filter((visit) => role !== "Owner" || engineerFilter === "All" || visit.engineer === engineerFilter)
    .filter((visit) => role !== "Owner" || siteFilter === "All" || visit.site === siteFilter)
    .filter((visit) => role !== "Owner" || projectFilter === "All" || visit.project === projectFilter)
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
      const position = await getCurrentPosition();
      const proof = {
        image: await compressImageFile(file),
        capturedAt,
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        locationName: await reverseGeocode(position.coords.latitude, position.coords.longitude)
      };
      if (capture.visit) {
        await onAction(capture.visit, capture.action, proof);
      } else {
        if (createProject) {
          const name = newProjectName.trim();
          if (!name) throw new Error("Enter a name for the new project/site.");
          await onCheckIn(name, newProjectSite.trim() || name, true, proof);
        } else {
          if (!selectedProject) throw new Error("Select a project/site for check-in.");
          await onCheckIn(selectedProject, "", false, proof);
        }
      }
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
        <div><span className="panel-kicker">{role === "Owner" ? "FIELD ACTIVITY" : "MY FIELD WORK"}</span><h2 className="list-title">{role === "Employee" ? "My site visits" : "Engineer site visits"}</h2></div>
        {(role === "Owner" || role === "Employee") && <div className="toolbar-actions">
          {role === "Owner" && <>
            <select className="select-button" aria-label="Filter site visits by engineer" value={engineerFilter} onChange={(event) => setEngineerFilter(event.target.value)}>
              <option value="All">All engineers</option>
              {availableEngineers.map((engineer) => <option key={engineer} value={engineer}>{engineer}</option>)}
            </select>
            <select className="select-button" aria-label="Filter site visits by site" value={siteFilter} onChange={(event) => setSiteFilter(event.target.value)}>
              <option value="All">All sites</option>
              {availableSites.map((site) => <option key={site} value={site}>{site}</option>)}
            </select>
            <select className="select-button" aria-label="Filter site visits by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="All">All projects</option>
              {availableProjects.map((project) => <option key={project} value={project}>{project}</option>)}
            </select>
          </>}
          {role === "Employee" && <select className="select-button" aria-label="Filter site visits by project" value={projectFilter} onChange={(event) => setProjectFilter(event.target.value)}>
              <option value="All">All projects</option>
              {availableProjects.map((project) => <option key={project} value={project}>{project}</option>)}
            </select>}
          <label className="work-progress-date-filter"><input aria-label="Filter site visits by date" type="date" value={visitDateFilter} onChange={(event) => setVisitDateFilter(event.target.value)} /></label>
          {role === "Employee" && <button className="button button-primary" onClick={() => {
            setError("");
            setCreateProject(projects.length === 0);
            setSelectedProject(projects[0]?.name ?? "");
            setNewProjectName("");
            setNewProjectSite("");
            setCameraOpen(false);
            setCameraStream(null);
            setCapture({ action: "check-in" });
            void openCamera("user");
          }}><span aria-hidden="true">＋</span><span>Check in at site</span></button>}
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
            {(visit.checkIn || visit.checkOut) && <div className="visit-proofs"><VisitProof proof={visit.checkIn} label="Check-in photo" fallbackLocation={visit.site} /><VisitProof proof={visit.checkOut} label="Check-out photo" fallbackLocation={visit.site} /></div>}
          </div>
          <div className="visit-card-end">
            <StatusBadge status={visit.status} />
            {role === "Employee" && visit.status === "Scheduled" && <button className="button button-primary" onClick={() => { setError(""); setCameraOpen(false); setCameraStream(null); setCapture({ visit, action: "check-in" }); void openCamera("user"); }}>Check in with photo</button>}
            {role === "Employee" && visit.status === "Checked in" && <button className="button button-primary" onClick={() => { setError(""); setCameraOpen(false); setCameraStream(null); setCapture({ visit, action: "check-out" }); void openCamera("user"); }}>Check out with photo</button>}
          </div>
        </article>;
        })}</div>
        : <div className="inline-empty">{role === "Employee"
          ? projectFilter !== "All" || visitDateFilter ? "No site visits match these filters." : "No site visits are in progress or completed yet."
          : engineerFilter !== "All" || siteFilter !== "All" || projectFilter !== "All" || visitDateFilter
            ? "No engineer site visits match these filters."
            : "No engineer site visits have been recorded yet."}</div>}
    </section>

    {capture && <div className="attendance-preview-scrim" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) closeCapture();
    }}>
      <form className="attendance-capture-dialog site-visit-capture-dialog" onSubmit={(event) => void submitProof(event)} role="dialog" aria-modal="true" aria-labelledby="site-visit-capture-title">
        <div className="attendance-preview-heading"><div><span className="panel-kicker">FIELD CHECK-IN</span><strong id="site-visit-capture-title">{capture.action === "check-in" ? "Site visit check-in" : "Site visit check-out"}</strong></div>
          <button type="button" aria-label="Close dialog" disabled={saving} onClick={closeCapture}>×</button>
        </div>
        {capture.visit
          ? <p>{capture.visit.project} · {capture.visit.site}<br />Photo and live location will be recorded when you confirm {capture.action === "check-in" ? "check-in" : "check-out"}.</p>
          : <>
            <p className="site-visit-location-note">Photo and live location will be recorded when you confirm check-in.</p>
            <label>Project / site
              <select value={createProject ? "__new" : selectedProject} onChange={(event) => {
                setCreateProject(event.target.value === "__new");
                if (event.target.value !== "__new") setSelectedProject(event.target.value);
              }}>
                {projects.length === 0 && <option value="" disabled>Select a project / site</option>}
                {projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
                <option value="__new">＋ Create new project / site</option>
              </select>
            </label>
            {createProject && <>
              <label>New project / site name<input value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="e.g. Lakeside Residence" required /></label>
              <label>Site location<input value={newProjectSite} onChange={(event) => setNewProjectSite(event.target.value)} placeholder="e.g. Whitefield, Bengaluru" /></label>
            </>}
          </>}
        {cameraLoading && <p>Opening selfie camera…</p>}
        {cameraOpen && <div className="attendance-live-camera"><video ref={cameraVideoRef} autoPlay muted playsInline aria-label="Live camera preview" onLoadedData={() => setCameraReady(true)} /></div>}
        {!cameraOpen && !cameraLoading && error && <button className="button button-outline attendance-photo-option" type="button" disabled={saving} onClick={() => void openCamera("user")}>Retry selfie camera</button>}
        {error && <p className="attendance-error" role="alert">{error}</p>}
        <div className="attendance-dialog-actions"><button className="button button-outline" type="button" disabled={saving} onClick={closeCapture}>Cancel</button><button className="button button-primary" type="submit" disabled={saving || !cameraReady}>{saving ? "Capturing & saving…" : capture.action === "check-in" ? "Confirm check-in" : "Confirm check-out"}</button></div>
      </form>
    </div>}
  </>;
}
