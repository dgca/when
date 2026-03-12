import { Hono } from "hono";
import { cors } from "hono/cors";
import { planRoutes } from "./routes/plans.js";
import { responseRoutes } from "./routes/responses.js";

export const app = new Hono();

app.use("*", cors());

app.route("/api/plans", planRoutes);
app.route("/api/plans", responseRoutes);

app.get("/api/health", (c) => c.json({ ok: true }));
