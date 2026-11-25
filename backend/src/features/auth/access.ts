import type { NextFunction, Request, Response } from "express";
import {
  attendance,
  attendanceLeaveRequests,
  attendanceRegularizationRequests,
  expenseAllocations,
  expenses,
  feedback,
  materialRequests,
  materialAllocations,
  materialUsageLogs,
  materials,
  people,
  projects,
  quotations,
  siteVisits,
  workRequests,
  type AccountRole,
  type Activity,
  type ExpenseAllocation
} from "../../data/store";
import type { WorkspaceUpdate } from "../../realtime";
import { authenticateBearerHeader, type AuthenticatedSession } from "./session";

type AuthorizationDecision = { allowed: true } | { allowed: false; status: 401 | 403; error: string };

const employeeReadRoutes = new Set([
  "/api/dashboard",
  "/api/projects",
  "/api/people",
  "/api/materials",
  "/api/material-categories",
  "/api/material-allocations",
  "/api/material-usage",
  "/api/material-requests",
  "/api/expenses",
  "/api/expenses/allocations",
  "/api/quotations",
  "/api/progress",
  "/api/site-visits",
  "/api/work-requests",
  "/api/attendance",
  "/api/attendance/leaves",
  "/api/attendance/leave-requests",
  "/api/attendance/regularization-requests",
  "/api/events",
  "/api/profiles/me"
]);

const projectManagerReadRoutes = new Set([
  "/api/dashboard", "/api/projects", "/api/people", "/api/materials",
  "/api/material-categories",
  "/api/material-allocations", "/api/material-usage", "/api/material-requests",
  "/api/expenses", "/api/expenses/allocations", "/api/quotations", "/api/progress",
  "/api/site-visits", "/api/attendance", "/api/attendance/leaves",
  "/api/work-requests",
  "/api/attendance/leave-requests", "/api/attendance/regularization-requests",
  "/api/payments", "/api/feedback", "/api/events", "/api/profiles/me"
]);

const clientReadRoutes = new Set([
  "/api/dashboard",
  "/api/projects",
  "/api/people",
  "/api/people",
  "/api/progress",
  "/api/work-requests",
  "/api/quotations",
  "/api/feedback",
  "/api/events",
  "/api/profiles/me",
  "/api/payments"
]);

function isPublicEndpoint(method: string, pathname: string) {
  if (method === "GET" && (pathname === "/api/health" || pathname === "/api/push/config" ||
    pathname === "/api/auth/setup/status" || /^\/api\/profiles\/[^/]+$/.test(pathname) && pathname !== "/api/profiles/me")) {
    return true;
  }
  return method === "POST" && /^\/api\/auth\/(setup|login|send-code|verify-code|refresh|logout)$/.test(pathname);
}

function isAttendanceReadRoute(pathname: string) {
  return pathname === "/api/attendance" ||
    pathname === "/api/attendance/leaves" ||
    pathname === "/api/attendance/leave-requests" ||
    pathname === "/api/attendance/regularization-requests";
}

function personForSession(session: AuthenticatedSession) {
  if (session.role === "owner") return undefined;
  const expectedRole = session.role === "employee" ? "Site Engineer" : session.role === "project_manager" ? "Project Manager" : "Client";
  const person = people.find((item) => item.role === expectedRole && typeof item.email === "string" &&
    item.email.toLowerCase() === session.email.toLowerCase());
  if (!person || typeof person.name !== "string") return undefined;
  const sameRoleNames = people.filter((item) => item.role === expectedRole && sameName(item.name, person.name));
  if (sameRoleNames.length !== 1) return undefined;
  return person;
}

function sameName(value: unknown, name: string) {
  return typeof value === "string" && value.toLowerCase() === name.toLowerCase();
}

