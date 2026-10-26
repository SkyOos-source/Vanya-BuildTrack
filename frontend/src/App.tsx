import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

type Role = "Owner" | "Employee" | "Client";
type RoleId = "owner" | "employee" | "client";
type SessionUser = { name: string; email: string; role: RoleId };
type Project = {
  id: string;
  name: string;
  site: string;
  client: string;
  engineer: string;
  status: string;
  progress: number;
  budget: number;
  spent: number;
  dueDate: string;
  image: string;
};
type Quote = { id: string; project: string; title: string; client: string; amount: number; date: string; status: string };
type Expense = { id: string; project: string; category: string; description: string; amount: number; date: string; submittedBy: string; status: string };
type SiteVisit = { id: string; project: string; site: string; engineer: string; date: string; time: string; status: string };
type Activity = { id: string; actor: string; action: string; project: string; time: string; kind: string };
type Material = { id: string; material: string; project: string; received: string; used: string; stock: string; lastUpdated: string };
type Attendance = { id: string; project: string; engineer: string; present: string; shift: string; status: string; evidence: string };
type Feedback = { id: string; project: string; client: string; rating: number; comment: string; date: string };
type Backup = { id: string; status: string; requestedAt: string; requestedBy: string };
type DashboardData = { projects: Project[]; quotes: Quote[]; expenses: Expense[]; siteVisits: SiteVisit[]; activities: Activity[]; materials: Material[]; attendance: Attendance[]; feedback: Feedback[]; backups: Backup[] };

const navigation: Record<Role, { label: string; icon: string }[]> = {
  Owner: [
    { label: "Dashboard", icon: "◫" }, { label: "Projects & Sites", icon: "▦" },
    { label: "Materials", icon: "◈" }, { label: "Expenses", icon: "＄" },
    { label: "Quotations", icon: "▤" }, { label: "People", icon: "♙" },
    { label: "Attendance", icon: "◷" }, { label: "Reports", icon: "▥" },
    { label: "Site Visits", icon: "⌖" }, { label: "Feedback", icon: "☆" }
  ],
  Employee: [
    { label: "Dashboard", icon: "◫" }, { label: "My Sites", icon: "▦" },
    { label: "Progress Updates", icon: "▥" }, { label: "Materials", icon: "◈" },
    { label: "Expenses", icon: "＄" }, { label: "Attendance", icon: "◷" },
    { label: "Site Visits", icon: "⌖" }, { label: "Instructions", icon: "▤" }
  ],
  Client: [
    { label: "Dashboard", icon: "◫" }, { label: "My Projects", icon: "▦" },
    { label: "Quotations", icon: "▤" }, { label: "Expenses", icon: "＄" },
    { label: "Timeline", icon: "◷" }, { label: "Feedback", icon: "☆" }
  ]
};

const fallbackData: DashboardData = {
  projects: [
    { id: "PRJ-024", name: "Riverside Residence", site: "Whitefield, Bengaluru", client: "Ananya Rao", engineer: "Arjun Mehta", status: "In progress", progress: 68, budget: 12500000, spent: 8240000, dueDate: "18 Dec 2026", image: "photo-1600585154340-be6161a56a0c" },
    { id: "PRJ-021", name: "Northstar Office Campus", site: "Hebbal, Bengaluru", client: "Northstar Labs", engineer: "Priya Nair", status: "In progress", progress: 42, budget: 28600000, spent: 11350000, dueDate: "02 Mar 2027", image: "photo-1486406146926-c627a92ad1ab" },
    { id: "PRJ-018", name: "Gardenia Villas — Phase II", site: "Sarjapur Road, Bengaluru", client: "Gardenia Estates", engineer: "Arjun Mehta", status: "On track", progress: 86, budget: 19400000, spent: 15620000, dueDate: "29 Nov 2026", image: "photo-1600607687939-ce8a6c25118c" },
    { id: "PRJ-016", name: "Cedar & Stone Café", site: "Indiranagar, Bengaluru", client: "Mira Hospitality", engineer: "Dev Patel", status: "At risk", progress: 31, budget: 6800000, spent: 2410000, dueDate: "14 Jan 2027", image: "photo-1600210492486-724fe5c67fb0" }
  ],
  quotes: [
    { id: "QT-1042", project: "Riverside Residence", title: "Kitchen island — add-on work", client: "Ananya Rao", amount: 285000, date: "24 Oct 2026", status: "Awaiting review" },
    { id: "QT-1039", project: "Northstar Office Campus", title: "Foundation & structure", client: "Northstar Labs", amount: 4250000, date: "21 Oct 2026", status: "Sent to client" },
    { id: "QT-1034", project: "Gardenia Villas — Phase II", title: "Landscape lighting package", client: "Gardenia Estates", amount: 168000, date: "17 Oct 2026", status: "Approved" },
    { id: "QT-1028", project: "Cedar & Stone Café", title: "Custom steel canopy", client: "Mira Hospitality", amount: 342000, date: "12 Oct 2026", status: "Changes requested" }
  ],
  expenses: [
    { id: "EXP-782", project: "Riverside Residence", category: "Materials", description: "M25 ready-mix concrete · 12 m³", amount: 94000, date: "25 Oct 2026", submittedBy: "Arjun Mehta", status: "Pending review" },
    { id: "EXP-779", project: "Northstar Office Campus", category: "Labour", description: "Structural crew · weekly payment", amount: 128000, date: "24 Oct 2026", submittedBy: "Priya Nair", status: "Pending review" },
    { id: "EXP-776", project: "Gardenia Villas — Phase II", category: "Equipment", description: "Scaffolding rental · 2 weeks", amount: 36500, date: "23 Oct 2026", submittedBy: "Arjun Mehta", status: "Approved" },
    { id: "EXP-771", project: "Cedar & Stone Café", category: "Materials", description: "Powder-coated steel sections", amount: 58200, date: "22 Oct 2026", submittedBy: "Dev Patel", status: "Approved" }
  ],
  siteVisits: [
    { id: "VIS-218", project: "Riverside Residence", site: "Whitefield", engineer: "Arjun Mehta", date: "26 Oct 2026", time: "10:30 AM", status: "Scheduled" },
    { id: "VIS-216", project: "Northstar Office Campus", site: "Hebbal", engineer: "Priya Nair", date: "27 Oct 2026", time: "02:00 PM", status: "Scheduled" },
    { id: "VIS-211", project: "Gardenia Villas — Phase II", site: "Sarjapur Road", engineer: "Arjun Mehta", date: "24 Oct 2026", time: "09:00 AM", status: "Completed" }
  ],
  activities: [
    { id: "ACT-1", actor: "Arjun Mehta", action: "submitted today's progress update", project: "Riverside Residence", time: "12 min ago", kind: "progress" },
    { id: "ACT-2", actor: "Priya Nair", action: "submitted an expense for review", project: "Northstar Office Campus", time: "48 min ago", kind: "expense" },
    { id: "ACT-3", actor: "Ananya Rao", action: "viewed add-on quotation QT-1042", project: "Riverside Residence", time: "1 hr ago", kind: "quote" },
    { id: "ACT-4", actor: "Dev Patel", action: "marked site attendance for 14 workers", project: "Cedar & Stone Café", time: "2 hrs ago", kind: "attendance" },
    { id: "ACT-5", actor: "Arjun Mehta", action: "recorded 12 m³ of concrete received", project: "Riverside Residence", time: "3 hrs ago", kind: "materials" }
  ],
  materials: [
    { id: "MAT-01", material: "M25 Ready-mix concrete", project: "Riverside Residence", received: "84 m³", used: "62 m³", stock: "22 m³", lastUpdated: "Today, 9:42 AM" },
    { id: "MAT-02", material: "TMT Steel · Fe 500", project: "Northstar Office Campus", received: "18,400 kg", used: "12,700 kg", stock: "5,700 kg", lastUpdated: "Today, 8:15 AM" },
    { id: "MAT-03", material: "Red clay bricks", project: "Gardenia Villas — Phase II", received: "24,000 pcs", used: "18,500 pcs", stock: "5,500 pcs", lastUpdated: "Yesterday" },
    { id: "MAT-04", material: "OPC Cement · 53 grade", project: "Cedar & Stone Café", received: "860 bags", used: "712 bags", stock: "148 bags", lastUpdated: "22 Oct" }
  ],
  attendance: [
    { id: "ATT-01", project: "Riverside Residence", engineer: "Arjun Mehta", present: "14 / 16", shift: "Full day", status: "Present", evidence: "▧ 2 photos" },
    { id: "ATT-02", project: "Northstar Office Campus", engineer: "Priya Nair", present: "10 / 12", shift: "Full day", status: "Present", evidence: "▧ 3 photos" },
    { id: "ATT-03", project: "Gardenia Villas — Phase II", engineer: "Arjun Mehta", present: "—", shift: "—", status: "Not submitted", evidence: "—" }
  ],
  feedback: [
    { id: "FDB-01", project: "Riverside Residence", client: "Ananya Rao", rating: 5, comment: "Great communication throughout the project. Arjun keeps us updated every week and the progress photos are really helpful.", date: "21 Oct 2026" }
  ],
  backups: [
    { id: "BKP-008", status: "Ready to download", requestedAt: "20 Oct 2026", requestedBy: "John Smith" }
  ]
};

