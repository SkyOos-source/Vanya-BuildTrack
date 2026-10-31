import { useEffect, useState, type FormEvent } from "react";
import type { Activity, Attendance, AttendanceProof, DashboardData, Expense, Project, Quote, RecordModalType, Role, SiteVisit, Person } from "./types";
import { apiFetch } from "./api";
import { formatCurrency, googleReviewUrl, initials } from "./utils";
import { ExpenseRows, ProjectCards, StatusBadge } from "./components";
import { AttendancePage } from "./attendance-page";
import { ProjectDetails } from "./project-details";
import { QuotationPdfPreview } from "./quotation-pdf-preview";
import { isDemoMode } from "./data";

export type FeaturePageProps = { page: string; role: Role; currentUser: string; data: DashboardData; projects: Project[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; onCreate: (modal: RecordModalType | null) => void; onQuote: (quote: Quote, decision: "Approved" | "Declined") => void; onAttendanceSubmit: (action: "check-in" | "check-out", date: string, proof: AttendanceProof) => Promise<void>; onAttendanceRegularize: (record: Attendance, capturedAt: string, reason: string) => Promise<void>; onExpenseStatus: (expense: Expense, status: "Approved" | "Declined" | "Paid") => void; onVisitStatus: (visit: SiteVisit, status: "Scheduled" | "Completed" | "Cancelled") => void; onRemovePerson: (person: Person) => void; onToast: (message: string) => void; onFeedback: (event: FormEvent<HTMLFormElement>) => void; onBackup: () => void };

function localDateKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function FeaturePage({ page, role, currentUser, data, projects, search, setSearch, filter, setFilter, onCreate, onQuote, onAttendanceSubmit, onAttendanceRegularize, onExpenseStatus, onVisitStatus, onRemovePerson, onToast, onFeedback, onBackup }: FeaturePageProps) {
  const [rating, setRating] = useState(5);
  const [workProgressDate, setWorkProgressDate] = useState("");
  const [selectedWorkProgress, setSelectedWorkProgress] = useState<Activity | null>(null);
  const [workProgressPhotoIndex, setWorkProgressPhotoIndex] = useState(0);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [personPendingDeletion, setPersonPendingDeletion] = useState<Person | null>(null);
  const [materialProjectFilter, setMaterialProjectFilter] = useState("All");
  const [materialRequestStatusFilter, setMaterialRequestStatusFilter] = useState("All");
  const projectView = page === "Projects & Sites" || page === "My Projects" || page === "My Sites";
  const clientProjectName = data.people.find((person) => person.role === "Client" && person.name === currentUser)?.project;
  const scopedProjects = role === "Owner" ? projects : role === "Employee" ? projects.filter((project) => project.engineer === currentUser) : projects.filter((project) => project.client === currentUser || project.name === clientProjectName);
  const selectedProject = scopedProjects.find((project) => project.id === selectedProjectId);
  const visibleQuotes = role === "Client" ? data.quotes.filter((quote) => quote.client === currentUser) : data.quotes;
  const selectedEngineer = data.people.find((person) => person.id === selectedEngineerId && person.role === "Site Engineer");
  const engineerProjects = selectedEngineer ? data.projects.filter((project) => project.engineer === selectedEngineer.name) : [];
  const visibleExpenses = role === "Client"
    ? data.expenses.filter((expense) => expense.status === "Approved" && data.projects.some((project) => (project.client === currentUser || project.name === clientProjectName) && project.name === expense.project))
    : role === "Employee"
      ? data.expenses.filter((expense) => expense.submittedBy === currentUser)
      : data.expenses;
  const clientWorkProgress = data.activities.filter((item) =>
    item.kind === "progress" &&
    scopedProjects.some((project) => project.name === item.project) &&
    (!workProgressDate || localDateKey(item.createdAt) === workProgressDate)
  );
  const clientWorkProgressPhotos = clientWorkProgress.filter((item) => item.attachment);
  const activeWorkProgressPhoto = clientWorkProgressPhotos[workProgressPhotoIndex];

  useEffect(() => {
    if (!selectedWorkProgress) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedWorkProgress(null);
      if (event.key === "ArrowLeft" && clientWorkProgressPhotos.length > 1) {
        setWorkProgressPhotoIndex((index) => (index - 1 + clientWorkProgressPhotos.length) % clientWorkProgressPhotos.length);
      }
      if (event.key === "ArrowRight" && clientWorkProgressPhotos.length > 1) {
        setWorkProgressPhotoIndex((index) => (index + 1) % clientWorkProgressPhotos.length);
      }
    };
    window.addEventListener("keydown", closeOnKey);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnKey);
    };
  }, [selectedWorkProgress, clientWorkProgressPhotos.length]);
  const renderPeople = (people: Person[], engineers = false) => people.length > 0
    ? <div className="people-grid">{people.map((person) => <article className="person-card" key={person.id}><span className="avatar">{initials(person.name)}</span><div><strong>{person.name}</strong><span>{person.role}</span><small>{engineers ? `${data.projects.filter((project) => project.engineer === person.name).length} assigned sites · ${person.email}` : `${person.project} · ${person.email}`}</small></div>{engineers && <button className="button button-outline person-details-button" onClick={() => setSelectedEngineerId(person.id)}>View details</button>}<button className="icon-button" aria-label={`Remove ${person.name}`} onClick={() => setPersonPendingDeletion(person)}>×</button></article>)}</div>
    : <p className="people-empty">No people in this section yet.</p>;

  const downloadReport = async (type: string) => {
    try {
      const response = await apiFetch(`/api/reports/${type}`);
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || `Report request failed (${response.status})`);
      const file = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `buildtrack-${type}-report.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error(`Unable to generate ${type} report:`, error);
      onToast(error instanceof Error ? error.message : "Could not generate this report.");
    }
  };
  const downloadBackup = async (id: string) => {
    try {
      const response = await apiFetch(`/api/backups/${id}/download`);
      if (!response.ok) throw new Error(`Backup download failed (${response.status}).`);
      const file = new Blob([JSON.stringify(await response.json(), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = `buildtrack-${id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Unable to download workspace backup:", error);
      onToast(error instanceof Error ? error.message : "Could not download this backup.");
    }
  };
  return <div className="feature-page">
    {projectView && (selectedProject
      ? <ProjectDetails project={selectedProject} data={data} role={role} currentUser={currentUser} onBack={() => setSelectedProjectId(null)} />
      : <section className="panel feature-panel"><div className="list-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search projects" placeholder="Search projects, sites, clients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="toolbar-actions"><select className="select-button project-filter-select" aria-label="Filter projects" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>In progress</option><option>On track</option><option>At risk</option></select>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("project")}>＋ New project</button>}</div></div><ProjectCards projects={scopedProjects} onOpen={(project) => setSelectedProjectId(project.id)} /></section>)}
    {page === "Quotations" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">PROJECT PROPOSALS</span><h2 className="list-title">{role === "Client" ? "Quotations for you" : "Quotations & add-on work"}</h2></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter quotations" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Awaiting review</option><option>Sent to client</option><option>Approved</option><option>Changes requested</option></select>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("quote")}>＋ New quotation</button>}</div></div><div className="quote-list">{visibleQuotes.filter((item) => filter === "All" || item.status === filter).map((quote) => <article className="quote-row" key={quote.id}><span className="quote-file-icon">▤</span><div className="quote-row-main"><strong>{quote.title}</strong><span>{quote.id} · {quote.project} · {quote.date}</span></div><div className="quote-row-client"><small>CLIENT</small><strong>{quote.client}</strong></div><strong className="quote-row-amount">{formatCurrency(quote.amount)}</strong><StatusBadge status={quote.status} />{role === "Client" && quote.status !== "Approved" && quote.status !== "Declined" ? <div className="inline-actions"><button onClick={() => onQuote(quote, "Approved")}>Approve</button><button onClick={() => onQuote(quote, "Declined")}>Decline</button>{quote.attachment && <QuotationPdfPreview attachment={quote.attachment} title={quote.title} />}</div> : quote.attachment ? <QuotationPdfPreview attachment={quote.attachment} title={quote.title} /> : <button className="icon-button" onClick={() => onToast(`Opening ${quote.id} preview.`)} aria-label={`Open quotation ${quote.id}`}>↗</button>}</article>)}</div></section>}
    {role !== "Client" && page === "Expenses" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">MONEY IN MOTION</span><h2 className="list-title">Expenses & receipts</h2></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter expenses" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Pending review</option><option>Logged</option><option>Approved</option><option>Declined</option><option>Paid</option></select>{role === "Employee" && <><button className="button button-outline" onClick={() => onCreate("expense-log")}>＋ Log expense</button><button className="button button-primary" onClick={() => onCreate("expense")}>＋ Request expense</button></>}</div></div><ExpenseRows expenses={visibleExpenses.filter((item) => filter === "All" || item.status === filter)} detailed onAction={(expense) => {
      if (expense.attachment) window.open(expense.attachment, "_blank", "noopener,noreferrer");
      else onToast(`${expense.id}: ${expense.description} · ${formatCurrency(expense.amount)} · Submitted by ${expense.submittedBy}.`);
    }} onApprove={role === "Owner" ? (expense) => onExpenseStatus(expense, "Approved") : undefined} onDecline={role === "Owner" ? (expense) => onExpenseStatus(expense, "Declined") : undefined} /></section>}
    {page === "Progress Updates" && <section className="panel feature-panel"><div className="feature-intro"><div><span className="panel-kicker">FIELD REPORTING</span><h2>Progress updates</h2><p>Keep owners and clients up to date with work completed on site.</p></div><button className="button button-primary" onClick={() => onCreate("progress")}>＋ Submit daily update</button></div><div className="progress-update-list">{data.activities.filter((item) => item.kind === "progress" && (role !== "Employee" || item.actor === currentUser)).map((item) => <div className="progress-update-row" key={item.id}><span className="update-date"><strong>{item.createdAt ? new Date(item.createdAt).getDate() : "—"}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short" }).toUpperCase() : ""}</small></span><div className="update-body"><strong>{item.description || item.action}</strong><p>{item.project} · {item.actor} · {item.time}</p><span>{item.createdAt ? new Date(item.createdAt).toLocaleString() : item.time}</span></div>{item.attachment && <a className="photo-count" href={item.attachment} target="_blank" rel="noreferrer">View attachment ↗</a>}</div>)}</div></section>}
    {page === "Materials" && <><section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">SITE INVENTORY</span><h2 className="list-title">Materials received & used</h2></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter materials by project" value={materialProjectFilter} onChange={(event) => setMaterialProjectFilter(event.target.value)}><option value="All">All projects</option>{scopedProjects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("material")}>＋ Log materials</button>}{role === "Employee" && <><button className="button button-outline" onClick={() => onCreate("material")}>＋ Log materials</button><button className="button button-primary" onClick={() => onCreate("material-request")}>＋ Request material</button></>}</div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Received</th><th>Used</th><th>In stock</th><th>Last updated</th></tr></thead><tbody>{data.materials.filter((item) => (role !== "Employee" || scopedProjects.some((project) => project.name === item.project)) && (materialProjectFilter === "All" || item.project === materialProjectFilter)).map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.project}</td><td>{item.received}</td><td>{item.used}</td><td>{item.stock}</td><td>{item.lastUpdated}</td></tr>)}</tbody></table></div></section>{role === "Employee" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">REQUEST HISTORY</span><h2 className="list-title">My material requests</h2></div><select className="select-button" aria-label="Filter material requests by status" value={materialRequestStatusFilter} onChange={(event) => setMaterialRequestStatusFilter(event.target.value)}><option value="All">All statuses</option><option>Pending review</option><option>Approved</option><option>Declined</option></select></div>{data.materialRequests.filter((request) => request.requestedBy === currentUser && (materialRequestStatusFilter === "All" || request.status === materialRequestStatusFilter)).length > 0 ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Quantity</th><th>Requested</th><th>Status</th></tr></thead><tbody>{data.materialRequests.filter((request) => request.requestedBy === currentUser && (materialRequestStatusFilter === "All" || request.status === materialRequestStatusFilter)).map((request) => <tr key={request.id}><td>{request.material}</td><td>{request.project}</td><td>{request.quantity}</td><td>{request.requestedAt}</td><td><StatusBadge status={request.status} /></td></tr>)}</tbody></table></div> : <p className="people-empty">No material requests match this filter.</p>}</section>}</>}
    {page === "Attendance" && <AttendancePage data={data} role={role} currentUser={currentUser} onSubmit={onAttendanceSubmit} onRegularize={onAttendanceRegularize} />}
    {page === "Site Visits" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">FIELD SCHEDULE</span><h2 className="list-title">{role === "Employee" ? "My upcoming site visits" : "Engineer site visits"}</h2></div>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("visit")}>＋ Schedule visit</button>}</div><div className="visit-cards">{data.siteVisits.filter((visit) => role !== "Employee" || visit.engineer === currentUser).map((visit) => <article className="visit-card" key={visit.id}><div className="visit-card-date"><span>{visit.date.split(" ")[1]?.slice(0, 3).toUpperCase()}</span><strong>{visit.date.split(" ")[0]}</strong><small>{visit.time}</small></div><div className="visit-card-content"><StatusBadge status={visit.status} /><h3>{visit.project}</h3><p>⌖ {visit.site} · Assigned engineer: {visit.engineer}</p><div className="visit-purpose">Site inspection · Progress verification</div></div>{visit.status === "Scheduled" && role === "Employee" ? <button className="button button-primary" onClick={() => onVisitStatus(visit, "Completed")}>Complete visit</button> : <button className="button button-outline" disabled={visit.status !== "Scheduled"} onClick={() => onVisitStatus(visit, "Completed")}>{visit.status === "Completed" ? "Completed" : "Mark complete"}</button>}</article>)}</div></section>}
    {page === "Reports" && <section className="report-grid"><article className="report-card panel"><span className="report-icon">▥</span><span className="panel-kicker">PROJECT PERFORMANCE</span><h2>Progress report</h2><p>Milestone completion and updates, by project and site.</p><button className="text-link" onClick={() => void downloadReport("progress")}>Generate report ↗</button></article><article className="report-card panel"><span className="report-icon">＄</span><span className="panel-kicker">FINANCIAL HEALTH</span><h2>Expense report</h2><p>Approved, pending, and paid expenses across your portfolio.</p><button className="text-link" onClick={() => void downloadReport("expenses")}>Generate report ↗</button></article><article className="report-card panel"><span className="report-icon">◈</span><span className="panel-kicker">SITE INVENTORY</span><h2>Materials report</h2><p>Material received, consumed, and remaining at every site.</p><button className="text-link" onClick={() => void downloadReport("materials")}>Generate report ↗</button></article></section>}
    {page === "Settings & Backup" && role === "Owner" && <section className="backup-layout"><article className="panel backup-card"><span className="report-icon">↧</span><span className="panel-kicker">ACCOUNT DATA</span><h2>Back up your workspace</h2><p>Download a JSON export of your project, site, quotation, and expense records.</p><ul><li>Project and site summaries</li><li>Quotations and expense records</li><li>Activity and attendance history</li></ul><button className="button button-primary" onClick={onBackup}>＋ Request account backup</button><small>Backups are generated from current workspace data.</small></article><section className="panel backup-history"><div className="panel-heading compact"><div><span className="panel-kicker">RECENT REQUESTS</span><h2>Backup history</h2></div><span className="backup-count">{data.backups.length} requests</span></div><div className="backup-list">{data.backups.map((backup) => <article className="backup-row" key={backup.id}><span className="backup-file">↧</span><div><strong>{backup.id} · Workspace data export</strong><small>Requested by {backup.requestedBy} · {backup.requestedAt}</small></div><button className="button button-outline" onClick={() => void downloadBackup(backup.id)}>Download</button><StatusBadge status={backup.status} /></article>)}</div></section></section>}
    {page === "People" && role === "Owner" && <section className="panel feature-panel">
      {selectedEngineer ? <>
        <div className="list-toolbar"><div><span className="panel-kicker">SITE ENGINEER DETAILS</span><h2 className="list-title">{selectedEngineer.name}</h2></div><button className="button button-outline" onClick={() => setSelectedEngineerId(null)}>← Back to people</button></div>
        <div className="engineer-summary"><span>{selectedEngineer.email}</span><strong>{engineerProjects.length} assigned {engineerProjects.length === 1 ? "site" : "sites"}</strong></div>
        {engineerProjects.length > 0
          ? <div className="engineer-site-list">{engineerProjects.map((project) => {
            const expanded = expandedSiteId === project.id;
            const siteMaterials = data.materials.filter((material) => material.project === project.name);
            return <article className={`engineer-site-card ${expanded ? "engineer-site-expanded" : ""}`} key={project.id}>
              <div className="engineer-site-row">
                <div><strong>{project.name}</strong><span>{project.site} · {project.status}</span></div>
                <button className="icon-button engineer-site-toggle" type="button" aria-label={`${expanded ? "Hide" : "Show"} details for ${project.name}`} aria-expanded={expanded} aria-controls={`site-details-${project.id}`} onClick={() => setExpandedSiteId(expanded ? null : project.id)}>{expanded ? "⌃" : "⌄"}</button>
              </div>
              {expanded && <div className="engineer-site-details" id={`site-details-${project.id}`}>
                <div><span>Budget</span><strong>{formatCurrency(project.budget)}</strong></div>
                <div><span>Assigned engineer</span><strong>{project.engineer}</strong></div>
                <div className="engineer-site-materials"><span>Materials</span>{siteMaterials.length > 0
                  ? <ul>{siteMaterials.map((material) => <li key={material.id}><strong>{material.material}</strong><span>Received {material.received} · Used {material.used} · In stock {material.stock}</span></li>)}</ul>
                  : <p>No materials recorded for this site.</p>}</div>
              </div>}
            </article>;
          })}</div>
          : <p className="people-empty">No sites are currently assigned to this engineer.</p>}
      </> : <>
        <div className="list-toolbar"><div><span className="panel-kicker">YOUR TEAM</span><h2 className="list-title">People</h2></div><button className="button button-primary" onClick={() => onCreate("person")}>＋ Invite a person</button></div>
        <section className="people-section"><h3 className="people-section-title">Site Engineers</h3>{renderPeople(data.people.filter((person) => person.role === "Site Engineer"), true)}</section>
        <section className="people-section"><h3 className="people-section-title">Clients</h3>{renderPeople(data.people.filter((person) => person.role === "Client"))}</section>
      </>}
    </section>}
    {page === "Work Progress" && role === "Client" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">FROM YOUR PROJECT TEAM</span><h2 className="list-title">Work progress</h2><p className="feature-subtitle">Updates and photos shared by your project team.</p></div><label className="work-progress-date-filter">Filter by date<input aria-label="Filter work progress by date" type="date" value={workProgressDate} onChange={(event) => { setWorkProgressDate(event.currentTarget.value); setSelectedWorkProgress(null); }} /></label></div>{clientWorkProgress.length > 0 ? <div className="progress-update-list">{clientWorkProgress.map((item) => <button className="progress-update-row client-work-progress-row" type="button" key={item.id} onClick={() => { setSelectedWorkProgress(item); setWorkProgressPhotoIndex(Math.max(0, clientWorkProgressPhotos.findIndex((photo) => photo.id === item.id))); }}><span className="update-date"><strong>{item.createdAt ? new Date(item.createdAt).getDate() : "—"}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short" }).toUpperCase() : ""}</small></span><span className="update-body"><strong>{item.description || item.action}</strong><span className="client-work-progress-meta">{item.project} · {item.stage ?? "Progress"} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : item.time}</span>{item.attachment && <img className="client-work-progress-thumbnail" src={item.attachment} alt="" />}</span><span className="client-work-progress-open">View photos ↗</span></button>)}</div> : <div className="inline-empty">{workProgressDate ? "No work progress updates were shared on this date." : "Your project team hasn’t shared any work progress updates yet."}</div>}</section>}
    {selectedWorkProgress && <div className="client-progress-gallery-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedWorkProgress(null); }}>
      <section className="client-progress-gallery" role="dialog" aria-modal="true" aria-label={`${activeWorkProgressPhoto?.project ?? selectedWorkProgress.project} progress photos`}>
        <header className="client-progress-gallery-header"><strong>{activeWorkProgressPhoto?.project ?? selectedWorkProgress.project} - Progress Photos</strong><button type="button" aria-label="Close progress photos" onClick={() => setSelectedWorkProgress(null)}>×</button></header>
        <div className="client-progress-gallery-stage">
          {activeWorkProgressPhoto?.attachment
            ? <img src={activeWorkProgressPhoto.attachment} alt={`Progress update: ${activeWorkProgressPhoto.description || activeWorkProgressPhoto.project}`} />
            : <p>No photos are available for this progress update.</p>}
          {clientWorkProgressPhotos.length > 1 && <>
            <button type="button" className="client-progress-gallery-arrow previous" aria-label="Previous progress photo" onClick={() => setWorkProgressPhotoIndex((index) => (index - 1 + clientWorkProgressPhotos.length) % clientWorkProgressPhotos.length)}>‹</button>
            <button type="button" className="client-progress-gallery-arrow next" aria-label="Next progress photo" onClick={() => setWorkProgressPhotoIndex((index) => (index + 1) % clientWorkProgressPhotos.length)}>›</button>
          </>}
        </div>
        <div className="client-progress-gallery-caption">
          <span>{activeWorkProgressPhoto?.description || activeWorkProgressPhoto?.action || selectedWorkProgress.description || selectedWorkProgress.action}</span>
          <small>{clientWorkProgressPhotos.length ? `Image ${workProgressPhotoIndex + 1} of ${clientWorkProgressPhotos.length}` : selectedWorkProgress.project}</small>
        </div>
      </section>
    </div>}
    {page === "Timeline" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">PROJECT ACTIVITY</span><h2 className="list-title">Project timeline & updates</h2></div><StatusBadge status="In progress" /></div><div className="timeline full-timeline">{data.activities.filter((item) => item.kind === "progress" && (role !== "Client" || scopedProjects.some((project) => project.name === item.project))).map((item) => <div className="timeline-item timeline-done" key={item.id}><div className="timeline-marker">✓</div><div className="timeline-date">{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : item.time}</div><div className="timeline-content"><strong>{item.description || item.action}</strong><span>{item.project} · {item.actor}</span></div></div>)}</div></section>}
    {page === "Feedback" && role === "Owner" && <section className="panel feature-panel"><div className="panel-heading compact"><div><span className="panel-kicker">CLIENT VOICE</span><h2>Project feedback & reviews</h2></div><span className="backup-count">{data.feedback.length} reviews</span></div><div className="quote-list">{data.feedback.map((item) => <article className="feedback-review" key={item.id}><span className="avatar">{initials(item.client)}</span><div><div className="review-title"><strong>{item.client}</strong><span className="aside-stars">{"★".repeat(item.rating)}</span></div><p>{item.comment}</p><small>{item.project} · {item.date}</small></div></article>)}</div></section>}
    {page === "Feedback" && role === "Client" && <section className="panel feature-panel feedback-layout"><div><span className="panel-kicker">YOUR VOICE MATTERS</span><h2 className="list-title">Share your review</h2><p className="feature-subtitle">Save your rating and comment for the project owner, then post the same review on Google.</p><form className="feedback-form" onSubmit={onFeedback}><label>Project<select name="project" required defaultValue={scopedProjects[0]?.name}>{scopedProjects.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>Your rating<div className="rating-stars" role="radiogroup" aria-label="Rate your experience">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} aria-label={`${star} stars`} aria-checked={rating === star} role="radio" className={star <= rating ? "star-selected" : ""} onClick={() => setRating(star)}>★</button>)}</div><input type="hidden" name="rating" value={rating} /></label><label>Your review<textarea name="comment" required rows={4} maxLength={2000} placeholder="Share your experience with the project team..." /></label><button className="button button-primary" type="submit" disabled={!scopedProjects.length}>Save review for owner</button></form><a className="button button-outline" href={googleReviewUrl} target="_blank" rel="noreferrer">Post a review on Google ↗</a></div><aside className="feedback-aside"><span>★</span><p>Your saved review will be visible to the project owner. Use the Google button to post it publicly as well.</p><strong>Vanya BuildTrack</strong><small>BuildTrack and Google reviews</small></aside></section>}
    {page === "Instructions" && (isDemoMode()
      ? <section className="panel feature-panel"><div className="panel-heading compact"><div><span className="panel-kicker">FROM YOUR OWNER</span><h2>Site instructions & updates</h2></div></div><div className="instruction-list"><article><span className="instruction-pin">?</span><div><StatusBadge status="Action required" /><h3>Ground-floor slab inspection</h3><p>Please complete the slab inspection before the next concrete pour. Upload the checklist photos once the review is done.</p><span>John Smith ? Riverside Residence ? 24 Oct, 4:18 PM</span></div></article><article><span className="instruction-pin">?</span><div><StatusBadge status="Read" /><h3>Delivery schedule update</h3><p>Steel delivery is confirmed for Tuesday morning. Please ensure the unloading area is clear.</p><span>John Smith ? Northstar Office Campus ? 23 Oct, 10:42 AM</span></div></article></div></section>
      : <section className="panel feature-panel"><p className="people-empty">No owner instructions have been shared yet.</p></section>)}
    {personPendingDeletion && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPersonPendingDeletion(null); }}>
      <section className="modal-card delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description">
        <div className="modal-heading"><div><span className="panel-kicker">CONFIRM DELETE</span><h2 id="delete-confirm-title">Remove {personPendingDeletion.name}?</h2></div><button className="icon-button modal-close" aria-label="Cancel delete" onClick={() => setPersonPendingDeletion(null)}>×</button></div>
        <p id="delete-confirm-description">This will remove this person from your team list. This action cannot be undone.</p>
        <div className="modal-actions"><button className="button button-outline" onClick={() => setPersonPendingDeletion(null)}>Cancel</button><button className="button button-danger" onClick={() => { const person = personPendingDeletion; setPersonPendingDeletion(null); if (selectedEngineerId === person.id) setSelectedEngineerId(null); onRemovePerson(person); }}>Delete person</button></div>
      </section>
    </div>}
  </div>;
}
