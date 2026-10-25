import cors from "cors";
import express from "express";

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

type Quote = {
  id: string;
  project: string;
  title: string;
  client: string;
  amount: number;
  date: string;
  status: string;
};

type Expense = {
  id: string;
  project: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  submittedBy: string;
  status: string;
};

type SiteVisit = {
  id: string;
  project: string;
  site: string;
  engineer: string;
  date: string;
  time: string;
  status: string;
};

type Activity = {
  id: string;
  actor: string;
  action: string;
  project: string;
  time: string;
  kind: string;
};
type Material = { id: string; material: string; project: string; received: string; used: string; stock: string; lastUpdated: string };
type Attendance = { id: string; project: string; engineer: string; present: string; shift: string; status: string; evidence: string };
type Feedback = { id: string; project: string; client: string; rating: number; comment: string; date: string };
type Backup = { id: string; status: string; requestedAt: string; requestedBy: string };
type DemoRole = "owner" | "employee" | "client";

const projects: Project[] = [
  { id: "PRJ-024", name: "Riverside Residence", site: "Whitefield, Bengaluru", client: "Ananya Rao", engineer: "Arjun Mehta", status: "In progress", progress: 68, budget: 12500000, spent: 8240000, dueDate: "18 Dec 2026", image: "photo-1600585154340-be6161a56a0c" },
  { id: "PRJ-021", name: "Northstar Office Campus", site: "Hebbal, Bengaluru", client: "Northstar Labs", engineer: "Priya Nair", status: "In progress", progress: 42, budget: 28600000, spent: 11350000, dueDate: "02 Mar 2027", image: "photo-1486406146926-c627a92ad1ab" },
  { id: "PRJ-018", name: "Gardenia Villas — Phase II", site: "Sarjapur Road, Bengaluru", client: "Gardenia Estates", engineer: "Arjun Mehta", status: "On track", progress: 86, budget: 19400000, spent: 15620000, dueDate: "29 Nov 2026", image: "photo-1600607687939-ce8a6c25118c" },
  { id: "PRJ-016", name: "Cedar & Stone Café", site: "Indiranagar, Bengaluru", client: "Mira Hospitality", engineer: "Dev Patel", status: "At risk", progress: 31, budget: 6800000, spent: 2410000, dueDate: "14 Jan 2027", image: "photo-1600210492486-724fe5c67fb0" }
];

const quotations: Quote[] = [
  { id: "QT-1042", project: "Riverside Residence", title: "Kitchen island — add-on work", client: "Ananya Rao", amount: 285000, date: "24 Oct 2026", status: "Awaiting review" },
  { id: "QT-1039", project: "Northstar Office Campus", title: "Foundation & structure", client: "Northstar Labs", amount: 4250000, date: "21 Oct 2026", status: "Sent to client" },
  { id: "QT-1034", project: "Gardenia Villas — Phase II", title: "Landscape lighting package", client: "Gardenia Estates", amount: 168000, date: "17 Oct 2026", status: "Approved" },
  { id: "QT-1028", project: "Cedar & Stone Café", title: "Custom steel canopy", client: "Mira Hospitality", amount: 342000, date: "12 Oct 2026", status: "Changes requested" }
];

const expenses: Expense[] = [
  { id: "EXP-782", project: "Riverside Residence", category: "Materials", description: "M25 ready-mix concrete · 12 m³", amount: 94000, date: "25 Oct 2026", submittedBy: "Arjun Mehta", status: "Pending review" },
  { id: "EXP-779", project: "Northstar Office Campus", category: "Labour", description: "Structural crew · weekly payment", amount: 128000, date: "24 Oct 2026", submittedBy: "Priya Nair", status: "Pending review" },
  { id: "EXP-776", project: "Gardenia Villas — Phase II", category: "Equipment", description: "Scaffolding rental · 2 weeks", amount: 36500, date: "23 Oct 2026", submittedBy: "Arjun Mehta", status: "Approved" },
  { id: "EXP-771", project: "Cedar & Stone Café", category: "Materials", description: "Powder-coated steel sections", amount: 58200, date: "22 Oct 2026", submittedBy: "Dev Patel", status: "Approved" }
];

const siteVisits: SiteVisit[] = [
  { id: "VIS-218", project: "Riverside Residence", site: "Whitefield", engineer: "Arjun Mehta", date: "26 Oct 2026", time: "10:30 AM", status: "Scheduled" },
  { id: "VIS-216", project: "Northstar Office Campus", site: "Hebbal", engineer: "Priya Nair", date: "27 Oct 2026", time: "02:00 PM", status: "Scheduled" },
  { id: "VIS-211", project: "Gardenia Villas — Phase II", site: "Sarjapur Road", engineer: "Arjun Mehta", date: "24 Oct 2026", time: "09:00 AM", status: "Completed" }
];