const formatCurrency = (amount: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
const initials = (name: string) => name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();

const demoCredentials: Record<RoleId, { email: string; password: string; label: string }> = {
  owner: { email: "owner@vanya.com", password: "owner123", label: "Owner" },
  employee: { email: "employee@vanya.com", password: "employee123", label: "Employee" },
  client: { email: "client@vanya.com", password: "client123", label: "Client" }
};

function readSession(): SessionUser | null {
  const session = localStorage.getItem("buildtrack-session");
  if (!session) return null;
  try {
    const user = JSON.parse(session) as SessionUser;
    return user && typeof user.name === "string" && typeof user.email === "string" &&
      (user.role === "owner" || user.role === "employee" || user.role === "client") ? user : null;
  } catch {
    localStorage.removeItem("buildtrack-session");
    return null;
  }
}

function roleName(role: RoleId): Role {
  return role === "owner" ? "Owner" : role === "employee" ? "Employee" : "Client";
}

function roleId(role: Role): RoleId {
  return role === "Owner" ? "owner" : role === "Employee" ? "employee" : "client";
}

function rolePath(role: RoleId): string {
  return role === "owner" ? "/admin" : `/${role}`;
}

function pageSlug(label: string): string {
  return label.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-");
}

function pagePath(role: Role, page: string): string {
  const base = rolePath(roleId(role));
  return page === "Dashboard" ? base : `${base}/${pageSlug(page)}`;
}

function pageFromPath(pathname: string, role: Role): string {
  const base = rolePath(roleId(role));
  const slug = pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
  if (!slug) return "Dashboard";
  const pages = [...navigation[role].map((item) => item.label), ...(role === "Owner" ? ["Settings & Backup"] : [])];
  return pages.find((page) => pageSlug(page) === slug) ?? "Dashboard";
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/signin" element={<SignInPage />} />
      <Route path="/admin/*" element={<PortalRoute role="owner" />} />
      <Route path="/employee/*" element={<PortalRoute role="employee" />} />
      <Route path="/client/*" element={<PortalRoute role="client" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LandingPage() {
  return <main className="landing-page">
    <header className="landing-nav">
      <Link className="brand landing-brand" to="/"><span className="brand-mark"><BuildingIcon /></span><span className="brand-copy"><strong>BuildTrack</strong><small>Construction Manager</small></span></Link>
      <Link className="button button-outline" to="/signin">Sign in <span>↗</span></Link>
    </header>
    <section className="landing-hero">
      <span className="landing-symbol"><BuildingIcon /></span>
      <span className="landing-kicker"><i /> CONSTRUCTION, IN SYNC</span>
      <h1>Build smarter.<br /><span>Manage better.</span></h1>
      <p>The complete workspace for construction teams. Connect your projects, sites, people, and clients — from the first plan to the final handover.</p>
      <Link to="/signin" className="button button-primary landing-cta">Get started <span>→</span></Link>
      <div className="landing-highlights"><span>✓ Site progress, in real time</span><span>✓ Materials & expense tracking</span><span>✓ One view for every role</span></div>
    </section>
    <section className="landing-portals"><div><span className="panel-kicker">ONE PLATFORM, YOUR WHOLE TEAM</span><h2>Everyone building<br />from the same page.</h2></div><div className="portal-cards"><article><span>01 / OWNER</span><h3>Lead the project</h3><p>Projects, people, budgets, and progress — all within reach.</p></article><article><span>02 / EMPLOYEE</span><h3>Bring the site to life</h3><p>Daily updates, site tasks, materials, and team attendance.</p></article><article><span>03 / CLIENT</span><h3>See it take shape</h3><p>Milestones, photos, proposals, and a clear line to your team.</p></article></div></section>
    <footer className="landing-footer"><span>© 2026 Vanya BuildTrack</span><span>Made for the people who build.</span></footer>
  </main>;
}

function SignInPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [role, setRole] = useState<RoleId>("owner");
  const [email, setEmail] = useState(demoCredentials.owner.email);
  const [password, setPassword] = useState(demoCredentials.owner.password);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const session = readSession();

  useEffect(() => {
    if (session) navigate(rolePath(session.role), { replace: true });
  }, [navigate, session?.role]);

  const selectDemoRole = (nextRole: RoleId) => {
    setRole(nextRole);
    setEmail(demoCredentials[nextRole].email);
    setPassword(demoCredentials[nextRole].password);
    setError("");
  };

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role })
      });
      const result = await response.json() as { user?: SessionUser; error?: string };
      if (!response.ok || !result.user) throw new Error(result.error || `Sign-in failed (${response.status})`);
      localStorage.setItem("buildtrack-session", JSON.stringify(result.user));
      const destination = (location.state as { from?: string } | null)?.from;
      navigate(destination?.startsWith(rolePath(role)) ? destination : rolePath(role), { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to sign in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="signin-page">
    <header className="signin-nav"><Link className="brand" to="/"><span className="brand-mark"><BuildingIcon /></span><span className="brand-copy"><strong>BuildTrack</strong><small>Construction Manager</small></span></Link><Link to="/" className="signin-back">← Back to home</Link></header>
    <section className="signin-layout">
      <div className="signin-story"><span className="landing-kicker"><i /> YOUR PROJECTS, IN SYNC</span><h1>Good work<br />starts with<br /><span>a clear view.</span></h1><p>One workspace for the people planning, building, and bringing every project to life.</p><div className="signin-story-note"><span>“</span><strong>Every site update brings the whole team closer.</strong><small>VANYA BUILDTRACK</small></div></div>
      <div className="signin-card">
        <span className="signin-card-icon"><BuildingIcon /></span><span className="panel-kicker">WELCOME BACK</span><h2>Sign in to BuildTrack</h2><p className="signin-description">Choose your workspace role and enter your details.</p>
        <form onSubmit={signIn}>
          <label>Sign in as<select value={role} onChange={(event) => selectDemoRole(event.target.value as RoleId)}><option value="owner">Owner</option><option value="employee">Employee</option><option value="client">Client</option></select></label>
          <label>Email address<input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Enter your password" required /></label>
          {error && <div className="signin-error" role="alert">{error}</div>}
          <button className="button button-primary signin-submit" type="submit" disabled={submitting}>{submitting ? "Signing in..." : "Sign in"} <span>→</span></button>
        </form>
        <div className="demo-access"><div className="demo-access-heading"><span>DEMO ACCESS</span><span>Pick a role to fill its demo login</span></div><div className="demo-role-list">{(["owner", "employee", "client"] as RoleId[]).map((demoRole) => <button type="button" key={demoRole} className={role === demoRole ? "demo-role-active" : ""} onClick={() => selectDemoRole(demoRole)}><span>{demoCredentials[demoRole].label}</span><span>{demoCredentials[demoRole].email}</span></button>)}</div><small>Demo only · changes reset when the API restarts</small></div>
      </div>
    </section>
    <footer className="signin-footer">© 2026 Vanya BuildTrack <span>·</span> Built for the people who build.</footer>
  </main>;
}

function PortalRoute({ role }: { role: RoleId }) {
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

function PortalApp({ role, userName }: { role: Role; userName: string }) {
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
            <button className="icon-button notification-button" aria-label="Notifications" onClick={() => showToast("You’re all caught up on notifications.")}>♧<i /></button>
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
          {page !== "Dashboard" && <FeaturePage page={page} role={role} data={data} projects={visibleProjects} search={search} setSearch={setSearch} filter={filter} setFilter={setFilter} onCreate={setModal} onQuote={updateQuote} onToast={showToast} onFeedback={submitFeedback} onBackup={requestBackup} />}

          <footer className="footer"><span>© 2026 Vanya BuildTrack</span><span>Built for the people who build.</span><span className="footer-status"><i /> All systems operational</span></footer>
        </div>
      </main>
      {mobileNavOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      {toast && <div className="toast"><span className="toast-check">✓</span>{toast}<button aria-label="Dismiss notification" onClick={() => setToast("")}>×</button></div>}
      {modal && <RecordModal modal={modal} projects={data.projects} onClose={() => setModal(null)} onSubmit={createRecord} />}
    </div>
  );
}

function OwnerDashboard({ data, onNavigate, onCreate, onOpenProject }: { data: DashboardData; onNavigate: (page: string) => void; onCreate: (modal: "project" | "quote" | "progress" | "expense" | "visit" | null) => void; onOpenProject: (project: Project) => void }) {
  const totalBudget = data.projects.reduce((sum, item) => sum + item.budget, 0);
  const totalSpent = data.projects.reduce((sum, item) => sum + item.spent, 0);
  const pendingExpenses = data.expenses.filter((item) => item.status === "Pending review").length;
  const activeSites = data.projects.length;
  const chart = [{ month: "May", revenue: 238, expenses: 176 }, { month: "Jun", revenue: 302, expenses: 211 }, { month: "Jul", revenue: 274, expenses: 229 }, { month: "Aug", revenue: 390, expenses: 281 }, { month: "Sep", revenue: 342, expenses: 263 }, { month: "Oct", revenue: 486, expenses: 334 }];
  return <>
    <div className="stat-grid">
      <article className="stat-card budget-card"><div className="budget-top"><div><span className="stat-label">Total project budget</span><strong>{formatCurrency(totalBudget)}</strong><small>Across {data.projects.length} active projects</small></div><div className="budget-revenue"><span>Utilized</span><strong>{Math.round(totalSpent / totalBudget * 100)}%</strong><small>{formatCurrency(totalSpent)} spent</small></div></div><div className="budget-track"><span style={{ width: `${totalSpent / totalBudget * 100}%` }} /></div><div className="budget-foot"><span><i className="legend-orange" /> Spent</span><span>{formatCurrency(totalBudget - totalSpent)} remaining</span></div></article>
      <StatCard label="Active projects" value={String(data.projects.length).padStart(2, "0")} note="Across your portfolio" icon="▦" trend="+2 this quarter" />
      <StatCard label="Active sites" value={String(activeSites).padStart(2, "0")} note="Currently in progress" icon="⌖" trend="All sites reporting" />
      <StatCard label="Needs your review" value={String(pendingExpenses + data.quotes.filter((item) => item.status === "Awaiting review").length).padStart(2, "0")} note="Expenses & quotations" icon="◷" trend={`${pendingExpenses} expenses`} attention />
    </div>
    <div className="dashboard-grid">
      <section className="panel chart-panel">
        <div className="panel-heading"><div><span className="panel-kicker">FINANCIAL OVERVIEW</span><h2>Revenue vs expenses</h2><p>Portfolio performance over the last 6 months</p></div><button className="select-button">Last 6 months <span>⌄</span></button></div>
        <div className="chart-legend"><span><i className="legend-orange" /> Revenue</span><span><i className="legend-charcoal" /> Expenses</span><span className="chart-total">INR · thousands</span></div>
        <div className="chart" role="img" aria-label="Bar chart comparing monthly revenue and expenses from May to October">
          <div className="chart-y"><span>500</span><span>375</span><span>250</span><span>125</span><span>0</span></div>
          <div className="chart-plot"><div className="chart-gridlines"><i /><i /><i /><i /><i /></div><div className="bar-groups">{chart.map((month) => <div className="bar-group" key={month.month}><div className="bars"><span className="bar revenue-bar" style={{ height: `${month.revenue / 5}%` }} title={`Revenue ${month.revenue}k`} /><span className="bar expense-bar" style={{ height: `${month.expenses / 5}%` }} title={`Expenses ${month.expenses}k`} /></div><span className="bar-month">{month.month}</span></div>)}</div></div>
        </div>
      </section>
      <section className="panel activity-panel"><div className="panel-heading compact"><div><span className="panel-kicker">LIVE FROM YOUR SITES</span><h2>Recent activity</h2></div><button className="text-link" onClick={() => onNavigate("Reports")}>View all ↗</button></div><div className="activity-list">{data.activities.slice(0, 5).map((item) => <div className="activity-item" key={item.id}><span className={`activity-icon activity-${item.kind}`}>{item.kind === "progress" ? "↗" : item.kind === "expense" ? "＄" : item.kind === "quote" ? "▤" : item.kind === "attendance" ? "◷" : "◈"}</span><div className="activity-copy"><p><strong>{item.actor}</strong> {item.action}</p><span>{item.project}</span></div><time>{item.time}</time></div>)}</div></section>
    </div>
    <section className="panel project-panel"><div className="panel-heading compact"><div><span className="panel-kicker">YOUR PORTFOLIO</span><h2>Active projects <span className="heading-count">{data.projects.length}</span></h2></div><button className="text-link" onClick={() => onNavigate("Projects & Sites")}>All projects ↗</button></div><ProjectCards projects={data.projects.slice(0, 3)} onOpen={onOpenProject} /></section>
    <div className="bottom-grid"><section className="panel table-panel"><div className="panel-heading compact"><div><span className="panel-kicker">ACTION REQUIRED</span><h2>Expenses for review</h2></div><button className="text-link" onClick={() => onNavigate("Expenses")}>All expenses ↗</button></div><ExpenseRows expenses={data.expenses.slice(0, 3)} /></section><section className="panel visit-panel"><div className="panel-heading compact"><div><span className="panel-kicker">COMING UP</span><h2>Site visits</h2></div><button className="icon-button small-add" aria-label="Schedule site visit" onClick={() => onCreate("visit")}>＋</button></div><div className="visit-list">{data.siteVisits.slice(0, 2).map((visit) => <div className="visit-item" key={visit.id}><div className="visit-date"><strong>{visit.date.split(" ")[0]}</strong><span>{visit.date.split(" ")[1]?.slice(0, 3).toUpperCase()}</span></div><div className="visit-info"><strong>{visit.project}</strong><span>{visit.site} · {visit.engineer}</span></div><time>{visit.time}</time></div>)}</div><button className="visit-add" onClick={() => onCreate("visit")}>＋ Schedule a site visit</button></section></div>
    <button className="floating-demo-action" onClick={() => onCreate("quote")}><span>＋</span> Create quotation</button>
  </>;
}

function EngineerDashboard({ data, currentUser, onCreate, onNavigate }: { data: DashboardData; currentUser: string; onCreate: (modal: "project" | "quote" | "progress" | "expense" | "visit" | null) => void; onNavigate: (page: string) => void }) {
  const projects = data.projects.filter((project) => project.engineer === currentUser || project.engineer === "Arjun Mehta");
  return <>
    <div className="welcome-banner"><div className="welcome-copy"><span className="panel-kicker">SUNDAY, OCTOBER 25, 2026</span><h2>Good morning, Arjun <span>☀</span></h2><p>Your sites are moving along. Here’s what needs your attention today.</p></div><div className="weather-pill">⌖ <span><strong>28°C</strong><small>Bengaluru</small></span><span className="weather-sun">☀</span></div></div>
    <div className="stat-grid engineer-stats"><StatCard label="Assigned sites" value={String(projects.length).padStart(2, "0")} note="Across 2 projects" icon="⌖" trend="Both sites active" /><StatCard label="Avg. site progress" value={`${Math.round(projects.reduce((sum, item) => sum + item.progress, 0) / Math.max(projects.length, 1))}%`} note="Across assigned projects" icon="↗" trend="+8% this month" /><StatCard label="Pending updates" value="01" note="Daily report due today" icon="◷" trend="Submit before 6 PM" attention /><StatCard label="Team on site" value="24" note="Workers checked in today" icon="♙" trend="Across your sites" /></div>
    <div className="dashboard-grid engineer-grid"><section className="panel my-sites-panel"><div className="panel-heading compact"><div><span className="panel-kicker">YOUR ASSIGNMENTS</span><h2>My active sites</h2></div><button className="text-link" onClick={() => onNavigate("My Sites")}>All sites ↗</button></div><div className="engineer-sites">{projects.map((project) => <article className="engineer-site-card" key={project.id}><div className="site-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(33,30,28,.72), transparent 70%), url(https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=700&q=80)` }}><span className="site-id">{project.id}</span><span className="site-status"><i /> {project.status}</span></div><div className="engineer-site-body"><div className="site-title-row"><div><h3>{project.name}</h3><span>⌖ {project.site}</span></div><button className="icon-button" aria-label={`Open ${project.name}`} onClick={() => onNavigate("My Sites")}>↗</button></div><div className="progress-label"><span>Overall progress</span><strong>{project.progress}%</strong></div><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><div className="site-task-row"><span>Next milestone</span><strong>{project.dueDate}</strong></div></div></article>)}</div></section><section className="panel today-panel"><div className="panel-heading compact"><div><span className="panel-kicker">SUNDAY · 25 OCT</span><h2>Today's checklist</h2></div><span className="checklist-count">2 / 4</span></div><div className="checklist"><label className="checklist-item checked"><input type="checkbox" defaultChecked /><span className="fake-check">✓</span><span><strong>Mark team attendance</strong><small>24 workers · Riverside Residence</small></span></label><label className="checklist-item"><input type="checkbox" /><span className="fake-check" /><span><strong>Submit daily progress update</strong><small>Due today · Riverside Residence</small></span><i className="task-dot" /></label><label className="checklist-item"><input type="checkbox" /><span className="fake-check" /><span><strong>Log material delivery</strong><small>Concrete pour · Northstar Campus</small></span></label><label className="checklist-item checked"><input type="checkbox" defaultChecked /><span className="fake-check">✓</span><span><strong>Upload foundation photos</strong><small>6 photos · Northstar Campus</small></span></label></div><button className="button button-light full-button" onClick={() => onCreate("progress")}>＋ Submit a site update</button></section></div>
    <div className="bottom-grid"><section className="panel table-panel"><div className="panel-heading compact"><div><span className="panel-kicker">YOUR SUBMISSIONS</span><h2>Recent expenses</h2></div><button className="text-link" onClick={() => onNavigate("Expenses")}>History ↗</button></div><ExpenseRows expenses={data.expenses.filter((item) => item.submittedBy === currentUser).slice(0, 3)} /></section><section className="panel instructions-panel"><div className="panel-heading compact"><div><span className="panel-kicker">FROM JOHN SMITH · OWNER</span><h2>Site instructions</h2></div><span className="instruction-new">NEW</span></div><div className="instruction-note"><span className="instruction-pin">↳</span><p>Please complete the ground-floor slab inspection before the next concrete pour. Upload the checklist photos once the review is done.</p></div><span className="instruction-time">Riverside Residence · 24 Oct, 4:18 PM</span><button className="text-link instruction-link" onClick={() => onNavigate("Instructions")}>View all instructions ↗</button></section></div>
  </>;
}

function ClientDashboard({ data, onNavigate, onQuote, onToast }: { data: DashboardData; onNavigate: (page: string) => void; onQuote: (quote: Quote, decision: "Approved" | "Declined") => void; onToast: (message: string) => void }) {
  const project = data.projects[0];
  const quote = data.quotes.find((item) => item.status === "Sent to client") || data.quotes[0];
  const timeline = [{ date: "OCT 22", title: "Ground floor slab poured", detail: "Concrete work complete · 12 site photos", done: true }, { date: "OCT 28", title: "First-floor columns", detail: "Structural work · Scheduled", done: false }, { date: "NOV 04", title: "First-floor slab", detail: "Concrete work · Upcoming", done: false }];
  return <>
    <div className="client-welcome"><div><span className="panel-kicker">YOUR HOME, IN THE MAKING</span><h2>Good morning, Ananya <span>✳</span></h2><p>Here’s the latest from Riverside Residence.</p></div><div className="client-project-pill"><span className="client-project-thumbnail" style={{ backgroundImage: `url(https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=140&q=80)` }} /><span><small>YOUR PROJECT</small><strong>{project.name}</strong></span><span className="client-status">{project.status}</span></div></div>
    <div className="client-progress-panel panel"><div className="client-progress-top"><div><span className="panel-kicker">OVERALL CONSTRUCTION</span><h2>Taking shape, day by day.</h2><p>Last updated today by {project.engineer}</p></div><div className="big-progress"><strong>{project.progress}<small>%</small></strong><span>complete</span></div></div><div className="client-progress-track"><i style={{ width: `${project.progress}%` }} /></div><div className="client-progress-foot"><span>Project started <strong>12 Feb 2026</strong></span><span>Estimated completion <strong>{project.dueDate}</strong></span></div></div>
    <div className="dashboard-grid client-grid"><section className="panel timeline-panel"><div className="panel-heading compact"><div><span className="panel-kicker">THE JOURNEY SO FAR</span><h2>Project timeline</h2></div><button className="text-link" onClick={() => onNavigate("Timeline")}>Full timeline ↗</button></div><div className="timeline">{timeline.map((item) => <div className={`timeline-item ${item.done ? "timeline-done" : ""}`} key={item.date}><div className="timeline-marker">{item.done ? "✓" : ""}</div><div className="timeline-date">{item.date}</div><div className="timeline-content"><strong>{item.title}</strong><span>{item.detail}</span></div></div>)}</div></section><section className="panel client-quote-panel"><div className="panel-heading compact"><div><span className="panel-kicker">NEEDS YOUR ATTENTION</span><h2>A quotation for you</h2></div><span className="quote-spark">✳</span></div><div className="client-quote-card"><span className="quote-type">ADDITIONAL WORK</span><h3>{quote.title}</h3><p>{quote.project}</p><div className="quote-price">{formatCurrency(quote.amount)}<small>One-time</small></div><div className="quote-divider" /><p className="quote-note">Review this proposal from your project team. You can approve it or ask the team to get in touch.</p><div className="quote-actions"><button className="button button-primary" onClick={() => onQuote(quote, "Approved")}>Approve quote <span>✓</span></button><button className="button button-outline" onClick={() => onQuote(quote, "Declined")}>Not now</button></div></div></section></div>
    <div className="bottom-grid client-bottom"><section className="panel photo-update-panel"><div className="panel-heading compact"><div><span className="panel-kicker">FROM YOUR SITE</span><h2>Latest progress photos</h2></div><button className="text-link" onClick={() => onNavigate("My Projects")}>See project ↗</button></div><div className="photo-grid">{[["photo-1503387762-592deb58ef4e", "Structural work"], ["photo-1504307651254-35680f356dfd", "On-site progress"], ["photo-1504917595217-d4dc5ebe6122", "Site inspection"]].map(([image, label]) => <button className="photo-tile" key={image} style={{ backgroundImage: `linear-gradient(0deg, rgba(33,30,28,.62), transparent 65%), url(https://images.unsplash.com/${image}?auto=format&fit=crop&w=420&q=80)` }} onClick={() => onToast("Photo gallery preview selected.")}><span>{label}</span><i>↗</i></button>)}</div><span className="photo-date">Added today · Arjun Mehta</span></section><section className="panel client-spend-panel"><div className="panel-heading compact"><div><span className="panel-kicker">PROJECT FINANCES</span><h2>Budget at a glance</h2></div><button className="text-link" onClick={() => onNavigate("Expenses")}>Details ↗</button></div><div className="spend-total"><span>Total project value</span><strong>{formatCurrency(project.budget)}</strong></div><div className="spend-row"><span><i className="spend-dot paid-dot" /> Paid to date</span><strong>{formatCurrency(project.spent)}</strong></div><div className="spend-row"><span><i className="spend-dot pending-dot" /> Remaining</span><strong>{formatCurrency(project.budget - project.spent)}</strong></div><div className="spend-progress"><i style={{ width: `${project.spent / project.budget * 100}%` }} /></div><span className="spend-caption">{Math.round(project.spent / project.budget * 100)}% of project value paid</span></section></div>
  </>;
}

function FeaturePage({ page, role, data, projects, search, setSearch, filter, setFilter, onCreate, onQuote, onToast, onFeedback, onBackup }: { page: string; role: Role; data: DashboardData; projects: Project[]; search: string; setSearch: (value: string) => void; filter: string; setFilter: (value: string) => void; onCreate: (modal: "project" | "quote" | "progress" | "expense" | "visit" | null) => void; onQuote: (quote: Quote, decision: "Approved" | "Declined") => void; onToast: (message: string) => void; onFeedback: (event: FormEvent<HTMLFormElement>) => void; onBackup: () => void }) {
  const [rating, setRating] = useState(5);
  const projectView = page === "Projects & Sites" || page === "My Projects" || page === "My Sites";
  const scopedProjects = role === "Owner" ? projects : role === "Employee" ? projects.filter((project) => project.engineer === "Arjun Mehta") : projects.filter((project) => project.client === "Ananya Rao");
  const visibleQuotes = role === "Client" ? data.quotes.filter((quote) => quote.client === "Ananya Rao") : data.quotes;
  const visibleExpenses = role === "Client"
    ? data.expenses.filter((expense) => expense.status === "Approved" && expense.project === data.projects[0].name)
    : role === "Employee"
      ? data.expenses.filter((expense) => expense.submittedBy === "Arjun Mehta")
      : data.expenses;
  return <div className="feature-page">
    {projectView && <section className="panel feature-panel"><div className="list-toolbar"><div className="search-box"><span>⌕</span><input aria-label="Search projects" placeholder="Search projects, sites, clients..." value={search} onChange={(event) => setSearch(event.target.value)} /></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter projects" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>In progress</option><option>On track</option><option>At risk</option></select>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("project")}>＋ New project</button>}</div></div><ProjectCards projects={scopedProjects} onOpen={(project) => onToast(`${project.name} · ${project.progress}% complete · ${formatCurrency(project.spent)} spent.`)} /></section>}
    {page === "Quotations" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">PROJECT PROPOSALS</span><h2 className="list-title">{role === "Client" ? "Quotations for you" : "Quotations & add-on work"}</h2></div><div className="toolbar-actions"><select className="select-button" aria-label="Filter quotations" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Awaiting review</option><option>Sent to client</option><option>Approved</option><option>Changes requested</option></select>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("quote")}>＋ New quotation</button>}</div></div><div className="quote-list">{visibleQuotes.filter((item) => filter === "All" || item.status === filter).map((quote) => <article className="quote-row" key={quote.id}><span className="quote-file-icon">▤</span><div className="quote-row-main"><strong>{quote.title}</strong><span>{quote.id} · {quote.project} · {quote.date}</span></div><div className="quote-row-client"><small>CLIENT</small><strong>{quote.client}</strong></div><strong className="quote-row-amount">{formatCurrency(quote.amount)}</strong><StatusBadge status={quote.status} />{role === "Client" && quote.status !== "Approved" && quote.status !== "Declined" ? <div className="inline-actions"><button onClick={() => onQuote(quote, "Approved")}>Approve</button><button onClick={() => onQuote(quote, "Declined")}>Decline</button></div> : <button className="icon-button" onClick={() => onToast(`Opening ${quote.id} preview.`)} aria-label={`Open quotation ${quote.id}`}>↗</button>}</article>)}</div></section>}
    {page === "Expenses" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">MONEY IN MOTION</span><h2 className="list-title">{role === "Client" ? "Approved project expenses" : "Expenses & receipts"}</h2></div><div className="toolbar-actions">{role !== "Client" && <select className="select-button" aria-label="Filter expenses" value={filter} onChange={(event) => setFilter(event.target.value)}><option>All</option><option>Pending review</option><option>Approved</option></select>}{role === "Employee" && <button className="button button-primary" onClick={() => onCreate("expense")}>＋ Submit expense</button>}</div></div><ExpenseRows expenses={visibleExpenses.filter((item) => filter === "All" || item.status === filter)} detailed onAction={(expense) => onToast(role === "Owner" ? `${expense.id} approved in the demo.` : `Receipt for ${expense.id} previewed.`)} /></section>}
    {page === "Progress Updates" && <section className="panel feature-panel"><div className="feature-intro"><div><span className="panel-kicker">FIELD REPORTING</span><h2>Progress updates</h2><p>Keep owners and clients up to date with work completed on site.</p></div><button className="button button-primary" onClick={() => onCreate("progress")}>＋ Submit daily update</button></div><div className="progress-update-list">{data.activities.filter((item) => (item.kind === "progress" || item.kind === "materials") && item.actor === "Arjun Mehta").map((item, index) => <div className="progress-update-row" key={item.id}><span className="update-date"><strong>{index === 0 ? "25" : "24"}</strong><small>OCT</small></span><div className="update-body"><strong>{index === 0 ? "Ground floor slab — concrete pour complete" : "Reinforcement & formwork inspection"}</strong><p>{index === 0 ? "Slab concrete poured and levelled. Curing started; formwork removal planned after 7 days." : "Rebar placement checked against drawings. Site cleared for the next concrete delivery."}</p><span>{item.project} · {item.actor} · {item.time}</span></div><span className="photo-count">▧ {index === 0 ? "6 photos" : "4 photos"}</span></div>)}</div></section>}
    {page === "Materials" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">SITE INVENTORY</span><h2 className="list-title">Materials received & used</h2></div><button className="button button-primary" onClick={() => onToast("Material entry form is ready for API implementation.")}>＋ Log materials</button></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Material</th><th>Project / site</th><th>Received</th><th>Used</th><th>In stock</th><th>Last updated</th></tr></thead><tbody>{data.materials.filter((item) => role !== "Employee" || scopedProjects.some((project) => project.name === item.project)).map((item) => <tr key={item.id}><td>{item.material}</td><td>{item.project}</td><td>{item.received}</td><td>{item.used}</td><td>{item.stock}</td><td>{item.lastUpdated}</td></tr>)}</tbody></table></div></section>}
    {page === "Attendance" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">SITE TEAMS</span><h2 className="list-title">Attendance monitoring</h2></div><button className="select-button">Today · 25 Oct 2026 <span>⌄</span></button></div><div className="attendance-overview"><div><strong>24 <small>/ 28</small></strong><span>Workers present today</span></div><div><strong>04</strong><span>Sites reporting</span></div><div><strong>86%</strong><span>Attendance rate</span></div></div><div className="data-table-wrap"><table className="data-table"><thead><tr><th>Site / project</th><th>Engineer</th><th>Workers present</th><th>Shift</th><th>Status</th><th>Evidence</th></tr></thead><tbody>{data.attendance.map((item) => <tr key={item.id}><td>{item.project}</td><td>{item.engineer}</td><td>{item.present}</td><td>{item.shift}</td><td><StatusBadge status={item.status} /></td><td>{item.evidence}</td></tr>)}</tbody></table></div></section>}
    {page === "Site Visits" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">FIELD SCHEDULE</span><h2 className="list-title">{role === "Employee" ? "My upcoming site visits" : "Engineer site visits"}</h2></div>{role === "Owner" && <button className="button button-primary" onClick={() => onCreate("visit")}>＋ Schedule visit</button>}</div><div className="visit-cards">{data.siteVisits.filter((visit) => role !== "Employee" || visit.engineer === "Arjun Mehta").map((visit) => <article className="visit-card" key={visit.id}><div className="visit-card-date"><span>OCT</span><strong>{visit.date.split(" ")[0]}</strong><small>{visit.time}</small></div><div className="visit-card-content"><StatusBadge status={visit.status} /><h3>{visit.project}</h3><p>⌖ {visit.site} · Assigned engineer: {visit.engineer}</p><div className="visit-purpose">Site inspection · Progress verification</div></div><button className="button button-outline" onClick={() => onToast(visit.status === "Completed" ? `Opening notes for ${visit.id}.` : `Visit ${visit.id} details opened.`)}>{visit.status === "Completed" ? "View notes" : "View details"} ↗</button></article>)}</div></section>}
    {page === "Reports" && <section className="report-grid"><article className="report-card panel"><span className="report-icon">▥</span><span className="panel-kicker">PROJECT PERFORMANCE</span><h2>Progress report</h2><p>Milestone completion and updates, by project and site.</p><button className="text-link" onClick={() => onToast("Progress report export is part of the demo.")}>Generate report ↗</button></article><article className="report-card panel"><span className="report-icon">＄</span><span className="panel-kicker">FINANCIAL HEALTH</span><h2>Expense report</h2><p>Approved, pending, and paid expenses across your portfolio.</p><button className="text-link" onClick={() => onToast("Expense report export is part of the demo.")}>Generate report ↗</button></article><article className="report-card panel"><span className="report-icon">◈</span><span className="panel-kicker">SITE INVENTORY</span><h2>Materials report</h2><p>Material received, consumed, and remaining at every site.</p><button className="text-link" onClick={() => onToast("Materials report export is part of the demo.")}>Generate report ↗</button></article></section>}
    {page === "Settings & Backup" && role === "Owner" && <section className="backup-layout"><article className="panel backup-card"><span className="report-icon">↧</span><span className="panel-kicker">ACCOUNT DATA</span><h2>Back up your workspace</h2><p>Request a demo export of your project, site, quotation, and expense records.</p><ul><li>Project and site summaries</li><li>Quotations and expense records</li><li>Activity and attendance history</li></ul><button className="button button-primary" onClick={onBackup}>＋ Request account backup</button><small>Demo requests are kept in memory and reset when the API restarts.</small></article><section className="panel backup-history"><div className="panel-heading compact"><div><span className="panel-kicker">RECENT REQUESTS</span><h2>Backup history</h2></div><span className="backup-count">{data.backups.length} requests</span></div><div className="backup-list">{data.backups.map((backup) => <article className="backup-row" key={backup.id}><span className="backup-file">↧</span><div><strong>{backup.id} · Workspace data export</strong><small>Requested by {backup.requestedBy} · {backup.requestedAt}</small></div><StatusBadge status={backup.status} /></article>)}</div></section></section>}
    {page === "People" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">YOUR TEAM</span><h2 className="list-title">Clients & site engineers</h2></div><button className="button button-primary" onClick={() => onToast("Invite workflow will be connected to authentication later.")}>＋ Invite a person</button></div><div className="people-grid">{[["Ananya Rao", "Client", "Riverside Residence", "AR"], ["Northstar Labs", "Client", "Northstar Office Campus", "NL"], ["Arjun Mehta", "Site Engineer", "2 active sites", "AM"], ["Priya Nair", "Site Engineer", "Northstar Office Campus", "PN"], ["Dev Patel", "Site Engineer", "Cedar & Stone Café", "DP"]].map((person) => <article className="person-card" key={person[0]}><span className="avatar">{person[3]}</span><div><strong>{person[0]}</strong><span>{person[1]}</span><small>{person[2]}</small></div><button className="icon-button" aria-label={`Options for ${person[0]}`} onClick={() => onToast(`${person[0]} profile selected.`)}>···</button></article>)}</div></section>}
    {page === "Timeline" && <section className="panel feature-panel"><div className="list-toolbar"><div><span className="panel-kicker">RIVERSIDE RESIDENCE</span><h2 className="list-title">Project timeline & updates</h2></div><StatusBadge status="In progress" /></div><div className="timeline full-timeline">{[["FEB 12", "Project kickoff", "Plans approved and site setup completed.", true], ["MAR 08", "Site excavation", "Excavation and foundation preparation finished.", true], ["JUN 14", "Foundation complete", "Foundation inspection approved.", true], ["OCT 22", "Ground floor slab", "Concrete poured. Curing in progress.", true], ["OCT 28", "First-floor columns", "Structural work scheduled.", false], ["NOV 04", "First-floor slab", "Concrete work upcoming.", false]].map(([date, title, detail, done]) => <div className={`timeline-item ${done ? "timeline-done" : ""}`} key={String(date)}><div className="timeline-marker">{done ? "✓" : ""}</div><div className="timeline-date">{String(date)}</div><div className="timeline-content"><strong>{String(title)}</strong><span>{String(detail)}</span></div></div>)}</div></section>}
    {page === "Feedback" && role === "Owner" && <section className="panel feature-panel"><div className="panel-heading compact"><div><span className="panel-kicker">CLIENT VOICE</span><h2>Project feedback & reviews</h2></div><span className="backup-count">{data.feedback.length} reviews</span></div><div className="quote-list">{data.feedback.map((item) => <article className="feedback-review" key={item.id}><span className="avatar">{initials(item.client)}</span><div><div className="review-title"><strong>{item.client}</strong><span className="aside-stars">{"★".repeat(item.rating)}</span></div><p>{item.comment}</p><small>{item.project} · {item.date}</small></div></article>)}</div></section>}
    {page === "Feedback" && role === "Client" && <section className="panel feature-panel feedback-layout"><div><span className="panel-kicker">YOUR VOICE MATTERS</span><h2 className="list-title">Feedback & project reviews</h2><p className="feature-subtitle">Share feedback with the project team. Your comments help us deliver better work.</p><form className="feedback-form" onSubmit={onFeedback}><label>Project<select name="project" defaultValue={data.projects[0].name}>{data.projects.map((item) => <option key={item.id}>{item.name}</option>)}</select></label><label>Your rating<div className="rating-stars" role="radiogroup" aria-label="Rate your experience">{[1, 2, 3, 4, 5].map((star) => <button type="button" key={star} aria-label={`${star} stars`} aria-checked={rating === star} role="radio" className={star <= rating ? "star-selected" : ""} onClick={() => setRating(star)}>★</button>)}</div><input type="hidden" name="rating" value={rating} /></label><label>What went well, or what could be better?<textarea name="comment" required rows={4} placeholder="Tell your project team about your experience..." /></label><button className="button button-primary" type="submit">Share feedback ↗</button></form></div><aside className="feedback-aside"><span>“</span><p>{data.feedback[0]?.comment || "Your feedback helps your project team deliver even better work."}</p><strong>{data.feedback[0]?.client || "Project client"}</strong><small>{data.feedback[0]?.project || data.projects[0]?.name} · {data.feedback[0]?.date || "Recently"}</small><div className="aside-stars">{"★".repeat(data.feedback[0]?.rating || 5)}</div></aside></section>}
    {page === "Instructions" && <section className="panel feature-panel"><div className="panel-heading compact"><div><span className="panel-kicker">FROM YOUR OWNER</span><h2>Site instructions & updates</h2></div></div><div className="instruction-list"><article><span className="instruction-pin">↳</span><div><StatusBadge status="Action required" /><h3>Ground-floor slab inspection</h3><p>Please complete the slab inspection before the next concrete pour. Upload the checklist photos once the review is done.</p><span>John Smith · Riverside Residence · 24 Oct, 4:18 PM</span></div></article><article><span className="instruction-pin">↳</span><div><StatusBadge status="Read" /><h3>Delivery schedule update</h3><p>Steel delivery is confirmed for Tuesday morning. Please ensure the unloading area is clear.</p><span>John Smith · Northstar Office Campus · 23 Oct, 10:42 AM</span></div></article></div></section>}
  </div>;
}

function ProjectCards({ projects, onOpen }: { projects: Project[]; onOpen: (project: Project) => void }) {
  if (!projects.length) return <div className="inline-empty">No projects match this search. Try another name or status.</div>;
  return <div className="project-cards">{projects.map((project) => <button className="portfolio-card" key={project.id} onClick={() => onOpen(project)}><div className="portfolio-image" style={{ backgroundImage: `linear-gradient(0deg, rgba(33,30,28,.78), transparent 72%), url(https://images.unsplash.com/${project.image}?auto=format&fit=crop&w=700&q=80)` }}><span className="portfolio-id">{project.id}</span><span className="portfolio-status"><i /> {project.status}</span><div className="portfolio-title"><h3>{project.name}</h3><span>⌖ {project.site}</span></div></div><div className="portfolio-details"><div className="portfolio-progress"><span>Progress</span><strong>{project.progress}%</strong></div><div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div><div className="portfolio-foot"><span>Budget <strong>{formatCurrency(project.budget)}</strong></span><span>Due <strong>{project.dueDate}</strong></span></div></div></button>)}</div>;
}

function ExpenseRows({ expenses, detailed = false, onAction }: { expenses: Expense[]; detailed?: boolean; onAction?: (expense: Expense) => void }) {
  if (!expenses.length) return <div className="inline-empty">No expenses to show yet.</div>;
  return <div className={`expense-list ${detailed ? "expense-list-detailed" : ""}`}>{expenses.map((expense) => <div className="expense-row" key={expense.id}><span className={`expense-icon ${expense.category === "Labour" ? "expense-labour" : ""}`}>{expense.category === "Materials" ? "◈" : expense.category === "Labour" ? "♙" : "▧"}</span><div className="expense-main"><strong>{expense.description}</strong><span>{expense.project} · {expense.submittedBy}</span></div><time>{expense.date.split(" ").slice(0, 2).join(" ")}</time><strong className="expense-amount">{formatCurrency(expense.amount)}</strong><StatusBadge status={expense.status} />{detailed && <button className="text-link receipt-action" onClick={() => onAction?.(expense)}>{expense.status === "Pending review" && onAction ? "Review" : "Receipt"} ↗</button>}</div>)}</div>;
}

function StatCard({ label, value, note, icon, trend, attention = false }: { label: string; value: string; note: string; icon: string; trend: string; attention?: boolean }) {
  return <article className={`stat-card ${attention ? "stat-attention" : ""}`}><div className="stat-card-head"><span className="stat-label">{label}</span><span className={`stat-icon ${attention ? "stat-icon-orange" : ""}`}>{icon}</span></div><strong className="stat-value">{value}</strong><span className="stat-note">{note}</span><div className={`stat-trend ${attention ? "trend-attention" : ""}`}><i />{trend}</div></article>;
}

function StatusBadge({ status }: { status: string }) {
  const className = status.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
  return <span className={`status-badge status-${className}`}>{status}</span>;
}

function RecordModal({ modal, projects, onClose, onSubmit }: { modal: "project" | "quote" | "progress" | "expense" | "visit"; projects: Project[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const title = modal === "project" ? "Create a project" : modal === "quote" ? "New quotation" : modal === "progress" ? "Daily progress update" : modal === "expense" ? "Submit an expense" : "Schedule a site visit";
  const label = modal === "project" ? "Project name" : modal === "quote" ? "Quotation title" : modal === "progress" ? "What did you complete today?" : modal === "expense" ? "Expense description" : "Visit purpose";
  return <div className="modal-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="panel-kicker">BUILDTRACK WORKSPACE</span><h2 id="modal-title">{title}</h2></div><button className="icon-button modal-close" aria-label="Close dialog" onClick={onClose}>×</button></div><form onSubmit={onSubmit}><label>{label}<input name={modal === "quote" ? "title" : modal === "progress" || modal === "expense" ? "description" : "name"} required placeholder={modal === "project" ? "e.g. Lakeside Residence" : modal === "quote" ? "e.g. Add-on work — kitchen island" : modal === "progress" ? "Describe work completed at site..." : modal === "expense" ? "e.g. Concrete delivery · 8 m³" : "e.g. Foundation inspection"} /></label>{modal !== "project" && <label>Project<select name="project" defaultValue={projects[0]?.name}>{projects.map((project) => <option key={project.id}>{project.name}</option>)}</select></label>}{(modal === "quote" || modal === "expense") && <label>Amount (INR)<input name="amount" type="number" min="0" required placeholder="0" /></label>}{modal === "visit" && <><label>Engineer<select name="engineer"><option>Arjun Mehta</option><option>Priya Nair</option><option>Dev Patel</option></select></label><label>Date and time<input name="date" type="datetime-local" required /></label></>}{(modal === "progress" || modal === "expense") && <label>Photos or receipt<input name="attachment" type="file" accept="image/*,.pdf" multiple /></label>}<div className="modal-actions"><button className="button button-outline" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" type="submit">{modal === "progress" ? "Submit update" : modal === "expense" ? "Submit expense" : modal === "visit" ? "Schedule visit" : modal === "quote" ? "Save quotation" : "Create project"}</button></div></form></section></div>;
}

function BuildingIcon() {
  return <svg width="21" height="21" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 21V5.5L12 2l8 3.5V21M2 21h20M8 8h1m-1 4h1m-1 4h1m6-8h1m-1 4h1m-1 4h1m-4 5v-5h-2v5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
