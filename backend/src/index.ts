import "reflect-metadata";
import cors from "cors";
import express from "express";
import { RegisterRoutes } from "./generated/routes";
import { saveStore } from "./data/store";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json({ limit: "3mb" }));
app.use((request, response, next) => {
  if (request.method === "GET" || request.method === "HEAD" || request.method === "OPTIONS") {
    next();
    return;
  }
  const sendJson = response.json.bind(response);
  response.json = ((body: unknown) => {
    if (response.statusCode < 400) {
      try {
        saveStore();
      } catch (error) {
        console.error("Unable to persist JSON data store:", error);
        response.status(500);
        return sendJson({ error: "The record could not be saved to the JSON data file." });
      }
    }
    return sendJson(body);
  }) as typeof response.json;
  next();
});

RegisterRoutes(app);

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  console.error("Mock API request failed:", error);
  response.status(500).json({ error: "The mock API could not process this request." });
});

app.listen(port, () => {
  console.log(`BuildTrack mock API listening on http://localhost:${port}`);
});
