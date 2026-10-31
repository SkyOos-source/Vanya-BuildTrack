import "dotenv/config";
import "reflect-metadata";
import cors from "cors";
import express from "express";
import { RegisterRoutes } from "./generated/routes";
import { initializeStore, saveStore } from "./data/store";
import { getPushPublicKey, isPushSubscription, pushConfigured, removePushSubscription, savePushSubscription } from "./push";
import { publishWorkspaceUpdate, subscribeToWorkspaceUpdates } from "./realtime";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: "15mb" }));
app.use((request, response, next) => {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
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
    void saveStore().then(() => sendResponse(body)).catch((error: unknown) => {
      console.error("Unable to persist SQLite workspace data:", error);
      response.status(500);
      sendJson({ error: "The record could not be saved to the SQLite database." });
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
  const { subscription, role, userName } = body;
  if ((role !== "owner" && role !== "employee" && role !== "client") || typeof userName !== "string" || !userName.trim() || !isPushSubscription(subscription)) {
    response.status(400).json({ error: "A valid role, push subscription, and user name are required." });
    return;
  }
  savePushSubscription(subscription, userName.trim(), role);
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

RegisterRoutes(app);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("API request failed:", error);
  response.status(500).json({ error: "The API could not process this request." });
});

void initializeStore().then(() => {
  app.listen(port, () => {
    console.log(`BuildTrack API listening on http://localhost:${port}`);
  });
}).catch((error: unknown) => {
  console.error("Unable to initialize the SQLite workspace database:", error);
  process.exitCode = 1;
});
