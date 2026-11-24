import { useEffect, useState, type FormEvent } from "react";
import type { Activity, Attendance, AttendanceLeaveRequest, AttendanceProof, AttendanceRegularizationRequest, DashboardData, Expense, MaterialRequest, OwnerAuditLog, Payment, Project, ProjectContact, Quote, RecordModalType, Role, SiteVisit, SiteVisitProof, Person } from "./types";
import { apiFetch } from "./api";
import { formatCurrency, initials, isLoggedExpense } from "./utils";
import { DateInput, ExpenseRows, ProjectCards, StatusBadge } from "./components";
import { AttendancePage } from "./attendance-page";
import { ProjectDetails } from "./project-details";
import { QuotationPdfPreview } from "./quotation-pdf-preview";
import { SiteVisitsPage, type SiteVisitAction } from "./site-visits-page";
import { PalettePicker } from "./palette";
import { WorkRequestsPage } from "./work-requests-page";

export type FeaturePageProps = { page: string; role: Role; currentUser: string; currentUserEmail: string; ownerContacts?: ProjectContact[] | null; ownerContactsError?: string; data: DashboardData; projects: Project[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; onCreate: (modal: RecordModalType | null, project?: Project) => void; onEditProject?: (project: Project) => void; onCreatePerson: (role: "Site Engineer" | "Client" | "Project Manager") => void; onQuote: (quote: Quote, decision: "Approved" | "Declined") => void; onAttendanceSubmit: (action: "check-in" | "check-out", date: string, proof: AttendanceProof) => Promise<void>; onAttendanceRegularize: (record: Attendance, capturedAt: string, reason: string) => Promise<void>; onAttendanceRequestReview: (requestId: string, decision: "Approved" | "Declined") => Promise<AttendanceRegularizationRequest>; onAttendanceLeaveReview: (requestId: string, decision: "Approved" | "Declined") => Promise<{ request: AttendanceLeaveRequest; record?: Attendance }>; onExpenseStatus: (expense: Expense, status: "Approved" | "Declined" | "Paid") => void; onMaterialRequestStatus: (request: MaterialRequest, status: "Approved" | "Declined") => void; onVisitStatus: (visit: SiteVisit, action: SiteVisitAction, proof: SiteVisitProof) => Promise<void>; onVisitCheckIn: (project: string, site: string, createProject: boolean, proof: SiteVisitProof) => Promise<void>; onUpdatePerson: (person: Person, event: FormEvent<HTMLFormElement>) => Promise<boolean>; onRemovePerson: (person: Person) => void; onUnassignEngineerProject: (project: Project) => Promise<void>; onUnassignClientProject: (client: Person, project: Project) => Promise<void>; onToast: (message: string) => void; onFeedback: (event: FormEvent<HTMLFormElement>) => void; onBackup: () => void; workRequestsRefresh: number };

const RECORDS_PER_PAGE = 10;
const AUDIT_LOGS_PER_PAGE = 20;

function RecordPagination({ page, totalItems, pageSize = RECORDS_PER_PAGE, onPageChange }: { page: number; totalItems: number; pageSize?: number; onPageChange: (page: number) => void }) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;
  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(page * pageSize, totalItems);
  return <div className="attendance-request-pagination">
    <span>Showing {firstItem}–{lastItem} of {totalItems}</span>
    <div>
      <button className="button button-outline" type="button" disabled={page === 1} onClick={() => onPageChange(page - 1)}>Previous</button>
      <span>Page {page} of {totalPages}</span>
      <button className="button button-outline" type="button" disabled={page === totalPages} onClick={() => onPageChange(page + 1)}>Next</button>
    </div>
  </div>;
}