function assignedProjectNames(session: AuthenticatedSession) {
  const person = personForSession(session);
  if (!person || typeof person.name !== "string") return new Set<string>();
  const assignedProjects = projects.filter((project) => session.role === "employee"
    ? sameName(project.engineer, person.name)
    : session.role === "project_manager"
      ? sameName(project.projectManager, person.name) || typeof person.project === "string" && sameName(project.name, person.project)
      : sameName(project.client, person.name) || typeof person.project === "string" && sameName(project.name, person.project)
  );
  const nameCounts = new Map<string, number>();
  for (const project of projects) {
    const projectName = project.name.toLowerCase();
    nameCounts.set(projectName, (nameCounts.get(projectName) ?? 0) + 1);
  }
  return new Set(assignedProjects.filter((project) => nameCounts.get(project.name.toLowerCase()) === 1).map((project) => project.name));
}

function belongsToAssignedProject(session: AuthenticatedSession, projectName: unknown) {
  return typeof projectName === "string" && assignedProjectNames(session).has(projectName);
}

function matchesProject(record: { project?: unknown }, projectNames: Set<string>) {
  return typeof record.project === "string" && projectNames.has(record.project);
}

function ownPushTarget(session: AuthenticatedSession, target: { role: AccountRole; userName?: string; userEmail?: string }) {
  return target.role === session.role &&
    (target.userEmail
      ? target.userEmail.toLowerCase() === session.email.toLowerCase()
      : target.userName?.toLowerCase() === session.name.toLowerCase());
}

