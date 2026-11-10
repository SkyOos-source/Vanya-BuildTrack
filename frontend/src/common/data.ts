import type { DashboardData, Role, RoleId, SessionUser } from "./types";

export const navigation: Record<Role, { label: string; icon: string }[]> = {
  Owner: [
    { label: "Dashboard", icon: "◫" }, { label: "Projects & Sites", icon: "▦" },
    { label: "Work Progress", icon: "▥" },
    { label: "Materials", icon: "◈" }, { label: "Expenses", icon: "＄" },
    { label: "Quotations", icon: "▤" }, { label: "People", icon: "♙" },
    { label: "Attendance", icon: "◷" }, { label: "Reports", icon: "▥" },
    { label: "Site Visits", icon: "⌖" }, { label: "Feedback", icon: "☆" }
  ],
  Employee: [
    { label: "Dashboard", icon: "◫" }, { label: "My Sites", icon: "▦" },
    { label: "Progress Updates", icon: "▥" }, { label: "Materials", icon: "◈" },
    { label: "Expenses", icon: "＄" }, { label: "Attendance", icon: "◷" },
    { label: "Site Visits", icon: "⌖" }
  ],
  Client: [
    { label: "Dashboard", icon: "◫" }, { label: "My Projects", icon: "▦" },
    { label: "Work Progress", icon: "▥" }, { label: "Quotations", icon: "▤" },
    { label: "Timeline", icon: "◷" },
    { label: "Feedback", icon: "☆" }
  ]
};

export const emptyDashboardData: DashboardData = {
  projects: [],
  quotes: [],
  expenses: [],
  siteVisits: [],
  activities: [],
  materials: [],
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
