import type { DashboardData, Project } from "./types";
import { formatCurrency } from "./utils";
import { StatusBadge } from "./components";
import { QuotationPdfPreview } from "./quotation-pdf-preview";

export function ProjectDetails({ project, data, onBack }: { project: Project; data: DashboardData; onBack: () => void }) {
  const materials = data.materials.filter((item) => item.project === project.name);
  const quotations = data.quotes.filter((item) => item.project === project.name);
  const expenses = data.expenses.filter((item) => item.project === project.name);
  const activities = data.activities.filter((item) => item.project === project.name && item.kind === "progress");
  const visits = data.siteVisits.filter((item) => item.project === project.name);

  return <section className="panel project-details">
    <div className="list-toolbar">
      <div><span className="panel-kicker">PROJECT DETAILS</span><h2 className="list-title">{project.name}</h2></div>
      <button className="button button-outline" onClick={onBack}>← Back to projects</button>
    </div>
    <div className="project-details-overview">
      <div><span>Project location</span><strong>{project.site}</strong></div>
      <div><span>Assigned engineer</span><strong>{project.engineer}</strong></div>
      <div><span>Status</span><StatusBadge status={project.status} /></div>
      <div><span>Progress</span><strong>{project.progress}%</strong></div>
      <div><span>Quotation</span><strong>{formatCurrency(project.quotationAmount ?? 0)}</strong></div>
      <div><span>Budget</span><strong>{formatCurrency(project.budget)}</strong></div>
      <div><span>Spent</span><strong>{formatCurrency(project.spent)}</strong></div>
      <div><span>Due date</span><strong>{project.dueDate}</strong></div>
    </div>

    <div className="project-details-sections">
      <section><h3>Materials</h3>{materials.length > 0
        ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Received</th><th>Used</th><th>In stock</th></tr></thead><tbody>{materials.map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.received}</td><td>{item.used}</td><td>{item.stock}</td></tr>)}</tbody></table></div>
        : <p className="project-details-empty">No materials recorded for this project.</p>}</section>
      <section><h3>Quotations</h3>{quotations.length > 0
        ? <div className="project-details-list">{quotations.map((item) => <article key={item.id}><div><strong>{item.title}</strong><span>{item.id} · {item.date}</span></div><strong>{formatCurrency(item.amount)}</strong><StatusBadge status={item.status} />{item.attachment && <QuotationPdfPreview attachment={item.attachment} title={item.title} />}</article>)}</div>
        : <p className="project-details-empty">No additional quotations recorded.</p>}</section>
      <section><h3>Expenses</h3>{expenses.length > 0
        ? <div className="project-details-list">{expenses.map((item) => <article key={item.id}><div><strong>{item.description}</strong><span>{item.date} · {item.submittedBy}</span></div><strong>{formatCurrency(item.amount)}</strong><StatusBadge status={item.status} /></article>)}</div>
        : <p className="project-details-empty">No expenses recorded for this project.</p>}</section>
      <section><h3>Progress updates</h3>{activities.length > 0
        ? <div className="project-details-list">{activities.map((item) => <article key={item.id}><div><strong>{item.description || item.action}</strong><span>{item.actor} · {item.time}</span></div></article>)}</div>
        : <p className="project-details-empty">No progress updates recorded.</p>}</section>
      <section><h3>Site visits</h3>{visits.length > 0
        ? <div className="project-details-list">{visits.map((item) => <article key={item.id}><div><strong>{item.date} · {item.time}</strong><span>{item.site} · {item.engineer}</span></div><StatusBadge status={item.status} /></article>)}</div>
        : <p className="project-details-empty">No site visits scheduled.</p>}</section>
    </div>
  </section>;
}