function authorizeMutation(request: Request, session: AuthenticatedSession): AuthorizationDecision {
  const path = request.path;
  const method = request.method;
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const projectNames = assignedProjectNames(session);

  if (session.role === "owner") {
    if (method === "POST" && path === "/api/site-visits") {
      return { allowed: false, status: 403, error: "Owners view engineer site visits and do not schedule them." };
    }
    if (method === "POST" && path === "/api/expenses/allocations") body.assignedBy = session.name;
    if (method === "POST" && path === "/api/material-allocations") body.assignedBy = session.name;
    if (method === "POST" && path === "/api/material-usage") body.loggedBy = session.name;
    if (method === "POST" && path === "/api/payments") {
      body.recordedBy = session.name;
      body.recordedByRole = "Owner";
    }
    if (method === "PATCH" && /^\/api\/material-requests\/[^/]+$/.test(path)) {
      body.reviewedBy = session.name;
      if (body.status === "Approved") body.assignedBy = session.name;
    }
    if (method === "POST" && path === "/api/work-requests") {
      return { allowed: false, status: 403, error: "Only clients can submit work requests." };
    }
    if (method === "PATCH" && /^\/api\/work-requests\/[^/]+$/.test(path)) {
      body.reviewedBy = session.name;
      body.reviewedByRole = "Owner";
    }
    if (method === "POST" && path === "/api/expenses") body.submittedBy = session.name;
    return { allowed: true };
  }

  if (session.role === "project_manager") {
    if (method === "POST" && path === "/api/work-requests") {
      return { allowed: false, status: 403, error: "Only clients can submit work requests." };
    }
    if (method === "PATCH" && /^\/api\/work-requests\/[^/]+$/.test(path)) {
      const request = workRequests.find((item) => item.id === path.slice("/api/work-requests/".length));
      if (!request || !projectNames.has(request.project)) {
        return { allowed: false, status: 403, error: "You can only review work requests for your assigned projects." };
      }
      body.reviewedBy = session.name;
      body.reviewedByRole = "Project Manager";
      return { allowed: true };
    }
    if (method === "POST" && path === "/api/site-visits") {
      body.engineer = body.engineer || session.name;
      if (!belongsToAssignedProject(session, body.project)) {
        return { allowed: false, status: 403, error: "You can only manage site visits for your assigned projects." };
      }
      return { allowed: true };
    }
    if (method === "POST" && path === "/api/attendance") {
      body.engineer = session.name;
      return { allowed: true };
    }
    if (method === "POST" && (path === "/api/attendance/leave-requests" || path === "/api/attendance/regularization-requests")) {
      body.engineer = session.name;
      if (path.endsWith("regularization-requests")) {
        const record = attendance.find((item) => item.id === body.attendanceId);
        if (!record || !sameName(record.engineer, session.name)) {
          return { allowed: false, status: 403, error: "You can only regularize your own attendance." };
        }
      }
      return { allowed: true };
    }
    if (method === "POST" && ["/api/projects", "/api/people", "/api/backups"].includes(path)) {
      return { allowed: false, status: 403, error: "Project managers cannot create projects, people, or workspace backups." };
    }
    if (method === "DELETE" && (/^\/api\/projects\/[^/]+$/.test(path) || /^\/api\/people\/[^/]+$/.test(path))) {
      return { allowed: false, status: 403, error: "Project managers cannot delete projects or people." };
    }
    if (method === "PATCH" && /^\/api\/profiles\/me$/.test(path)) return authorizeOwnProfile(request, session);
    if (method === "PATCH" && /^\/api\/attendance\/(leave|regularization)-requests\/[^/]+$/.test(path)) {
      return { allowed: false, status: 403, error: "Project managers can submit attendance requests but cannot approve them." };
    }
    if (typeof body.project === "string" && !belongsToAssignedProject(session, body.project)) {
      return { allowed: false, status: 403, error: "You can only manage records for your assigned projects." };
    }
    if (method === "PATCH" && /^\/api\/projects\/[^/]+$/.test(path)) {
      const id = path.slice("/api/projects/".length);
      const project = projects.find((item) => item.id === id);
      if (!project || !projectNames.has(project.name)) {
        return { allowed: false, status: 403, error: "You can only edit your assigned projects." };
      }
    }
    if (method === "POST" && ["/api/progress", "/api/material-requests", "/api/material-usage", "/api/expenses", "/api/payments", "/api/quotations", "/api/materials", "/api/material-allocations", "/api/expenses/allocations", "/api/feedback"].includes(path)) {
      if (typeof body.project === "string" && !belongsToAssignedProject(session, body.project)) {
        return { allowed: false, status: 403, error: "You can only manage records for your assigned projects." };
      }
    }
    if (method === "POST" && path === "/api/payments") {
      body.recordedBy = session.name;
      body.recordedByRole = "Owner";
    }
    if (method === "POST" && path === "/api/progress") {
      body.actor = session.name;
    }
    return { allowed: true };
  }
  if (path === "/api/push/subscriptions" && (method === "POST" || method === "DELETE")) return { allowed: true };

  if (session.role === "employee") {
    if (method === "POST" && path === "/api/material-categories") {
      body.createdBy = session.name;
      return { allowed: true };
    }
    if (method === "PATCH" && /^\/api\/work-requests\/[^/]+$/.test(path)) {
      const request = workRequests.find((item) => item.id === path.slice("/api/work-requests/".length));
      const assignedProject = request && projects.find((project) => project.name === request.project);
      if (!request || !assignedProject || !sameName(assignedProject.engineer, session.name)) {
        return { allowed: false, status: 403, error: "You can only review work requests for projects assigned to you." };
      }
      body.reviewedBy = session.name;
      body.reviewedByRole = "Site Engineer";
      return { allowed: true };
    }
    if (method === "POST" && path === "/api/site-visits") {
      if (body.action !== "check-in") {
        return { allowed: false, status: 403, error: "Site engineers can check in directly but cannot schedule owner visits." };
      }
      body.engineer = session.name;
      if (body.createProject !== true && body.createProject !== "true" &&
        !belongsToAssignedProject(session, body.project)) {
        return { allowed: false, status: 403, error: "You can only check in at your assigned projects/sites." };
      }
      return { allowed: true };
    }
    if (method === "POST" && path === "/api/attendance") {
      body.engineer = session.name;
      return { allowed: true };
    }
    if (method === "POST" && path === "/api/attendance/leave-requests") {
      body.engineer = session.name;
      return { allowed: true };
    }
    if (method === "POST" && path === "/api/attendance/regularization-requests") {
      const record = attendance.find((item) => item.id === body.attendanceId);
      if (!record || !sameName(record.engineer, session.name)) {
        return { allowed: false, status: 403, error: "You can only request regularization for your own attendance." };
      }
      body.engineer = session.name;
      return { allowed: true };
    }
    if (method === "POST" && ["/api/progress", "/api/material-requests", "/api/material-usage", "/api/expenses"].includes(path)) {
      if (!belongsToAssignedProject(session, body.project)) {
        return { allowed: false, status: 403, error: "You can only add records to your assigned projects." };
      }
      if (path === "/api/progress") {
        body.actor = session.name;
        body.submittedBy = session.name;
      } else if (path === "/api/materials") {
        body.submittedBy = session.name;
      } else if (path === "/api/material-requests") {
        body.requestedBy = session.name;
      } else if (path === "/api/material-usage") {
        const allocation = materialAllocations.find((item) => item.id === body.allocationId &&
          sameName(item.engineer, session.name) && projectNames.has(item.project));
        if (!allocation) {
          return { allowed: false, status: 403, error: "You can only log usage against your own material assignments." };
        }
        body.engineer = session.name;
        body.loggedBy = session.name;
        body.project = allocation.project;
      } else {
        body.submittedBy = session.name;
        if (body.entryType === "log") {
          const allocation = expenseAllocations.find((item) => item.id === body.allocationId &&
            sameName(item.engineer, session.name));
          if (!allocation) {
            return { allowed: false, status: 403, error: "You can only log expenses against your own assigned funds." };
          }
          body.requireAllocation = true;
        }
      }
      return { allowed: true };
    }
    if (method === "PATCH" && /^\/api\/site-visits\/[^/]+$/.test(path)) {
      const id = path.slice("/api/site-visits/".length);
      const visit = siteVisits.find((item) => item.id === id);
      if (!visit || !sameName(visit.engineer, session.name) || !projectNames.has(visit.project)) {
        return { allowed: false, status: 403, error: "You can only update site visits assigned to you." };
      }
      body.engineer = session.name;
      return { allowed: true };
    }
    if (method === "PATCH" && path === "/api/profiles/me") return authorizeOwnProfile(request, session);
    return { allowed: false, status: 403, error: "This action is not available to site engineers." };
  }

  if (session.role === "client") {
    if (method === "POST" && path === "/api/work-requests") {
      if (!belongsToAssignedProject(session, body.project)) {
        return { allowed: false, status: 403, error: "You can only request work for your assigned projects." };
      }
      body.requestedBy = session.name;
      body.requesterEmail = session.email;
      return { allowed: true };
    }
    if (method === "PATCH" && /^\/api\/work-requests\/[^/]+$/.test(path)) {
      return { allowed: false, status: 403, error: "Clients cannot review work requests." };
    }
    if (method === "POST" && path === "/api/payments") {
      if (!belongsToAssignedProject(session, body.project)) {
        return { allowed: false, status: 403, error: "You can only add payments to your assigned project." };
      }
      body.recordedBy = session.name;
      body.recordedByRole = "Client";
      return { allowed: true };
    }
    if (method === "POST" && path === "/api/feedback") {
      if (!belongsToAssignedProject(session, body.project)) {
        return { allowed: false, status: 403, error: "You can only submit feedback for your assigned project." };
      }
      body.client = session.name;
      return { allowed: true };
    }
    if (method === "PATCH" && /^\/api\/quotations\/[^/]+$/.test(path)) {
      const id = path.slice("/api/quotations/".length);
      const quote = quotations.find((item) => item.id === id);
      if (!quote || !projectNames.has(quote.project) || !sameName(quote.client, session.name)) {
        return { allowed: false, status: 403, error: "You can only review quotations for your assigned project." };
      }
      return { allowed: true };
    }
    return { allowed: false, status: 403, error: "This action is not available to clients." };
  }
  return { allowed: false, status: 403, error: "This action is not available to this account." };
}

