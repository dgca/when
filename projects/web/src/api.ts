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

const BASE = "/api";

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${url}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.toString() || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  createPlan(data: CreatePlanInput): Promise<CreatePlanResponse> {
    return request("/plans", { method: "POST", body: JSON.stringify(data) });
  },

  getPlan(planId: string): Promise<PlanSummary> {
    return request(`/plans/${planId}`);
  },

  updatePlan(planId: string, data: UpdatePlanInput, adminToken: string): Promise<{ ok: true }> {
    return request(`/plans/${planId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      headers: { "x-admin-token": adminToken },
    });
  },

  closePlan(planId: string, adminToken: string): Promise<{ ok: true }> {
    return request(`/plans/${planId}/close`, {
      method: "POST",
      headers: { "x-admin-token": adminToken },
    });
  },

  submitResponse(planId: string, data: CreateResponseInput): Promise<ParticipantResponse> {
    return request(`/plans/${planId}/responses`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateResponse(
    planId: string,
    responseId: string,
    data: UpdateResponseInput,
    editToken: string,
  ): Promise<{ ok: true }> {
    return request(`/plans/${planId}/responses/${responseId}`, {
      method: "PUT",
      body: JSON.stringify(data),
      headers: { "x-edit-token": editToken },
    });
  },

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

  getResults(planId: string): Promise<PlanResults> {
    return request(`/plans/${planId}/results`);
  },
};
