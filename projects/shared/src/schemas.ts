import { z } from "zod";

// --- Option schemas ---

export const optionSchema = z.object({
  label: z.string().min(1, "Label is required"),
  startsAt: z.string().datetime({ offset: true }),
  endsAt: z.string().datetime({ offset: true }).optional(),
});

export const optionWithIdSchema = optionSchema.extend({
  id: z.string(),
  sortOrder: z.number(),
});

// --- Plan schemas ---

export const createPlanSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional(),
  timezone: z.string().min(1, "Timezone is required"),
  options: z.array(optionSchema).min(1, "At least one option is required"),
});

export const updatePlanSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
});

export const addOptionsSchema = z.object({
  options: z.array(optionSchema).min(1),
});

// --- Response schemas ---

export const selectionValueSchema = z.enum(["yes", "maybe"]);

export const selectionSchema = z.object({
  optionId: z.string(),
  value: selectionValueSchema,
});

export const createResponseSchema = z.object({
  participantName: z.string().min(1, "Name is required").max(100),
  selections: z.array(selectionSchema),
});

export const updateResponseSchema = z.object({
  participantName: z.string().min(1).max(100).optional(),
  selections: z.array(selectionSchema),
});

// --- Plan status ---

export const planStatusSchema = z.enum(["open", "closed"]);