function authorizeOwnProfile(request: Request, session: AuthenticatedSession): AuthorizationDecision {
  const expectedRole = session.role;
  const role = request.query.role;
  const email = request.query.email;
  if (role !== expectedRole || typeof email !== "string" || email.toLowerCase() !== session.email.toLowerCase()) {
    return { allowed: false, status: 403, error: "You can only access your own profile." };
  }
  return { allowed: true };
}

export function authorizeApiRequest(request: Request, session?: AuthenticatedSession): AuthorizationDecision {
  if (!session) return { allowed: false, status: 401, error: "Sign-in is required to access this API." };
  if (session.role === "owner") {
    return request.method === "GET" || request.method === "HEAD"
      ? { allowed: true }
      : authorizeMutation(request, session);
  }
  if (!personForSession(session)) {
    return { allowed: false, status: 403, error: "Your account profile is missing or ambiguous. Contact a workspace owner." };
  }

  const method = request.method;
  const path = request.path;
  if (path === "/api/push/subscriptions" && (method === "POST" || method === "DELETE")) return { allowed: true };
  if (method === "GET") {
    if (session.role === "project_manager" && projectManagerReadRoutes.has(path)) {
      if (path === "/api/profiles/me") return authorizeOwnProfile(request, session);
      return { allowed: true };
    }
    if (session.role === "employee" && (employeeReadRoutes.has(path) || isAttendanceReadRoute(path))) {
      if (path === "/api/profiles/me") return authorizeOwnProfile(request, session);
      return { allowed: true };
    }
    if (session.role === "client" && clientReadRoutes.has(path)) {
      if (path === "/api/profiles/me") return authorizeOwnProfile(request, session);
      return { allowed: true };
    }
    return { allowed: false, status: 403, error: "This resource is not available to this account." };
  }
  return authorizeMutation(request, session);
}

