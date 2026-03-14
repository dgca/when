import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { db } from "../db/index.js";
import { plans, options, responses, responseSelections, availabilitySlots } from "../db/schema.js";
import {
  createResponseSchema,
  updateResponseSchema,
  createAvailabilityResponseSchema,
  updateAvailabilityResponseSchema,
} from "@when/shared";
import type { Selection } from "@when/shared";
import { computeBestTimes } from "./bestTimes.js";

export const responseRoutes = new Hono();

// Submit response
responseRoutes.post("/:planId/responses", async (c) => {
  const planId = c.req.param("planId");

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });
  if (!plan) return c.json({ error: "Plan not found" }, 404);
  if (plan.status === "closed") return c.json({ error: "Plan is closed" }, 400);

  const body = await c.req.json();
  const responseId = nanoid(12);
  const editToken = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  if (plan.mode === "availability") {
    const parsed = createAvailabilityResponseSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    await db.insert(responses).values({
      id: responseId,
      planId,
      participantName: parsed.data.participantName,
      editToken,
      createdAt: now,
      updatedAt: now,
    });

    if (parsed.data.availabilitySlots.length > 0) {
      await db.insert(availabilitySlots).values(
        parsed.data.availabilitySlots.map((s) => ({
          id: nanoid(12),
          responseId,
          date: s.date,
          startHour: s.startHour,
          startMinute: s.startMinute,
          endHour: s.endHour,
          endMinute: s.endMinute,
        })),
      );
    }

    return c.json(
      {
        id: responseId,
        participantName: parsed.data.participantName,
        editToken,
        availabilitySlots: parsed.data.availabilitySlots,
        createdAt: now,
        updatedAt: now,
      },
      201,
    );
  }

  // Poll mode
  const parsed = createResponseSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  await db.insert(responses).values({
    id: responseId,
    planId,
    participantName: parsed.data.participantName,
    editToken,
    createdAt: now,
    updatedAt: now,
  });

  if (parsed.data.selections.length > 0) {
    await db.insert(responseSelections).values(
      parsed.data.selections.map((s) => ({
        id: nanoid(12),
        responseId,
        optionId: s.optionId,
        value: s.value,
      })),
    );
  }

  return c.json(
    {
      id: responseId,
      participantName: parsed.data.participantName,
      editToken,
      selections: parsed.data.selections,
      createdAt: now,
      updatedAt: now,
    },
    201,
  );
});

// Update response
responseRoutes.put("/:planId/responses/:responseId", async (c) => {
  const { planId, responseId } = c.req.param();
  const editToken = c.req.header("x-edit-token");

  const response = await db.query.responses.findFirst({
    where: and(eq(responses.id, responseId), eq(responses.planId, planId)),
  });

  if (!response) return c.json({ error: "Response not found" }, 404);
  if (response.editToken !== editToken) return c.json({ error: "Unauthorized" }, 401);

  const plan = await db.query.plans.findFirst({ where: eq(plans.id, planId) });
  if (plan?.status === "closed") return c.json({ error: "Plan is closed" }, 400);

  const body = await c.req.json();
  const now = new Date().toISOString();

  if (plan?.mode === "availability") {
    const parsed = updateAvailabilityResponseSchema.safeParse(body);
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

    const updates: Record<string, string> = { updatedAt: now };
    if (parsed.data.participantName) updates.participantName = parsed.data.participantName;

    await db.update(responses).set(updates).where(eq(responses.id, responseId));

    await db.delete(availabilitySlots).where(eq(availabilitySlots.responseId, responseId));
    if (parsed.data.availabilitySlots.length > 0) {
      await db.insert(availabilitySlots).values(
        parsed.data.availabilitySlots.map((s) => ({
          id: nanoid(12),
          responseId,
          date: s.date,
          startHour: s.startHour,
          startMinute: s.startMinute,
          endHour: s.endHour,
          endMinute: s.endMinute,
        })),
      );
    }

    return c.json({ ok: true });
  }

  // Poll mode
  const parsed = updateResponseSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const updates: Record<string, string> = { updatedAt: now };
  if (parsed.data.participantName) updates.participantName = parsed.data.participantName;

  await db.update(responses).set(updates).where(eq(responses.id, responseId));

  // Replace all selections
  if (parsed.data.selections) {
    await db.delete(responseSelections).where(eq(responseSelections.responseId, responseId));
    if (parsed.data.selections.length > 0) {
      await db.insert(responseSelections).values(
        parsed.data.selections.map((s) => ({
          id: nanoid(12),
          responseId,
          optionId: s.optionId,
          value: s.value,
        })),
      );
    }
  }

  return c.json({ ok: true });
});

