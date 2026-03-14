const STORAGE_KEY = "when-plans";

export interface PlanEntry {
  title: string;
  adminToken?: string;
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

export function trackPlanCreated(planId: string, title: string, adminToken: string) {
  const store = getPlanStore();
  store[planId] = { title, adminToken, timestamp: new Date().toISOString() };
  savePlanStore(store);
}

export function trackPlanJoined(planId: string, title: string) {
  const store = getPlanStore();
  // Don't overwrite if already tracked as admin
  if (store[planId]?.adminToken) {
    store[planId].timestamp = new Date().toISOString();
  } else {
    store[planId] = { title, timestamp: new Date().toISOString() };
  }
  savePlanStore(store);
}
