import { useEffect, useState, type FormEvent, type InputHTMLAttributes } from "react";
import type { Expense, ExpenseAllocation, Person, Project, RecordModalType, Role } from "./types";
import { formatCurrency } from "./utils";

export function ProjectCards({ projects, onOpen }: { projects: Project[]; onOpen: (project: Project) => void }) {
  if (!projects.length) return <div className="inline-empty">No projects match this search. Try another name or status.</div>;
  return <div className="project-cards">{projects.map((project) => <button className="portfolio-card" key={project.id} onClick={() => onOpen(project)}><div className="portfolio-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(33,30,28,.78), transparent 72%), url(https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=700&q=80)` }}><span className="portfolio-id">{project.id}</span><span className="portfolio-status"><i /> {project.status}</span><div className="portfolio-title"><h3>{project.name}</h3><span>⌖ {project.site}</span></div></div><div className="portfolio-details"><div className="portfolio-progress"><span>Progress</span><strong>{project.progress}%</strong></div><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><div className="portfolio-foot"><span>Due <strong>{project.dueDate}</strong></span></div></div></button>)}</div>;
}

export function ExpenseRows({ expenses, detailed = false, onAction, onApprove, onDecline }: { expenses: Expense[]; detailed?: boolean; onAction?: (expense: Expense) => void; onApprove?: (expense: Expense) => void; onDecline?: (expense: Expense) => void }) {
  const [receipt, setReceipt] = useState<Expense | null>(null);
  useEffect(() => {
    if (!receipt) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setReceipt(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [receipt]);
  if (!expenses.length) return <div className="inline-empty">No expenses to show yet.</div>;
  return <>
    <div className={`expense-list ${detailed ? "expense-list-detailed" : ""}`}>{expenses.map((expense) => {
      const needsReview = expense.entryType !== "log" && expense.status === "Pending review";
      return <div className="expense-row" key={expense.id}><span className={`expense-icon ${expense.category === "Labour" ? "expense-labour" : ""}`}>{expense.category === "Materials" ? "◈" : expense.category === "Labour" ? "♙" : "▧"}</span><div className="expense-main"><strong>{expense.description}</strong><span>{expense.project} · {expense.submittedBy}</span></div><time>{expense.date.split(" ").slice(0, 2).join(" ")}</time><strong className="expense-amount">{formatCurrency(expense.amount)}</strong><StatusBadge status={expense.status} />{detailed && <><button className="text-link receipt-action" onClick={() => expense.attachment ? setReceipt(expense) : onAction?.(expense)}>{needsReview && onApprove ? "View" : "Receipt"} ↗</button>{needsReview && onApprove && onDecline && <div className="inline-actions expense-review-actions"><button onClick={() => onApprove(expense)}>Approve</button><button onClick={() => onDecline(expense)}>Decline</button></div>}</>}</div>;
    })}</div>
    {receipt?.attachment && <div className="pdf-preview-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setReceipt(null); }}>
      <section className="pdf-preview-dialog expense-receipt-dialog" role="dialog" aria-modal="true" aria-label={`${receipt.description} receipt`}>
        <header className="pdf-preview-header">
          <strong>{receipt.description} · {receipt.project}</strong>
          <div>
            <a className="button button-outline" href={receipt.attachment} download={`${receipt.id}-receipt${receipt.attachment.startsWith("data:application/pdf") ? ".pdf" : ".jpg"}`}>Download</a>
            <button className="icon-button" type="button" aria-label="Close receipt preview" onClick={() => setReceipt(null)}>×</button>
          </div>
        </header>
        {receipt.attachment.startsWith("data:application/pdf")
          ? <iframe title={`${receipt.description} receipt PDF`} src={receipt.attachment} />
          : <div className="expense-receipt-image"><img src={receipt.attachment} alt={`${receipt.description} receipt`} /></div>}
      </section>
    </div>}
  </>;
}

export function StatCard({ label, value, note, icon, trend, attention = false, dark = false }: { label: string; value: string; note: string; icon: string; trend: string; attention?: boolean; dark?: boolean }) {
  return <article className={`stat-card ${attention ? "stat-attention" : ""} ${dark ? "stat-card-dark" : ""}`}><div className="stat-card-head"><span className="stat-label">{label}</span><span className={`stat-icon ${attention ? "stat-icon-orange" : ""}`}>{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span><div className={`stat-trend ${attention ? "trend-attention" : ""}`}><i />{trend}</div></article>;
}

export function StatusBadge({ status }: { status: string }) {
  const className = status.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return <span className={`status-badge status-${className}`}>{status}</span>;
}

export function PasswordInput(props: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return <span className="password-input-wrap">
    <input {...props} type={visible ? "text" : "password"} />
    <button
      className="password-visibility-toggle"
      type="button"
      aria-label={visible ? "Hide password" : "Show password"}
      aria-pressed={visible}
      onClick={() => setVisible((current) => !current)}
    >
      {visible
        ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5.2 0 8.6 5 9.5 7-.3.7-1.1 2-2.4 3.2M6.2 6.2C3.9 7.6 2.7 10 2.5 12c.5 1.1 1.7 3.2 4.4 4.5A10 10 0 0012 19c.9 0 1.8-.1 2.6-.4" /></svg>
        : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12S6 5 12 5s9.5 7 9.5 7-3.5 7-9.5 7-9.5-7-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>}
    </button>
  </span>;
}

export function RecordModal({ modal, role, initialPersonRole = "Site Engineer", projects, projectsLoading, projectsLoadError, people, peopleLoading, peopleLoadError, expenseAllocations, onClose, onSubmit }: { modal: RecordModalType; role: Role; initialPersonRole?: "Site Engineer" | "Client"; projects: Project[]; projectsLoading: boolean; projectsLoadError: string; people: Person[]; peopleLoading: boolean; peopleLoadError: string; expenseAllocations: ExpenseAllocation[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const personRole = initialPersonRole;
  const visitEngineers = people.filter((person) => person.role === "Site Engineer");
  const availableAllocations = expenseAllocations.filter((allocation) => allocation.remainingAmount > 0);
  const defaultVisitEngineer = visitEngineers.find((person) => person.name === projects[0]?.engineer)?.name ?? visitEngineers[0]?.name ?? projects[0]?.engineer ?? "";
  const [visitProject, setVisitProject] = useState(projects[0]?.name ?? "");
  const [visitEngineer, setVisitEngineer] = useState(defaultVisitEngineer);
  const [selectedProject, setSelectedProject] = useState(projects[0]?.name ?? "");
  const [clientProject, setClientProject] = useState("");
  const [selectedAllocation, setSelectedAllocation] = useState(availableAllocations[0]?.id ?? "");
  const projectSelectorRequired = ["material", "material-request", "quote", "expense", "expense-log", "progress", "visit"].includes(modal);
  const projectSelectionUnavailable = projectSelectorRequired && (projectsLoading || projects.length === 0);
  const engineerSelectionUnavailable = (modal === "project" || modal === "expense-allocation") && (peopleLoading || visitEngineers.length === 0);
  const allocationSelectionUnavailable = modal === "expense-log" && role === "Employee" && availableAllocations.length === 0;
  const projectOptionMessage = projectsLoading ? "Loading projects…" : projectsLoadError ? "Could not load projects" : "No projects available";
  useEffect(() => {
    if (!projects.some((project) => project.name === visitProject)) setVisitProject(projects[0]?.name ?? "");
  }, [projects, visitProject]);
  useEffect(() => {
    if (!availableAllocations.some((allocation) => allocation.id === selectedAllocation)) {
      setSelectedAllocation(availableAllocations[0]?.id ?? "");
    }
  }, [expenseAllocations, selectedAllocation]);
  const title = modal === "project" ? "Create a project" : modal === "quote" ? "New quotation" : modal === "progress" ? "Daily progress update" : modal === "expense" ? "Request extra funds" : modal === "expense-log" ? "Log an expense" : modal === "expense-allocation" ? "Assign funds to an engineer" : modal === "visit" ? "Schedule a site visit" : modal === "material" ? "Log materials" : modal === "material-request" ? "Request materials" : personRole === "Client" ? "Invite client" : "Invite engineer";
  const label = modal === "project" ? "Project name" : modal === "quote" ? "Quotation title" : modal === "progress" ? "What did you complete today?" : modal === "expense" || modal === "expense-log" ? "Expense description" : modal === "visit" ? "Visit purpose" : modal === "material" || modal === "material-request" ? "Material" : "Full name";
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="panel-kicker">BUILDTRACK WORKSPACE</span><h2 id="modal-title">{title}</h2></div><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>×</button></div><form onSubmit={onSubmit}>
    {modal !== "material" && modal !== "person" && modal !== "expense-allocation" && <label>{modal === "project" ? "Project Name" : label}<input name={modal === "quote" ? "title" : modal === "progress" || modal === "expense" || modal === "expense-log" || modal === "visit" ? "description" : modal === "material-request" ? "material" : "name"} required placeholder={modal === "project" ? "e.g. Lakeside Residence" : modal === "quote" ? "e.g. Add-on work — kitchen island" : modal === "progress" ? "Describe work completed at site..." : modal === "expense" || modal === "expense-log" ? "e.g. Concrete delivery · 8 m³" : modal === "visit" ? "e.g. Foundation inspection" : "e.g. M25 concrete"}/></label>}
    {(modal === "material" || modal === "material-request" || modal === "quote" || modal === "expense" || modal === "expense-log" || modal === "progress" || modal === "visit") && <label>Project<select name="project" required disabled={projectsLoading || projects.length === 0} value={modal === "visit" ? visitProject : selectedProject || projects[0]?.name || ""} onChange={(event) => {
      if (modal !== "visit") {
        setSelectedProject(event.currentTarget.value);
        return;
      }
      const selected = projects.find((project) => project.name === event.currentTarget.value);
      setVisitProject(event.currentTarget.value);
      setVisitEngineer(visitEngineers.find((person) => person.name === selected?.engineer)?.name ?? visitEngineers[0]?.name ?? selected?.engineer ?? "");
    }}>{projects.length === 0 && <option value="" disabled>{projectOptionMessage}</option>}{projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>{projectsLoadError && !projectsLoading && <small role="alert">{projectsLoadError}</small>}</label>}
    {modal === "progress" && <label>Site photo stage<select name="stage" defaultValue="Progress"><option value="Start">Project start</option><option value="Progress">Progress update</option><option value="Completion">Project completion</option></select></label>}
    {modal === "progress" && <label>Overall project completion (%)<input name="progress" type="number" min="0" max="100" step="1" placeholder="Optional, from 0 to 100" /></label>}
    {modal === "project" && <><label>Project location<input name="site" required placeholder="e.g. Whitefield, Bengaluru" /></label><label>Assign engineer<select name="engineer" required disabled={peopleLoading || visitEngineers.length === 0} defaultValue=""><option value="" disabled>{peopleLoading ? "Loading engineers…" : peopleLoadError ? "Could not load engineers" : "Select a site engineer"}</option>{visitEngineers.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select>{peopleLoadError && !peopleLoading && <small role="alert">{peopleLoadError}</small>}</label><label>Quotation (INR)<input name="quotationAmount" type="number" min="0" required placeholder="0" /></label></>}
    {modal === "expense-allocation" && <><label>Site engineer<select name="engineer" required disabled={peopleLoading || visitEngineers.length === 0} defaultValue=""><option value="" disabled>{peopleLoading ? "Loading engineers…" : peopleLoadError ? "Could not load engineers" : "Select an engineer"}</option>{visitEngineers.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select>{peopleLoadError && !peopleLoading && <small role="alert">{peopleLoadError}</small>}</label><label>Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0" /></label></>}
    {modal === "quote" && <label>Upload quotation<input name="quotationFile" type="file" accept="application/pdf,.pdf" /></label>}
    {modal === "person" && <><input type="hidden" name="role" value={personRole} /><label>Full name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone number<input name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" required /><small>Include the country code. This number will receive sign-in verification codes.</small></label><label>{personRole === "Client" ? "Client password" : "Temporary password"}<PasswordInput name="password" autoComplete="new-password" minLength={8} required /><small>At least 8 characters. Share it securely with the {personRole === "Client" ? "client" : "employee"}.</small></label>{personRole === "Client" && <label>Assign project<select name="project" required disabled={projectsLoading || projects.length === 0} value={clientProject} onChange={(event) => setClientProject(event.currentTarget.value)}><option value="" disabled>{projects.length === 0 ? projectOptionMessage : "Select a project"}</option>{projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>{projectsLoadError && !projectsLoading && <small role="alert">{projectsLoadError}</small>}</label>}</>}
    {modal === "material" && <><label>Material name<input name="material" required placeholder="e.g. M25 ready-mix concrete" /></label><label>Received quantity<input name="received" required placeholder="e.g. 12 m³" /></label><label>Used quantity<input name="used" defaultValue="0" /></label><label>Remaining stock<input name="stock" placeholder="Defaults to received quantity" /></label></>}
    {modal === "material-request" && <><label>Requested quantity<input name="quantity" required placeholder="e.g. 12 m³" /></label><label>Reason or site need<textarea name="note" rows={3} placeholder="Optional details for the owner" /></label></>}
    {(modal === "quote" || modal === "expense" || modal === "expense-log") && <label>Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0" /></label>}
    {modal === "expense-log" && role === "Employee" && <label>Use assigned funds<select name="allocationId" required value={selectedAllocation} onChange={(event) => setSelectedAllocation(event.currentTarget.value)}><option value="" disabled>{availableAllocations.length ? "Select an allocation" : "No funds available"}</option>{availableAllocations.map((allocation) => <option key={allocation.id} value={allocation.id}>{formatCurrency(allocation.remainingAmount)} remaining · assigned {allocation.assignedAt}</option>)}</select>{allocationSelectionUnavailable && <small>Ask the owner to assign funds or request extra funds.</small>}</label>}
    {modal === "visit" && <><label>Engineer<select name="engineer" required value={visitEngineer} onChange={(event) => setVisitEngineer(event.currentTarget.value)}>{visitEngineer && !visitEngineers.some((person) => person.name === visitEngineer) && <option value={visitEngineer}>{visitEngineer}</option>}{visitEngineers.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></label><label>Visit date<input name="date" type="date" required /></label></>}
    {(modal === "progress" || modal === "expense" || modal === "expense-log") && <label>{modal === "progress" ? "Progress photos (up to 5)" : "Photos or receipt"}<input name={modal === "progress" ? "attachments" : "attachment"} type="file" accept={modal === "progress" ? "image/*" : "image/*,.pdf"} multiple={modal === "progress"} /></label>}
    <div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={projectSelectionUnavailable || engineerSelectionUnavailable || allocationSelectionUnavailable || modal === "person" && personRole === "Client" && (projectsLoading || projects.length === 0)}>{modal === "progress" ? "Submit update" : modal === "expense" ? "Request extra funds" : modal === "expense-log" ? "Log expense" : modal === "expense-allocation" ? "Assign funds" : modal === "material-request" ? "Send material request" : modal === "visit" ? "Schedule visit" : modal === "quote" ? "Save quotation" : modal === "material" ? "Save material" : modal === "person" ? personRole === "Client" ? "Invite client" : "Invite engineer" : "Create project"}</button></div></form></section></div>;
}

export function BuildingIcon() {
  return <img className="building-icon-image" src="/buildtrack-logo-transparent.png" alt="BuildTrack icon" />;
}
