import { useEffect, useState, type FormEvent } from "react";
import type { Project, Role, WorkRequest } from "./types";
import { apiFetch } from "./api";
import { compressImageFile } from "./utils";
import { StatusBadge } from "./components";

type SelectedPhoto = { name: string; image: string };

export function WorkRequestsPage({ role, currentUser, projects, refreshKey, onToast }: {
  role: Role;
  currentUser: string;
  projects: Project[];
  refreshKey: number;
  onToast: (message: string) => void;
}) {
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [project, setProject] = useState(projects[0]?.name ?? "");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<SelectedPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const isClient = role === "Client";

  useEffect(() => {
    let active = true;
    const loadRequests = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const response = await apiFetch("/api/work-requests");
        const records: unknown = await response.json();
        if (!response.ok || !Array.isArray(records)) {
          throw new Error((records as { error?: string })?.error || `Work requests could not be loaded (${response.status}).`);
        }
        if (active) setRequests(records as WorkRequest[]);
      } catch (error) {
        if (active) setLoadError(error instanceof Error ? error.message : "Work requests could not be loaded.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadRequests();
    return () => { active = false; };
  }, [refreshKey, retry]);

  useEffect(() => {
    if (!projects.some((item) => item.name === project)) {
      setProject(projects[0]?.name ?? "");
    }
  }, [project, projects]);

  const addPhotos = async (files: File[]) => {
    setFormError("");
    const availableSlots = 5 - photos.length;
    if (files.length > availableSlots) {
      setFormError("You can attach up to five photos to a request.");
      files = files.slice(0, availableSlots);
    }
    try {
      const selected = await Promise.all(files.map(async (file) => ({
        name: file.name,
        image: await compressImageFile(file)
      })));
      setPhotos((current) => [...current, ...selected].slice(0, 5));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Could not process the selected photo.");
    }
  };

  const submitRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFormError("");
    try {
      const response = await apiFetch("/api/work-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project, description, photos: photos.map((photo) => photo.image) })
      });
      const result = await response.json() as { record?: WorkRequest; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Work request could not be submitted (${response.status}).`);
      setRequests((current) => [result.record!, ...current]);
      setDescription("");
      setPhotos([]);
      onToast("Your work request has been sent.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Work request could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  const reviewRequest = async (request: WorkRequest, status: "Approved" | "Declined") => {
    setReviewingId(request.id);
    try {
      const response = await apiFetch(`/api/work-requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const result = await response.json() as { record?: WorkRequest; error?: string };
      if (!response.ok || !result.record) throw new Error(result.error || `Work request could not be ${status.toLowerCase()} (${response.status}).`);
      setRequests((current) => current.map((item) => item.id === request.id ? result.record! : item));
      onToast(`Work request ${status.toLowerCase()}.`);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Work request review failed.");
    } finally {
      setReviewingId(null);
    }
  };

  return <div className="work-requests-page">
    {isClient && <section className="panel work-request-form-panel">
      <div className="work-request-section-heading">
        <div><span className="panel-kicker">CLIENT REQUEST</span><h2>Request additional work</h2><p>Describe what you need and share photos to help the project team understand.</p></div>
      </div>
      <form className="work-request-form" onSubmit={(event) => void submitRequest(event)}>
        <label>Project
          <select value={project} onChange={(event) => setProject(event.target.value)} required disabled={projects.length === 0}>
            {projects.length === 0 && <option value="">No assigned projects available</option>}
            {projects.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
          </select>
        </label>
        <label>What work would you like done?
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} maxLength={2000} rows={4} placeholder="Describe the work you would like the project team to consider..." required />
          <small>{description.length}/2,000 characters</small>
        </label>
        <div className="work-request-upload">
          <span className="work-request-upload-title">Photos <small>(up to 5)</small></span>
          <div className="work-request-upload-actions">
            <label className="button button-outline">Take a photo<input type="file" accept="image/*" capture="environment" disabled={photos.length >= 5 || busy} onChange={(event) => {
              const file = event.currentTarget.files?.[0];
              if (file) void addPhotos([file]);
              event.currentTarget.value = "";
            }} /></label>
            <label className="button button-outline">Choose from gallery<input type="file" accept="image/*" multiple disabled={photos.length >= 5 || busy} onChange={(event) => {
              if (event.currentTarget.files) void addPhotos(Array.from(event.currentTarget.files));
              event.currentTarget.value = "";
            }} /></label>
          </div>
          {photos.length > 0 && <div className="work-request-photo-preview">{photos.map((photo, index) => <div key={`${photo.name}-${index}`}>
            <img src={photo.image} alt={photo.name} />
            <button type="button" aria-label={`Remove ${photo.name}`} onClick={() => setPhotos((current) => current.filter((_, photoIndex) => photoIndex !== index))}>×</button>
          </div>)}</div>}
        </div>
        {formError && <p className="work-request-error" role="alert">{formError}</p>}
        <div className="work-request-submit-row"><span>Requesting as {currentUser}</span><button className="button button-primary" type="submit" disabled={busy || projects.length === 0}>{busy ? "Sending request…" : "Send work request"}</button></div>
      </form>
    </section>}

    <section className="panel work-request-list-panel">
      <div className="work-request-section-heading">
        <div><span className="panel-kicker">{isClient ? "YOUR PROJECTS" : "CLIENT REQUESTS"}</span><h2>{isClient ? "Your work requests" : "Work requests"}</h2><p>{isClient ? "Follow the status of the work you have requested." : "Review requests submitted by clients on your assigned projects."}</p></div>
        <span className="work-request-total">{requests.length} {requests.length === 1 ? "request" : "requests"}</span>
      </div>
      {loading ? <div className="inline-empty" role="status">Loading work requests…</div>
        : loadError ? <div className="inline-empty" role="alert">{loadError} <button className="text-link" onClick={() => setRetry((current) => current + 1)}>Retry</button></div>
          : requests.length === 0 ? <div className="work-request-empty"><span aria-hidden="true">✦</span><strong>No work requests yet</strong><p>{isClient ? "Your submitted requests will appear here." : "New client requests for your projects will appear here."}</p></div>
            : <div className="work-request-list">{requests.map((request) => <article className="work-request-card" key={request.id}>
              <div className="work-request-card-header">
                <div><span className="panel-kicker">{request.id} · {request.project}</span><h3>{request.description}</h3></div>
                <StatusBadge status={request.status} />
              </div>
              <div className="work-request-meta"><span>Requested by <strong>{request.requestedBy}</strong></span><time>{new Date(request.requestedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</time></div>
              {request.photos.length > 0 && <div className="work-request-photos">{request.photos.map((photo, index) => <a key={`${request.id}-photo-${index}`} href={photo} target="_blank" rel="noreferrer"><img src={photo} alt={`Photo ${index + 1} for ${request.id}`} /></a>)}</div>}
              <div className="work-request-card-footer">
                {request.reviewedBy && <span>Reviewed by <strong>{request.reviewedBy}</strong>{request.reviewedByRole ? ` · ${request.reviewedByRole}` : ""}{request.reviewedAt ? ` · ${new Date(request.reviewedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}` : ""}</span>}
                {!isClient && request.status === "Pending review" && <div className="work-request-review-actions">
                  <button className="button button-outline" disabled={reviewingId === request.id} onClick={() => void reviewRequest(request, "Declined")}>Decline</button>
                  <button className="button button-primary" disabled={reviewingId === request.id} onClick={() => void reviewRequest(request, "Approved")}>{reviewingId === request.id ? "Saving…" : "Approve"}</button>
                </div>}
              </div>
            </article>)}</div>}
    </section>
  </div>;
}
