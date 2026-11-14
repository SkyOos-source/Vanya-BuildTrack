import "dotenv/config";
import "reflect-metadata";
import cors from "cors";
import express from "express";
import { existsSync } from "node:fs";
import path from "node:path";
import { RegisterRoutes } from "./generated/routes";
import { findOwnerAccount, initializeStore, ownerAuditLogs, people, recordOwnerAction, saveStore, type SiteVisit } from "./data/store";
import { getPushPublicKey, isPushSubscription, pushConfigured, removePushSubscription, savePushSubscription } from "./push";
import { publishWorkspaceUpdate, subscribeToWorkspaceUpdates } from "./realtime";
import { authenticateBearerHeader } from "./features/auth/session";
import { createInitialOwnerSetupCode } from "./features/auth/service";

const app = express();
const port = Number(process.env.PORT ?? 3001);

function auditOwnerRequest(request: express.Request, body: unknown) {
  const session = authenticateBearerHeader(request.get("authorization"));
  const owner = session?.role === "owner" ? findOwnerAccount(session.email) : undefined;
  if (!owner || request.path.startsWith("/api/push/") || request.path.startsWith("/api/auth/")) return;
  const parts = request.path.split("/").filter(Boolean);
  const collection = parts[1] === "attendance" && ["leaves", "leave-requests", "regularization-requests"].includes(parts[2] ?? "")
    ? parts[2]
    : parts[1] ?? "workspace";
  const resources: Record<string, string> = {
    projects: "Project",
    quotations: "Quotation",
    expenses: "Expense",
    "site-visits": "Site visit",
    progress: "Progress update",
    materials: "Material",
    "material-requests": "Material request",
    attendance: "Attendance",
    "leave-requests": "Leave request",
    "regularization-requests": "Regularization request",
    leaves: "Attendance leave",
    people: "Person",
    feedback: "Feedback",
    backups: "Backup",
    profiles: "Profile"
  };
  const resource = resources[collection] ?? collection.replace(/-/g, " ").replace(/s$/, "");
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const record = payload.record && typeof payload.record === "object"
    ? payload.record as Record<string, unknown>
    : payload.request && typeof payload.request === "object"
      ? payload.request as Record<string, unknown>
      : {};
  const target = typeof record.id === "string"
    ? record.id
    : parts.find((part, index) => index > 1 && part !== "regularize" && part !== "download");
  const requestedStatus = payload.decision ?? payload.status ?? record.status;
  let action = request.method === "POST" ? "Created" : request.method === "DELETE" ? "Deleted" : "Updated";
  if (typeof requestedStatus === "string" && ["Approved", "Declined", "Paid"].includes(requestedStatus)) {
    action = requestedStatus;
  } else if (parts.includes("regularize")) {
    action = "Regularized";
  } else if (request.path === "/api/backups") {
    action = "Requested";
  }
  recordOwnerAction(owner, action, resource, target);
}

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((request, response, next) => {
  const attendanceReadMayMaterializeRecords = request.method === "GET" && (
    request.path === "/api/attendance" ||
    request.path === "/api/dashboard" ||
    request.path === "/api/reports/attendance"
  );
  if ((request.method === "GET" && !attendanceReadMayMaterializeRecords) ||
    request.method === "HEAD" || request.method === "OPTIONS") {
    next();
    return;
  }
  const sendJson = response.json.bind(response);
  const sendResponse = (body: unknown) => {
    if (response.statusCode < 400) {
      const record = (body as { record?: Record<string, unknown> } | null)?.record;
      if (request.method === "POST" && request.path === "/api/materials") {
        publishWorkspaceUpdate({ resource: "materials" });
      } else if (request.method === "POST" && request.path === "/api/material-requests") {
        publishWorkspaceUpdate({
          resource: "materialRequests",
          push: {
            title: "Vanya BuildTrack",
            body: "Material request received. An engineer submitted a request for your review.",
            targets: [{ role: "owner", url: "/admin/materials" }]
          }
        });
      } else if (request.method === "POST" && request.path === "/api/attendance/regularization-requests") {
        publishWorkspaceUpdate({
          resource: "attendance",
          push: {
            title: "Attendance regularization requested",
            body: `${request.body?.engineer ?? "An engineer"} requested a missed check-out correction.`,
            targets: [{ role: "owner", url: "/admin/attendance" }]
          }
        });
      } else if (request.method === "POST" && request.path === "/api/attendance/leave-requests") {
        publishWorkspaceUpdate({
          resource: "attendance",
          push: {
            title: "Engineer leave requested",
            body: `${request.body?.engineer ?? "An engineer"} requested leave for ${request.body?.date ?? "a scheduled date"}.`,
            targets: [{ role: "owner", url: "/admin/attendance" }]
          }
        });
      } else if (request.method === "PATCH" && /^\/api\/attendance\/(leave|regularization)-requests\/[^/]+$/.test(request.path)) {
        const requestRecord = (body as { request?: { engineer?: string; status?: string; date?: string } } | null)?.request;
        const isLeaveRequest = request.path.includes("/leave-requests/");
        const engineer = people.find((person) => person.role === "Site Engineer" && person.name === requestRecord?.engineer);
        publishWorkspaceUpdate({
          resource: "attendance",
          ...(requestRecord?.engineer && requestRecord.status ? {
            push: {
              title: `${isLeaveRequest ? "Leave" : "Attendance"} ${requestRecord.status.toLowerCase()}`,
              body: isLeaveRequest
                ? `Your leave request for ${requestRecord.date ?? "the requested date"} was ${requestRecord.status.toLowerCase()}.`
                : `Your attendance regularization request was ${requestRecord.status.toLowerCase()}.`,
              targets: [{
                role: "employee",
                userName: requestRecord.engineer,
                ...(engineer ? { userEmail: engineer.email } : {}),
                url: "/engineer/attendance"
              }]
            }
          } : {})
        });
      } else if (request.method === "POST" && request.path === "/api/expenses") {
        publishWorkspaceUpdate({
          resource: "expenses",
          ...(record?.status === "Pending review" ? {
            push: {
              title: "Vanya BuildTrack",
              body: "Expense request received. An engineer submitted an expense request for your review.",
              targets: [{ role: "owner", url: "/admin/expenses" }]
            }
          } : {})
        });
      }
    }
    return sendJson(body);
  };
  response.json = ((body: unknown) => {
    if (response.statusCode >= 400) return sendResponse(body);
    if (request.method !== "GET" && request.method !== "HEAD" && request.method !== "OPTIONS") {
      auditOwnerRequest(request, body);
    }
    void saveStore().then(() => {
      if (request.path === "/api/site-visits" || /^\/api\/site-visits\/[^/]+$/.test(request.path)) {
        const visit = (body as { record?: SiteVisit } | null)?.record;
        if (visit) {
          const action = request.method === "POST" ? "scheduled" : request.body?.action;
          if (action === "scheduled" || action === "check-in" || action === "check-out") {
            const isScheduled = action === "scheduled";
            publishWorkspaceUpdate({
              resource: "siteVisits",
              visit: {
                id: visit.id,
                project: visit.project,
                site: visit.site,
                engineer: visit.engineer,
                date: visit.date,
                purpose: visit.purpose,
                status: visit.status
              },
              action,
              ...(isScheduled ? {
                push: {
                  title: "New site visit scheduled",
                  body: `${visit.project} is scheduled for ${new Date(`${visit.date}T00:00:00`).toLocaleDateString()}.`,
                  targets: [{ role: "employee" as const, userName: visit.engineer, url: "/engineer/site-visits" }]
                }
              } : {})
            });
          }
        }
      }
      return sendResponse(body);
    }).catch((error: unknown) => {
      console.error("Unable to persist workspace data:", error);
      response.status(500);
      sendJson({ error: "The record could not be saved to the database." });
    });
    return response;
  }) as typeof response.json;
  next();
});

