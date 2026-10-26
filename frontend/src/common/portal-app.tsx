import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import type { Attendance, AttendanceProof, Backup, DashboardData, Feedback, Quote, Role, RoleId, NotificationItem } from "./types";
import { fallbackData, navigation, pageFromPath, pagePath, readSession, roleId, roleName, rolePath } from "./data";
import { formatCurrency, initials } from "./utils";
import { BuildingIcon, RecordModal } from "./components";
import OwnerDashboard from "../owner/dashboard/page";
import EngineerDashboard from "../engineer/dashboard/page";
import ClientDashboard from "../client/dashboard/page";
import { FeaturePage } from "./feature-page";
import OwnerProjectsPage from "../owner/projects/page";
import OwnerMaterialsPage from "../owner/material/page";

export function PortalRoute({ role }: { role: RoleId }) {
  const session = readSession();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/signin" replace state={{ from: location.pathname }} />;
  }
  if (session.role !== role) {
    return <Navigate to={rolePath(session.role)} replace />;
  }
  return <PortalApp role={roleName(role)} userName={session.name} />;
}

export function PortalApp({ role, userName }: { role: Role; userName: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState<DashboardData>(fallbackData);
  const page = pageFromPath(location.pathname, role);
  const [apiStatus, setApiStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("All");
  const [toast, setToast] = useState("");
  const [modal, setModal] = useState<"project" | "quote" | "progress" | "expense" | "visit" | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const navigateToPage = (nextPage: string) => navigate(pagePath(role, nextPage));

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/dashboard");
        if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
        const result: DashboardData = await response.json();
        if (active) {
          setData(result);
          setApiStatus("connected");
        }
      } catch (error) {
        console.error("Unable to load dashboard API; showing local demo data:", error);
        if (active) setApiStatus("offline");
      }
    };
    void load();
    return () => { active = false; };
  }, []);

  const visibleProjects = useMemo(() => data.projects.filter((project) => {
    const matchesSearch = `${project.name} ${project.site} ${project.client}`.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === "All" || project.status === filter;
    return matchesSearch && matchesFilter;
  }), [data.projects, filter, search]);

  const notifications = useMemo<NotificationItem[]>(() => {
    if (role === "Owner") {
      return [
        ...data.expenses.filter((expense) => expense.status.toLowerCase().includes("pending")).map((expense) => ({
          title: "Expense needs review",
          detail: `${expense.description} · ${formatCurrency(expense.amount)}`,
          time: expense.date,
          icon: "＄",
          page: "Expenses"
        })),
        ...data.quotes.filter((quote) => quote.status.toLowerCase().includes("review")).map((quote) => ({
          title: "Quotation needs review",
          detail: `${quote.title} · ${quote.project}`,
          time: quote.date,
          icon: "▤",
          page: "Quotations"
        }))
      ].slice(0, 8);
    }
    if (role === "Employee") {
      return [
        ...data.siteVisits.filter((visit) => visit.status === "Scheduled" && visit.engineer === userName).map((visit) => ({
          title: "Upcoming site visit",
          detail: `${visit.project} · ${visit.site}`,
          time: `${visit.date} at ${visit.time}`,
          icon: "⌖",
          page: "Site Visits"
        })),
        ...data.activities.filter((activity) => activity.kind === "progress").map((activity) => ({
          title: "Site progress update",
          detail: `${activity.actor} · ${activity.project}`,
          time: activity.time,
          icon: "▥",
          page: "Progress Updates"
        }))
      ].slice(0, 8);
    }
    return [
      ...data.quotes.filter((quote) => quote.status === "Sent to client" || quote.status === "Changes requested").map((quote) => ({
        title: quote.status === "Sent to client" ? "Quotation ready for review" : "Quotation updated",
        detail: `${quote.title} · ${quote.project}`,
        time: quote.date,
        icon: "▤",
        page: "Quotations"
      })),
      ...data.activities.slice(0, 5).map((activity) => ({
        title: "Project update",
        detail: `${activity.action} · ${activity.project}`,
        time: activity.time,
        icon: "◷",
        page: "Timeline"
      }))
    ].slice(0, 8);
  }, [userName, data.activities, data.expenses, data.quotes, data.siteVisits, role]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setNotificationsOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [notificationsOpen]);

  const showToast = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  };

  const createRecord = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!modal) return;
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || form.get("title") || form.get("description") || "").trim();
    const amount = Number(form.get("amount") || 0);
    const endpoint = `/api/${modal === "project" ? "projects" : modal === "quote" ? "quotations" : modal === "expense" ? "expenses" : modal === "visit" ? "site-visits" : "progress"}`;
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          title: name,
          description: name,
          amount,
          project: form.get("project"),
          engineer: form.get("engineer"),
          date: form.get("date")
        })
      });
      if (!response.ok) throw new Error(`Could not save record (${response.status})`);
      const result = await response.json() as { record?: { id: string; name?: string; title?: string; project?: string; amount?: number; status?: string } };
      const record = result.record;
      if (record && modal === "project") {
        setData((current) => ({ ...current, projects: [{ ...fallbackData.projects[0], id: record.id, name: record.name || name, site: "New project site", client: "Unassigned", engineer: "Unassigned", progress: 0, budget: 0, spent: 0, dueDate: "To be confirmed", image: "photo-1600585154340-be6161a56a0c", status: record.status || "Planning" }, ...current.projects] }));
      } else if (record && modal === "quote") {
        setData((current) => ({ ...current, quotes: [{ id: record.id, project: String(form.get("project") || "Riverside Residence"), title: record.title || name, client: "Ananya Rao", amount: record.amount || amount, date: "25 Oct 2026", status: record.status || "Awaiting review" }, ...current.quotes] }));
      } else if (record && modal === "expense") {
        setData((current) => ({ ...current, expenses: [{ id: record.id, project: String(form.get("project") || "Riverside Residence"), category: "Other", description: record.name || name, amount: record.amount || amount, date: "25 Oct 2026", submittedBy: role === "Employee" ? currentUser : "John Smith", status: "Pending review" }, ...current.expenses] }));
      } else if (record && modal === "visit") {
        setData((current) => ({ ...current, siteVisits: [{ id: record.id, project: String(form.get("project")), site: "Project site", engineer: String(form.get("engineer")), date: String(form.get("date")).slice(0, 10), time: "Scheduled", status: "Scheduled" }, ...current.siteVisits] }));
      } else if (record && modal === "progress") {
        setData((current) => ({
          ...current,
          activities: [{
            id: record.id,
            actor: currentUser,
            action: `submitted a progress update: ${name}`,
            project: String(form.get("project")),
            time: "Just now",
            kind: "progress"
          }, ...current.activities]
        }));
      }
      setModal(null);
      showToast(`${modal === "project" ? "Project" : modal === "quote" ? "Quotation" : modal === "expense" ? "Expense" : modal === "visit" ? "Site visit" : "Progress update"} saved to the demo API.`);
    } catch (error) {
      console.error("Unable to save demo record:", error);
      showToast("Could not save this record. Check the API connection and try again.");
    }
  };

  const updateQuote = async (quote: Quote, decision: "Approved" | "Declined") => {
    try {
      const response = await fetch(`/api/quotations/${quote.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: decision }) });
      if (!response.ok) throw new Error(`Quotation update failed (${response.status})`);
      setData((current) => ({ ...current, quotes: current.quotes.map((item) => item.id === quote.id ? { ...item, status: decision } : item) }));
      showToast(`Quotation ${decision.toLowerCase()}.`);
    } catch (error) {
      console.error("Unable to update quotation:", error);
      showToast("Could not update quotation. Check the API connection.");
    }
  };

  const submitAttendance = async (action: "check-in" | "check-out", date: string, proof: AttendanceProof) => {
    try {
      const response = await fetch("/api/attendance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ engineer: currentUser, action, date, proof })
      });
      const result = await response.json() as { record?: Attendance; error?: string };
      if (!response.ok) throw new Error(result.error || `Attendance submission failed (${response.status})`);
      const savedRecord = result.record;
      if (!savedRecord) throw new Error("The attendance service returned no saved record.");
      setData((current) => ({
        ...current,
        attendance: current.attendance.some((record) => record.id === savedRecord.id)
          ? current.attendance.map((record) => record.id === savedRecord.id ? savedRecord : record)
          : [savedRecord, ...current.attendance]
      }));
      showToast(`${action === "check-in" ? "Check-in" : "Check-out"} recorded with photo and location.`);
    } catch (error) {
      console.error("Unable to submit attendance:", error);
      throw error;
    }
  };

  const submitFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: form.get("project"),
          comment: form.get("comment"),
          rating: Number(form.get("rating"))
        })
      });
      if (!response.ok) throw new Error(`Feedback request failed (${response.status})`);
      const result = await response.json() as { record: Feedback };
      setData((current) => ({ ...current, feedback: [result.record, ...current.feedback] }));
      showToast("Thank you — your feedback has been shared with the project team.");
    } catch (error) {
      console.error("Unable to submit feedback:", error);
      showToast("Could not submit feedback. Check the API connection and try again.");
    }
  };

  const requestBackup = async () => {
    try {
      const response = await fetch("/api/backups", { method: "POST" });
      if (!response.ok) throw new Error(`Backup request failed (${response.status})`);
      const result = await response.json() as { record: Backup };
      setData((current) => ({ ...current, backups: [result.record, ...current.backups] }));
      showToast(`Backup ${result.record.id} requested. Status: ${result.record.status}.`);
    } catch (error) {
      console.error("Unable to request account backup:", error);
      showToast("Could not request a backup. Check the API connection.");
    }
  };

  const signOut = async () => {
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error(`Sign-out failed (${response.status})`);
    } catch (error) {
      console.error("Demo API sign-out failed:", error);
    } finally {
      localStorage.removeItem("buildtrack-session");
      navigate("/signin", { replace: true });
    }
  };

  const currentUser = userName;
  const pageDescription: Record<string, string> = {
    Dashboard: role === "Owner" ? "Here's your construction overview." : role === "Employee" ? "A clear view of your sites and today's priorities." : "Stay close to every detail of your project.",
    "Projects & Sites": "Manage active projects, sites, teams, and delivery dates.",
    "My Sites": "Your assigned sites, site tasks, and latest progress.",
    "My Projects": "Your construction projects, progress, and project payments.",
    Materials: "Track materials received, used, and remaining across your sites.",
    Expenses: role === "Client" ? "Review approved expenses for your projects." : "Keep project spending and receipt reviews in view.",
    Quotations: "Manage project quotations and additional work approvals.",
    "Progress Updates": "Share the latest site progress with your project team.",
    Attendance: "Review daily attendance across your construction sites.",
    Reports: "Project-wise progress, expenses, materials, and activity.",
    "Site Visits": "Plan and follow up on engineer site visits.",
    "Settings & Backup": "Manage your profile and request an account data backup.",
    People: "Manage clients and engineers across your projects.",
    Timeline: "Follow project milestones and site updates.",
    Feedback: "Share feedback and follow project reviews.",
    Instructions: "Owner instructions and recent project updates."
  };
  const pageTitle = page === "Dashboard" ? `${role} Dashboard` : page;
  const featurePageProps = {
    currentUser,
    data,
    projects: visibleProjects,
    search,
    setSearch,
    filter,
    setFilter,
    onCreate: setModal,
    onQuote: updateQuote,
    onAttendanceSubmit: submitAttendance,
    onToast: showToast,
    onFeedback: submitFeedback,
    onBackup: requestBackup
  };

  return (
    <div className="app-frame">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <Link className="brand" to={rolePath(roleId(role))} aria-label="Vanya BuildTrack home">
          <span className="brand-mark"><BuildingIcon /></span>
          <span className="brand-copy"><strong>Vanya BuildTrack</strong><small>Construction workspace</small></span>
        </Link>
        <div className="profile">
          <span className="avatar">{initials(currentUser)}</span>
          <span className="profile-copy"><strong>{currentUser}</strong><small>{role === "Owner" ? "Company Admin" : role}</small></span>
          <button className="icon-button profile-menu" aria-label="Profile options" onClick={() => showToast("Profile settings are part of the demo.")}>···</button>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="side-nav" aria-label={`${role} navigation`}>
          {navigation[role].map((item) => (
            <button key={item.label} className={`nav-item ${page === item.label ? "nav-active" : ""}`} onClick={() => { navigateToPage(item.label); setMobileNavOpen(false); }}>
              <span className="nav-icon">{item.icon}</span><span>{item.label}</span>
              {item.label === "Quotations" && role === "Owner" && <span className="nav-count">2</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {role === "Owner" && <button className={`nav-item ${page === "Settings & Backup" ? "nav-active" : ""}`} onClick={() => navigateToPage("Settings & Backup")}><span className="nav-icon">⚙</span><span>Settings & Backup</span></button>}
          <div className="sidebar-divider" />
          <button className="logout-button" onClick={() => void signOut()}><span>↪</span> Sign out</button>
        </div>
      </aside>

      <main className="main-shell">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label="Open navigation" onClick={() => setMobileNavOpen(!mobileNavOpen)}>☰</button>
          <div className="breadcrumb"><span>Workspace</span><span className="breadcrumb-slash">/</span><strong>{page}</strong></div>
          <div className="topbar-actions">
            <div className={`api-indicator api-${apiStatus}`} title={apiStatus === "offline" ? "API unavailable — local demo data shown" : "Dashboard API status"}>
              <span />{apiStatus === "connected" ? "Demo API connected" : apiStatus === "offline" ? "Using local preview" : "Connecting"}
            </div>
            <button className="icon-button notification-button" aria-label="Notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen((open) => !open)}>♧<i /></button>
            <div className="top-avatar">{initials(currentUser)}</div>
          </div>
        </header>

        <div className="content-area">
          <section className="page-heading">
            <div><div className="eyebrow"><span className="eyebrow-dot" /> BUILDTRACK / {role.toUpperCase()}</div><h1>{pageTitle}</h1><p>{pageDescription[page] || "Your construction workspace at a glance."}</p></div>
            <div className="heading-actions">
              {role === "Owner" && page === "Dashboard" && <button className="button button-primary" onClick={() => setModal("project")}><span>＋</span> New project</button>}
              {role === "Employee" && page === "Dashboard" && <button className="button button-primary" onClick={() => setModal("progress")}><span>＋</span> Add update</button>}
              {role === "Client" && page === "Dashboard" && <button className="button button-secondary" onClick={() => navigateToPage("Quotations")}>View quotations <span>↗</span></button>}
            </div>
          </section>

          {page === "Dashboard" && role === "Owner" && <OwnerDashboard data={data} onNavigate={navigateToPage} onCreate={setModal} onOpenProject={(project) => { setSearch(project.name); navigateToPage("Projects & Sites"); }} />}
          {page === "Dashboard" && role === "Employee" && <EngineerDashboard data={data} currentUser={currentUser} onCreate={setModal} onNavigate={navigateToPage} />}
          {page === "Dashboard" && role === "Client" && <ClientDashboard data={data} onNavigate={navigateToPage} onQuote={updateQuote} onToast={showToast} />}
          {page !== "Dashboard" && role === "Owner" && page === "Projects & Sites" && <OwnerProjectsPage {...featurePageProps} />}
          {page !== "Dashboard" && role === "Owner" && page === "Materials" && <OwnerMaterialsPage {...featurePageProps} />}
          {page !== "Dashboard" && !(role === "Owner" && (page === "Projects & Sites" || page === "Materials")) && <FeaturePage {...featurePageProps} page={page} role={role} />}

          <footer className="footer"><span>© 2026 Vanya BuildTrack</span><span>Built for the people who build.</span><span className="footer-status"><i /> All systems operational</span></footer>
        </div>
      </main>
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {notificationsOpen && <>
        <button className="notification-scrim" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)} />
        <aside className="notification-drawer" role="dialog" aria-modal="true" aria-labelledby="notification-title">
          <header className="notification-heading">
            <div><span className="panel-kicker">{role.toUpperCase()} WORKSPACE</span><h2 id="notification-title">Notifications</h2><p>Updates that need your attention.</p></div>
            <button className="icon-button notification-close" aria-label="Close notifications" onClick={() => setNotificationsOpen(false)}>×</button>
          </header>
          {notifications.length > 0
            ? <div className="notification-list">{notifications.map((item, index) => (
              <button className="notification-item" key={`${item.title}-${item.detail}-${index}`} onClick={() => { setNotificationsOpen(false); navigateToPage(item.page); }}>
                <span className="notification-item-icon">{item.icon}</span>
                <span className="notification-item-copy"><strong>{item.title}</strong><span>{item.detail}</span><small>{item.time}</small></span>
                <span className="notification-arrow">›</span>
              </button>
            ))}</div>
            : <div className="notification-empty"><span>✓</span><strong>You’re all caught up</strong><p>New updates will appear here.</p></div>}
        </aside>
      </>}
      {toast && <div className="toast"><span className="toast-check">✓</span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}>×</button></div>}
      {modal && <RecordModal modal={modal} projects={data.projects} onClose={() => setModal(null)} onSubmit={createRecord} />}
    </div>
  );
}
