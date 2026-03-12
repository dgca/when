# Availability Mode Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an "availability" mode to When where participants submit free-form time ranges and the system computes overlap/best-times.

**Architecture:** Plans get a `mode` field. Availability-mode plans skip pre-set options; participants draw time ranges using the existing TimeSlotPicker. Server computes best overlapping windows from all submissions.

**Tech Stack:** Same stack — Hono, Drizzle/SQLite, React, TanStack Router/Query, Tosui UI, Zod.

**Spec:** `docs/superpowers/specs/2026-03-12-availability-mode-design.md`

---

## File Map

### Shared (`projects/shared/src/`)
- **Modify:** `schemas.ts` — add `availabilitySlotSchema`, `planModeSchema`, new create/update schemas for availability responses, update `createPlanSchema` to support both modes
- **Modify:** `types.ts` — add `AvailabilitySlot`, `BestTime`, update `PlanSummary`, `PlanResults`, `ParticipantResponse`
- **Modify:** `index.ts` — exports (already re-exports all, should be fine)

### Server (`projects/server/src/`)
- **Modify:** `db/schema.ts` — add `mode`, `dateRangeStart`, `dateRangeEnd` to plans; add `availabilitySlots` table
- **Modify:** `db/index.ts` — add `CREATE TABLE IF NOT EXISTS` for `availability_slots`, add `ALTER TABLE` for new plan columns
- **Modify:** `routes/plans.ts` — handle availability mode in create and get
- **Modify:** `routes/responses.ts` — handle availability slots in create/update response, compute best times in results
- **Create:** `routes/bestTimes.ts` — best-times algorithm as a pure function (testable independently)

