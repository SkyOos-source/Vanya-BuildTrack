import type { DashboardData, Role, RoleId, SessionUser } from "./types";

export const navigation: Record<Role, { label: string; icon: string }[]> = {
  Owner: [
    { label: "Dashboard", icon: "dashboard" }, { label: "Projects & Sites", icon: "projects" },
    { label: "Work Progress", icon: "progress" },
    { label: "Materials", icon: "materials" }, { label: "Expenses", icon: "expenses" },
    { label: "Quotations", icon: "quotations" }, { label: "People", icon: "people" },
    { label: "Attendance", icon: "attendance" }, { label: "Reports", icon: "reports" },
    { label: "Site Visits", icon: "site-visits" }, { label: "Feedback", icon: "feedback" },
    { label: "Logs", icon: "logs" }
  ],
  Employee: [
    { label: "Dashboard", icon: "dashboard" }, { label: "My Sites", icon: "projects" },
    { label: "Progress Updates", icon: "progress" }, { label: "Materials", icon: "materials" },
    { label: "Expenses", icon: "expenses" }, { label: "Attendance", icon: "attendance" },
    { label: "Site Visits", icon: "site-visits" }
  ],
  Client: [
    { label: "Dashboard", icon: "dashboard" }, { label: "My Projects", icon: "projects" },
    { label: "Work Progress", icon: "progress" }, { label: "Quotations", icon: "quotations" },
    { label: "Timeline", icon: "timeline" },
    { label: "Feedback", icon: "feedback" }
  ]
};

export const emptyDashboardData: DashboardData = {
  projects: [],
  quotes: [],
  expenses: [],
  expenseAllocations: [],
  siteVisits: [],
  activities: [],
  materials: [],
  materialAllocations: [],
  materialUsageLogs: [],
  materialRequests: [],
  attendance: [],
  feedback: [],
  backups: [],
  people: []
};

localStorage.removeItem("buildtrack-mode");
localStorage.removeItem("buildtrack-demo-data");

export function readAccessToken(): string | null {
  return localStorage.getItem("buildtrack-access-token");
}

export function readRefreshToken(): string | null {
  return localStorage.getItem("buildtrack-refresh-token");
}

export function saveAuthTokens(accessToken: string, refreshToken: string): void {
  localStorage.setItem("buildtrack-access-token", accessToken);
  localStorage.setItem("buildtrack-refresh-token", refreshToken);
}

export function clearAuthTokens(): void {
  localStorage.removeItem("buildtrack-access-token");
  localStorage.removeItem("buildtrack-refresh-token");
}

export function readSession(): SessionUser | null {
  const session = localStorage.getItem("buildtrack-session");
  if (!session) return null;
  try {
    const user = JSON.parse(session) as SessionUser;
    if (!user || typeof user.name !== "string" || typeof user.email !== "string" ||
      (user.role !== "owner" && user.role !== "employee" && user.role !== "client")) {
      localStorage.removeItem("buildtrack-session");
      return null;
    }
    if (!readAccessToken() || !readRefreshToken()) {
      localStorage.removeItem("buildtrack-session");
      return null;
    }
    return user;
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
  const pages = [...(role !== "Client" ? ["Profile"] : []), ...navigation[role].map((item) => item.label), ...(role === "Owner" ? ["Settings & Backup", "Financial Overview"] : ["Settings"])];
  return pages.find((page) => pageSlug(page) === slug) ?? "Dashboard";
}