export function apiAccessMiddleware(request: Request, response: Response, next: NextFunction) {
  if (!request.path.startsWith("/api/") || request.method === "OPTIONS" ||
    isPublicEndpoint(request.method, request.path)) {
    next();
    return;
  }
  const session = authenticateBearerHeader(request.get("authorization"));
  const decision = authorizeApiRequest(request, session);
  if (!decision.allowed) {
    response.status(decision.status).json({ error: decision.error });
    return;
  }
  response.locals.authSession = session;
  next();
}

function scopeDashboard(data: Record<string, unknown>, session: AuthenticatedSession) {
  const projectNames = assignedProjectNames(session);
  const ownName = session.name.toLowerCase();
  const isEmployee = session.role === "employee";
  const isProjectManager = session.role === "project_manager";
  const filterProjects = (items: unknown) => Array.isArray(items) ? items.filter((item) =>
    item && typeof item === "object" && matchesProject(item as { project?: unknown }, projectNames)
  ) : [];
  const filterActivities = (items: unknown) => Array.isArray(items) ? items.filter((value) => {
    if (!value || typeof value !== "object") return false;
    const item = value as Activity;
    return projectNames.has(item.project) && (isEmployee || item.kind === "progress");
  }) : [];
  const ownPeople = people.filter((person) => typeof person.email === "string" &&
    person.email.toLowerCase() === session.email.toLowerCase());
  return {
    ...data,
    materialCategories: isProjectManager || isEmployee ? data.materialCategories : [],
    projects: projects.filter((project) => projectNames.has(project.name)),
    quotes: isEmployee ? [] : filterProjects(data.quotes),
    expenses: isEmployee ? filterProjects(data.expenses) : isProjectManager ? filterProjects(data.expenses) : [],
    payments: isEmployee ? [] : filterProjects(data.payments),
    expenseAllocations: isEmployee
      ? (Array.isArray(data.expenseAllocations) ? data.expenseAllocations as ExpenseAllocation[] : [])
        .filter((allocation) => sameName(allocation.engineer, session.name))
      : [],
    siteVisits: isEmployee ? siteVisits.filter((visit) => projectNames.has(visit.project) && sameName(visit.engineer, ownName)) : [],
    activities: filterActivities(data.activities),
    materials: isEmployee ? filterProjects(data.materials) : isProjectManager ? data.materials : [],
    materialAllocations: (isEmployee || isProjectManager)
      ? (Array.isArray(data.materialAllocations) ? data.materialAllocations as typeof materialAllocations : [])
        .filter((allocation) => isProjectManager ? projectNames.has(allocation.project) : sameName(allocation.engineer, session.name) && projectNames.has(allocation.project))
      : [],
    materialUsageLogs: (isEmployee || isProjectManager)
      ? (Array.isArray(data.materialUsageLogs) ? data.materialUsageLogs as typeof materialUsageLogs : [])
        .filter((log) => isProjectManager ? projectNames.has(log.project) : sameName(log.engineer, session.name) && projectNames.has(log.project))
      : [],
    materialRequests: isEmployee
      ? filterProjects(data.materialRequests).filter((request) =>
        request && typeof request === "object" && sameName((request as { requestedBy?: unknown }).requestedBy, session.name))
      : [],
    attendance: isProjectManager
      ? attendance.filter((record) => !record.project || projectNames.has(record.project) || sameName(record.engineer, ownName))
      : isEmployee ? attendance.filter((record) => sameName(record.engineer, ownName)) : [],
    attendanceLeaves: data.attendanceLeaves ?? [],
    attendanceLeaveRequests: isEmployee ? attendanceLeaveRequests.filter((item) => sameName(item.engineer, ownName)) : [],
    attendanceRegularizationRequests: isEmployee ? attendanceRegularizationRequests.filter((item) => sameName(item.engineer, ownName)) : [],
    feedback: feedback.filter((item) => projectNames.has(item.project)),
    backups: [],
    people: ownPeople
  };
}

