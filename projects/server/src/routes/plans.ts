import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { db } from "../db/index.js";
import { plans, options } from "../db/schema.js";
import { createPlanSchema, updatePlanSchema } from "@when/shared";

export const planRoutes = new Hono();

// Create plan
planRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { title, creatorName, description, timezone, mode } = parsed.data;
  const planId = nanoid(12);
  const adminToken = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  await db.insert(plans).values({
    id: planId,
    adminToken,
    creatorName,
    title,
    description: description || null,
    timezone,
    mode,
    dateRangeStart: parsed.data.mode === "availability" ? (parsed.data.dateRangeStart || null) : null,
    dateRangeEnd: parsed.data.mode === "availability" ? (parsed.data.dateRangeEnd || null) : null,
    status: "open",
    createdAt: now,
    updatedAt: now,
  });

  if (parsed.data.mode === "poll") {
    const optionRows = parsed.data.options.map((opt, i) => ({
      id: nanoid(12),
      planId,
      label: opt.label,
      startsAt: opt.startsAt,
      endsAt: opt.endsAt || null,
      sortOrder: i,
    }));

    if (optionRows.length > 0) {
      await db.insert(options).values(optionRows);
    }
  }

  return c.json(
    {
      id: planId,
      adminToken,
      participantUrl: `/p/${planId}`,
      adminUrl: `/a/${planId}?token=${adminToken}`,
    },
    201,
  );
});

// Get plan
planRoutes.get("/:planId", async (c) => {
  const planId = c.req.param("planId");
  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });

  if (!plan) {
    return c.json({ error: "Plan not found" }, 404);
  }

  const planOptions = await db.query.options.findMany({
    where: eq(options.planId, planId),
    orderBy: (opts, { asc }) => [asc(opts.sortOrder)],
  });

  return c.json({
    id: plan.id,
    title: plan.title,
    creatorName: plan.creatorName,
    description: plan.description,
    timezone: plan.timezone,
    mode: plan.mode,
    dateRangeStart: plan.dateRangeStart,
    dateRangeEnd: plan.dateRangeEnd,
    status: plan.status,
    options: planOptions.map((o) => ({
      id: o.id,
      label: o.label,
      startsAt: o.startsAt,
      endsAt: o.endsAt,
      sortOrder: o.sortOrder,
    })),
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  });
});

// Update plan (admin)
planRoutes.patch("/:planId", async (c) => {
  const planId = c.req.param("planId");
  const token = c.req.header("x-admin-token");

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });

  if (!plan) return c.json({ error: "Plan not found" }, 404);
  if (plan.adminToken !== token) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json();
  const parsed = updatePlanSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const updates: Record<string, string> = { updatedAt: new Date().toISOString() };
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.description !== undefined) updates.description = parsed.data.description;

  await db.update(plans).set(updates).where(eq(plans.id, planId));

  return c.json({ ok: true });
});

// Close plan (admin)
planRoutes.post("/:planId/close", async (c) => {
  const planId = c.req.param("planId");
  const token = c.req.header("x-admin-token");

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });

  if (!plan) return c.json({ error: "Plan not found" }, 404);
  if (plan.adminToken !== token) return c.json({ error: "Unauthorized" }, 401);

  await db
    .update(plans)
    .set({ status: "closed", updatedAt: new Date().toISOString() })
    .where(eq(plans.id, planId));

  return c.json({ ok: true });
});