// Get results
responseRoutes.get("/:planId/results", async (c) => {
  const planId = c.req.param("planId");

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });
  if (!plan) return c.json({ error: "Plan not found" }, 404);

  if (plan.mode === "availability") {
    const planResponses = await db.query.responses.findMany({
      where: eq(responses.planId, planId),
    });

    const responseIds = new Set(planResponses.map((r) => r.id));
    const allSlots = await db.query.availabilitySlots.findMany();
    const planSlots = allSlots.filter((s) => responseIds.has(s.responseId));

    const responseData = planResponses.map((r) => {
      const slots = planSlots
        .filter((s) => s.responseId === r.id)
        .map((s) => ({
          date: s.date,
          startHour: s.startHour,
          startMinute: s.startMinute,
          endHour: s.endHour,
          endMinute: s.endMinute,
        }));
      return {
        id: r.id,
        participantName: r.participantName,
        selections: [] as Selection[],
        availabilitySlots: slots,
      };
    });

    const slotInputs = planResponses.flatMap((r) =>
      planSlots
        .filter((s) => s.responseId === r.id)
        .map((s) => ({
          participantName: r.participantName,
          date: s.date,
          startHour: s.startHour,
          startMinute: s.startMinute,
          endHour: s.endHour,
          endMinute: s.endMinute,
        })),
    );

    const bestTimes = computeBestTimes(slotInputs);

    return c.json({
      plan: {
        id: plan.id,
        title: plan.title,
        creatorName: plan.creatorName,
        description: plan.description,
        timezone: plan.timezone,
        status: plan.status,
        mode: plan.mode,
        dateRangeStart: plan.dateRangeStart,
        dateRangeEnd: plan.dateRangeEnd,
        chosenOptionId: plan.chosenOptionId,
        options: [],
        createdAt: plan.createdAt,
        updatedAt: plan.updatedAt,
      },
      responses: responseData,
      optionSummary: [],
      bestTimes,
    });
  }

  // Poll mode
  const planOptions = await db.query.options.findMany({
    where: eq(options.planId, planId),
    orderBy: (opts, { asc }) => [asc(opts.sortOrder)],
  });

  const planResponses = await db.query.responses.findMany({
    where: eq(responses.planId, planId),
  });

  const allSelections = await db.query.responseSelections.findMany();
  const responseIds = new Set(planResponses.map((r) => r.id));

  // Build response data with selections
  const responseData = planResponses.map((r) => {
    const sels = allSelections
      .filter((s) => s.responseId === r.id)
      .map((s) => ({ optionId: s.optionId, value: s.value as "yes" | "maybe" }));
    return {
      id: r.id,
      participantName: r.participantName,
      selections: sels,
    };
  });

  // Build option summary
  const optionSummary = planOptions.map((opt) => {
    const relevantSelections = allSelections.filter(
      (s) => s.optionId === opt.id && responseIds.has(s.responseId),
    );
    return {
      optionId: opt.id,
      yesCount: relevantSelections.filter((s) => s.value === "yes").length,
      maybeCount: relevantSelections.filter((s) => s.value === "maybe").length,
    };
  });

  // Sort by yes desc, then maybe desc, then original order
  const sortedSummary = [...optionSummary].sort((a, b) => {
    if (b.yesCount !== a.yesCount) return b.yesCount - a.yesCount;
    if (b.maybeCount !== a.maybeCount) return b.maybeCount - a.maybeCount;
    return (
      planOptions.findIndex((o) => o.id === a.optionId) -
      planOptions.findIndex((o) => o.id === b.optionId)
    );
  });

  return c.json({
    plan: {
      id: plan.id,
      title: plan.title,
      creatorName: plan.creatorName,
      description: plan.description,
      timezone: plan.timezone,
      status: plan.status,
      mode: plan.mode,
      dateRangeStart: plan.dateRangeStart,
      dateRangeEnd: plan.dateRangeEnd,
      chosenOptionId: plan.chosenOptionId,
      options: planOptions.map((o) => ({
        id: o.id,
        label: o.label,
        startsAt: o.startsAt,
        endsAt: o.endsAt,
        sortOrder: o.sortOrder,
      })),
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    },
    responses: responseData,
    optionSummary: sortedSummary,
  });
});
