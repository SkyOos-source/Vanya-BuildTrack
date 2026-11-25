import { useEffect, useRef, useState, type FormEvent, type InputHTMLAttributes } from "react";
import type { Expense, ExpenseAllocation, Material, MaterialAllocation, MaterialCategory, Person, Project, RecordModalType, Role } from "./types";
import { captureCameraPhoto, formatCurrency } from "./utils";

export function ProjectCards({ projects, onOpen }: { projects: Project[]; onOpen: (project: Project) => void }) {
  if (!projects.length) return <div className="inline-empty">No projects match this search. Try another name or status.</div>;
  return <div className="project-cards">{projects.map((project) => {
    const coverUrl = project.image
      ? project.image.startsWith("data:")
        ? `linear-gradient(0deg, rgba(33,30,28,.78), transparent 72%), url("${project.image}")`
        : `linear-gradient(0deg, rgba(33,30,28,.78), transparent 72%), url(https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=700&q=80)`
      : undefined;
    return <button className="portfolio-card" key={project.id} onClick={() => onOpen(project)}>
      <div className={`portfolio-image${coverUrl ? "" : " portfolio-image-placeholder"}`} style={coverUrl ? { backgroundImage: coverUrl } : undefined}>
        <span className="portfolio-id">{project.id}</span>
        <div className="portfolio-title"><h3>{project.name}</h3><span>⌖ {project.site}</span></div>
      </div>
      <div className="portfolio-details"><div className="portfolio-progress"><span>Progress</span><strong>{project.progress}%</strong></div><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><div className="portfolio-foot"><span>Due <strong>{project.dueDate}</strong></span></div></div>
    </button>;
  })}</div>;
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

export function DateInput({ value, defaultValue, onChange, onClear, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { onClear?: () => void }) {
  const [hasValue, setHasValue] = useState(Boolean(value ?? defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (value !== undefined) setHasValue(Boolean(value));
  }, [value]);
  return <span className={`date-input-wrap ${hasValue ? "" : "date-input-empty"}`}>
    <input
      {...props}
      ref={inputRef}
      type="date"
      value={value}
      defaultValue={defaultValue}
      onChange={(event) => {
        setHasValue(Boolean(event.currentTarget.value));
        onChange?.(event);
      }}
    />
    <span className="date-input-format" aria-hidden="true">DD/MM/YYYY</span>
    {hasValue && <button
      className="date-input-clear"
      type="button"
      aria-label="Clear date"
      title="Clear date"
      onClick={() => {
        if (value === undefined && inputRef.current) inputRef.current.value = "";
        setHasValue(false);
        onClear?.();
      }}
    >Clear</button>}
  </span>;
}

function getAvailableMaterialQuantity(stock: string) {
  const quantity = stock.trim().match(/^(\d+(?:\.\d{1,3})?)/)?.[1];
  return quantity ? Number(quantity) : 0;
}

export function RecordModal({ modal, role, isSubmitting, initialPersonRole = "Site Engineer", initialProject, projects, projectsLoading, projectsLoadError, people, peopleLoading, peopleLoadError, materials, materialCategories, expenseAllocations, materialAllocations, onAddMaterialCategory, onClose, onSubmit }: { modal: RecordModalType; role: Role; isSubmitting: boolean; initialPersonRole?: "Site Engineer" | "Client" | "Project Manager"; initialProject?: Project; projects: Project[]; projectsLoading: boolean; projectsLoadError: string; people: Person[]; peopleLoading: boolean; peopleLoadError: string; materials: Material[]; materialCategories: MaterialCategory[]; expenseAllocations: ExpenseAllocation[]; materialAllocations: MaterialAllocation[]; onAddMaterialCategory: (name: string) => Promise<MaterialCategory>; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [personRole, setPersonRole] = useState<"Site Engineer" | "Client" | "Project Manager">(initialPersonRole);
  const visitEngineers = people.filter((person) => person.role === "Site Engineer");
  const projectManagers = people.filter((person) => person.role === "Project Manager");
  const selectableAllocations = expenseAllocations;
  const selectableMaterialAllocations = materialAllocations.filter((allocation) => allocation.remainingQuantity > 0);
  const selectableMaterials = materials.filter((material) => getAvailableMaterialQuantity(material.stock) > 0);
  const defaultVisitEngineer = visitEngineers.find((person) => person.name === projects[0]?.engineer)?.name ?? visitEngineers[0]?.name ?? projects[0]?.engineer ?? "";
  const [visitProject, setVisitProject] = useState(projects[0]?.name ?? "");
  const [visitEngineer, setVisitEngineer] = useState(defaultVisitEngineer);
  const [selectedProject, setSelectedProject] = useState(initialProject?.name ?? projects[0]?.name ?? "");
  const [progressValue, setProgressValue] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"Cash" | "Online">("Cash");
  const [clientProject, setClientProject] = useState("");
  const [selectedAllocation, setSelectedAllocation] = useState(selectableAllocations[0]?.id ?? "");
  const [selectedMaterialAllocation, setSelectedMaterialAllocation] = useState(selectableMaterialAllocations[0]?.id ?? "");
  const [selectedStockMaterial, setSelectedStockMaterial] = useState(selectableMaterials[0]?.material ?? "");
  const [selectedRequestCategory, setSelectedRequestCategory] = useState(materialCategories[0]?.name ?? "");
  const [showRequestCategoryForm, setShowRequestCategoryForm] = useState(materialCategories.length === 0);
  const [newRequestCategory, setNewRequestCategory] = useState("");
  const [requestCategoryError, setRequestCategoryError] = useState("");
  const [creatingRequestCategory, setCreatingRequestCategory] = useState(false);
  const [progressCameraOpen, setProgressCameraOpen] = useState(false);
  const [progressCameraReady, setProgressCameraReady] = useState(false);
  const [progressCameraStream, setProgressCameraStream] = useState<MediaStream | null>(null);
  const [progressCameraError, setProgressCameraError] = useState("");
  const [progressCameraFiles, setProgressCameraFiles] = useState<File[]>([]);
  const progressCameraVideoRef = useRef<HTMLVideoElement>(null);
  const progressCameraInputRef = useRef<HTMLInputElement>(null);
  const projectSelectorRequired = ["material-allocation", "material-request", "quote", "expense", "expense-log", "payment", "progress", "visit"].includes(modal);
  const projectSelectionUnavailable = projectSelectorRequired && (projectsLoading || projects.length === 0);
  const engineerSelectionUnavailable = (modal === "project" || modal === "expense-allocation") && (peopleLoading || visitEngineers.length === 0);
  const allocationSelectionUnavailable = modal === "expense-log" && role === "Employee" && selectableAllocations.length === 0 ||
    modal === "material-log" && selectableMaterialAllocations.length === 0 ||
    modal === "material-allocation" && selectableMaterials.length === 0 ||
    modal === "material-request" && materialCategories.length === 0;
  const projectOptionMessage = projectsLoading ? "Loading projects…" : projectsLoadError ? "Could not load projects" : "No projects available";
  useEffect(() => {
    setPersonRole(initialPersonRole);
  }, [initialPersonRole]);
  useEffect(() => {
    if (!projects.some((project) => project.name === visitProject)) setVisitProject(projects[0]?.name ?? "");
  }, [projects, visitProject]);
  useEffect(() => {
    if (!selectableAllocations.some((allocation) => allocation.id === selectedAllocation)) {
      setSelectedAllocation(selectableAllocations[0]?.id ?? "");
    }
  }, [expenseAllocations, selectedAllocation]);
  useEffect(() => {
    if (!selectableMaterialAllocations.some((allocation) => allocation.id === selectedMaterialAllocation)) {
      setSelectedMaterialAllocation(selectableMaterialAllocations[0]?.id ?? "");
    }
  }, [selectableMaterialAllocations, selectedMaterialAllocation]);
  useEffect(() => {
    if (!selectableMaterials.some((material) => material.material === selectedStockMaterial)) {
      setSelectedStockMaterial(selectableMaterials[0]?.material ?? "");
    }
  }, [selectableMaterials, selectedStockMaterial]);
  useEffect(() => {
    if (!materialCategories.some((category) => category.name === selectedRequestCategory)) {
      setSelectedRequestCategory(materialCategories[0]?.name ?? "");
    }
  }, [materialCategories, selectedRequestCategory]);
  useEffect(() => {
    const video = progressCameraVideoRef.current;
    if (progressCameraOpen && progressCameraStream && video) {
      video.srcObject = progressCameraStream;
      void video.play().then(() => setProgressCameraReady(true)).catch(() => setProgressCameraError("Could not start the camera preview."));
    }
  }, [progressCameraOpen, progressCameraStream]);
  useEffect(() => () => {
    progressCameraStream?.getTracks().forEach((track) => track.stop());
  }, [progressCameraStream]);

  const openProgressCamera = async () => {
    setProgressCameraError("");
    setProgressCameraReady(false);
    if (!navigator.mediaDevices?.getUserMedia) {
      setProgressCameraError("Camera access is unavailable. Open this page over HTTPS and allow camera access.");
      return;
    }
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: "environment" } },
          audio: false
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false
        });
      }
      setProgressCameraStream(stream);
      setProgressCameraOpen(true);
    } catch (error) {
      setProgressCameraError(error instanceof DOMException && error.name === "NotAllowedError"
        ? "Camera permission was denied. Allow camera access in your browser settings."
        : "Could not open the camera. Check that it is available and not used by another app.");
    }
  };

  const closeProgressCamera = () => {
    progressCameraStream?.getTracks().forEach((track) => track.stop());
    setProgressCameraStream(null);
    setProgressCameraOpen(false);
    setProgressCameraReady(false);
  };

  const takeProgressPhoto = async () => {
    const video = progressCameraVideoRef.current;
    if (!progressCameraReady || !video) {
      setProgressCameraError("Camera is not ready yet. Please wait a moment.");
      return;
    }
    if (progressCameraFiles.length >= 5) {
      setProgressCameraError("You can add up to 5 progress photos.");
      return;
    }
    try {
      const captured = await captureCameraPhoto(video, "progress");
      const nextFiles = [...progressCameraFiles, captured.file];
      setProgressCameraFiles(nextFiles);
      if (progressCameraInputRef.current) {
        const transfer = new DataTransfer();
        nextFiles.forEach((file) => transfer.items.add(file));
        progressCameraInputRef.current.files = transfer.files;
      }
      setProgressCameraError("");
    } catch (error) {
      setProgressCameraError(error instanceof Error ? error.message : "Could not take a photo.");
    }
  };
  const addRequestCategory = async () => {
    const name = newRequestCategory.trim();
    if (!name) {
      setRequestCategoryError("Enter a category name.");
      return;
    }
    setCreatingRequestCategory(true);
    setRequestCategoryError("");
    try {
      const category = await onAddMaterialCategory(name);
      setSelectedRequestCategory(category.name);
      setNewRequestCategory("");
      setShowRequestCategoryForm(false);
    } catch (error) {
      setRequestCategoryError(error instanceof Error ? error.message : "Could not add the category.");
    } finally {
      setCreatingRequestCategory(false);
    }
  };
  const title = modal === "project" ? (initialProject ? "Edit project" : "Create a project") : modal === "quote" ? "New quotation" : modal === "progress" ? "Daily progress update" : modal === "payment" ? "Record a project payment" : modal === "expense" ? "Request extra funds" : modal === "expense-log" ? "Log an expense" : modal === "expense-allocation" ? "Assign funds to an engineer" : modal === "visit" ? "Schedule a site visit" : modal === "material" ? "Record company materials" : modal === "material-category" ? "Add material category" : modal === "material-allocation" ? "Assign materials to a site" : modal === "material-log" ? "Log material use" : modal === "material-request" ? "Request materials" : personRole === "Client" ? "Invite client" : "Add team member";
  const label = modal === "project" ? "Project name" : modal === "quote" ? "Quotation title" : modal === "progress" ? "What did you complete today?" : modal === "expense" || modal === "expense-log" ? "Expense description" : modal === "visit" ? "Visit purpose" : modal === "material-category" ? "Category name" : modal === "material" || modal === "material-request" ? "Material" : "Full name";
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (!isSubmitting && event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="panel-kicker">BUILDTRACK WORKSPACE</span><h2 id="modal-title">{title}</h2></div><button className="icon-button modal-close" aria-label="Close dialog" disabled={isSubmitting} onClick={onClose}>×</button></div><form onSubmit={onSubmit}>
    {(modal === "expense" || modal === "expense-log") && <label>Receipt photo<input name="attachment" type="file" accept="image/*" /></label>}
    {!["material", "material-allocation", "material-log", "material-request", "person", "expense-allocation", "expense", "expense-log", "payment"].includes(modal) && <label>{modal === "project" ? "Project Name" : label}<input name={modal === "quote" ? "title" : modal === "progress" || modal === "visit" ? "description" : "name"} defaultValue={modal === "project" ? initialProject?.name : undefined} required placeholder={modal === "project" ? "e.g. Lakeside Residence" : modal === "quote" ? "e.g. Add-on work — kitchen island" : modal === "progress" ? "Describe work completed at site..." : modal === "visit" ? "e.g. Foundation inspection" : "e.g. M25 concrete"}/></label>}
    {(modal === "material-allocation" || modal === "material-request" || modal === "quote" || modal === "expense" || modal === "expense-log" || modal === "payment" || modal === "progress" || modal === "visit") && <label>{modal === "material-allocation" ? "Site / project" : "Project"}<select name="project" required disabled={projectsLoading || projects.length === 0} value={modal === "visit" ? visitProject : selectedProject || projects[0]?.name || ""} onChange={(event) => {
      if (modal !== "visit") {
        setSelectedProject(event.currentTarget.value);
        return;
      }
      const selected = projects.find((project) => project.name === event.currentTarget.value);
      setVisitProject(event.currentTarget.value);
      setVisitEngineer(visitEngineers.find((person) => person.name === selected?.engineer)?.name ?? visitEngineers[0]?.name ?? selected?.engineer ?? "");
    }}>{projects.length === 0 && <option value="" disabled>{projectOptionMessage}</option>}{projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>{modal === "material-allocation" && <small>Assigned to the selected project's site engineer.</small>}{projectsLoadError && !projectsLoading && <small role="alert">{projectsLoadError}</small>}</label>}
    {modal === "progress" && <label>Site photo stage<select name="stage" defaultValue="Progress"><option value="Start">Project start</option><option value="Progress">Progress update</option><option value="Completion">Project completion</option></select></label>}
    {modal === "progress" && <><label>Overall project completion (%)<input name="progress" type="number" min="0" max="100" step="1" placeholder="Optional, from 0 to 100" value={progressValue} onChange={(event) => setProgressValue(event.currentTarget.value)} /></label>{progressValue !== "" && Number(progressValue) === 100 && <label>Completion summary<textarea name="completionSummary" rows={4} required placeholder="Summarize the completed project work..." /></label>}</>}
    {modal === "project" && <><label>Project location<input name="site" defaultValue={initialProject?.site} required placeholder="e.g. Whitefield, Bengaluru" /></label><label>Assign engineer<select name="engineer" required disabled={peopleLoading || visitEngineers.length === 0} defaultValue={initialProject?.engineer ?? ""}><option value="" disabled>{peopleLoading ? "Loading engineers…" : peopleLoadError ? "Could not load engineers" : "Select a site engineer"}</option>{visitEngineers.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select>{peopleLoadError && !peopleLoading && <small role="alert">{peopleLoadError}</small>}</label><label>Assign project manager (optional)<select name="projectManager" defaultValue={initialProject?.projectManager ?? ""}><option value="">No project manager</option>{projectManagers.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></label><label>Cover image (optional)<input name="coverImage" type="file" accept="image/*" /></label></>}
    {modal === "expense-allocation" && <><label>Site engineer<select name="engineer" required disabled={peopleLoading || visitEngineers.length === 0} defaultValue=""><option value="" disabled>{peopleLoading ? "Loading engineers…" : peopleLoadError ? "Could not load engineers" : "Select an engineer"}</option>{visitEngineers.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select>{peopleLoadError && !peopleLoading && <small role="alert">{peopleLoadError}</small>}</label><label>Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0" /></label></>}
    {modal === "quote" && <label>Upload quotation<input name="quotationFile" type="file" accept="application/pdf,.pdf" /></label>}
    {modal === "person" && <><input type="hidden" name="role" value={personRole} />{personRole !== "Client" && <label>Role<select name="displayRole" value={personRole} onChange={(event) => setPersonRole(event.currentTarget.value as "Site Engineer" | "Project Manager")}><option value="Site Engineer">Site Engineer</option><option value="Project Manager">Project Manager</option></select></label>}<label>Full name<input name="name" required /></label><label>Email<input name="email" type="email" required /></label><label>Phone number<div className="phone-input-prefix"><span>+91</span><input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} placeholder="98765 43210" required /></div></label><label>{personRole === "Client" ? "Client password" : "Temporary password"}<PasswordInput name="password" autoComplete="new-password" minLength={8} required /><small>At least 8 characters. Share it securely with the account holder.</small></label>{personRole === "Client" && <label>Assign project<select name="project" required disabled={projectsLoading || projects.length === 0} value={clientProject} onChange={(event) => setClientProject(event.currentTarget.value)}><option value="" disabled>{projects.length === 0 ? projectOptionMessage : "Select a project"}</option>{projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>{projectsLoadError && !projectsLoading && <small role="alert">{projectsLoadError}</small>}</label>}</>}
    {modal === "material" && <><label>Category<select name="category" required disabled={materialCategories.length === 0}><option value="">{materialCategories.length ? "Select a category" : "Add a category first"}</option>{materialCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select>{materialCategories.length === 0 && <small>Add a material category before recording stock.</small>}</label><label>Quantity to add<input name="received" required placeholder="e.g. 12 bags or 2.5 m³" /></label></>}
    {modal === "material-allocation" && <><label>Material<select name="material" required disabled={selectableMaterials.length === 0} value={selectedStockMaterial} onChange={(event) => setSelectedStockMaterial(event.currentTarget.value)}><option value="" disabled>{selectableMaterials.length ? "Select company material" : "No company materials in stock"}</option>{selectableMaterials.map((material) => <option key={material.id} value={material.material}>{material.material} · {material.stock} available</option>)}</select>{selectableMaterials.length === 0 && <small>Record company materials before assigning them to a site.</small>}</label><label>Quantity<input name="quantity" type="number" min="0.001" step="0.001" max={getAvailableMaterialQuantity(selectableMaterials.find((material) => material.material === selectedStockMaterial)?.stock ?? "0") || undefined} required placeholder="e.g. 12" /></label></>}
    {modal === "material-request" && <><label>Material category<select name="material" required value={selectedRequestCategory} onChange={(event) => setSelectedRequestCategory(event.currentTarget.value)} disabled={materialCategories.length === 0}><option value="" disabled>{materialCategories.length ? "Select a material category" : "Add a category to continue"}</option>{materialCategories.map((category) => <option key={category.id} value={category.name}>{category.name}</option>)}</select></label><div className="material-request-category-create"><button className="button button-outline" type="button" onClick={() => { setShowRequestCategoryForm((show) => !show); setRequestCategoryError(""); }}>{showRequestCategoryForm ? "Cancel adding category" : "＋ Add category"}</button>{showRequestCategoryForm && <div className="material-request-category-form"><label>New category name<input value={newRequestCategory} onChange={(event) => setNewRequestCategory(event.currentTarget.value)} placeholder="e.g. Cement" /></label><button className="button button-outline" type="button" disabled={creatingRequestCategory} onClick={() => void addRequestCategory()}>{creatingRequestCategory ? "Adding…" : "Save category"}</button>{requestCategoryError && <small role="alert">{requestCategoryError}</small>}</div>}</div><label>Requested quantity<input name="quantity" required placeholder="e.g. 12 m³" /></label><label>Reason or site need<textarea name="note" rows={3} placeholder="Optional details for the owner" /></label></>}
    {modal === "material-log" && <><label>Assigned material<select name="allocationId" required value={selectedMaterialAllocation} onChange={(event) => setSelectedMaterialAllocation(event.currentTarget.value)}><option value="" disabled>{selectableMaterialAllocations.length ? "Select an assignment" : "No remaining materials assigned"}</option>{selectableMaterialAllocations.map((allocation) => <option key={allocation.id} value={allocation.id}>{allocation.material} · {allocation.project}{role === "Owner" ? ` · ${allocation.engineer}` : ""} · {allocation.remainingQuantity} {allocation.unit} remaining</option>)}</select>{selectableMaterialAllocations.length === 0 && <small>{role === "Employee" ? "Ask the owner to assign materials or request more." : "Assign materials to a site before logging usage."}</small>}</label><label>Quantity used<input name="quantity" type="number" min="0.001" step="0.001" max={selectableMaterialAllocations.find((item) => item.id === selectedMaterialAllocation)?.remainingQuantity} required placeholder="e.g. 2" /></label><label>Note<textarea name="note" rows={2} placeholder="Optional usage details" /></label></>}
    {(modal === "quote" || modal === "expense" || modal === "expense-log" || modal === "payment") && <label>Amount (INR)<input name="amount" type="number" min="0.01" step="0.01" required placeholder="0" /></label>}
    {modal === "payment" && <><label>Payment method<select name="method" value={paymentMethod} onChange={(event) => setPaymentMethod(event.currentTarget.value === "Online" ? "Online" : "Cash")}><option value="Cash">Cash</option><option value="Online">Online</option></select></label>{paymentMethod === "Online" && <label>Payment proof image<input name="proofImage" type="file" accept="image/*" required /><small>Upload a screenshot or photo of the online payment confirmation.</small></label>}<label>Note (optional)<input name="note" maxLength={500} placeholder="e.g. First instalment" /></label></>}
    {modal === "expense-log" && role === "Employee" && <input type="hidden" name="allocationId" value={selectedAllocation} />}
    {modal === "visit" && <><label>Engineer<select name="engineer" required value={visitEngineer} onChange={(event) => setVisitEngineer(event.currentTarget.value)}>{visitEngineer && !visitEngineers.some((person) => person.name === visitEngineer) && <option value={visitEngineer}>{visitEngineer}</option>}{visitEngineers.map((person) => <option key={person.id} value={person.name}>{person.name}</option>)}</select></label><label>Visit date<DateInput name="date" required /></label></>}
    {modal === "progress" && <div className="progress-photo-options"><div className="progress-camera-option"><span>Take photos with camera</span><button className="button button-outline" type="button" disabled={isSubmitting} onClick={() => void openProgressCamera()}>Open camera</button>{progressCameraOpen && <div className="progress-camera-preview"><video ref={progressCameraVideoRef} muted playsInline /><div className="progress-camera-actions"><button className="button button-primary" type="button" disabled={!progressCameraReady || isSubmitting} onClick={() => void takeProgressPhoto()}>Take photo</button><button className="button button-outline" type="button" disabled={isSubmitting} onClick={closeProgressCamera}>Close camera</button></div>{progressCameraFiles.length > 0 && <small>{progressCameraFiles.length} photo(s) captured</small>}</div>}{progressCameraError && <small role="alert">{progressCameraError}</small>}<input ref={progressCameraInputRef} name="cameraAttachments" type="file" accept="image/*" multiple hidden disabled={isSubmitting} /></div><label>Upload photos (up to 5)<input name="attachments" type="file" accept="image/*" multiple disabled={isSubmitting} /></label></div>}
    {(modal === "expense" || modal === "expense-log") && <label>Expense description<input name="description" required placeholder="e.g. Concrete delivery · 8 m³" /></label>}
    <div className="modal-actions"><button className="button button-outline" type="button" disabled={isSubmitting} onClick={onClose}>Cancel</button><button className="button button-primary" type="submit" disabled={isSubmitting || projectSelectionUnavailable || engineerSelectionUnavailable || allocationSelectionUnavailable || modal === "material" && materialCategories.length === 0 || modal === "person" && personRole === "Client" && (projectsLoading || projects.length === 0)}>{isSubmitting ? modal === "progress" ? "Uploading photos…" : "Saving…" : modal === "progress" ? "Submit update" : modal === "payment" ? "Save payment" : modal === "expense" ? "Request extra funds" : modal === "expense-log" ? "Log expense" : modal === "expense-allocation" ? "Assign funds" : modal === "material-request" ? "Send material request" : modal === "material-allocation" ? "Assign materials" : modal === "material-log" ? "Log material use" : modal === "material-category" ? "Add category" : modal === "visit" ? "Schedule visit" : modal === "quote" ? "Save quotation" : modal === "material" ? "Save material" : modal === "person" ? personRole === "Client" ? "Invite client" : "Add team member" : modal === "project" && initialProject ? "Save changes" : "Create project"}</button></div></form></section></div>;
}

export function BuildingIcon() {
  return <img className="building-icon-image" src="/buildtrack-logo-transparent.png" alt="BuildTrack icon" />;
}