export function scopeApiResponse(pathname: string, body: unknown, session?: AuthenticatedSession): unknown {
  if (!session || session.role === "owner") return body;
  if (pathname === "/api/dashboard" && body && typeof body === "object" && !Array.isArray(body)) {
    return scopeDashboard(body as Record<string, unknown>, session);
  }
  if (!Array.isArray(body)) return body;
  const projectNames = assignedProjectNames(session);
  if (pathname === "/api/projects") return projects.filter((project) => projectNames.has(project.name));
  if (pathname === "/api/people") {
    const ownPeople = people.filter((person) => typeof person.email === "string" &&
      person.email.toLowerCase() === session.email.toLowerCase());
    if (session.role === "project_manager") {
      return people.filter((person) => ownPeople.includes(person) ||
        typeof person.project === "string" && projectNames.has(person.project));
    }
    if (session.role === "employee") {
      const assignedClientNames = new Set(projects
        .filter((project) => projectNames.has(project.name) && project.client.toLowerCase() !== "unassigned")
        .map((project) => project.client.toLowerCase()));
      return people.filter((person) => ownPeople.includes(person) ||
        person.role === "Client" && (
          typeof person.project === "string" && projectNames.has(person.project) ||
          assignedClientNames.has(person.name.toLowerCase())
        ));
    }
    if (session.role === "client") {
      const assignedEngineerNames = new Set(projects
        .filter((project) => projectNames.has(project.name) && project.engineer.toLowerCase() !== "unassigned")
        .map((project) => project.engineer.toLowerCase()));
      return people.filter((person) => ownPeople.includes(person) ||
        person.role === "Site Engineer" && assignedEngineerNames.has(person.name.toLowerCase()));
    }
    return ownPeople;
  }
  if (pathname === "/api/expenses/allocations") {
    return session.role === "employee"
      ? expenseAllocations.filter((allocation) => sameName(allocation.engineer, session.name)).map((allocation) => {
        const spentCents = expenses.filter((expense) => expense.allocationId === allocation.id &&
          (expense.entryType === "log" || (!expense.entryType && expense.status === "Logged")))
          .reduce((total, expense) => total + Math.round(expense.amount * 100), 0);
        const allocationCents = Math.round(allocation.amount * 100);
        return { ...allocation, spentAmount: spentCents / 100, remainingAmount: (allocationCents - spentCents) / 100 };
      })
      : body;
  }
  if (pathname === "/api/attendance" || pathname === "/api/attendance/leave-requests" ||
    pathname === "/api/attendance/regularization-requests") {
    if (session.role === "project_manager") {
      if (pathname === "/api/attendance") {
        return body.filter((item) => item && typeof item === "object" &&
          (!(item as { project?: unknown }).project || matchesProject(item as { project?: unknown }, projectNames)));
      }
      return body.filter((item) => item && typeof item === "object" &&
        sameName((item as { engineer?: unknown }).engineer, session.name));
    }
    return body.filter((item) => item && typeof item === "object" &&
      "engineer" in item && sameName((item as { engineer: unknown }).engineer, session.name));
  }
  if (pathname === "/api/attendance/leaves") return body;
  if (pathname === "/api/work-requests") {
    return body.filter((item) => item && typeof item === "object" &&
      matchesProject(item as { project?: unknown }, projectNames) &&
      (session.role !== "client" ||
        (item as { requesterEmail?: unknown }).requesterEmail === session.email));
  }
  if (pathname === "/api/site-visits") {
    if (session.role === "project_manager") {
      return body.filter((item) => item && typeof item === "object" &&
        matchesProject(item as { project?: unknown }, projectNames));
    }
    return body.filter((item) => item && typeof item === "object" &&
      sameName((item as { engineer?: unknown }).engineer, session.name) &&
      matchesProject(item as { project?: unknown }, projectNames));
  }
  if (pathname === "/api/material-allocations") {
    return session.role === "employee"
      ? body.filter((allocation) => allocation && typeof allocation === "object" &&
        sameName((allocation as { engineer?: unknown }).engineer, session.name) &&
        matchesProject(allocation as { project?: unknown }, projectNames))
      : body;
  }
  if (pathname === "/api/material-usage") {
    return session.role === "employee"
      ? body.filter((item) => item && typeof item === "object" && sameName((item as { engineer?: unknown }).engineer, session.name) && projectNames.has((item as { project?: string }).project ?? ""))
      : body;
  }
  if (pathname === "/api/materials" && session.role === "project_manager") return body;
  if (["/api/quotations", "/api/expenses", "/api/payments", "/api/materials", "/api/material-requests", "/api/progress", "/api/feedback"].includes(pathname)) {
    return body.filter((item) => item && typeof item === "object" &&
      matchesProject(item as { project?: unknown }, projectNames) &&
      (pathname !== "/api/material-requests" || session.role !== "employee" ||
        sameName((item as { requestedBy?: unknown }).requestedBy, session.name)) &&
      (session.role !== "client" || pathname !== "/api/progress" || (item as Activity).kind === "progress"));
  }
  if (pathname === "/api/backups") return [];
  return body;
}

