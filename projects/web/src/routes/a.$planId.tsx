import { createFileRoute, redirect } from "@tanstack/react-router";
import { trackPlanCreated, getEntry } from "../planStore";

export const Route = createFileRoute("/a/$planId")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
  beforeLoad: ({ params, search }) => {
    const { planId } = params;
    const { token } = search;

    // Persist admin token to plan store before redirecting
    if (token) {
      const entry = getEntry(planId);
      trackPlanCreated(planId, entry?.title || "Untitled", token);
    }

    throw redirect({
      to: "/p/$planId",
      params: { planId },
      search: { token: token || undefined },
    });
  },
  component: () => null, // Never renders — beforeLoad always redirects
});
