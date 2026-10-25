import "dotenv/config";
import cors from "cors";
import express from "express";
import { prisma } from "./prisma";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get("/api/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    response.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("Database health check failed:", error);
    response.status(503).json({ status: "error", database: "unavailable" });
  }
});

app.get("/api/projects", async (_request, response, next) => {
  try {
    const projects = await prisma.project.findMany({
      orderBy: { createdAt: "desc" }
    });
    response.json(projects);
  } catch (error) {
    next(error);
  }
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("API request failed:", error);
  response.status(500).json({ error: "Internal server error" });
});

const server = app.listen(port, () => {
  console.log(`BuildTrack API listening on http://localhost:${port}`);
});

const shutdown = async () => {
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
