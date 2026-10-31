import { useState } from "react";
import type { DashboardData, Project, Role } from "./types";
import { formatCurrency, googleReviewUrl } from "./utils";
import { StatusBadge } from "./components";
import { QuotationPdfPreview } from "./quotation-pdf-preview";

export function ProjectDetails({ project, data, role, currentUser, onBack }: { project: Project; data: DashboardData; role: Role; currentUser: string; onBack: () => void }) {
  const [showCompletionReport, setShowCompletionReport] = useState(false);
  const materials = data.materials.filter((item) => item.project === project.name);
  const quotations = data.quotes.filter((item) => item.project === project.name);
  const displayedQuotationAmount = quotations.length > 0
    ? quotations.reduce((total, quotation) => total + quotation.amount, 0)
    : project.quotationAmount ?? 0;
  const expenses = data.expenses.filter((item) => item.project === project.name);
  const assignedEngineer = data.people.find((person) => person.role === "Site Engineer" && person.name === project.engineer);
  const activities = data.activities.filter((item) => item.project === project.name && item.kind === "progress");
  const sitePhotos = activities
    .flatMap((item) => (item.attachments?.length ? item.attachments : item.attachment ? [item.attachment] : [])
      .map((attachment, index) => ({ ...item, id: `${item.id}-${index}`, attachment })))
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;
      if (!Number.isFinite(leftTime)) return Number.isFinite(rightTime) ? 1 : 0;
      if (!Number.isFinite(rightTime)) return -1;
      return leftTime - rightTime;
    });
  const startingPhoto = sitePhotos.find((item) => item.stage === "Start") ?? sitePhotos[0];
  const completionPhotos = sitePhotos.filter((item) => item.stage === "Completion");
  const completionPhoto = completionPhotos[completionPhotos.length - 1] ?? sitePhotos[sitePhotos.length - 1];
  const formatPhotoDate = (createdAt?: string) => createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "Date not recorded";
  if (showCompletionReport && role === "Client" && project.progress >= 100) {
    return <section className="panel completion-report">
      <div className="list-toolbar completion-report-toolbar">
        <div><span className="panel-kicker">PROJECT COMPLETION</span><h2 className="list-title">{project.name} · Final report</h2></div>
        <div className="toolbar-actions">
          <button className="button button-outline" onClick={() => window.print()}>Print / Save report</button>
          <button className="button button-outline" onClick={() => setShowCompletionReport(false)}>Back to project</button>
        </div>
      </div>
      <p className="completion-report-intro">The project has reached 100% completion. Compare the site photos marked for project start and completion. If a stage was not marked, the earliest or latest available photo is shown.</p>
      <div className="completion-report-overview">
        <div><span>Project</span><strong>{project.name}</strong></div>
        <div><span>Site</span><strong>{project.site}</strong></div>
        <div><span>Client</span><strong>{currentUser}</strong></div>
        <div><span>Completion</span><strong>{project.progress}%</strong></div>
        {role !== "Client" && <div><span>Project value</span><strong>{formatCurrency(project.budget)}</strong></div>}
        <div><span>Engineer</span><strong>{project.engineer}</strong></div>
      </div>
      <section className="completion-report-photos" aria-label="Before and after site photos">
        {[
          { title: "Starting site condition", photo: startingPhoto },
          { title: "Completed site condition", photo: completionPhoto }
        ].map(({ title, photo }) => <article className="completion-photo-card" key={title}>
          <h3>{title}</h3>
          {photo?.attachment
            ? <><a href={photo.attachment} target="_blank" rel="noreferrer"><img src={photo.attachment} alt={`${title} at ${project.site}`} /></a><p>{photo.description || photo.action}</p><small>{formatPhotoDate(photo.createdAt)} · {photo.actor}</small></>
            : <p className="project-details-empty">No site photo was uploaded for this stage.</p>}
        </article>)}
      </section>
      {startingPhoto && completionPhoto && startingPhoto.id === completionPhoto.id && <p className="completion-photo-note">Only one site photo is available, so it appears for both stages. Ask your site team to upload separate start and completion photos for a clearer comparison.</p>}
      <section className="completion-review">
        <div><span className="panel-kicker">SHARE YOUR EXPERIENCE</span><h3>How was your project?</h3><p>Rate our work and share your experience on Google.</p></div>
        <a className="button button-primary" href={googleReviewUrl} target="_blank" rel="noreferrer">Leave a Google review ↗</a>
      </section>
    </section>;
  }
  const visits = data.siteVisits.filter((item) => item.project === project.name);

  return <section className="panel project-details">
    <div className="list-toolbar">
      <div><span className="panel-kicker">PROJECT DETAILS</span><h2 className="list-title">{project.name}</h2></div>
      <div className="toolbar-actions">
        {role === "Client" && project.progress >= 100 && <button className="button button-primary" onClick={() => setShowCompletionReport(true)}>Get the project report</button>}
        <button className="button button-outline" onClick={onBack}>← Back to projects</button>
      </div>
    </div>
    <div className="project-details-overview">
      <div><span>Project location</span><strong>{project.site}</strong></div>
      <div><span>Assigned engineer</span><strong>{project.engineer}</strong>{role === "Client" && assignedEngineer?.phone && <a href={`tel:${assignedEngineer.phone}`}>{assignedEngineer.phone}</a>}</div>
      <div><span>Status</span><StatusBadge status={project.status} /></div>
      <div><span>Progress</span><strong>{project.progress}%</strong></div>
      <div><span>Quotation</span><strong>{formatCurrency(role === "Client" ? displayedQuotationAmount : project.quotationAmount ?? 0)}</strong></div>
      {role !== "Client" && <>
        <div><span>Budget</span><strong>{formatCurrency(project.budget)}</strong></div>
        <div><span>Spent</span><strong>{formatCurrency(project.spent)}</strong></div>
      </>}
      <div><span>Due date</span><strong>{project.dueDate}</strong></div>
    </div>

    <div className="project-details-sections">
      {role !== "Client" && <section><h3>Materials</h3>{materials.length > 0
        ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Received</th><th>Used</th><th>In stock</th></tr></thead><tbody>{materials.map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.received}</td><td>{item.used}</td><td>{item.stock}</td></tr>)}</tbody></table></div>
        : <p className="project-details-empty">No materials recorded for this project.</p>}</section>}
      <section><h3>Quotations</h3>{quotations.length > 0
        ? <div className="project-details-list">{quotations.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.id} · {item.date}</span></div><strong>{formatCurrency(item.amount)}</strong><StatusBadge status={item.status} />{item.attachment && <QuotationPdfPreview attachment={item.attachment} title={item.title} />}</article>)}</div>
        : <p className="project-details-empty">No additional quotations recorded.</p>}</section>
      {role !== "Client" && <section><h3>Expenses</h3>{expenses.length > 0
        ? <div className="project-details-list">{expenses.map((item) => <article key={item.id}><div><strong>{item.description}</strong><span>{item.date} · {item.submittedBy}</span></div><strong>{formatCurrency(item.amount)}</strong><StatusBadge status={item.status} /></article>)}</div>
        : <p className="project-details-empty">No expenses recorded for this project.</p>}</section>}
      {role !== "Client" && <section><h3>Progress updates</h3>{activities.length > 0
        ? <div className="project-details-list">{activities.map((item) => {
          const photos = item.attachments?.length ? item.attachments : item.attachment ? [item.attachment] : [];
          return <article key={item.id}><div><strong>{item.description || item.action}</strong><span>{item.actor} · {item.time}</span>{photos.map((attachment, index) => <a key={`${item.id}-photo-${index}`} href={attachment} target="_blank" rel="noreferrer"><img className="client-work-progress-thumbnail" src={attachment} alt={`Progress photo ${index + 1} for ${item.project}`} /></a>)}</div></article>;
        })}</div>
        : <p className="project-details-empty">No progress updates recorded.</p>}</section>}
      <section><h3>Site visits</h3>{visits.length > 0
        ? <div className="project-details-list">{visits.map((item) => <article key={item.id}><div><strong>{item.date} · {item.time}</strong><span>{item.site} · {item.engineer}</span></div><StatusBadge status={item.status} /></article>)}</div>
        : <p className="project-details-empty">No site visits scheduled.</p>}</section>
    </div>
  </section>;
}
