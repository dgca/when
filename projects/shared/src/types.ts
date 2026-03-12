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
} from "./schemas.js";

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type CreateResponseInput = z.infer<typeof createResponseSchema>;
export type UpdateResponseInput = z.infer<typeof updateResponseSchema>;
export type OptionWithId = z.infer<typeof optionWithIdSchema>;
export type SelectionValue = z.infer<typeof selectionValueSchema>;
export type PlanStatus = z.infer<typeof planStatusSchema>;
export type Selection = z.infer<typeof selectionSchema>;

export interface PlanSummary {
  id: string;
  title: string;
  description: string | null;
  timezone: string;
  status: PlanStatus;
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
  selections: Selection[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanResults {
  plan: PlanSummary;
  responses: Array<{
    id: string;
    participantName: string;
    selections: Selection[];
  }>;
  optionSummary: Array<{
    optionId: string;
    yesCount: number;
    maybeCount: number;
  }>;
}
