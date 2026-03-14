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

const createPollPlanSchema = z.object({
  mode: z.literal("poll"),
  title: z.string().min(1, "Title is required").max(200),
  creatorName: z.string().min(1, "Your name is required").max(100),
  description: z.string().max(2000).optional(),
  timezone: z.string().min(1, "Timezone is required"),
  options: z.array(optionSchema).min(1, "At least one option is required"),
});

const createAvailabilityPlanSchema = z.object({
  mode: z.literal("availability"),
  title: z.string().min(1, "Title is required").max(200),
  creatorName: z.string().min(1, "Your name is required").max(100),
  description: z.string().max(2000).optional(),
  timezone: z.string().min(1, "Timezone is required"),
  dateRangeStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  dateRangeEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createPlanSchema = z.discriminatedUnion("mode", [
  createPollPlanSchema,
  createAvailabilityPlanSchema,
]);

export const createAvailabilityResponseSchema = z.object({
  participantName: z.string().min(1, "Name is required").max(100),
  availabilitySlots: z.array(availabilitySlotSchema),
});

export const updateAvailabilityResponseSchema = z.object({
  participantName: z.string().min(1).max(100).optional(),
  availabilitySlots: z.array(availabilitySlotSchema),
});
