import type { FormEvent } from "react";
import type { Expense, Person, Project, RecordModalType } from "./types";
import { formatCurrency } from "./utils";

export function ProjectCards({ projects, onOpen }: { projects: Project[]; onOpen: (project: Project) => void }) {
  if (!projects.length) return <div className="inline-empty">No projects match this search. Try another name or status.</div>;
  return <div className="project-cards">{projects.map((project) => <button className="portfolio-card" key={project.id} onClick={() => onOpen(project)}><div className="portfolio-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(33,30,28,.78), transparent 72%), url(https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=700&q=80)` }}><span className="portfolio-id">{project.id}</span><span className="portfolio-status"><i /> {project.status}</span><div className="portfolio-title"><h3>{project.name}</h3><span>⌖ {project.site}</span></div></div><div className="portfolio-details"><div className="portfolio-progress"><span>Progress</span><strong>{project.progress}%</strong></div><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><div className="portfolio-foot"><span>Budget <strong>{formatCurrency(project.budget)}</strong></span><span>Due <strong>{project.dueDate}</strong></span></div></div></button>)}</div>;
}

export function ExpenseRows({ expenses, detailed = false, onAction }: { expenses: Expense[]; detailed?: boolean; onAction?: (expense: Expense) => void }) {
  if (!expenses.length) return <div className="inline-empty">No expenses to show yet.</div>;
  return <div className={`expense-list ${detailed ? "expense-list-detailed" : ""}`}>{expenses.map((expense) => <div className="expense-row" key={expense.id}><span className={`expense-icon ${expense.category === "Labour" ? "expense-labour" : ""}`}>{expense.category === "Materials" ? "◈" : expense.category === "Labour" ? "♙" : "▧"}</span><div className="expense-main"><strong>{expense.description}</strong><span>{expense.project} · {expense.submittedBy}</span></div><time>{expense.date.split(" ").slice(0, 2).join(" ")}</time><strong className="expense-amount">{formatCurrency(expense.amount)}</strong><StatusBadge status={expense.status} />{detailed && <button className="text-link receipt-action" onClick={() => onAction?.(expense)}>{expense.status === "Pending review" && onAction ? "Review" : "Receipt"} ↗</button>}</div>)}</div>;
}

export function StatCard({ label, value, note, icon, trend, attention = false }: { label: string; value: string; note: string; icon: string; trend: string; attention?: boolean }) {
  return <article className={`stat-card ${attention ? "stat-attention" : ""}`}><div className="stat-card-head"><span className="stat-label">{label}</span><span className={`stat-icon ${attention ? "stat-icon-orange" : ""}`}>{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span><div className={`stat-trend ${attention ? "trend-attention" : ""}`}><i />{trend}</div></article>;
}

export function StatusBadge({ status }: { status: string }) {
  const className = status.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return <span className={`status-badge status-${className}`}>{status}</span>;
}

export function RecordModal({ modal, projects, people, onClose, onSubmit }: { modal: RecordModalType; projects: Project[]; people: Person[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const title = modal === "project" ? "Create a project" : modal === "quote" ? "New quotation" : modal === "progress" ? "Daily progress update" : modal === "expense" ? "Submit an expense" : modal === "visit" ? "Schedule a site visit" : modal === "material" ? "Log materials" : "Invite a person";
  const label = modal === "project" ? "Project name" : modal === "quote" ? "Quotation title" : modal === "progress" ? "What did you complete today?" : modal === "expense" ? "Expense description" : modal === "visit" ? "Visit purpose" : modal === "material" ? "Material" : "Full name";
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="panel-kicker">BUILDTRACK WORKSPACE</span><h2 id="modal-title">{title}</h2></div><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>×</button></div><form onSubmit={onSubmit}>
    {modal !== "material" && modal !== "person" && <label>{modal === "project" ? "Project Name" : label}<input name={modal === "quote" ? "title" : modal === "progress" || modal === "expense" || modal === "visit" ? "description" : "name"} required placeholder={modal === "project" ? "e.g. Lakeside Residence" : modal === "quote" ? "e.g. Add-on work — kitchen island" : modal === "progress" ? "Describe work completed at site..." : modal === "expense" ? "e.g. Concrete delivery · 8 m³" : modal === "visit" ? "e.g. Foundation inspection" : "e.g. M25 concrete"}/></label>}
    {(modal === "material" || modal === "quote" || modal === "expense" || modal === "progress" || modal === "visit") && <label>Project<select name="project" required defaultValue={projects[0]?.name}>{projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select></label>}
    {modal === "project" && <><label>Project location<input name="site" required placeholder="e.g. Whitefield, Bengaluru" /></label><label>Assign engineer<select name="engineer" required defaultValue=""><option value="" disabled>Select a site engineer</option>{people.filter((person) => person.role === "Site Engineer").map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></label><label>Quotation (INR)<input name="quotationAmount" type="number" min="0" required placeholder="0" /></label><label>Budget (INR)<input name="budget" type="number" min="0" required placeholder="0" /></label></>}
    {modal === "quote" && <label>Upload quotation<input name="quotationFile" type="file" accept="application/pdf,.pdf" /></label>}
    {modal === "person" && <><label>Full name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Role<select name="role"><option>Site Engineer</option><option>Client</option></select></label><label>Project / assignment (optional for site engineers)<input name="project" placeholder="Project or assignment" /></label></>}
    {modal === "material" && <><label>Material name<input name="material" required placeholder="e.g. M25 ready-mix concrete" /></label><label>Received quantity<input name="received" required placeholder="e.g. 12 m³" /></label><label>Used quantity<input name="used" defaultValue="0" /></label><label>Remaining stock<input name="stock" placeholder="Defaults to received quantity" /></label></>}
    {(modal === "quote" || modal === "expense") && <label>Amount (INR)<input name="amount" type="number" min="0" required placeholder="0" /></label>}
    {modal === "visit" && <><label>Engineer<select name="engineer"><option>Arjun Mehta</option><option>Priya Nair</option><option>Dev Patel</option></select></label><label>Date and time<input name="date" type="datetime-local" required /></label></>}
    {(modal === "progress" || modal === "expense") && <label>Photos or receipt<input name="attachment" type="file" accept="image/*,.pdf" /></label>}
    <div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">{modal === "progress" ? "Submit update" : modal === "expense" ? "Submit expense" : modal === "visit" ? "Schedule visit" : modal === "quote" ? "Save quotation" : modal === "material" ? "Save material" : modal === "person" ? "Add person" : "Create project"}</button></div></form></section></div>;
}

export function BuildingIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V5.5L12 2l8 3.5V21M2 21h20M8 8h1m-1 4h1m-1 4h1m6-8h1m-1 4h1m-1 4h1m-4 5v-5h-2v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
