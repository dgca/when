import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Box,
  Button,
  Input,
  Textarea,
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
import { DateCalendar } from "../components/DateCalendar";
import { AvailabilityView } from "../components/AvailabilityView";
import { BestTimesList } from "../components/BestTimesList";
import { Modal, ModalHeader, ModalBody } from "@tosui/react";

export const Route = createFileRoute("/a/$planId")({
  component: AdminPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || "",
  }),
});

function AdminPage() {
  const { planId } = Route.useParams();
  const { token } = Route.useSearch();
  const queryClient = useQueryClient();

  const { data: results, isLoading } = useQuery({
    queryKey: ["results", planId],
    queryFn: () => api.getResults(planId),
    refetchInterval: 15_000,
  });

  const [viewingDate, setViewingDate] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [copied, setCopied] = useState(false);

  const updateMutation = useMutation({
    mutationFn: () =>
      api.updatePlan(planId, { title: editTitle, description: editDescription || undefined }, token),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["results", planId] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => api.closePlan(planId, token),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["results", planId] });
    },
  });

  const copyLink = () => {
    const url = `${window.location.origin}/p/${planId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const startEditing = () => {
    if (results) {
      setEditTitle(results.plan.title);
      setEditDescription(results.plan.description || "");
      setEditing(true);
    }
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

  const allAvailDates = plan.mode === "availability"
    ? [...new Set(results.responses.flatMap((r) => (r.availabilitySlots || []).map((s) => s.date)))]
    : [];

  return (
    <VStack gap={5}>
      <Box>
        <Box mb={2}>
          <Badge colorScheme="primary">
            Admin view
          </Badge>
        </Box>

        {editing ? (
          <VStack gap={3}>
            <FormField label="Title">
              <Input
                value={editTitle}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEditTitle(e.target.value)}
              />
            </FormField>
            <FormField label="Description">
              <Textarea
                value={editDescription}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setEditDescription(e.target.value)
                }
                rows={2}
              />
            </FormField>
            <HStack gap={2}>
              <Button
                size="sm"
                onClick={() => updateMutation.mutate()}
                loading={updateMutation.isPending}
              >
                Save
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </HStack>
          </VStack>
        ) : (
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
        )}
      </Box>

      <HStack gap={2}>
        <Button size="sm" variant="outline" onClick={copyLink}>
          {copied ? "Copied!" : "Copy share link"}
        </Button>
        {!editing && (
          <Button size="sm" variant="outline" onClick={startEditing}>
            Edit details
          </Button>
        )}
        {plan.status === "open" && (
          <Button
            size="sm"
            variant="outline"
            colorScheme="error"
            onClick={() => {
              if (confirm("Close this plan? Participants won't be able to respond.")) {
                closeMutation.mutate();
              }
            }}
            loading={closeMutation.isPending}
          >
            Close plan
          </Button>
        )}
      </HStack>

      {plan.mode === "availability" ? (
        <>
          <Box w="100%">
            <Heading as="h3" size="lg" mb={3}>
              Best times
            </Heading>
            <BestTimesList
              bestTimes={results.bestTimes || []}
              totalParticipants={results.responses.length}
            />
          </Box>

          {results.responses.length > 0 && (
            <Box w="100%">
              <Heading as="h3" size="lg" mb={3}>
                Everyone's availability
              </Heading>
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

      <Box w="100%" p={3} bg="surface" rounded="md">
        <Text size="xs" color="foreground-muted">
          Share this link with participants:
        </Text>
        <Text size="sm" weight="semibold">
          {window.location.origin}/p/{planId}
        </Text>
      </Box>
    </VStack>
  );
}
