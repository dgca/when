const STORAGE_KEY = "when-plans";

export interface PlanEntry {
  title: string;
  adminToken?: string;
  editToken?: string;
  responseId?: string;
  timestamp: string; // ISO
}

export type PlanStore = Record<string, PlanEntry>;

export function getPlanStore(): PlanStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function savePlanStore(store: PlanStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export function getEntry(planId: string): PlanEntry | undefined {
  return getPlanStore()[planId];
}

export function trackPlanCreated(planId: string, title: string, adminToken: string) {
  const store = getPlanStore();
  store[planId] = { ...store[planId], title, adminToken, timestamp: new Date().toISOString() };
  savePlanStore(store);
}

export function trackPlanJoined(
  planId: string,
  title: string,
  response: { editToken: string; responseId: string },
) {
  const store = getPlanStore();
  const existing = store[planId];
  store[planId] = {
    ...existing,
    title,
    editToken: response.editToken,
    responseId: response.responseId,
    timestamp: new Date().toISOString(),
  };
  savePlanStore(store);
}