const activities: Activity[] = [
  { id: "ACT-1", actor: "Arjun Mehta", action: "submitted today's progress update", project: "Riverside Residence", time: "12 min ago", kind: "progress" },
  { id: "ACT-2", actor: "Priya Nair", action: "submitted an expense for review", project: "Northstar Office Campus", time: "48 min ago", kind: "expense" },
  { id: "ACT-3", actor: "Ananya Rao", action: "viewed add-on quotation QT-1042", project: "Riverside Residence", time: "1 hr ago", kind: "quote" },
  { id: "ACT-4", actor: "Dev Patel", action: "marked site attendance for 14 workers", project: "Cedar & Stone Café", time: "2 hrs ago", kind: "attendance" },
  { id: "ACT-5", actor: "Arjun Mehta", action: "recorded 12 m³ of concrete received", project: "Riverside Residence", time: "3 hrs ago", kind: "materials" }
];
const materials: Material[] = [
  { id: "MAT-01", material: "M25 Ready-mix concrete", project: "Riverside Residence", received: "84 m³", used: "62 m³", stock: "22 m³", lastUpdated: "Today, 9:42 AM" },
  { id: "MAT-02", material: "TMT Steel · Fe 500", project: "Northstar Office Campus", received: "18,400 kg", used: "12,700 kg", stock: "5,700 kg", lastUpdated: "Today, 8:15 AM" },
  { id: "MAT-03", material: "Red clay bricks", project: "Gardenia Villas — Phase II", received: "24,000 pcs", used: "18,500 pcs", stock: "5,500 pcs", lastUpdated: "Yesterday" },
  { id: "MAT-04", material: "OPC Cement · 53 grade", project: "Cedar & Stone Café", received: "860 bags", used: "712 bags", stock: "148 bags", lastUpdated: "22 Oct" }
];
const attendance: Attendance[] = [
  { id: "ATT-01", project: "Riverside Residence", engineer: "Arjun Mehta", present: "14 / 16", shift: "Full day", status: "Present", evidence: "▧ 2 photos" },
  { id: "ATT-02", project: "Northstar Office Campus", engineer: "Priya Nair", present: "10 / 12", shift: "Full day", status: "Present", evidence: "▧ 3 photos" },
  { id: "ATT-03", project: "Gardenia Villas — Phase II", engineer: "Arjun Mehta", present: "—", shift: "—", status: "Not submitted", evidence: "—" }
];
const feedback: Feedback[] = [
  { id: "FDB-01", project: "Riverside Residence", client: "Ananya Rao", rating: 5, comment: "Great communication throughout the project. Arjun keeps us updated every week and the progress photos are really helpful.", date: "21 Oct 2026" }
];
const backups: Backup[] = [
  { id: "BKP-008", status: "Ready to download", requestedAt: "20 Oct 2026", requestedBy: "John Smith" }
];

const app = express();
const port = Number(process.env.PORT ?? 3001);
let projectSequence = 25;
let quotationSequence = 1043;
let expenseSequence = 783;
let visitSequence = 219;
let updateSequence = 1;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_request, response) => {
  response.json({ status: "ok", data: "mock", database: "not-required" });
});

app.post("/api/auth/login", (request, response) => {
  const email = readText(request.body?.email)?.toLowerCase();
  const password = readText(request.body?.password);
  const role: unknown = request.body?.role;
  const demoUsers: Record<DemoRole, { email: string; password: string; name: string }> = {
    owner: { email: "owner@vanya.com", password: "owner123", name: "John Smith" },
    employee: { email: "employee@vanya.com", password: "employee123", name: "Arjun Mehta" },
    client: { email: "client@vanya.com", password: "client123", name: "Ananya Rao" }
  };

  if (!isDemoRole(role)) {
    response.status(400).json({ error: "Choose a valid account role." });
    return;
  }

  const user = demoUsers[role];
  if (email !== user.email || password !== user.password) {
    response.status(401).json({ error: "Email or password is incorrect for this role." });
    return;
  }

  response.json({ user: { name: user.name, email: user.email, role } });
});

app.post("/api/auth/logout", (_request, response) => {
  response.json({ status: "ok" });
});

app.get("/api/dashboard", (_request, response) => {
  response.json({ projects, quotes: quotations, expenses, siteVisits, activities, materials, attendance, feedback, backups });
});

app.get("/api/projects", (_request, response) => {
  response.json(projects);
});

app.post("/api/projects", (request, response) => {
  const name = readText(request.body?.name);
  if (!name) {
    response.status(400).json({ error: "Project name is required." });
    return;
  }
  const project: Project = {
    id: `PRJ-${String(projectSequence++).padStart(3, "0")}`,
    name,
    site: "New project site",
    client: "Unassigned",
    engineer: "Unassigned",
    status: "Planning",
    progress: 0,
    budget: 0,
    spent: 0,
    dueDate: "To be confirmed",
    image: "photo-1600585154340-be6161a56a0c"
  };
  projects.unshift(project);
  response.status(201).json({ record: project });
});

