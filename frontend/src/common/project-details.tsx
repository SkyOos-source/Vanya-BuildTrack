import { useEffect, useState } from "react";
import type { DashboardData, Project, ProjectContact, Role } from "./types";
import { formatCurrency, googleReviewUrl, isLoggedExpense } from "./utils";
import { ExpenseRows, StatusBadge } from "./components";
import { QuotationPdfPreview } from "./quotation-pdf-preview";

export function ProjectDetails({ project, data, role, currentUser, ownerContacts, ownerContactsError, onBack, onEdit, onCreate }: { project: Project; data: DashboardData; role: Role; currentUser: string; ownerContacts?: ProjectContact[] | null; ownerContactsError?: string; onBack: () => void; onEdit?: (project: Project) => void; onCreate?: (modal: "payment" | "expense-log", project: Project) => void }) {
  const [showCompletionReport, setShowCompletionReport] = useState(false);
  const [completionReportGeneratedAt, setCompletionReportGeneratedAt] = useState<Date | null>(null);
  useEffect(() => {
    if (!showCompletionReport || project.progress < 100) return;
    const previousTitle = document.title;
    document.title = `${project.name} - Project Completion Report`;
    return () => { document.title = previousTitle; };
  }, [showCompletionReport, project.name, project.progress]);
  const quotations = data.quotes.filter((item) => item.project === project.name);
  const projectPayments = data.payments.filter((item) => item.project === project.name);
  const totalPayments = projectPayments.reduce((total, payment) => total + payment.amount, 0);
  const projectExpenses = data.expenses.filter((item) => item.project === project.name);
  const loggedProjectExpenses = projectExpenses.filter(isLoggedExpense);
  const totalProjectExpenses = loggedProjectExpenses.reduce((total, expense) => total + expense.amount, 0);
  const displayedQuotationAmount = quotations.length > 0
    ? quotations.reduce((total, quotation) => total + quotation.amount, 0)
    : project.quotationAmount ?? 0;
  const assignedEngineer = data.people.find((person) => person.role === "Site Engineer" && person.name === project.engineer);
  const assignedClient = data.people.find((person) =>
    person.role === "Client"
    && (person.project === project.name || person.name === project.client)
  );
  const assignedClientName = assignedClient?.name || (project.client !== "Unassigned" ? project.client : "No client assigned");
  const projectActivities = data.activities
    .filter((item) => item.project === project.name && item.kind === "progress")
    .sort((left, right) => {
      const leftTime = left.createdAt ? Date.parse(left.createdAt) : Number.NaN;
      const rightTime = right.createdAt ? Date.parse(right.createdAt) : Number.NaN;
      if (!Number.isFinite(leftTime)) return Number.isFinite(rightTime) ? 1 : 0;
      if (!Number.isFinite(rightTime)) return -1;
      return leftTime - rightTime;
    });
  const photosForUpdate = (activity: (typeof projectActivities)[number]) =>
    activity.attachments?.length ? activity.attachments : activity.attachment ? [activity.attachment] : [];
  const updatesWithPhotos = projectActivities.filter((activity) => photosForUpdate(activity).length > 0);
  const startingUpdate = updatesWithPhotos.find((activity) => activity.stage === "Start") ?? updatesWithPhotos[0];
  const completionUpdate = [...updatesWithPhotos].reverse().find((activity) => activity.stage === "Completion") ??
    updatesWithPhotos[updatesWithPhotos.length - 1];
  const completionSummaryUpdate = [...projectActivities].reverse().find((activity) => activity.completionSummary) ??
    [...projectActivities].reverse().find((activity) => activity.stage === "Completion") ??
    projectActivities[projectActivities.length - 1];
  const completionReportId = `VBT-${project.id}-${completionReportGeneratedAt?.getTime().toString(36).toUpperCase() ?? "FINAL"}`;
  const formatPhotoDate = (createdAt?: string) => createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "Date not recorded";
  if (showCompletionReport && project.progress >= 100) {
    return <section className="panel completion-report">
      <header className="completion-report-brand">
        <div className="completion-report-brand-name">
          <img src="/buildtrack-logo-transparent.png" alt="" />
          <div><strong>Vanya BuildTrack</strong><span>Project completion report</span></div>
        </div>
        <dl>
          <div><dt>Report ID</dt><dd>{completionReportId}</dd></div>
          <div><dt>Generated</dt><dd>{completionReportGeneratedAt?.toLocaleString() ?? "Just now"}</dd></div>
        </dl>
      </header>
      <div className="list-toolbar completion-report-toolbar">
        <div><span className="panel-kicker">PROJECT COMPLETION</span><h2 className="list-title">{project.name} · Final report</h2></div>
        <div className="toolbar-actions">
          <button className="button button-primary" type="button" onClick={() => window.print()}>Export PDF</button>
          <button className="button button-outline" onClick={() => setShowCompletionReport(false)}>Back to project</button>
        </div>
      </div>
      <p className="completion-report-intro">This project has reached 100% completion. Use Export PDF and choose “Save as PDF” in your browser’s print dialog. All photos from the first and last photo updates are included; explicitly marked start and completion updates take priority.</p>
      <div className="completion-report-overview">
        <div><span>Project</span><strong>{project.name}</strong></div>
        <div><span>Site</span><strong>{project.site}</strong></div>
        <div><span>Client</span><strong>{project.client}</strong></div>
        <div><span>Report prepared for</span><strong>{currentUser}</strong></div>
        <div><span>Site engineer</span><strong>{project.engineer}</strong></div>
        <div><span>Project manager</span><strong>{project.projectManager || "Not assigned"}</strong></div>
        <div><span>Completion status</span><strong>Completed · {project.progress}%</strong></div>
        <div><span>Started</span><strong>{startingUpdate ? formatPhotoDate(startingUpdate.createdAt) : "Date not recorded"}</strong></div>
        <div><span>Completed</span><strong>{completionUpdate ? formatPhotoDate(completionUpdate.createdAt) : "Date not recorded"}</strong></div>
        <div><span>Due date</span><strong>{project.dueDate || "Not recorded"}</strong></div>
      </div>
      <section className="completion-report-summary">
        <span className="panel-kicker">COMPLETION SUMMARY</span>
        <p>{completionSummaryUpdate?.completionSummary || completionSummaryUpdate?.description || "No completion summary was provided."}</p>
        {completionSummaryUpdate && <small>{completionSummaryUpdate.stage === "Completion" ? "Completion update" : "Latest progress update"} · {formatPhotoDate(completionSummaryUpdate.createdAt)} · {completionSummaryUpdate.actor}</small>}
      </section>
      <section className="completion-report-photos" aria-label="Before and after site photos">
        {[
          { title: "Starting site condition", update: startingUpdate },
          { title: "Completed site condition", update: completionUpdate }
        ].map(({ title, update }) => <article className="completion-photo-card" key={title}>
          <h3>{title}</h3>
          {update
            ? <><div className="completion-photo-images">{photosForUpdate(update).map((photo, index) =>
                <a href={photo} target="_blank" rel="noreferrer" key={`${update.id}-${index}`}>
                  <img src={photo} alt={`${title} photo ${index + 1} at ${project.site}`} />
                </a>
              )}</div><small>{formatPhotoDate(update.createdAt)} · {update.actor}</small></>
            : <p className="project-details-empty">No site photo was uploaded for this stage.</p>}
        </article>)}
      </section>
      {startingUpdate && completionUpdate && startingUpdate.id === completionUpdate.id && <p className="completion-photo-note">Only one progress update with photos is available, so its photos appear for both stages. Upload separate start and completion updates for a clearer comparison.</p>}
      {role === "Client" && <section className="completion-review">
        <div><span className="panel-kicker">SHARE YOUR EXPERIENCE</span><h3>How was your project?</h3><p>Rate our work and share your experience on Google.</p></div>
        <a className="button button-primary" href={googleReviewUrl} target="_blank" rel="noreferrer">Leave a Google review ↗</a>
      </section>}
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
        {project.progress >= 100 && <button className="button button-primary" type="button" onClick={() => { setCompletionReportGeneratedAt(new Date()); setShowCompletionReport(true); }}>View completion report</button>}
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
      {(role === "Owner" || role === "ProjectManager") && <div className="project-cash-summary">
        <article>
          <span>Total amount in</span>
          <strong>{formatCurrency(totalPayments)}</strong>
          <small>{projectPayments.length} {projectPayments.length === 1 ? "payment" : "payments"} received</small>
        </article>
        <article>
          <span>Total amount out</span>
          <strong>{formatCurrency(totalProjectExpenses)}</strong>
          <small>{loggedProjectExpenses.length} {loggedProjectExpenses.length === 1 ? "expense" : "expenses"} logged</small>
        </article>
      </div>}
      <section className="project-financial-section"><div className="list-toolbar"><div><span className="panel-kicker">PROJECT CASH FLOW</span><h3>Payments</h3><span className="project-payment-total">{formatCurrency(totalPayments)} received · {projectPayments.length} {projectPayments.length === 1 ? "payment" : "payments"}</span></div>{(role === "Owner" || role === "ProjectManager") && onCreate && <button className="button button-primary" type="button" onClick={() => onCreate("payment", project)}>＋ Add payment</button>}</div>{projectPayments.length
        ? <div className="project-details-list">{projectPayments.map((payment) => <article className="project-payment-row" key={payment.id}><div><strong>{formatCurrency(payment.amount)} · {payment.method}</strong><span>{payment.date} · Recorded by {payment.recordedBy} ({payment.recordedByRole}){payment.note ? ` · ${payment.note}` : ""}</span></div>{payment.proofImage && <a className="project-payment-proof" href={payment.proofImage} target="_blank" rel="noreferrer"><img src={payment.proofImage} alt={`Online payment proof uploaded by ${payment.recordedBy}`} />View proof</a>}</article>)}</div>
        : <p className="project-details-empty">No payments have been recorded for this project yet.</p>}</section>
      {(role === "Owner" || role === "ProjectManager") && <section className="project-financial-section project-expense-section">
        <div className="list-toolbar">
          <div><span className="panel-kicker">PROJECT COSTS</span><h3>Expenses</h3><span className="project-payment-total">{formatCurrency(totalProjectExpenses)} logged · {loggedProjectExpenses.length} {loggedProjectExpenses.length === 1 ? "expense" : "expenses"}</span></div>
          {onCreate && <button className="button button-primary" type="button" onClick={() => onCreate("expense-log", project)}>＋ Add expense</button>}
        </div>
        {loggedProjectExpenses.length
          ? <ExpenseRows expenses={loggedProjectExpenses} detailed />
          : <p className="project-details-empty">No expenses have been logged for this project yet.</p>}
      </section>}
    </div>
  </section>;
}
