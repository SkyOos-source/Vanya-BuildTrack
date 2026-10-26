import type { DashboardData, Role, RoleId, SessionUser } from "./types";

export const navigation: Record<Role, { label: string; icon: string }[]> = {
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

export const fallbackData: DashboardData = {
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
    { id: "ATT-01", project: "Riverside Residence", engineer: "Arjun Mehta", present: "14 / 16", shift: "Full day", status: "Present", evidence: "▧ 2 photos", date: "2026-10-25" },
    { id: "ATT-02", project: "Northstar Office Campus", engineer: "Priya Nair", present: "10 / 12", shift: "Full day", status: "Present", evidence: "▧ 3 photos", date: "2026-10-25" },
    { id: "ATT-03", project: "Gardenia Villas — Phase II", engineer: "Arjun Mehta", present: "—", shift: "—", status: "Not submitted", evidence: "—", date: "2026-10-25" }
  ],
  feedback: [
    { id: "FDB-01", project: "Riverside Residence", client: "Ananya Rao", rating: 5, comment: "Great communication throughout the project. Arjun keeps us updated every week and the progress photos are really helpful.", date: "21 Oct 2026" }
  ],
  backups: [
    { id: "BKP-008", status: "Ready to download", requestedAt: "20 Oct 2026", requestedBy: "John Smith" }
  ],
  people: [
    { id: "USR-001", name: "Ananya Rao", role: "Client", project: "Riverside Residence", email: "client@vanya.com" },
    { id: "USR-002", name: "Northstar Labs", role: "Client", project: "Northstar Office Campus", email: "northstar@example.com" },
    { id: "USR-003", name: "Arjun Mehta", role: "Site Engineer", project: "2 active sites", email: "employee@vanya.com" },
    { id: "USR-004", name: "Priya Nair", role: "Site Engineer", project: "Northstar Office Campus", email: "priya@example.com" },
    { id: "USR-005", name: "Dev Patel", role: "Site Engineer", project: "Cedar & Stone Café", email: "dev@example.com" }
  ]
};

export const demoCredentials: Record<RoleId, { email: string; password: string; label: string }> = {
  owner: { email: "owner@vanya.com", password: "owner123", label: "Owner" },
  employee: { email: "employee@vanya.com", password: "employee123", label: "Employee" },
  client: { email: "client@vanya.com", password: "client123", label: "Client" }
};

export function readSession(): SessionUser | null {
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

export function roleName(role: RoleId): Role {
  return role === "owner" ? "Owner" : role === "employee" ? "Employee" : "Client";
}

export function roleId(role: Role): RoleId {
  return role === "Owner" ? "owner" : role === "Employee" ? "employee" : "client";
}

export function rolePath(role: RoleId): string {
  return role === "owner" ? "/admin" : `/${role}`;
}

export function pageSlug(label: string): string {
  return label.toLowerCase().replace(/ & /g, "-").replace(/\s+/g, "-");
}

export function pagePath(role: Role, page: string): string {
  const base = rolePath(roleId(role));
  return page === "Dashboard" ? base : `${base}/${pageSlug(page)}`;
}

export function pageFromPath(pathname: string, role: Role): string {
  const base = rolePath(roleId(role));
  const slug = pathname.slice(base.length).replace(/^\/+|\/+$/g, "");
  if (!slug) return "Dashboard";
  const pages = [...navigation[role].map((item) => item.label), ...(role === "Owner" ? ["Settings & Backup"] : [])];
  return pages.find((page) => pageSlug(page) === slug) ?? "Dashboard";
}
