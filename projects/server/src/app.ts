import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { planRoutes } from "./routes/plans.js";
import { responseRoutes } from "./routes/responses.js";
import { readFileSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

export const app = new Hono();

app.use("*", cors());

app.route("/api/plans", planRoutes);
app.route("/api/plans", responseRoutes);

app.get("/api/health", (c) => c.json({ ok: true }));

// Static file serving for production SPA
// serveStatic root is relative to CWD
const staticRoot = process.env.STATIC_ROOT || "projects/web/dist";

app.use("/*", serveStatic({ root: staticRoot }));

// SPA fallback — serve index.html for any non-API route
const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, "../../web/dist/index.html");

app.get("*", (c) => {
  try {
    const html = readFileSync(
      process.env.STATIC_ROOT
        ? join(process.env.STATIC_ROOT, "index.html")
        : indexPath,
      "utf-8",
    );
    return c.html(html);
  } catch {
    return c.text("Not found", 404);
  }
});