function localDateKey(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function isAssignedToEngineer(project: Project, engineer: Person) {
  const assignment = project.engineer.trim().toLocaleLowerCase();
  return assignment === engineer.name.trim().toLocaleLowerCase() ||
    assignment === engineer.email.trim().toLocaleLowerCase();
}

function isAssignedToClient(project: Project, client: Person) {
  return project.client.trim().toLocaleLowerCase() === client.name.trim().toLocaleLowerCase() ||
    project.name.trim().toLocaleLowerCase() === client.project.trim().toLocaleLowerCase();
}

function isAssignedToProjectManager(project: Project, manager: Person) {
  return (project.projectManager ?? "").trim().toLocaleLowerCase() === manager.name.trim().toLocaleLowerCase();
}

export function FeaturePage({ page, role, currentUser, currentUserEmail, ownerContacts, ownerContactsError, data, projects, search, setSearch, filter, setFilter, onCreate, onCreatePerson, onQuote, onAttendanceSubmit, onAttendanceRegularize, onAttendanceRequestReview, onAttendanceLeaveReview, onExpenseStatus, onVisitStatus, onVisitCheckIn, onUpdatePerson, onRemovePerson, onUnassignEngineerProject, onUnassignClientProject, onToast, onFeedback, onBackup, workRequestsRefresh }: FeaturePageProps) {
  const [rating, setRating] = useState(5);
  const [workProgressDate, setWorkProgressDate] = useState("");
  const [workProgressProject, setWorkProgressProject] = useState("All");
  const [timelineProject, setTimelineProject] = useState("All");
  const [selectedWorkProgress, setSelectedWorkProgress] = useState<Activity | null>(null);
  const [workProgressPhotoIndex, setWorkProgressPhotoIndex] = useState(0);
  const [selectedEngineerId, setSelectedEngineerId] = useState<string | null>(null);
  const [selectedProjectManagerId, setSelectedProjectManagerId] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [engineerPage, setEngineerPage] = useState(1);
  const [clientPage, setClientPage] = useState(1);
  const [allocationPage, setAllocationPage] = useState(1);
  const [expensePage, setExpensePage] = useState(1);
  const [auditLogsPage, setAuditLogsPage] = useState(1);
  const [allocationEngineerFilter, setAllocationEngineerFilter] = useState("All");
  const [expenseProjectFilter, setExpenseProjectFilter] = useState("All");
  const [expenseDateFilter, setExpenseDateFilter] = useState("");
  const [paymentProjectFilter, setPaymentProjectFilter] = useState("All");
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [personPendingDeletion, setPersonPendingDeletion] = useState<Person | null>(null);
  const [personBeingEdited, setPersonBeingEdited] = useState<Person | null>(null);
  const [unassigningProjectId, setUnassigningProjectId] = useState<string | null>(null);
  const [projectPendingUnassignment, setProjectPendingUnassignment] = useState<Project | null>(null);
  const [materialProjectFilter, setMaterialProjectFilter] = useState("All");
  const [materialLogProjectFilter, setMaterialLogProjectFilter] = useState("All");
  const [materialActivityStatusFilter, setMaterialActivityStatusFilter] = useState("All");
  const materialAssignmentRows = [
    ...data.materialAllocations
      .filter((item) => (role !== "Employee" || item.engineer === currentUser) &&
        (materialProjectFilter === "All" || item.project === materialProjectFilter))
      .map((item) => ({
        id: item.id,
        type: "Assigned",
        material: item.material,
        project: item.project,
        quantity: `${item.quantity} ${item.unit} assigned · ${item.remainingQuantity} ${item.unit} remaining`.trim(),
        submittedBy: item.assignedBy,
        date: item.assignedAt,
        status: "Assigned",
        note: ""
      })),
    ...data.materialRequests
      .filter((request) => (role !== "Employee" || request.requestedBy === currentUser) &&
        (materialProjectFilter === "All" || request.project === materialProjectFilter))
      .map((request) => ({
        id: request.id,
        type: "Requested",
        material: request.material,
        project: request.project,
        quantity: request.quantity,
        submittedBy: request.requestedBy,
        date: request.requestedAt,
        status: request.status,
        note: request.note
      }))
  ]
    .filter((item) => materialActivityStatusFilter === "All" || item.status === materialActivityStatusFilter)
    .sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  const visibleMaterialLogs = data.materialUsageLogs.filter((log) =>
    (role !== "Employee" || log.engineer === currentUser) &&
    (materialLogProjectFilter === "All" || log.project === materialLogProjectFilter)
  );
  const [ownerAuditLogs, setOwnerAuditLogs] = useState<OwnerAuditLog[]>([]);
  const [auditLogsError, setAuditLogsError] = useState("");
  const [auditLogsLoading, setAuditLogsLoading] = useState(false);
  const currentAuditLogsPage = Math.min(auditLogsPage, Math.max(1, Math.ceil(ownerAuditLogs.length / AUDIT_LOGS_PER_PAGE)));
  const visibleAuditLogs = ownerAuditLogs.slice(
    (currentAuditLogsPage - 1) * AUDIT_LOGS_PER_PAGE,
    currentAuditLogsPage * AUDIT_LOGS_PER_PAGE
  );
  const loadOwnerAuditLogs = async () => {
    if (role !== "Owner" || page !== "Logs") return;
    setAuditLogsLoading(true);
    try {
      const response = await apiFetch("/api/audit-logs");
      const records: unknown = await response.json();
      if (!response.ok || !Array.isArray(records)) {
        throw new Error((records as { error?: string }).error || `Audit log request failed (${response.status}).`);
      }
      setOwnerAuditLogs(records as OwnerAuditLog[]);
      setAuditLogsError("");
    } catch (error) {
      console.error("Unable to load owner audit logs:", error);
      setAuditLogsError(error instanceof Error ? error.message : "Could not load owner audit logs.");
    } finally {
      setAuditLogsLoading(false);
    }
  };
  useEffect(() => {
    void loadOwnerAuditLogs();
  }, [page, role]);
  const projectView = page === "Projects & Sites" || page === "My Projects" || page === "My Sites";
  const clientEmail = currentUserEmail.toLowerCase();
  const clientProjectName = data.people.find((person) => person.role === "Client" && person.email.toLowerCase() === clientEmail)?.project;
  const scopedProjects = role === "Owner"
    ? projects
    : role === "Employee"
      ? projects.filter((project) => project.engineer === currentUser)
      : role === "ProjectManager"
        ? projects.filter((project) => project.projectManager === currentUser)
        : projects.filter((project) => project.name === clientProjectName);
  const selectedProject = scopedProjects.find((project) => project.id === selectedProjectId);
  const visibleQuotes = role === "Client"
    ? data.quotes.filter((quote) => quote.clientEmail?.toLowerCase() === clientEmail)
    : data.quotes;
  const quotationGroups = new Map<string, Quote[]>();
  for (const quote of visibleQuotes) {
    const projectQuotes = quotationGroups.get(quote.project) ?? [];
    projectQuotes.push(quote);
    quotationGroups.set(quote.project, projectQuotes);
  }
  const selectedEngineer = data.people.find((person) => person.id === selectedEngineerId && person.role === "Site Engineer");
  const engineerProjects = selectedEngineer ? data.projects.filter((project) => isAssignedToEngineer(project, selectedEngineer)) : [];
  const selectedProjectManager = data.people.find((person) => person.id === selectedProjectManagerId && person.role === "Project Manager");
  const projectManagerProjects = selectedProjectManager ? data.projects.filter((project) => isAssignedToProjectManager(project, selectedProjectManager)) : [];
  const selectedClient = data.people.find((person) => person.id === selectedClientId && person.role === "Client");
  const clientProjects = selectedClient ? data.projects.filter((project) => isAssignedToClient(project, selectedClient)) : [];
  const selectedTeamMember = selectedEngineer ?? selectedProjectManager ?? selectedClient;
  const selectedTeamProjects = selectedEngineer ? engineerProjects : selectedProjectManager ? projectManagerProjects : clientProjects;
  const visibleExpenses = role === "Client"
    ? data.expenses.filter((expense) => expense.status === "Approved" && data.projects.some((project) => (project.client === currentUser || project.name === clientProjectName) && project.name === expense.project))
    : role === "Employee"
      ? data.expenses.filter((expense) => expense.submittedBy === currentUser)
      : data.expenses;
  const visibleExpenseAllocations = role === "Employee"
    ? data.expenseAllocations.filter((allocation) => allocation.engineer === currentUser)
    : data.expenseAllocations;
  const projectPayments = data.payments.filter((payment) =>
    data.projects.some((project) => project.name === payment.project)
  );
  const filteredPayments = projectPayments.filter((payment) =>
    paymentProjectFilter === "All" || payment.project === paymentProjectFilter
  );
  const recordedPaymentTotal = filteredPayments.reduce((total, payment) => total + payment.amount, 0);
  const cashPaymentTotal = filteredPayments.filter((payment) => payment.method === "Cash")
    .reduce((total, payment) => total + payment.amount, 0);
  const onlinePaymentTotal = filteredPayments.filter((payment) => payment.method === "Online")
    .reduce((total, payment) => total + payment.amount, 0);
  const paymentReceivedByProject = data.projects
    .filter((project) => paymentProjectFilter === "All" || project.name === paymentProjectFilter)
    .map((project) => {
      const payments = projectPayments.filter((payment) => payment.project === project.name);
      return { project, payments, receivedAmount: payments.reduce((total, payment) => total + payment.amount, 0) };
    });
  const allocationEngineers = [...new Set(visibleExpenseAllocations.map((allocation) => allocation.engineer))]
    .sort((left, right) => left.localeCompare(right));
  const filteredExpenseAllocations = visibleExpenseAllocations.filter((allocation) =>
    role !== "Owner" || allocationEngineerFilter === "All" || allocation.engineer === allocationEngineerFilter
  );
  const totalAssignedFunds = visibleExpenseAllocations.reduce((total, allocation) => total + allocation.amount, 0);
  const totalLoggedExpenses = visibleExpenses.filter(isLoggedExpense).reduce((total, expense) => total + expense.amount, 0);
  const remainingFunds = totalAssignedFunds - totalLoggedExpenses;
  const filteredExpenses = visibleExpenses.filter((item) => {
    if (expenseProjectFilter !== "All" && item.project !== expenseProjectFilter) return false;
    if (expenseDateFilter && localDateKey(item.date) !== expenseDateFilter) return false;
    return true;
  });
  const currentAllocationPage = Math.min(allocationPage, Math.max(1, Math.ceil(filteredExpenseAllocations.length / RECORDS_PER_PAGE)));
  const currentExpensePage = Math.min(expensePage, Math.max(1, Math.ceil(filteredExpenses.length / RECORDS_PER_PAGE)));
  const allocationPageRecords = filteredExpenseAllocations.slice(
    (currentAllocationPage - 1) * RECORDS_PER_PAGE,
    currentAllocationPage * RECORDS_PER_PAGE
  );
  const expensePageRecords = filteredExpenses.slice(
    (currentExpensePage - 1) * RECORDS_PER_PAGE,
    currentExpensePage * RECORDS_PER_PAGE
  );
  useEffect(() => {
    setExpensePage(1);
  }, [expenseDateFilter, expenseProjectFilter, page]);
  useEffect(() => {
    setAllocationPage(1);
  }, [allocationEngineerFilter, page]);
  const clientWorkProgress = data.activities.filter((item) =>
    item.kind === "progress" &&
    scopedProjects.some((project) => project.name === item.project) &&
    (workProgressProject === "All" || item.project === workProgressProject) &&
    (!workProgressDate || localDateKey(item.createdAt) === workProgressDate)
  );
  const selectedWorkProgressPhotos = selectedWorkProgress
    ? (selectedWorkProgress.attachments?.length
      ? selectedWorkProgress.attachments
      : selectedWorkProgress.attachment ? [selectedWorkProgress.attachment] : [])
      .map((attachment) => ({ ...selectedWorkProgress, attachment }))
    : [];
  const activeWorkProgressPhoto = selectedWorkProgressPhotos[workProgressPhotoIndex];
  const renderProgressRow = (item: Activity) => {
    const firstPhoto = item.attachments?.[0] || item.attachment;
    return <div className="progress-update-row client-work-progress-row" key={item.id}>
      <span className="update-date"><strong>{item.createdAt ? new Date(item.createdAt).getDate() : "—"}</strong><small>{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short" }).toUpperCase() : ""}</small></span>
      <span className="update-body"><strong>{item.description || item.action}</strong><span className="client-work-progress-meta">{item.project} · {item.stage ?? "Progress"} · {item.createdAt ? new Date(item.createdAt).toLocaleString() : item.time}</span>{firstPhoto && <button className="client-work-progress-photo-button" type="button" aria-label={`Open progress photos for ${item.project}`} onClick={() => { setSelectedWorkProgress(item); setWorkProgressPhotoIndex(0); }}><img className="client-work-progress-thumbnail" src={firstPhoto} alt={`Progress photo for ${item.project}`} /></button>}</span>
    </div>;
  };

  useEffect(() => {
    if (!selectedWorkProgress) return;
    const previousOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    const closeOnKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSelectedWorkProgress(null);
      if (event.key === "ArrowLeft" && selectedWorkProgressPhotos.length > 1) {
        setWorkProgressPhotoIndex((index) => (index - 1 + selectedWorkProgressPhotos.length) % selectedWorkProgressPhotos.length);
      }
      if (event.key === "ArrowRight" && selectedWorkProgressPhotos.length > 1) {
        setWorkProgressPhotoIndex((index) => (index + 1) % selectedWorkProgressPhotos.length);
      }
    };
    window.addEventListener("keydown", closeOnKey);
    return () => {
      document.documentElement.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnKey);
    };
  }, [selectedWorkProgressPhotos.length, selectedWorkProgress]);
  const renderPeople = (people: Person[], engineers = false) => {
    const currentPage = engineers ? engineerPage : clientPage;
    const setPage = engineers ? setEngineerPage : setClientPage;
    const pageCount = Math.max(1, Math.ceil(people.length / RECORDS_PER_PAGE));
    const page = Math.min(currentPage, pageCount);
    const visiblePeople = people.slice((page - 1) * RECORDS_PER_PAGE, page * RECORDS_PER_PAGE);
    return <>
      {people.length > 0
        ? <div className="data-table-wrap"><table className="data-table people-table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>{engineers ? "Assigned sites" : "Project"}</th><th>Actions</th></tr></thead>
          <tbody>{visiblePeople.map((person) => <tr key={person.id}>
            <td>{person.name}</td><td>{person.email}</td><td>{person.phone || "—"}</td>
            <td>{engineers ? data.projects.filter((project) => isAssignedToEngineer(project, person)).length : person.project}</td>
            <td><div className="person-card-actions"><button className="button button-outline person-details-button" type="button" onClick={() => {
              if (!engineers) setSelectedClientId(person.id);
              else if (person.role === "Project Manager") setSelectedProjectManagerId(person.id);
              else setSelectedEngineerId(person.id);
            }}>View details</button></div></td>
          </tr>)}</tbody>
        </table></div>
        : <p className="people-empty">No people in this section yet.</p>}
      <RecordPagination page={page} totalItems={people.length} onPageChange={setPage} />
    </>;
  };

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
  return <div className={`feature-page ${page === "Expenses" ? "expenses-feature-page" : ""} ${page === "Payments" ? "payment-feature-page" : ""} ${role === "Employee" && page === "Expenses" ? "engineer-expenses-feature-page" : ""} ${role === "Employee" && page === "Materials" ? "engineer-materials-feature-page" : ""}`}>
    {projectView && (selectedProject
      ? <ProjectDetails project={selectedProject} data={data} role={role} currentUser={currentUser} ownerContacts={ownerContacts} ownerContactsError={ownerContactsError} onBack={() => setSelectedProjectId(null)} onCreate={onCreate} />
      : <section className="panel feature-panel"><div className="list-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search projects" placeholder="Search projects, sites, clients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>{role === "Owner" && <div className="toolbar-actions"><button className="button button-primary" onClick={() => onCreate("project")}>＋ New project</button></div>}</div><ProjectCards projects={scopedProjects} onOpen={(project) => setSelectedProjectId(project.id)} /></section>)}
    {page === "Quotations" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">PROJECT PROPOSALS</span><h2 className="list-title">{role === "Client" ? "Quotations for you" : "Quotations & add-on work"}</h2></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter quotations" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Awaiting review</option><option>Sent to client</option><option>Approved</option><option>Changes requested</option></select>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("quote")}>＋ New quotation</button>}</div></div>{role === "Client" ? <div className="quotation-project-list">{Array.from(quotationGroups, ([projectName, projectQuotes]) => {
      const filteredQuotes = projectQuotes.filter((quote) => filter === "All" || quote.status === filter);
      if (filteredQuotes.length === 0) return null;
      const projectTotal = projectQuotes.reduce((total, quote) => total + quote.amount, 0);
      return <section className="quotation-project-group" key={projectName}><header><div><span className="panel-kicker">PROJECT QUOTATIONS</span><h3>{projectName}</h3></div><div><small>COMBINED TOTAL</small><strong>{formatCurrency(projectTotal)}</strong></div></header><div className="quote-list">{filteredQuotes.map((quote) => <article className="quote-row" key={quote.id}><span className="quote-file-icon">▤</span><div className="quote-row-main"><strong>{quote.title}</strong><span>{quote.id} · {quote.date}</span></div><strong className="quote-row-amount">{formatCurrency(quote.amount)}</strong><StatusBadge status={quote.status} />{quote.status !== "Approved" && quote.status !== "Declined" ? <div className="inline-actions"><button onClick={() => onQuote(quote, "Approved")}>Approve</button><button onClick={() => onQuote(quote, "Declined")}>Decline</button>{quote.attachment && <QuotationPdfPreview attachment={quote.attachment} title={quote.title} />}</div> : quote.attachment ? <QuotationPdfPreview attachment={quote.attachment} title={quote.title} /> : <button className="icon-button" onClick={() => onToast(`Opening ${quote.id} preview.`)} aria-label={`Open quotation ${quote.id}`}>↗</button>}</article>)}</div></section>;
    })}</div> : <div className="quote-list">{visibleQuotes.filter((item) => filter === "All" || item.status === filter).map((quote) => <article className="quote-row" key={quote.id}><span className="quote-file-icon">▤</span><div className="quote-row-main"><strong>{quote.title}</strong><span>{quote.id} · {quote.project} · {quote.date}</span></div><div className="quote-row-client"><small>CLIENT</small><strong>{quote.client}</strong></div><strong className="quote-row-amount">{formatCurrency(quote.amount)}</strong><StatusBadge status={quote.status} />{quote.attachment ? <QuotationPdfPreview attachment={quote.attachment} title={quote.title} /> : <button className="icon-button" onClick={() => onToast(`Opening ${quote.id} preview.`)} aria-label={`Open quotation ${quote.id}`}>↗</button>}</article>)}</div>}</section>}
    {page === "Payments" && <>
      <section className="payment-summary-grid" aria-label="Payment totals">
        <article className="payment-summary-stat"><span>Recorded total</span><strong>{formatCurrency(recordedPaymentTotal)}</strong><small>{filteredPayments.length} {filteredPayments.length === 1 ? "payment" : "payments"}</small></article>
        <article className="payment-summary-stat"><span>Cash payments</span><strong>{formatCurrency(cashPaymentTotal)}</strong><small>{filteredPayments.filter((payment) => payment.method === "Cash").length} records</small></article>
        <article className="payment-summary-stat"><span>Online payments</span><strong>{formatCurrency(onlinePaymentTotal)}</strong><small>{filteredPayments.filter((payment) => payment.method === "Online").length} records</small></article>
      </section>
      {paymentReceivedByProject.length > 0 && <section className="payment-progress-grid" aria-label="Payments received by project">
        {paymentReceivedByProject.map(({ project, payments, receivedAmount }) => <article className="payment-progress-card" key={project.id}>
          <div><strong>{project.name}</strong><b>{formatCurrency(receivedAmount)}</b></div>
          <small>{payments.length} {payments.length === 1 ? "payment" : "payments"} received</small>
        </article>)}
      </section>}
      <section className="panel feature-panel">
        <div className="list-toolbar">
          <div><span className="panel-kicker">{role === "Owner" ? "OWNER & CLIENT ACTIVITY" : "YOUR PROJECT ACTIVITY"}</span><h2 className="list-title">{role === "Owner" ? "Payment history" : "My project payments"}</h2></div>
          <div className="toolbar-actions">
            <select className="select-button" aria-label="Filter payments by project" value={paymentProjectFilter} onChange={(event) => setPaymentProjectFilter(event.target.value)}>
              <option value="All">All projects</option>
              {data.projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}
            </select>
            <button className="button button-primary" type="button" onClick={() => onCreate("payment")} disabled={scopedProjects.length === 0}>＋ Add payment</button>
          </div>
        </div>
        {filteredPayments.length
          ? <div className="payment-history-list">{filteredPayments.map((payment: Payment) => <article className="payment-history-row" key={payment.id}>
            <div className="payment-history-amount"><strong>{formatCurrency(payment.amount)}</strong><span>{payment.method}</span></div>
            <div className="payment-history-project"><strong>{payment.project}</strong><span>{payment.date}{payment.note ? ` · ${payment.note}` : ""}</span></div>
            <div className="payment-history-recorder"><strong>{payment.recordedBy}</strong><span>Recorded by {payment.recordedByRole.toLowerCase()}</span></div>
            {payment.proofImage && <a className="project-payment-proof" href={payment.proofImage} target="_blank" rel="noreferrer"><img src={payment.proofImage} alt={`Online payment proof uploaded by ${payment.recordedBy}`} />View proof</a>}
          </article>)}</div>
          : <p className="project-details-empty">{data.projects.length ? "No payments match this project filter yet." : "No assigned projects are available for payment tracking."}</p>}
      </section>
    </>}
    {role === "Employee" && page === "Expenses" && <section className="financial-summary-card engineer-expense-summary" aria-label="Your expense summary">
      <div className="financial-summary-top">
        <div><span>Total funds</span><strong>{formatCurrency(totalAssignedFunds)}</strong></div>
        <div className="engineer-expense-summary-spent"><span>Spent (logged expenses)</span><strong>{formatCurrency(totalLoggedExpenses)}</strong></div>
        <div className="financial-summary-profit"><span>Remaining funds</span><strong>{remainingFunds >= 0 ? `+${formatCurrency(remainingFunds)}` : `-${formatCurrency(Math.abs(remainingFunds))}`}</strong></div>
      </div>
    </section>}
    {role !== "Client" && page === "Expenses" && <>
      <section className="panel feature-panel">
        <div className="list-toolbar"><div><span className="panel-kicker">ASSIGNED SPENDING</span><h2 className="list-title">{role === "Owner" ? "Engineer fund allocations" : "Your assigned funds"}</h2></div>
          <div className="toolbar-actions">
            {role === "Owner" && <select className="select-button" aria-label="Filter fund allocations by engineer" value={allocationEngineerFilter} onChange={(event) => setAllocationEngineerFilter(event.target.value)}>
              <option value="All">All engineers</option>
              {allocationEngineers.map((engineer) => <option key={engineer} value={engineer}>{engineer}</option>)}
            </select>}
            {role === "Owner" && <button className="button button-outline" onClick={() => onCreate("expense-allocation")}>＋ Assign funds</button>}
            {role === "Employee" && <button className="button button-outline" onClick={() => onCreate("expense")}>＋ Request extra funds</button>}
          </div>
        </div>
        {role === "Employee" && <p className="feature-subtitle">Review the funds assigned to you. Request extra funds here if you need more.</p>}
        {filteredExpenseAllocations.length ? <div className="project-details-list">{allocationPageRecords.map((allocation) => <article key={allocation.id}>
          <div><strong>{role === "Owner" ? allocation.engineer : `Assigned ${allocation.assignedAt}`}</strong><span>{formatCurrency(allocation.spentAmount)} spent · {formatCurrency(allocation.remainingAmount)} remaining</span></div>
          <strong>{formatCurrency(allocation.amount)}</strong>
        </article>)}</div> : <div className="inline-empty">{role === "Owner" ? allocationEngineerFilter === "All" ? "No funds have been assigned to engineers yet." : `No funds have been assigned to ${allocationEngineerFilter} yet.` : "No funds have been assigned to you yet."}</div>}
        <RecordPagination page={currentAllocationPage} totalItems={filteredExpenseAllocations.length} onPageChange={setAllocationPage} />
      </section>
      <section className="panel feature-panel">
        <div className="list-toolbar"><div><span className="panel-kicker">MONEY IN MOTION</span><h2 className="list-title">Expenses & receipts</h2></div>
          <div className="toolbar-actions">
            <select className="select-button" aria-label="Filter expenses by project" value={expenseProjectFilter} onChange={(event) => setExpenseProjectFilter(event.target.value)}><option value="All">All projects</option>{data.projects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>
            <label className="work-progress-date-filter"><DateInput aria-label="Filter expenses by date" value={expenseDateFilter} onChange={(event) => setExpenseDateFilter(event.currentTarget.value)} onClear={() => setExpenseDateFilter("")} /></label>
            {role === "Employee" && <button className="button button-primary" onClick={() => onCreate("expense-log")}>＋ Log expense</button>}
            {role === "Owner" && <button className="button button-primary" onClick={() => onCreate("expense-log")}>＋ Log expense</button>}
          </div>
        </div>
        <ExpenseRows expenses={expensePageRecords} detailed onAction={(expense) => {
      onToast(`${expense.id}: ${expense.description} · ${formatCurrency(expense.amount)} · Submitted by ${expense.submittedBy}.`);
    }} onApprove={role === "Owner" ? (expense) => onExpenseStatus(expense, "Approved") : undefined} onDecline={role === "Owner" ? (expense) => onExpenseStatus(expense, "Declined") : undefined} />
        <RecordPagination page={currentExpensePage} totalItems={filteredExpenses.length} onPageChange={setExpensePage} />
      </section>
    </>}
    {page === "Progress Updates" && <section className="panel feature-panel"><div className="feature-intro"><div><span className="panel-kicker">FIELD REPORTING</span><h2>Progress updates</h2><p>Keep owners and clients up to date with work completed on site.</p></div><button className="button button-primary" onClick={() => onCreate("progress")}>＋ Submit daily update</button></div><div className="list-toolbar"><span className="panel-kicker">MY SITE UPDATES</span><div className="toolbar-actions"><select className="select-button" aria-label="Filter progress updates by project" value={workProgressProject} onChange={(event) => { setWorkProgressProject(event.target.value); setSelectedWorkProgress(null); }}><option value="All">All projects</option>{scopedProjects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select><div className="work-progress-date-filter"><DateInput aria-label="Filter progress updates by date" value={workProgressDate} onChange={(event) => { setWorkProgressDate(event.currentTarget.value); setSelectedWorkProgress(null); }} onClear={() => { setWorkProgressDate(""); setSelectedWorkProgress(null); }} /></div></div></div>{(() => {
      const engineerUpdates = data.activities.filter((item) =>
        item.kind === "progress" &&
        (role !== "Employee" || (item.actor === currentUser && scopedProjects.some((project) => project.name === item.project))) &&
        (workProgressProject === "All" || item.project === workProgressProject) &&
        (!workProgressDate || localDateKey(item.createdAt) === workProgressDate)
      );
      return engineerUpdates.length > 0
        ? <div className="progress-update-list">{engineerUpdates.map(renderProgressRow)}</div>
        : <div className="inline-empty">{workProgressDate ? "No work progress updates were shared on this date." : "No work progress updates have been shared yet."}</div>;
    })()}</section>}
    {page === "Materials" && <>
      <section className="panel feature-panel">
        <div className="list-toolbar"><div><span className="panel-kicker">ASSIGNED & REQUESTED MATERIALS</span><h2 className="list-title">Assigned and requested materials</h2></div><div className="toolbar-actions">
          <select className="select-button" aria-label="Filter assigned materials and requests by project" value={materialProjectFilter} onChange={(event) => setMaterialProjectFilter(event.target.value)}><option value="All">All projects</option>{scopedProjects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>
          <select className="select-button" aria-label="Filter assignments and requests by status" value={materialActivityStatusFilter} onChange={(event) => setMaterialActivityStatusFilter(event.target.value)}><option value="All">All statuses</option><option>Assigned</option><option>Pending review</option><option>Approved</option><option>Declined</option></select>
          {role === "Employee" && <button className="button button-primary" onClick={() => onCreate("material-request")}>＋ Request material</button>}
        </div></div>
        {materialAssignmentRows.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Type</th><th>Material</th><th>Project / site</th><th>Quantity / balance</th><th>Submitted by</th><th>Date</th><th>Status</th><th>Note</th></tr></thead><tbody>
          {materialAssignmentRows.map((item) => <tr key={item.id}><td>{item.type}</td><td>{item.material}</td><td>{item.project}</td><td>{item.quantity}</td><td>{item.submittedBy}</td><td>{item.date}</td><td><StatusBadge status={item.status} /></td><td>{item.note || "—"}</td></tr>)}
        </tbody></table></div> : <p className="people-empty">No assigned materials or requests match this filter.</p>}
      </section>
      <section className="panel feature-panel">
        <div className="list-toolbar"><div><span className="panel-kicker">MATERIAL LOGS</span><h2 className="list-title">Material usage logs</h2></div><div className="toolbar-actions">
          <select className="select-button" aria-label="Filter material logs by project" value={materialLogProjectFilter} onChange={(event) => setMaterialLogProjectFilter(event.target.value)}><option value="All">All projects</option>{scopedProjects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select>
          {role === "Employee" && <button className="button button-primary" onClick={() => onCreate("material-log")}>＋ Log material use</button>}
        </div></div>
        {visibleMaterialLogs.length ? <div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Used</th><th>Engineer</th><th>Logged</th><th>Note</th></tr></thead><tbody>
          {visibleMaterialLogs.map((log) => <tr key={log.id}><td>{log.material}</td><td>{log.project}</td><td>{log.quantity} {log.unit}</td><td>{log.engineer}</td><td>{log.loggedAt}</td><td>{log.note || "—"}</td></tr>)}
        </tbody></table></div> : <p className="people-empty">No material usage logs match this filter.</p>}
      </section>
    </>}
    {page === "Attendance" && <AttendancePage data={data} role={role} currentUser={currentUser} onSubmit={onAttendanceSubmit} onRegularize={onAttendanceRegularize} onReviewRequest={onAttendanceRequestReview} onReviewLeaveRequest={onAttendanceLeaveReview} />}
    {page === "Site Visits" && <SiteVisitsPage visits={data.siteVisits} projects={projects} role={role} currentUser={currentUser} onAction={onVisitStatus} onCheckIn={onVisitCheckIn} />}
    {page === "Work Requests" && <WorkRequestsPage role={role} currentUser={currentUser} projects={data.projects} refreshKey={workRequestsRefresh} onToast={onToast} />}
    {page === "Reports" && <section className="report-grid"><article className="report-card panel"><span className="report-icon">▥</span><span className="panel-kicker">PROJECT PERFORMANCE</span><h2>Progress report</h2><p>Milestone completion and updates, by project and site.</p><button className="text-link" onClick={() => void downloadReport("progress")}>Generate report ↗</button></article><article className="report-card panel"><span className="report-icon">＄</span><span className="panel-kicker">FINANCIAL HEALTH</span><h2>Expense report</h2><p>Approved, pending, and paid expenses across your portfolio.</p><button className="text-link" onClick={() => void downloadReport("expenses")}>Generate report ↗</button></article><article className="report-card panel"><span className="report-icon">◈</span><span className="panel-kicker">SITE INVENTORY</span><h2>Materials report</h2><p>Material received, consumed, and remaining at every site.</p><button className="text-link" onClick={() => void downloadReport("materials")}>Generate report ↗</button></article></section>}
    {(page === "Settings" || page === "Settings & Backup") && <>
      <section className="panel palette-settings">
        <div className="panel-heading compact"><div><span className="panel-kicker">PERSONAL APPEARANCE</span><h2>Color palette</h2></div><span className="palette-scope-label">Saved per user</span></div>
        <p className="palette-settings-copy">Choose the colors for your account. Your selection is saved in this browser and does not change other users' palettes.</p>
        <PalettePicker onError={onToast} />
      </section>
      {page === "Settings & Backup" && role === "Owner" && <>
        <section className="backup-layout"><article className="panel backup-card"><span className="report-icon">↧</span><span className="panel-kicker">ACCOUNT DATA</span><h2>Back up your workspace</h2><p>Download a JSON export of your project, site, quotation, and expense records.</p><ul><li>Project and site summaries</li><li>Quotations and expense records</li><li>Activity and attendance history</li></ul><button className="button button-primary" onClick={onBackup}>＋ Request account backup</button><small>Backups are generated from current workspace data.</small></article><section className="panel backup-history"><div className="panel-heading compact"><div><span className="panel-kicker">RECENT REQUESTS</span><h2>Backup history</h2></div><span className="backup-count">{data.backups.length} requests</span></div><div className="backup-list">{data.backups.map((backup) => <article className="backup-row" key={backup.id}><span className="backup-file">↧</span><div><strong>{backup.id} · Workspace data export</strong><small>Requested by {backup.requestedBy} · {backup.requestedAt}</small></div><button className="button button-outline" onClick={() => void downloadBackup(backup.id)}>Download</button><StatusBadge status={backup.status} /></article>)}</div></section></section>
      </>}
    </>}
    {page === "Logs" && role === "Owner" && <section className="panel backup-history owner-audit-history">
      <div className="panel-heading compact"><div><span className="panel-kicker">OWNER ACTIVITY</span><h2>Audit log</h2></div><button className="button button-outline" disabled={auditLogsLoading} onClick={() => void loadOwnerAuditLogs()}>{auditLogsLoading ? "Refreshing…" : "Refresh"}</button></div>
      {auditLogsError
        ? <p className="palette-settings-copy" role="alert">{auditLogsError}</p>
        : ownerAuditLogs.length > 0
          ? <><div className="backup-list">{visibleAuditLogs.map((entry) => <article className="backup-row" key={entry.id}><span className="backup-file">↻</span><div><strong>{entry.action} {entry.resource}{entry.target ? ` · ${entry.target}` : ""}</strong><small>{entry.ownerName} ({entry.ownerEmail}) · {new Date(entry.createdAt).toLocaleString()}</small></div></article>)}</div><RecordPagination page={currentAuditLogsPage} totalItems={ownerAuditLogs.length} pageSize={AUDIT_LOGS_PER_PAGE} onPageChange={setAuditLogsPage} /></>
          : <p className="palette-settings-copy">{auditLogsLoading ? "Loading owner activity…" : "No owner actions have been recorded yet."}</p>}
    </section>}
    {page === "People" && (role === "Owner" || role === "ProjectManager") && <section className="panel feature-panel">
      {selectedTeamMember ? <>
        <div className="list-toolbar engineer-details-header"><div><span className="panel-kicker">{selectedEngineer ? "SITE ENGINEER DETAILS" : selectedProjectManager ? "PROJECT MANAGER DETAILS" : "CLIENT DETAILS"}</span><h2 className="list-title">{selectedTeamMember.name}</h2></div><button className="button button-outline" onClick={() => { setSelectedEngineerId(null); setSelectedProjectManagerId(null); setSelectedClientId(null); }}>← Back to people</button></div>
        <div className="engineer-details-actions"><button className="button button-outline" onClick={() => setPersonBeingEdited(selectedTeamMember)}>Edit {selectedEngineer ? "engineer" : selectedProjectManager ? "project manager" : "client"}</button><button className="button button-danger" onClick={() => setPersonPendingDeletion(selectedTeamMember)}>Delete {selectedEngineer ? "engineer" : selectedProjectManager ? "project manager" : "client"}</button></div>
        <div className="engineer-profile-grid">
          <article><span>Full name</span><strong>{selectedTeamMember.name}</strong></article>
          <article><span>Email</span><strong>{selectedTeamMember.email}</strong></article>
          <article><span>Phone number</span><strong>{selectedTeamMember.phone || "Not provided"}</strong></article>
          <article><span>Assigned {selectedEngineer ? "sites" : "projects"}</span><strong>{selectedTeamProjects.length}</strong></article>
        </div>
        {selectedTeamProjects.length > 0
          ? <div className="engineer-site-list">{selectedTeamProjects.map((project) => {
            const expanded = expandedSiteId === project.id;
            const siteMaterials = data.materials.filter((material) => material.project === project.name);
            return <article className={`engineer-site-card ${expanded ? "engineer-site-expanded" : ""}`} key={project.id}>
              <div className="engineer-site-row">
                <div><strong>{project.name}</strong><span>{project.site} · {project.status}</span></div>
                <div className="engineer-site-actions">
                  <button className="icon-button engineer-site-toggle" type="button" aria-label={`${expanded ? "Hide" : "Show"} details for ${project.name}`} aria-expanded={expanded} aria-controls={`site-details-${project.id}`} onClick={() => setExpandedSiteId(expanded ? null : project.id)}>{expanded ? "⌃" : "⌄"}</button>
                </div>
              </div>
              {expanded && <div className="engineer-site-details" id={`site-details-${project.id}`}>
                <div><span>Assigned engineer</span><strong>{project.engineer}</strong></div>
                <div><span>Client</span><strong>{project.client}</strong></div>
                <div><span>Progress</span><strong>{project.progress}%</strong></div>
                <div><span>Status</span><strong>{project.status}</strong></div>
                {selectedEngineer && <div className="engineer-site-materials"><span>Materials</span>{siteMaterials.length > 0
                  ? <ul>{siteMaterials.map((material) => <li key={material.id}><strong>{material.material}</strong><span>Received {material.received} · Used {material.used} · In stock {material.stock}</span></li>)}</ul>
                  : <p>No materials recorded for this site.</p>}</div>}
                {!selectedProjectManager && <button className="button button-danger engineer-site-unassign" type="button" disabled={unassigningProjectId === project.id} onClick={() => setProjectPendingUnassignment(project)}>{unassigningProjectId === project.id ? "Unassigning…" : `Unassign ${selectedEngineer ? "site" : "project"}`}</button>}
              </div>}
            </article>;
          })}</div>
          : <p className="people-empty">No {selectedEngineer ? "sites are currently assigned to this engineer." : selectedProjectManager ? "projects are currently assigned to this project manager." : "projects are currently assigned to this client."}</p>}
      </> : <>
        <div className="list-toolbar"><div><span className="panel-kicker">YOUR TEAM</span><h2 className="list-title">People</h2></div></div>
        <section className="people-section"><div className="people-section-heading"><h3 className="people-section-title">Site Engineers &amp; Project Managers</h3>{role === "Owner" && <button className="button button-primary" type="button" onClick={() => onCreatePerson("Site Engineer")}>＋ Add team member</button>}</div>{renderPeople(data.people.filter((person) => person.role === "Site Engineer" || person.role === "Project Manager"), true)}</section>
        <section className="people-section"><div className="people-section-heading"><h3 className="people-section-title">Clients</h3>{role === "Owner" && <button className="button button-primary" type="button" onClick={() => onCreatePerson("Client")}>＋ Add client</button>}</div>{renderPeople(data.people.filter((person) => person.role === "Client"))}</section>
      </>}
    </section>}
    {page === "Work Progress" && (role === "Client" || role === "Owner" || role === "ProjectManager") && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">{role === "Client" ? "FROM YOUR PROJECT TEAM" : "SITE TEAM UPDATES"}</span><h2 className="list-title">Work progress</h2><p className="feature-subtitle">{role === "Client" ? "Updates and photos shared by your project team." : "Updates and photos shared by engineers across your projects."}</p></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter work progress by project" value={workProgressProject} onChange={(event) => { setWorkProgressProject(event.target.value); setSelectedWorkProgress(null); }}><option value="All">All projects</option>{scopedProjects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select><div className="work-progress-date-filter"><DateInput aria-label="Filter work progress by date" value={workProgressDate} onChange={(event) => { setWorkProgressDate(event.currentTarget.value); setSelectedWorkProgress(null); }} onClear={() => { setWorkProgressDate(""); setSelectedWorkProgress(null); }} /></div></div></div>{clientWorkProgress.length > 0 ? <div className="progress-update-list">{clientWorkProgress.map(renderProgressRow)}</div> : <div className="inline-empty">{workProgressProject !== "All" ? `No work progress updates were shared for ${workProgressProject}${workProgressDate ? " on this date" : ""}.` : workProgressDate ? "No work progress updates were shared on this date." : "No work progress updates have been shared yet."}</div>}</section>}
    {(page === "Work Progress" || page === "Progress Updates") && selectedWorkProgress && <div className="client-progress-gallery-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedWorkProgress(null); }}>
      <section className="client-progress-gallery" role="dialog" aria-modal="true" aria-label={`${activeWorkProgressPhoto?.project ?? selectedWorkProgress.project} progress photos`}>
        <header className="client-progress-gallery-header"><strong>{activeWorkProgressPhoto?.project ?? selectedWorkProgress.project} - Progress Photos</strong><button type="button" aria-label="Close progress photos" onClick={() => setSelectedWorkProgress(null)}>×</button></header>
        <div className="client-progress-gallery-stage">
          {activeWorkProgressPhoto?.attachment
            ? <img src={activeWorkProgressPhoto.attachment} alt={`Progress update: ${activeWorkProgressPhoto.description || activeWorkProgressPhoto.project}`} />
            : <p>No photos are available for this progress update.</p>}
          {selectedWorkProgressPhotos.length > 1 && <>
            <button type="button" className="client-progress-gallery-arrow previous" aria-label="Previous progress photo" onClick={() => setWorkProgressPhotoIndex((index) => (index - 1 + selectedWorkProgressPhotos.length) % selectedWorkProgressPhotos.length)}>‹</button>
            <button type="button" className="client-progress-gallery-arrow next" aria-label="Next progress photo" onClick={() => setWorkProgressPhotoIndex((index) => (index + 1) % selectedWorkProgressPhotos.length)}>›</button>
          </>}
        </div>
        <div className="client-progress-gallery-caption">
          <span>{activeWorkProgressPhoto?.description || activeWorkProgressPhoto?.action || selectedWorkProgress.description || selectedWorkProgress.action}</span>
          <small>{selectedWorkProgressPhotos.length ? `Image ${workProgressPhotoIndex + 1} of ${selectedWorkProgressPhotos.length}` : selectedWorkProgress.project}</small>
        </div>
      </section>
    </div>}
    {page === "Timeline" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">PROJECT ACTIVITY</span><h2 className="list-title">Project timeline & updates</h2></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter project timeline by project" value={timelineProject} onChange={(event) => setTimelineProject(event.target.value)}><option value="All">All projects</option>{scopedProjects.map((project) => <option key={project.id} value={project.name}>{project.name}</option>)}</select><StatusBadge status="In progress" /></div></div><div className="timeline full-timeline">{data.activities.filter((item) => item.kind === "progress" && scopedProjects.some((project) => project.name === item.project) && (timelineProject === "All" || item.project === timelineProject)).map((item) => <div className="timeline-item timeline-done" key={item.id}><div className="timeline-marker">✓</div><div className="timeline-date">{item.createdAt ? new Date(item.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : item.time}</div><div className="timeline-content"><strong>{item.description || item.action}</strong><span>{item.project} · {item.actor}</span></div></div>)}</div></section>}
    {page === "Feedback" && role === "Owner" && <section className="panel feature-panel"><div className="panel-heading compact"><div><span className="panel-kicker">CLIENT VOICE</span><h2>Project feedback & reviews</h2></div><span className="backup-count">{data.feedback.length} reviews</span></div><div className="quote-list">{data.feedback.map((item) => <article className="feedback-review" key={item.id}><span className="avatar">{initials(item.client)}</span><div><div className="review-title"><strong>{item.client}</strong><span className="aside-stars">{"★".repeat(item.rating)}</span></div><p>{item.comment}</p><small>{item.project} · {item.date}</small></div></article>)}</div></section>}
    {page === "Feedback" && role === "Client" && <section className="panel feature-panel feedback-layout"><div><span className="panel-kicker">YOUR VOICE MATTERS</span><h2 className="list-title">Share your review</h2><p className="feature-subtitle">Your rating and comment will be saved for the project owner, then you’ll continue to Google to post it publicly.</p><form className="feedback-form" onSubmit={onFeedback}><label>Project<select name="project" required defaultValue={scopedProjects[0]?.name}>{scopedProjects.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label>Your rating<div className="rating-stars" role="radiogroup" aria-label="Rate your experience">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} aria-label={`${star} stars`} aria-checked={rating === star} role="radio" className={star <= rating ? "star-selected" : ""} onClick={() => setRating(star)}>★</button>)}</div><input type="hidden" name="rating" value={rating} /></label><label>Your review<textarea name="comment" required rows={4} maxLength={2000} placeholder="Share your experience with the project team..." /></label><button className="button button-primary" type="submit" disabled={!scopedProjects.length}>Post review on Google ↗</button></form></div><aside className="feedback-aside"><span>★</span><p>Your review will be saved for the project owner before you continue to Google.</p><strong>Vanya BuildTrack</strong><small>BuildTrack and Google reviews</small></aside></section>}
    {personBeingEdited && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPersonBeingEdited(null); }}>
      <section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="edit-person-title">
        <div className="modal-heading"><div><span className="panel-kicker">YOUR TEAM</span><h2 id="edit-person-title">Edit {personBeingEdited.name}</h2></div><button className="icon-button modal-close" aria-label="Close dialog" onClick={() => setPersonBeingEdited(null)}>×</button></div>
        <form onSubmit={(event) => { event.preventDefault(); void onUpdatePerson(personBeingEdited, event).then((updated) => { if (updated) setPersonBeingEdited(null); }); }}>
          <label>Full name<input name="name" required defaultValue={personBeingEdited.name} /></label>
          <label>Email<input name="email" type="email" required defaultValue={personBeingEdited.email} /></label>
          <label>Phone number<div className="phone-input-prefix"><span>+91</span><input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" maxLength={10} autoComplete="tel" defaultValue={(personBeingEdited.phone ?? "").replace(/^\+91/, "")} placeholder="98765 43210" /></div></label>
          <div className="modal-actions"><button className="button button-outline" type="button" onClick={() => setPersonBeingEdited(null)}>Cancel</button><button className="button button-primary" type="submit">Save changes</button></div>
        </form>
      </section>
    </div>}
    {projectPendingUnassignment && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setProjectPendingUnassignment(null); }}>
      <section className="modal-card delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="unassign-confirm-title" aria-describedby="unassign-confirm-description">
        <div className="modal-heading"><div><span className="panel-kicker">CONFIRM SITE CHANGE</span><h2 id="unassign-confirm-title">Unassign {projectPendingUnassignment.name}?</h2></div><button className="icon-button modal-close" aria-label="Cancel unassign" onClick={() => setProjectPendingUnassignment(null)}>×</button></div>
        <p id="unassign-confirm-description">This {selectedEngineer ? "site" : "project"} will no longer be assigned to {selectedTeamMember?.name}.</p>
        <div className="modal-actions"><button className="button button-outline" onClick={() => setProjectPendingUnassignment(null)}>Cancel</button><button className="button button-danger" onClick={() => {
          const project = projectPendingUnassignment;
          setProjectPendingUnassignment(null);
          setUnassigningProjectId(project.id);
          const unassign = selectedClient
            ? onUnassignClientProject(selectedClient, project)
            : onUnassignEngineerProject(project);
          void unassign.finally(() => setUnassigningProjectId(null));
        }}>Unassign {selectedEngineer ? "site" : "project"}</button></div>
      </section>
    </div>}
    {personPendingDeletion && <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPersonPendingDeletion(null); }}>
      <section className="modal-card delete-confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" aria-describedby="delete-confirm-description">
        <div className="modal-heading"><div><span className="panel-kicker">CONFIRM DELETE</span><h2 id="delete-confirm-title">Remove {personPendingDeletion.name}?</h2></div><button className="icon-button modal-close" aria-label="Cancel delete" onClick={() => setPersonPendingDeletion(null)}>×</button></div>
        <p id="delete-confirm-description">{personPendingDeletion.role === "Site Engineer" ? "This will remove the engineer from your team list and revoke their sign-in access. This action cannot be undone." : personPendingDeletion.role === "Project Manager" ? "This will remove the project manager from your team list and revoke their sign-in access. This action cannot be undone." : "This will remove the client from your team list and revoke their sign-in access. This action cannot be undone."}</p>
        <div className="modal-actions"><button className="button button-outline" onClick={() => setPersonPendingDeletion(null)}>Cancel</button><button className="button button-danger" onClick={() => { const person = personPendingDeletion; setPersonPendingDeletion(null); if (selectedEngineerId === person.id) setSelectedEngineerId(null); if (selectedProjectManagerId === person.id) setSelectedProjectManagerId(null); if (selectedClientId === person.id) setSelectedClientId(null); onRemovePerson(person); }}>{personPendingDeletion.role === "Site Engineer" ? "Delete engineer" : personPendingDeletion.role === "Project Manager" ? "Delete project manager" : "Delete client"}</button></div>
      </section>
    </div>}
  </div>;
}