### Web (`projects/web/src/`)
- **Modify:** `api.ts` — update types for availability-mode API calls
- **Modify:** `routes/index.tsx` — add mode selector, availability-mode create form
- **Modify:** `routes/p.$planId.tsx` — availability-mode participant view (submit time ranges, view others' availability, best times)
- **Modify:** `routes/a.$planId.tsx` — availability-mode admin view (best times, everyone's availability)
- **Create:** `components/AvailabilityView.tsx` — read-only view of everyone's availability for a date (stacked horizontal bars per participant)
- **Create:** `components/BestTimesList.tsx` — ranked list of best overlapping windows

---

## Chunk 1: Shared Types and Schemas

### Task 1: Add availability schemas to shared package

**Files:**
- Modify: `projects/shared/src/schemas.ts`
- Modify: `projects/shared/src/types.ts`

- [ ] **Step 1: Add availability slot schema and plan mode schema**

In `projects/shared/src/schemas.ts`, add after the existing `planStatusSchema`:

```typescript
// --- Availability mode schemas ---

export const planModeSchema = z.enum(["poll", "availability"]);

export const availabilitySlotSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    startHour: z.number().int().min(0).max(23),
    startMinute: z.number().int().refine((v) => v === 0 || v === 30, "Must be 0 or 30"),
    endHour: z.number().int().min(0).max(24),
    endMinute: z.number().int().refine((v) => v === 0 || v === 30, "Must be 0 or 30"),
  })
  .refine(
    (s) => s.startHour * 60 + s.startMinute < s.endHour * 60 + s.endMinute,
    "Start must be before end",
  )
  .refine(
    (s) => !(s.endHour === 24 && s.endMinute !== 0),
    "endHour=24 requires endMinute=0",
  );
```

- [ ] **Step 2: Update createPlanSchema to support both modes**

Replace the existing `createPlanSchema` with two variants and a union:

```typescript
const createPollPlanSchema = z.object({
  mode: z.literal("poll"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  timezone: z.string().min(1, "Timezone is required"),
  options: z.array(optionSchema).min(1, "At least one option is required"),
});

const createAvailabilityPlanSchema = z.object({
  mode: z.literal("availability"),
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  timezone: z.string().min(1, "Timezone is required"),
  dateRangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateRangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createPlanSchema = z.discriminatedUnion("mode", [
  createPollPlanSchema,
  createAvailabilityPlanSchema,
]);
```

- [ ] **Step 3: Add availability response schemas**

```typescript
export const createAvailabilityResponseSchema = z.object({
  participantName: z.string().min(1, "Name is required").max(100),
  availabilitySlots: z.array(availabilitySlotSchema),
});

export const updateAvailabilityResponseSchema = z.object({
  participantName: z.string().min(1).max(100).optional(),
  availabilitySlots: z.array(availabilitySlotSchema),
});
```

- [ ] **Step 4: Update types.ts**

Add new types and update existing interfaces in `projects/shared/src/types.ts`:

```typescript
import type {
  // ... existing imports ...
  availabilitySlotSchema,
  createAvailabilityResponseSchema,
  updateAvailabilityResponseSchema,
  planModeSchema,
} from "./schemas.js";

// ... existing inferred types ...

export type PlanMode = z.infer<typeof planModeSchema>;
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
export type CreateAvailabilityResponseInput = z.infer<typeof createAvailabilityResponseSchema>;
export type UpdateAvailabilityResponseInput = z.infer<typeof updateAvailabilityResponseSchema>;
```

Update `PlanSummary`:
```typescript
export interface PlanSummary {
  id: string;
  title: string;
  description: string | null;
  timezone: string;
  status: PlanStatus;
  mode: PlanMode;
  dateRangeStart?: string | null;
  dateRangeEnd?: string | null;
  options: OptionWithId[];
  createdAt: string;
  updatedAt: string;
}
```

Add `BestTime`:
```typescript
export interface BestTime {
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  participants: string[];
}
```

Update `ParticipantResponse` to support both modes:
```typescript
export interface ParticipantResponse {
  id: string;
  participantName: string;
  editToken: string;
  selections?: Selection[];
  availabilitySlots?: AvailabilitySlot[];
  createdAt: string;
  updatedAt: string;
}
```

Update `PlanResults`:
```typescript
export interface PlanResults {
  plan: PlanSummary;
  responses: Array<{
    id: string;
    participantName: string;
    selections: Selection[];
    availabilitySlots?: AvailabilitySlot[];
  }>;
  optionSummary: Array<{
    optionId: string;
    yesCount: number;
    maybeCount: number;
  }>;
  bestTimes?: BestTime[];
}
```

- [ ] **Step 5: Verify shared package compiles**

Run: `pnpm --filter @when/shared exec tsc --noEmit`
Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add projects/shared/
git commit -m "feat(shared): add availability mode schemas and types"
```

---

## Chunk 2: Server — Database and Plan Routes

### Task 2: Update database schema and initialization

**Files:**
- Modify: `projects/server/src/db/schema.ts`
- Modify: `projects/server/src/db/index.ts`

- [ ] **Step 1: Add new columns and table to Drizzle schema**

In `projects/server/src/db/schema.ts`, add `mode`, `dateRangeStart`, `dateRangeEnd` to `plans`:

```typescript
export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  adminToken: text("admin_token").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  timezone: text("timezone").notNull(),
  mode: text("mode", { enum: ["poll", "availability"] }).notNull().default("poll"),
  dateRangeStart: text("date_range_start"),
  dateRangeEnd: text("date_range_end"),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
```

Add the `availabilitySlots` table:

```typescript
export const availabilitySlots = sqliteTable("availability_slots", {
  id: text("id").primaryKey(),
  responseId: text("response_id")
    .notNull()
    .references(() => responses.id),
  date: text("date").notNull(),
  startHour: integer("start_hour").notNull(),
  startMinute: integer("start_minute").notNull(),
  endHour: integer("end_hour").notNull(),
  endMinute: integer("end_minute").notNull(),
});
```

- [ ] **Step 2: Update db/index.ts to create new table and alter plans**

Add after the existing `CREATE TABLE IF NOT EXISTS` block in `projects/server/src/db/index.ts`:

```typescript
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS availability_slots (
    id TEXT PRIMARY KEY,
    response_id TEXT NOT NULL REFERENCES responses(id),
    date TEXT NOT NULL,
    start_hour INTEGER NOT NULL,
    start_minute INTEGER NOT NULL,
    end_hour INTEGER NOT NULL,
    end_minute INTEGER NOT NULL
  );
`);

// Add new columns to plans (idempotent — ignore if already exist)
try { sqlite.exec(`ALTER TABLE plans ADD COLUMN mode TEXT NOT NULL DEFAULT 'poll'`); } catch {}
try { sqlite.exec(`ALTER TABLE plans ADD COLUMN date_range_start TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE plans ADD COLUMN date_range_end TEXT`); } catch {}
```

- [ ] **Step 3: Verify server compiles**

Run: `pnpm --filter server exec tsc --noEmit`
Expected: no errors (or only pre-existing ones unrelated to our changes)

- [ ] **Step 4: Commit**

```bash
git add projects/server/src/db/
git commit -m "feat(server): add availability_slots table and mode column to plans"
```

### Task 3: Update plan routes for availability mode

**Files:**
- Modify: `projects/server/src/routes/plans.ts`

- [ ] **Step 1: Update POST /plans to handle both modes**

In `projects/server/src/routes/plans.ts`, the `createPlanSchema` is now a discriminated union. Update the create handler:

```typescript
planRoutes.post("/", async (c) => {
  const body = await c.req.json();
  const parsed = createPlanSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }

  const { mode, title, description, timezone } = parsed.data;
  const planId = nanoid(12);
  const adminToken = crypto.randomBytes(32).toString("hex");
  const now = new Date().toISOString();

  const planValues: Record<string, unknown> = {
    id: planId,
    adminToken,
    title,
    description: description || null,
    timezone,
    mode,
    status: "open",
    createdAt: now,
    updatedAt: now,
  };

  if (parsed.data.mode === "availability") {
    planValues.dateRangeStart = parsed.data.dateRangeStart || null;
    planValues.dateRangeEnd = parsed.data.dateRangeEnd || null;
  }

  await db.insert(plans).values(planValues as typeof plans.$inferInsert);

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
```

- [ ] **Step 2: Update GET /plans/:planId to include mode and dateRange**

Update the return value in the get handler to include `mode`, `dateRangeStart`, `dateRangeEnd`:

```typescript
return c.json({
  id: plan.id,
  title: plan.title,
  description: plan.description,
  timezone: plan.timezone,
  status: plan.status,
  mode: plan.mode,
  dateRangeStart: plan.dateRangeStart,
  dateRangeEnd: plan.dateRangeEnd,
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
```

- [ ] **Step 3: Verify server compiles**

Run: `pnpm --filter server exec tsc --noEmit`

- [ ] **Step 4: Commit**

```bash
git add projects/server/src/routes/plans.ts
git commit -m "feat(server): handle availability mode in plan create/get"
```

---

## Chunk 3: Server — Response Routes and Best Times

### Task 4: Implement best-times algorithm

**Files:**
- Create: `projects/server/src/routes/bestTimes.ts`

- [ ] **Step 1: Create bestTimes.ts with the computation function**

```typescript
import type { BestTime } from "@when/shared";

interface SlotInput {
  participantName: string;
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export function computeBestTimes(slots: SlotInput[], maxResults = 10): BestTime[] {
  // Step 1: Discretize into 30-min buckets
  // Key: "YYYY-MM-DD|HH:MM" → Set<participantName>
  const buckets = new Map<string, Set<string>>();

  for (const slot of slots) {
    let h = slot.startHour;
    let m = slot.startMinute;
    const endTotal = slot.endHour * 60 + slot.endMinute;

    while (h * 60 + m < endTotal) {
      const key = `${slot.date}|${h}:${m.toString().padStart(2, "0")}`;
      if (!buckets.has(key)) buckets.set(key, new Set());
      buckets.get(key)!.add(slot.participantName);
      m += 30;
      if (m >= 60) { h++; m = 0; }
    }
  }

  // Step 2: Group contiguous buckets with identical participant sets
  // Sort bucket keys chronologically
  const sortedKeys = [...buckets.keys()].sort();

  const ranges: BestTime[] = [];
  let currentParticipants: string[] | null = null;
  let currentDate = "";
  let rangeStartH = 0;
  let rangeStartM = 0;
  let rangeEndH = 0;
  let rangeEndM = 0;

  function pushRange() {
    if (currentParticipants && currentParticipants.length >= 2) {
      ranges.push({
        date: currentDate,
        startHour: rangeStartH,
        startMinute: rangeStartM,
        endHour: rangeEndH,
        endMinute: rangeEndM,
        participants: currentParticipants,
      });
    }
  }

  for (const key of sortedKeys) {
    const [date, time] = key.split("|");
    const [h, m] = time.split(":").map(Number);
    const participants = [...buckets.get(key)!].sort();
    const participantKey = participants.join(",");

    // Check if this bucket is contiguous with the current range
    const isContiguous =
      currentParticipants !== null &&
      date === currentDate &&
      h * 60 + m === rangeEndH * 60 + rangeEndM &&
      participantKey === currentParticipants.join(",");

    if (isContiguous) {
      // Extend current range by 30 min
      rangeEndM += 30;
      if (rangeEndM >= 60) { rangeEndH++; rangeEndM = 0; }
    } else {
      pushRange();
      currentDate = date;
      currentParticipants = participants;
      rangeStartH = h;
      rangeStartM = m;
      rangeEndH = h;
      rangeEndM = m + 30;
      if (rangeEndM >= 60) { rangeEndH = h + 1; rangeEndM = 0; }
    }
  }
  pushRange();

  // Step 3: Sort by participant count desc, then duration desc
  ranges.sort((a, b) => {
    if (b.participants.length !== a.participants.length) {
      return b.participants.length - a.participants.length;
    }
    const durationA = (a.endHour * 60 + a.endMinute) - (a.startHour * 60 + a.startMinute);
    const durationB = (b.endHour * 60 + b.endMinute) - (b.startHour * 60 + b.startMinute);
    return durationB - durationA;
  });

  return ranges.slice(0, maxResults);
}
```

- [ ] **Step 2: Commit**

```bash
git add projects/server/src/routes/bestTimes.ts
git commit -m "feat(server): add best-times computation algorithm"
```

### Task 5: Update response routes for availability mode

**Files:**
- Modify: `projects/server/src/routes/responses.ts`

- [ ] **Step 1: Add imports for availability schemas and table**

At the top of `projects/server/src/routes/responses.ts`, update imports:

```typescript
import { plans, options, responses, responseSelections, availabilitySlots } from "../db/schema.js";
import {
  createResponseSchema,
  updateResponseSchema,
  createAvailabilityResponseSchema,
  updateAvailabilityResponseSchema,
} from "@when/shared";
import type { Selection } from "@when/shared";
import { computeBestTimes } from "./bestTimes.js";
```

- [ ] **Step 2: Update POST /:planId/responses for availability mode**

After fetching the plan and checking status, branch on `plan.mode`:

```typescript
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

  // Poll mode — existing logic
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
```

- [ ] **Step 3: Update PUT /:planId/responses/:responseId for availability mode**

After auth checks, branch on plan mode:

```typescript
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

    // Delete and replace slots
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

  // Poll mode — existing logic
  const parsed = updateResponseSchema.safeParse(body);
  if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400);

  const updates: Record<string, string> = { updatedAt: now };
  if (parsed.data.participantName) updates.participantName = parsed.data.participantName;
  await db.update(responses).set(updates).where(eq(responses.id, responseId));

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
```

- [ ] **Step 4: Update GET /:planId/results for availability mode**

After the existing plan/response fetching, branch on mode:

```typescript
responseRoutes.get("/:planId/results", async (c) => {
  const planId = c.req.param("planId");

  const plan = await db.query.plans.findFirst({
    where: eq(plans.id, planId),
  });
  if (!plan) return c.json({ error: "Plan not found" }, 404);

  const planResponses = await db.query.responses.findMany({
    where: eq(responses.planId, planId),
  });

  const planSummary = {
    id: plan.id,
    title: plan.title,
    description: plan.description,
    timezone: plan.timezone,
    status: plan.status,
    mode: plan.mode,
    dateRangeStart: plan.dateRangeStart,
    dateRangeEnd: plan.dateRangeEnd,
    options: [] as Array<{ id: string; label: string; startsAt: string; endsAt: string | null; sortOrder: number }>,
    createdAt: plan.createdAt,
    updatedAt: plan.updatedAt,
  };

  if (plan.mode === "availability") {
    // Fetch all availability slots for these responses
    const allSlots = await db.query.availabilitySlots.findMany();
    const responseIds = new Set(planResponses.map((r) => r.id));

    const responseData = planResponses.map((r) => {
      const slots = allSlots
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
        selections: [],
        availabilitySlots: slots,
      };
    });

    // Compute best times
    const slotInputs = planResponses.flatMap((r) => {
      const slots = allSlots.filter((s) => s.responseId === r.id);
      return slots.map((s) => ({
        participantName: r.participantName,
        date: s.date,
        startHour: s.startHour,
        startMinute: s.startMinute,
        endHour: s.endHour,
        endMinute: s.endMinute,
      }));
    });

    const bestTimes = computeBestTimes(slotInputs);

    return c.json({
      plan: planSummary,
      responses: responseData,
      optionSummary: [],
      bestTimes,
    });
  }

  // Poll mode — existing logic
  const planOptions = await db.query.options.findMany({
    where: eq(options.planId, planId),
    orderBy: (opts, { asc }) => [asc(opts.sortOrder)],
  });

  planSummary.options = planOptions.map((o) => ({
    id: o.id,
    label: o.label,
    startsAt: o.startsAt,
    endsAt: o.endsAt,
    sortOrder: o.sortOrder,
  }));

  const allSelections = await db.query.responseSelections.findMany();
  const responseIds = new Set(planResponses.map((r) => r.id));

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

  const sortedSummary = [...optionSummary].sort((a, b) => {
    if (b.yesCount !== a.yesCount) return b.yesCount - a.yesCount;
    if (b.maybeCount !== a.maybeCount) return b.maybeCount - a.maybeCount;
    return (
      planOptions.findIndex((o) => o.id === a.optionId) -
      planOptions.findIndex((o) => o.id === b.optionId)
    );
  });

  return c.json({
    plan: planSummary,
    responses: responseData,
    optionSummary: sortedSummary,
  });
});
```

- [ ] **Step 5: Verify server compiles**

Run: `pnpm --filter server exec tsc --noEmit`

- [ ] **Step 6: Commit**

```bash
git add projects/server/src/routes/
git commit -m "feat(server): handle availability mode in response create/update/results"
```

---

## Chunk 4: Web — API Client and Create Page

### Task 6: Update API client

**Files:**
- Modify: `projects/web/src/api.ts`

- [ ] **Step 1: Update api.ts with availability-mode types**

Add imports and new methods:

```typescript
import type {
  CreatePlanInput,
  CreatePlanResponse,
  PlanSummary,
  CreateResponseInput,
  ParticipantResponse,
  UpdateResponseInput,
  PlanResults,
  UpdatePlanInput,
  CreateAvailabilityResponseInput,
  UpdateAvailabilityResponseInput,
} from "@when/shared";
```

Add to the `api` object:

```typescript
submitAvailabilityResponse(
  planId: string,
  data: CreateAvailabilityResponseInput,
): Promise<ParticipantResponse> {
  return request(`/plans/${planId}/responses`, {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateAvailabilityResponse(
  planId: string,
  responseId: string,
  data: UpdateAvailabilityResponseInput,
  editToken: string,
): Promise<{ ok: true }> {
  return request(`/plans/${planId}/responses/${responseId}`, {
    method: "PUT",
    body: JSON.stringify(data),
    headers: { "x-edit-token": editToken },
  });
},
```

- [ ] **Step 2: Commit**

```bash
git add projects/web/src/api.ts
git commit -m "feat(web): add availability API methods"
```

### Task 7: Update create page with mode selector

**Files:**
- Modify: `projects/web/src/routes/index.tsx`

- [ ] **Step 1: Add mode state and selector UI**

In `CreatePlanPage`, add mode state:

```typescript
const [mode, setMode] = useState<"poll" | "availability">("poll");
```

Add mode selector at the top of the form, before the title field:

```tsx
<HStack gap={2} mb={2}>
  <Button
    variant={mode === "poll" ? "solid" : "outline"}
    onClick={() => setMode("poll")}
    type="button"
  >
    Poll
  </Button>
  <Button
    variant={mode === "availability" ? "solid" : "outline"}
    onClick={() => setMode("availability")}
    type="button"
  >
    Availability
  </Button>
</HStack>
```

- [ ] **Step 2: Add date range fields for availability mode**

Add state for date range:

```typescript
const [dateRangeStart, setDateRangeStart] = useState("");
const [dateRangeEnd, setDateRangeEnd] = useState("");
```

After the timezone display, conditionally show either the calendar/time picker (poll) or date range inputs (availability):

```tsx
{mode === "poll" ? (
  <Box w="100%">
    <Text weight="semibold" mb={2}>
      Select dates, then pick time slots
    </Text>
    <DateCalendar selectedDates={selectedDates} onClickDate={handleDateClick} />
  </Box>
) : (
  <Box w="100%">
    <Text weight="semibold" mb={2}>
      Optionally limit dates
    </Text>
    <HStack gap={2}>
      <FormField label="From">
        <Input
          type="date"
          value={dateRangeStart}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setDateRangeStart(e.target.value)
          }
        />
      </FormField>
      <FormField label="To">
        <Input
          type="date"
          value={dateRangeEnd}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setDateRangeEnd(e.target.value)
          }
        />
      </FormField>
    </HStack>
  </Box>
)}
```

- [ ] **Step 3: Update handleSubmit for both modes**

Update the submit handler to branch on mode:

```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  setError("");

  if (!title.trim()) {
    setError("Title is required");
    return;
  }

  if (mode === "poll" && options.length === 0) {
    setError("Add at least one time option");
    return;
  }

  setSubmitting(true);

  try {
    let result: CreatePlanResponse;

    if (mode === "poll") {
      const planOptions = sortedOptions.map((opt) => {
        const startDate = `${opt.date}T${String(opt.startHour).padStart(2, "0")}:${String(opt.startMinute).padStart(2, "0")}:00`;
        const endDate = `${opt.date}T${String(opt.endHour).padStart(2, "0")}:${String(opt.endMinute).padStart(2, "0")}:00`;
        const startsAt = new Date(startDate).toISOString();
        const endsAt = new Date(endDate).toISOString();
        const label = `${formatDateNice(opt.date)} ${formatTime12(opt.startHour, opt.startMinute)}–${formatTime12(opt.endHour, opt.endMinute)}`;
        return { label, startsAt, endsAt };
      });

      result = await api.createPlan({
        mode: "poll",
        title,
        description: description || undefined,
        timezone,
        options: planOptions,
      });
    } else {
      result = await api.createPlan({
        mode: "availability",
        title,
        description: description || undefined,
        timezone,
        dateRangeStart: dateRangeStart || undefined,
        dateRangeEnd: dateRangeEnd || undefined,
      });
    }

    localStorage.setItem(`when-admin-${result.id}`, result.adminToken);

    navigate({
      to: "/a/$planId",
      params: { planId: result.id },
      search: { token: result.adminToken },
    });
  } catch (err: unknown) {
    setError(err instanceof Error ? err.message : "Failed to create plan");
  } finally {
    setSubmitting(false);
  }
};
```

- [ ] **Step 4: Hide the poll-only options summary when in availability mode**

Wrap the `sortedOptions` display and the modal in `{mode === "poll" && (...)}`.

- [ ] **Step 5: Verify web compiles**

Run: `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 6: Manually test**

Start dev servers: `pnpm dev` (or equivalent)
1. Load `/` — mode toggle should appear
2. Switch to "Availability" — date range inputs appear, calendar/time picker hides
3. Create an availability plan with just title — should succeed and redirect to admin page
4. Create a poll plan — should work exactly as before

- [ ] **Step 7: Commit**

```bash
git add projects/web/src/routes/index.tsx
git commit -m "feat(web): add mode selector and availability create flow"
```

---

## Chunk 5: Web — Participant Page (Availability Mode)

### Task 8: Create BestTimesList component

**Files:**
- Create: `projects/web/src/components/BestTimesList.tsx`

- [ ] **Step 1: Create the component**

```tsx
import { Text, VStack, HStack, Badge } from "@tosui/react";
import type { BestTime } from "@when/shared";

function formatTime12(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h} ${ampm}` : `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function formatDateNice(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

interface BestTimesListProps {
  bestTimes: BestTime[];
  totalParticipants: number;
}

export function BestTimesList({ bestTimes, totalParticipants }: BestTimesListProps) {
  if (bestTimes.length === 0) {
    return (
      <Text size="sm" color="foreground-muted">
        No overlapping availability yet.
      </Text>
    );
  }

  return (
    <VStack gap={2}>
      {bestTimes.map((bt, i) => (
        <HStack key={i} gap={2} align="center">
          <Badge colorScheme={bt.participants.length === totalParticipants ? "success" : "primary"}>
            {bt.participants.length}/{totalParticipants}
          </Badge>
          <Text size="sm" weight="semibold">
            {formatDateNice(bt.date)}{" "}
            {formatTime12(bt.startHour, bt.startMinute)}–
            {formatTime12(bt.endHour, bt.endMinute)}
          </Text>
          <Text size="xs" color="foreground-muted">
            {bt.participants.join(", ")}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add projects/web/src/components/BestTimesList.tsx
git commit -m "feat(web): add BestTimesList component"
```

### Task 9: Create AvailabilityView component

**Files:**
- Create: `projects/web/src/components/AvailabilityView.tsx`

- [ ] **Step 1: Create the read-only day view component**

This component shows stacked horizontal bars per participant for a given date. It reuses the same time grid layout as TimeSlotPicker but is read-only.

```tsx
import React from "react";
import { Text, VStack } from "@tosui/react";
import type { AvailabilitySlot } from "@when/shared";

const SLOT_HEIGHT = 20;
const SLOT_MINUTES = 30;
const DAY_START = 0;
const DAY_END = 24;
const TOTAL_SLOTS = ((DAY_END - DAY_START) * 60) / SLOT_MINUTES;

const PARTICIPANT_COLORS = [
  "#3b82f6", "#a855f7", "#22c55e", "#f59e0b",
  "#ec4899", "#14b8a6", "#ef4444", "#6366f1",
];

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h} ${ampm}` : `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

interface ParticipantSlots {
  name: string;
  slots: AvailabilitySlot[];
}

interface AvailabilityViewProps {
  date: string;
  participants: ParticipantSlots[];
  scrollToHour?: number;
}

export function AvailabilityView({ date, participants, scrollToHour = 8 }: AvailabilityViewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      const scrollSlot = ((scrollToHour - DAY_START) * 60) / SLOT_MINUTES;
      scrollRef.current.scrollTop = scrollSlot * SLOT_HEIGHT;
    }
  }, [scrollToHour]);

  // For each participant, compute which slots they cover on this date
  const participantSlotSets = participants.map((p, pIdx) => {
    const covered = new Set<number>();
    for (const slot of p.slots) {
      if (slot.date !== date) continue;
      const startSlot = ((slot.startHour * 60 + slot.startMinute) - DAY_START * 60) / SLOT_MINUTES;
      const endSlot = ((slot.endHour * 60 + slot.endMinute) - DAY_START * 60) / SLOT_MINUTES;
      for (let s = startSlot; s < endSlot; s++) covered.add(s);
    }
    return { name: p.name, color: PARTICIPANT_COLORS[pIdx % PARTICIPANT_COLORS.length], covered };
  });

  return (
    <VStack gap={2}>
      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {participants.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
                flexShrink: 0,
              }}
            />
            <Text size="xs">{p.name}</Text>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} style={{ maxHeight: "560px", overflowY: "auto" }}>
        <div style={{ position: "relative" }}>
          {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
            const totalMinutes = DAY_START * 60 + i * SLOT_MINUTES;
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            const isHourBoundary = minute === 0;

            // Which participants cover this slot?
            const activeParticipants = participantSlotSets.filter((p) => p.covered.has(i));

            return (
              <div
                key={i}
                style={{
                  height: `${SLOT_HEIGHT}px`,
                  borderTop: isHourBoundary ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: activeParticipants.length > 0 ? `${activeParticipants.length * 4 + 4}px` : "4px",
                  position: "relative",
                  background: activeParticipants.length > 0
                    ? `rgba(59, 130, 246, ${Math.min(0.08 + activeParticipants.length * 0.06, 0.3)})`
                    : "transparent",
                }}
              >
                {activeParticipants.map((p, si) => (
                  <div
                    key={si}
                    style={{
                      position: "absolute",
                      left: si * 4,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      background: p.color,
                    }}
                  />
                ))}
                {isHourBoundary && (
                  <Text
                    size="xs"
                    color="foreground-muted"
                    style={{ pointerEvents: "none", minWidth: "60px" }}
                  >
                    {formatTime(hour, 0)}
                  </Text>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </VStack>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add projects/web/src/components/AvailabilityView.tsx
git commit -m "feat(web): add AvailabilityView component for read-only day display"
```

### Task 10: Update participant page for availability mode

**Files:**
- Modify: `projects/web/src/routes/p.$planId.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { DateCalendar } from "../components/DateCalendar";
import { TimeSlotPicker } from "../components/TimeSlotPicker";
import { AvailabilityView } from "../components/AvailabilityView";
import { BestTimesList } from "../components/BestTimesList";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@tosui/react";
import type { AvailabilitySlot } from "@when/shared";
```

- [ ] **Step 2: Add availability state**

Inside `ParticipantPage`, add state for the availability form:

```typescript
// Availability mode state
const [availSlots, setAvailSlots] = useState<AvailabilitySlot[]>([]);
const [selectedDate, setSelectedDate] = useState<string | null>(null);
const [tempRanges, setTempRanges] = useState<
  Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }>
>([]);
// For viewing others' availability
const [viewingDate, setViewingDate] = useState<string | null>(null);
```

- [ ] **Step 3: Add availability handlers**

```typescript
const handleAvailDateClick = (date: string) => {
  const existing = availSlots
    .filter((s) => s.date === date)
    .map((s) => ({
      startHour: s.startHour,
      startMinute: s.startMinute,
      endHour: s.endHour,
      endMinute: s.endMinute,
    }));
  setTempRanges(existing);
  setSelectedDate(date);
};

const handleSaveAvailDay = () => {
  if (!selectedDate) return;
  const otherSlots = availSlots.filter((s) => s.date !== selectedDate);
  const newSlots = tempRanges.map((r) => ({
    date: selectedDate,
    ...r,
  }));
  setAvailSlots([...otherSlots, ...newSlots]);
  setSelectedDate(null);
};

const availSelectedDates = [...new Set(availSlots.map((s) => s.date))];
```

- [ ] **Step 4: Update submit mutation for availability mode**

Update the `submitMutation` to branch on plan mode:

```typescript
const submitMutation = useMutation({
  mutationFn: async () => {
    if (plan?.mode === "availability") {
      if (existingResponseId && editToken) {
        await api.updateAvailabilityResponse(
          planId,
          existingResponseId,
          { participantName: name, availabilitySlots: availSlots },
          editToken,
        );
        return { updated: true };
      } else {
        const res = await api.submitAvailabilityResponse(planId, {
          participantName: name,
          availabilitySlots: availSlots,
        });
        localStorage.setItem(
          `when-edit-${planId}`,
          JSON.stringify({ editToken: res.editToken, responseId: res.id }),
        );
        setEditToken(res.editToken);
        setExistingResponseId(res.id);
        return { updated: false };
      }
    }

    // Poll mode — existing logic
    const selectionList: Selection[] = Object.entries(selections)
      .filter(([, v]) => v !== null)
      .map(([optionId, value]) => ({ optionId, value: value! }));

    if (existingResponseId && editToken) {
      await api.updateResponse(
        planId,
        existingResponseId,
        { participantName: name, selections: selectionList },
        editToken,
      );
      return { updated: true };
    } else {
      const res = await api.submitResponse(planId, {
        participantName: name,
        selections: selectionList,
      });
      localStorage.setItem(
        `when-edit-${planId}`,
        JSON.stringify({ editToken: res.editToken, responseId: res.id }),
      );
      setEditToken(res.editToken);
      setExistingResponseId(res.id);
      return { updated: false };
    }
  },
  onSuccess: () => {
    setSubmitted(true);
    queryClient.invalidateQueries({ queryKey: ["results", planId] });
  },
});
```

- [ ] **Step 5: Load existing availability on edit**

In the `useEffect` that loads existing response data, add availability branch:

```typescript
useEffect(() => {
  if (results && existingResponseId) {
    const existing = results.responses.find((r) => r.id === existingResponseId);
    if (existing) {
      setName(existing.participantName);
      if (plan?.mode === "availability" && existing.availabilitySlots) {
        setAvailSlots(existing.availabilitySlots);
      } else {
        const sels: Record<string, "yes" | "maybe" | null> = {};
        for (const s of existing.selections) {
          sels[s.optionId] = s.value;
        }
        setSelections(sels);
      }
    }
  }
}, [results, existingResponseId]);
```

- [ ] **Step 6: Update the JSX render for availability mode**

Replace the form section with a mode-aware branch. When `plan.mode === "availability"`:

Show the "Add your availability" form with:
- Name input (same as current)
- DateCalendar for picking dates (constrained by dateRange if set)
- TimeSlotPicker modal (same as create page)
- Submit button

Show "Everyone's availability" section with:
- Best times list (`<BestTimesList bestTimes={results.bestTimes} totalParticipants={results.responses.length} />`)
- DateCalendar showing dates with any availability, clicking opens read-only AvailabilityView modal

This is the largest UI change — the full JSX is too long to inline here. The key structure:

```tsx
{plan.mode === "availability" ? (
  <>
    {/* Everyone's availability (visible always) */}
    <Box w="100%">
      <Heading as="h3" size="lg" mb={3}>Best times</Heading>
      <BestTimesList
        bestTimes={results.bestTimes || []}
        totalParticipants={results.responses.length}
      />
    </Box>

    {/* Calendar showing all submitted dates */}
    {results.responses.length > 0 && (
      <Box w="100%">
        <Heading as="h3" size="lg" mb={3}>Everyone's availability</Heading>
        <DateCalendar
          selectedDates={allAvailDates}
          onClickDate={(date) => setViewingDate(date)}
        />
      </Box>
    )}

    {/* Submit availability form (when plan is open) */}
    {plan.status === "open" && (
      <Box w="100%" p={4} border="thin" borderColor="border" rounded="md">
        <Heading as="h3" size="lg" mb={3}>
          {existingResponseId ? "Update your availability" : "Add your availability"}
        </Heading>
        <VStack gap={3}>
          <FormField label="Your name">
            <Input ... />
          </FormField>
          <DateCalendar
            selectedDates={availSelectedDates}
            onClickDate={handleAvailDateClick}
          />
          {/* submit button */}
        </VStack>
      </Box>
    )}

    {/* Time picker modal for editing own availability */}
    <Modal isOpen={selectedDate !== null} onClose={() => setSelectedDate(null)} size="md">
      ...TimeSlotPicker...
    </Modal>

    {/* Read-only view modal for viewing everyone's availability on a date */}
    <Modal isOpen={viewingDate !== null} onClose={() => setViewingDate(null)} size="md">
      <ModalHeader>...</ModalHeader>
      <ModalBody>
        <AvailabilityView
          date={viewingDate!}
          participants={results.responses
            .filter((r) => r.availabilitySlots?.some((s) => s.date === viewingDate))
            .map((r) => ({ name: r.participantName, slots: r.availabilitySlots || [] }))}
        />
      </ModalBody>
    </Modal>
  </>
) : (
  // ... existing poll mode JSX ...
)}
```

Compute `allAvailDates` from results:
```typescript
const allAvailDates = plan?.mode === "availability"
  ? [...new Set(results.responses.flatMap((r) => (r.availabilitySlots || []).map((s) => s.date)))]
  : [];
```

- [ ] **Step 7: Verify web compiles**

Run: `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 8: Commit**

```bash
git add projects/web/src/routes/p.$planId.tsx
git commit -m "feat(web): availability mode participant page with calendar, time picker, and results"
```

---

## Chunk 6: Web — Admin Page and Polish

### Task 11: Update admin page for availability mode

**Files:**
- Modify: `projects/web/src/routes/a.$planId.tsx`

- [ ] **Step 1: Add imports**

```typescript
import { DateCalendar } from "../components/DateCalendar";
import { AvailabilityView } from "../components/AvailabilityView";
import { BestTimesList } from "../components/BestTimesList";
import { Modal, ModalHeader, ModalBody } from "@tosui/react";
```

- [ ] **Step 2: Add state for viewing availability**

```typescript
const [viewingDate, setViewingDate] = useState<string | null>(null);
```

- [ ] **Step 3: Update results display**

Replace `<ResultsTable results={results} />` with a mode-aware branch:

```tsx
{plan.mode === "availability" ? (
  <>
    <Box w="100%">
      <Heading as="h3" size="lg" mb={3}>Best times</Heading>
      <BestTimesList
        bestTimes={results.bestTimes || []}
        totalParticipants={results.responses.length}
      />
    </Box>

    {results.responses.length > 0 && (
      <Box w="100%">
        <Heading as="h3" size="lg" mb={3}>Everyone's availability</Heading>
        <Text size="sm" color="foreground-muted" mb={2}>
          Click a date to see details
        </Text>
        <DateCalendar
          selectedDates={allAvailDates}
          onClickDate={(date) => setViewingDate(date)}
        />
      </Box>
    )}

    <Modal isOpen={viewingDate !== null} onClose={() => setViewingDate(null)} size="md">
      <ModalHeader>
        <Heading as="h3" size="lg">
          {viewingDate ? new Date(viewingDate + "T00:00").toLocaleDateString("en-US", {
            weekday: "short", month: "short", day: "numeric"
          }) : ""}
        </Heading>
      </ModalHeader>
      <ModalBody>
        {viewingDate && (
          <AvailabilityView
            date={viewingDate}
            participants={results.responses
              .filter((r) => r.availabilitySlots?.some((s) => s.date === viewingDate))
              .map((r) => ({ name: r.participantName, slots: r.availabilitySlots || [] }))}
          />
        )}
      </ModalBody>
    </Modal>
  </>
) : (
  <ResultsTable results={results} />
)}
```

Compute `allAvailDates`:
```typescript
const allAvailDates = plan.mode === "availability"
  ? [...new Set(results.responses.flatMap((r) => (r.availabilitySlots || []).map((s) => s.date)))]
  : [];
```

- [ ] **Step 4: Verify web compiles**

Run: `pnpm --filter web exec tsc --noEmit`

- [ ] **Step 5: Manually test end-to-end**

1. Create an availability plan (title only)
2. Open participant link in a second tab
3. Add availability as "Alice" — pick 2 dates, draw time ranges, submit
4. Open participant link in a third tab
5. Add availability as "Bob" — overlapping times
6. Verify "Best times" shows overlapping windows
7. Click dates in "Everyone's availability" — verify AvailabilityView shows both participants
8. Verify admin page shows same results
9. Verify poll mode still works end-to-end

- [ ] **Step 6: Commit**

```bash
git add projects/web/src/routes/a.$planId.tsx
git commit -m "feat(web): availability mode admin page with best times and calendar view"
```

### Task 12: Delete the local test database and verify clean startup

- [ ] **Step 1: Delete and restart**

```bash
rm projects/server/data/when.db*
```

Restart the server to verify the new schema creates cleanly from scratch.

- [ ] **Step 2: Quick smoke test both modes**

Create one poll plan and one availability plan. Verify both work.

- [ ] **Step 3: Final commit with any fixes**

```bash
git add -A
git commit -m "chore: availability mode polish and fixes"
```