app.post("/api/quotations", (request, response) => {
  const title = readText(request.body?.title);
  const project = readText(request.body?.project);
  const amount = readAmount(request.body?.amount);
  if (!title || !project || amount === null) {
    response.status(400).json({ error: "Quotation title, project, and non-negative amount are required." });
    return;
  }
  const quote: Quote = {
    id: `QT-${quotationSequence++}`,
    project,
    title,
    client: projects.find((item) => item.name === project)?.client ?? "Unassigned",
    amount,
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    status: "Awaiting review"
  };
  quotations.unshift(quote);
  response.status(201).json({ record: quote });
});

app.patch("/api/quotations/:id", (request, response) => {
  const status = request.body?.status;
  if (status !== "Approved" && status !== "Declined") {
    response.status(400).json({ error: "Quotation status must be Approved or Declined." });
    return;
  }
  const quote = quotations.find((item) => item.id === request.params.id);
  if (!quote) {
    response.status(404).json({ error: "Quotation not found." });
    return;
  }
  quote.status = status;
  response.json({ record: quote });
});

app.get("/api/expenses", (_request, response) => {
  response.json(expenses);
});

app.post("/api/expenses", (request, response) => {
  const description = readText(request.body?.description);
  const project = readText(request.body?.project);
  const amount = readAmount(request.body?.amount);
  if (!description || !project || amount === null) {
    response.status(400).json({ error: "Expense description, project, and non-negative amount are required." });
    return;
  }
  const expense: Expense = {
    id: `EXP-${expenseSequence++}`,
    project,
    category: "Other",
    description,
    amount,
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    submittedBy: "Arjun Mehta",
    status: "Pending review"
  };
  expenses.unshift(expense);
  response.status(201).json({ record: expense });
});

app.post("/api/progress", (request, response) => {
  const description = readText(request.body?.description);
  const project = readText(request.body?.project);
  if (!description || !project) {
    response.status(400).json({ error: "Progress description and project are required." });
    return;
  }
  const activity: Activity = {
    id: `UPD-${updateSequence++}`,
    actor: "Arjun Mehta",
    action: `submitted a progress update: ${description}`,
    project,
    time: "Just now",
    kind: "progress"
  };
  activities.unshift(activity);
  response.status(201).json({ record: activity });
});

app.get("/api/site-visits", (_request, response) => {
  response.json(siteVisits);
});

app.post("/api/feedback", (request, response) => {
  const project = readText(request.body?.project);
  const comment = readText(request.body?.comment);
  const rating = readAmount(request.body?.rating);
  if (!project || !comment || rating === null || rating < 1 || rating > 5) {
    response.status(400).json({ error: "Project, feedback comment, and a rating from 1 to 5 are required." });
    return;
  }
  const record: Feedback = {
    id: `FDB-${String(feedback.length + 1).padStart(2, "0")}`,
    project,
    client: "Ananya Rao",
    rating,
    comment,
    date: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
  };
  feedback.unshift(record);
  response.status(201).json({ record });
});

app.get("/api/feedback", (_request, response) => {
  response.json(feedback);
});

app.post("/api/backups", (_request, response) => {
  const backup: Backup = {
    id: `BKP-${String(backups.length + 8).padStart(3, "0")}`,
    status: "Preparing",
    requestedAt: new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    requestedBy: "John Smith"
  };
  backups.unshift(backup);
  response.status(202).json({ record: backup });
});

app.post("/api/site-visits", (request, response) => {
  const project = readText(request.body?.project);
  const engineer = readText(request.body?.engineer);
  const date = readText(request.body?.date);
  if (!project || !engineer || !date) {
    response.status(400).json({ error: "Project, engineer, and visit date are required." });
    return;
  }
  const selectedProject = projects.find((item) => item.name === project);
  const visit: SiteVisit = {
    id: `VIS-${visitSequence++}`,
    project,
    site: selectedProject?.site ?? "Project site",
    engineer,
    date: new Date(date).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
    time: new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    status: "Scheduled"
  };
  siteVisits.unshift(visit);
  response.status(201).json({ record: visit });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Mock API request failed:", error);
  response.status(500).json({ error: "The mock API could not process this request." });
});

app.listen(port, () => {
  console.log(`BuildTrack mock API listening on http://localhost:${port}`);
});

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function readAmount(value: unknown): number | null {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : null;
}

function isDemoRole(value: unknown): value is DemoRole {
  return value === "owner" || value === "employee" || value === "client";
}
