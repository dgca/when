import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Box,
  Button,
  Input,
  FormField,
  Heading,
  Text,
  VStack,
  HStack,
  Badge,
  Spinner,
} from "@tosui/react";
import { api } from "../api";
import { ResultsTable } from "../components/ResultsTable";
import type { Selection } from "@when/shared";

export const Route = createFileRoute("/p/$planId")({
  component: ParticipantPage,
});

function ParticipantPage() {
  const { planId } = Route.useParams();
  const queryClient = useQueryClient();

  const { data: results, isLoading } = useQuery({
    queryKey: ["results", planId],
    queryFn: () => api.getResults(planId),
    refetchInterval: 15_000,
  });

  const [editToken, setEditToken] = useState<string | null>(null);
  const [existingResponseId, setExistingResponseId] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(`when-edit-${planId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setEditToken(parsed.editToken);
        setExistingResponseId(parsed.responseId);
      } catch {
        // ignore
      }
    }
  }, [planId]);

  const [name, setName] = useState("");
  const [selections, setSelections] = useState<Record<string, "yes" | "maybe" | null>>({});
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (results && existingResponseId) {
      const existing = results.responses.find((r) => r.id === existingResponseId);
      if (existing) {
        setName(existing.participantName);
        const sels: Record<string, "yes" | "maybe" | null> = {};
        for (const s of existing.selections) {
          sels[s.optionId] = s.value;
        }
        setSelections(sels);
      }
    }
  }, [results, existingResponseId]);

  const submitMutation = useMutation({
    mutationFn: async () => {
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

  const toggleSelection = (optionId: string) => {
    setSelections((prev) => {
      const current = prev[optionId];
      if (current === null || current === undefined) return { ...prev, [optionId]: "yes" };
      if (current === "yes") return { ...prev, [optionId]: "maybe" };
      return { ...prev, [optionId]: null };
    });
  };

  if (isLoading) {
    return (
      <Box display="flex" justifyContent="center" py={8}>
        <Spinner />
      </Box>
    );
  }

  if (!results) {
    return <Text color="error">Plan not found</Text>;
  }

  const { plan } = results;

  return (
    <VStack gap={5}>
      <Box>
        <HStack gap={2} align="center" mb={1}>
          <Heading as="h2" size="xl">
            {plan.title}
          </Heading>
          {plan.status === "closed" && <Badge colorScheme="error">Closed</Badge>}
        </HStack>
        {plan.description && (
          <Text color="foreground-muted" mb={2}>
            {plan.description}
          </Text>
        )}
        <Text size="xs" color="foreground-muted">
          Times shown in {plan.timezone}
        </Text>
      </Box>

      <ResultsTable results={results} />

      {plan.status === "open" && (
        <Box w="100%" p={4} border="thin" borderColor="border" rounded="md">
          <Heading as="h3" size="lg" mb={3}>
            {existingResponseId ? "Update your response" : "Add your availability"}
          </Heading>

          <VStack gap={3}>
            <FormField label="Your name">
              <Input
                placeholder="Enter your name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                required
              />
            </FormField>

            <Box w="100%">
              <Text weight="semibold" mb={2}>
                Which times work? (click to cycle: yes / maybe / blank)
              </Text>
              <VStack gap={2}>
                {plan.options.map((opt) => {
                  const sel = selections[opt.id];
                  return (
                    <Button
                      key={opt.id}
                      variant={sel === "yes" ? "solid" : sel === "maybe" ? "outline" : "ghost"}
                      colorScheme={
                        sel === "yes" ? "success" : sel === "maybe" ? "warning" : undefined
                      }
                      fullWidth
                      onClick={() => toggleSelection(opt.id)}
                      type="button"
                    >
                      <HStack gap={2} w="100%" justify="space-between">
                        <Text size="sm">{opt.label}</Text>
                        <Badge
                          colorScheme={
                            sel === "yes" ? "success" : sel === "maybe" ? "warning" : "gray"
                          }
                        >
                          {sel === "yes" ? "Yes" : sel === "maybe" ? "Maybe" : "—"}
                        </Badge>
                      </HStack>
                    </Button>
                  );
                })}
              </VStack>
            </Box>

            {submitMutation.error && (
              <Text color="error" size="sm">
                {(submitMutation.error as Error).message}
              </Text>
            )}

            {submitted && (
              <Text color="success" size="sm">
                Response saved!
              </Text>
            )}

            <Button
              onClick={() => submitMutation.mutate()}
              loading={submitMutation.isPending}
              disabled={!name.trim()}
              fullWidth
            >
              {existingResponseId ? "Update response" : "Submit"}
            </Button>
          </VStack>
        </Box>
      )}
    </VStack>
  );
}
