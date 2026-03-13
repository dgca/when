import type { z } from "zod";
import type {
  createPlanSchema,
  updatePlanSchema,
  createResponseSchema,
  updateResponseSchema,
  optionWithIdSchema,
  selectionValueSchema,
  planStatusSchema,
  selectionSchema,
  availabilitySlotSchema,
  createAvailabilityResponseSchema,
  updateAvailabilityResponseSchema,
  planModeSchema,
} from "./schemas.js";

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateResponseInput = z.infer<typeof createResponseSchema>;
export type UpdateResponseInput = z.infer<typeof updateResponseSchema>;
export type OptionWithId = z.infer<typeof optionWithIdSchema>;
export type SelectionValue = z.infer<typeof selectionValueSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type Selection = z.infer<typeof selectionSchema>;
export type PlanMode = z.infer<typeof planModeSchema>;
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;
export type CreateAvailabilityResponseInput = z.infer<typeof createAvailabilityResponseSchema>;
export type UpdateAvailabilityResponseInput = z.infer<typeof updateAvailabilityResponseSchema>;

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

export interface CreatePlanResponse {
  id: string;
  adminToken: string;
  participantUrl: string;
  adminUrl: string;
}

export interface ParticipantResponse {
  id: string;
  participantName: string;
  editToken: string;
  selections?: Selection[];
  availabilitySlots?: AvailabilitySlot[];
  createdAt: string;
  updatedAt: string;
}

export interface BestTime {
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  participants: string[];
}

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
