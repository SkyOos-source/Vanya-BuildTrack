import { useState } from "react";
import type { DashboardData, Project, ProjectContact, Role } from "./types";
import { formatCurrency, googleReviewUrl } from "./utils";
import { StatusBadge } from "./components";
import { QuotationPdfPreview } from "./quotation-pdf-preview";

export function ProjectDetails({ project, data, role, currentUser, ownerContacts, ownerContactsError, onBack, onEdit, onCreate }: { project: Project; data: DashboardData; role: Role; currentUser: string; ownerContacts?: ProjectContact[] | null; ownerContactsError?: string; onBack: () => void; onEdit?: (project: Project) => void; onCreate?: (modal: "payment", project: Project) => void }) {
  const [showCompletionReport, setShowCompletionReport] = useState(false);
  const quotations = data.quotes.filter((item) => item.project === project.name);
  const projectPayments = data.payments.filter((item) => item.project === project.name);
  const totalPayments = projectPayments.reduce((total, payment) => total + payment.amount, 0);
  const displayedQuotationAmount = quotations.length > 0
    ? quotations.reduce((total, quotation) => total + quotation.amount, 0)
    : project.quotationAmount ?? 0;
  const paymentQuotationCents = Math.round(displayedQuotationAmount * 100);
  const paymentProgress = paymentQuotationCents > 0
    ? Math.min(100, Math.floor(Math.round(totalPayments * 100) / paymentQuotationCents * 100))
    : 0;
  const assignedEngineer = data.people.find((person) => person.role === "Site Engineer" && person.name === project.engineer);
  const assignedClient = data.people.find((person) =>
    person.role === "Client"
    && (person.project === project.name || person.name === project.client)
  );
  const assignedClientName = assignedClient?.name || (project.client !== "Unassigned" ? project.client : "No client assigned");
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
  const coverImageUrl = project.image
    ? project.image.startsWith("data:")
      ? project.image
      : `https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=1200&q=80`
    : undefined;

  return <section className="panel project-details">
    <div className="list-toolbar">
      <div><span className="panel-kicker">PROJECT DETAILS</span><h2 className="list-title">{project.name}</h2></div>
      <div className="toolbar-actions">
        {role === "Client" && project.progress >= 100 && <button className="button button-primary" onClick={() => setShowCompletionReport(true)}>Get the project report</button>}
        {(role === "Owner" || role === "ProjectManager") && onEdit && <button className="button button-outline" onClick={() => onEdit(project)}>Edit details</button>}
        <button className="button button-outline" onClick={onBack}>← Back to projects</button>
      </div>
    </div>
    {coverImageUrl
      ? <div className="project-details-cover" style={{ backgroundImage: `linear-gradient(0deg, rgba(33,30,28,.78), transparent 72%), url("${coverImageUrl}")` }}>
          <div><h3>{project.name}</h3><span>⌖ {project.site}</span></div>
        </div>
      : <div className="project-details-cover project-details-cover-placeholder">
          <div><h3>{project.name}</h3><span>⌖ {project.site}</span></div>
        </div>}
    <div className="project-details-overview">
      <div><span>Project location</span><strong>{project.site}</strong></div>
      {role === "Client"
        ? ownerContacts?.length
          ? ownerContacts.map((owner, index) => <div key={owner.id || `${owner.name}-${index}`}><span>Owner contact</span><strong>{owner.name}</strong>{owner.phone && <a href={`tel:${owner.phone}`}>{owner.phone}</a>}</div>)
          : <div><span>Owner contact</span><strong>{ownerContactsError ? "Unable to load owner contacts" : ownerContacts === null ? "Loading owner contacts…" : "No owner contacts available"}</strong>{ownerContactsError && <small role="alert">{ownerContactsError}</small>}</div>
        : <div><span>Client</span><strong>{assignedClientName}</strong>{assignedClient?.phone && <a href={`tel:${assignedClient.phone}`}>{assignedClient.phone}</a>}</div>}
      {(role === "Owner" || role === "ProjectManager") && <div>
        <span>Assigned engineer</span>
        <strong>{project.engineer !== "Unassigned" ? project.engineer : "No engineer assigned"}</strong>
        {assignedEngineer?.phone && <a href={`tel:${assignedEngineer.phone}`}>{assignedEngineer.phone}</a>}
      </div>}
      {role === "Client" && <div>
        <span>Engineer contact</span>
        <strong>{project.engineer !== "Unassigned" ? assignedEngineer?.name ?? project.engineer : "No engineer assigned"}</strong>
        {assignedEngineer?.phone && <a href={`tel:${assignedEngineer.phone}`}>{assignedEngineer.phone}</a>}
      </div>}
      {role === "Client" && <div><span>Progress</span><strong>{project.progress}%</strong></div>}
      <div><span>Quotation</span><strong>{formatCurrency(displayedQuotationAmount)}</strong></div>
    </div>

    <div className="project-details-sections">
      <section><h3>Quotations</h3>{quotations.length > 0
        ? <div className="project-details-list">{quotations.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.id} · {item.date}</span></div><strong>{formatCurrency(item.amount)}</strong><StatusBadge status={item.status} />{item.attachment && <QuotationPdfPreview attachment={item.attachment} title={item.title} />}</article>)}</div>
        : <p className="project-details-empty">No additional quotations recorded.</p>}</section>
      <section><div className="list-toolbar"><div><h3>Project payments</h3><span className="project-payment-total">{formatCurrency(totalPayments)} recorded · {paymentProgress}% of quotation paid · {projectPayments.length} {projectPayments.length === 1 ? "payment" : "payments"}</span><div className="payment-progress-track" role="progressbar" aria-label="Project quotation payment progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={paymentProgress}><span style={{ width: `${paymentProgress}%` }} /></div></div>{role !== "Employee" && onCreate && <button className="button button-primary" type="button" onClick={() => onCreate("payment", project)}>＋ Add payment</button>}</div>{projectPayments.length
        ? <div className="project-details-list">{projectPayments.map((payment) => <article className="project-payment-row" key={payment.id}><div><strong>{formatCurrency(payment.amount)} · {payment.method}</strong><span>{payment.date} · Recorded by {payment.recordedBy} ({payment.recordedByRole}){payment.note ? ` · ${payment.note}` : ""}</span></div>{payment.proofImage && <a className="project-payment-proof" href={payment.proofImage} target="_blank" rel="noreferrer"><img src={payment.proofImage} alt={`Online payment proof uploaded by ${payment.recordedBy}`} />View proof</a>}</article>)}</div>
        : <p className="project-details-empty">No payments have been recorded for this project yet.</p>}</section>
    </div>
  </section>;
}