export function scopeWorkspaceUpdate(update: WorkspaceUpdate, session: AuthenticatedSession): WorkspaceUpdate | undefined {
  if (session.role === "owner") return update;
  if (session.role === "project_manager" &&
    (update.resource === "materialCategories" || update.resource === "materials")) return update;
  if (session.role === "employee") {
    if (update.resource === "materialCategories") return update;
    const push = update.push;
    if (update.resource === "materialRequests" && push?.targets.some((target) => ownPushTarget(session, target))) {
      return { ...update, push: { ...push, targets: push.targets.filter((target) => ownPushTarget(session, target)) } };
    }
    if (update.resource === "expenseAllocations" && update.allocation &&
      sameName(update.allocation.engineer, session.name)) return update;
    if (update.resource === "materialAllocations" && update.materialAllocation &&
      sameName(update.materialAllocation.engineer, session.name)) return update;
    if (update.resource === "materialUsage" && update.engineer &&
      sameName(update.engineer, session.name)) return update;
    if (update.resource === "siteVisits" && update.visit && sameName(update.visit.engineer, session.name) &&
      assignedProjectNames(session).has(update.visit.project)) return update;
    if (update.resource === "workRequests" && update.project && assignedProjectNames(session).has(update.project)) {
      return {
        ...update,
        ...(push ? { push: { ...push, targets: push.targets.filter((target) => ownPushTarget(session, target)) } } : {})
      };
    }
    if (update.resource === "attendance" && update.push?.targets.some((target) => ownPushTarget(session, target))) {
      return update;
    }
    return undefined;
  }
  if ((update.resource !== "progress" && update.resource !== "quotations" && update.resource !== "payments" && update.resource !== "workRequests") ||
    !update.project || !belongsToAssignedProject(session, update.project)) return undefined;
  return {
    ...update,
    ...(update.push ? {
      push: {
        ...update.push,
        targets: update.push.targets.filter((target) => ownPushTarget(session, target))
      }
    } : {})
  };
}