app.get("/api/events", (_request, response) => {
  response.status(200).set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive"
  });
  response.flushHeaders();
  response.write(": connected\n\n");

  const unsubscribe = subscribeToWorkspaceUpdates((update) => {
    if (!response.destroyed && !response.writableEnded) {
      response.write(`data: ${JSON.stringify(update)}\n\n`);
    }
  });
  const heartbeat = setInterval(() => {
    if (!response.destroyed && !response.writableEnded) response.write(": keep-alive\n\n");
  }, 25_000);

  response.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

app.get("/api/push/config", (_request, response) => {
  response.json({ enabled: pushConfigured, publicKey: pushConfigured ? getPushPublicKey() : null });
});

app.post("/api/push/subscriptions", (request, response) => {
  if (!pushConfigured) {
    response.status(503).json({ error: "Web Push is not configured on the server." });
    return;
  }
  const body = request.body && typeof request.body === "object" ? request.body as Record<string, unknown> : {};
  const { subscription, role, userName, userEmail } = body;
  if ((role !== "owner" && role !== "employee" && role !== "client") || typeof userName !== "string" || !userName.trim() ||
    userEmail !== undefined && (typeof userEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) ||
    !isPushSubscription(subscription)) {
    response.status(400).json({ error: "A valid role, push subscription, and user name are required." });
    return;
  }
  savePushSubscription(subscription, userName.trim(), role, typeof userEmail === "string" ? userEmail.trim() : undefined);
  response.status(201).json({ enabled: true });
});

app.delete("/api/push/subscriptions", (request, response) => {
  const endpoint = request.body?.endpoint;
  if (typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    response.status(400).json({ error: "A valid push subscription endpoint is required." });
    return;
  }
  removePushSubscription(endpoint);
  response.json({ enabled: false });
});

app.get("/api/audit-logs", (request, response) => {
  const session = authenticateBearerHeader(request.get("authorization"));
  if (!session) {
    response.status(401).json({ error: "Sign-in is required to view audit logs." });
    return;
  }
  if (session.role !== "owner" || !findOwnerAccount(session.email)) {
    response.status(403).json({ error: "Owner access is required to view audit logs." });
    return;
  }
  response.json(ownerAuditLogs);
});

RegisterRoutes(app);

const frontendDirectory = path.resolve(__dirname, "../public");
if (existsSync(frontendDirectory)) {
  app.use(express.static(frontendDirectory));
  app.get("*", (request, response, next) => {
    if (request.path === "/api" || request.path.startsWith("/api/")) {
      next();
      return;
    }
    response.sendFile(path.join(frontendDirectory, "index.html"));
  });
}

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("API request failed:", error);
  response.status(500).json({ error: "The API could not process this request." });
});

void initializeStore().then(() => {
  const setupCode = createInitialOwnerSetupCode();
  if (setupCode) {
    console.info(`Initial owner setup code: ${setupCode}`);
  }
  app.listen(port, () => {
    console.log(`BuildTrack API listening on http://localhost:${port}`);
  });
}).catch((error: unknown) => {
  console.error("Unable to initialize the workspace database:", error);
  process.exitCode = 1;
});
