import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import React from "react";
import { trackPlanJoined, getEntry, trackPlanCreated } from "../planStore";
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
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@tosui/react";
import { api } from "../api";
import { ResultsTable } from "../components/ResultsTable";
import { DateCalendar } from "../components/DateCalendar";
import { TimeSlotPicker } from "../components/TimeSlotPicker";
import { AvailabilityView } from "../components/AvailabilityView";
import { BestTimesList } from "../components/BestTimesList";
import type { Selection, AvailabilitySlot } from "@when/shared";

export const Route = createFileRoute("/p/$planId")({
  component: PlanPage,
  validateSearch: (search: Record<string, unknown>) => ({
    token: (search.token as string) || undefined,
  }),
});

function PlanPage() {
  const { planId } = Route.useParams();
  const { token: urlToken } = Route.useSearch();
  const queryClient = useQueryClient();

  // Resolve admin token from URL param or plan store
  const [adminToken, setAdminToken] = useState<string | null>(() => {
    const entry = getEntry(planId);
    return urlToken || entry?.adminToken || null;
  });

  // If token came via URL, persist it to the plan store
  useEffect(() => {
    if (urlToken) {
      const entry = getEntry(planId);
      trackPlanCreated(planId, entry?.title || "Untitled", urlToken);
      setAdminToken(urlToken);
    }
  }, [planId, urlToken]);

  const isAdmin = !!adminToken;

  const { data: results, isLoading } = useQuery({
    queryKey: ["results", planId],
    queryFn: () => api.getResults(planId),
    refetchInterval: 15_000,
  });

  // Store title in plan store once loaded (for drawer display)
  useEffect(() => {
    if (results?.plan.title && adminToken) {
      trackPlanCreated(planId, results.plan.title, adminToken);
    }
  }, [results?.plan.title, planId, adminToken]);

  // Edit token / existing response
  const [editToken, setEditToken] = useState<string | null>(null);
  const [existingResponseId, setExistingResponseId] = useState<string | null>(null);

  useEffect(() => {
    const entry = getEntry(planId);
    if (entry?.editToken && entry?.responseId) {
      setEditToken(entry.editToken);
      setExistingResponseId(entry.responseId);
    }
  }, [planId]);

  // Response form state
  const [name, setName] = useState("");
  const [selections, setSelections] = useState<Record<string, "yes" | "maybe" | null>>({});
  const [submitted, setSubmitted] = useState(false);

  // Availability mode state
  const [availSlots, setAvailSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tempRanges, setTempRanges] = useState<
    Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }>
  >([]);
  const [viewingDate, setViewingDate] = useState<string | null>(null);

  // Admin edit state
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [copiedShare, setCopiedShare] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [chosenOptionId, setChosenOptionId] = useState<string | null>(null);

  // Load existing response data, or pre-fill name from creatorName for admins
  useEffect(() => {
    if (results && existingResponseId) {
      const existing = results.responses.find((r) => r.id === existingResponseId);
      if (existing) {
        setName(existing.participantName);
        if (results.plan.mode === "availability" && existing.availabilitySlots) {
          setAvailSlots(existing.availabilitySlots);
        } else {
          const sels: Record<string, "yes" | "maybe" | null> = {};
          for (const s of existing.selections) {
            sels[s.optionId] = s.value;
          }
          setSelections(sels);
        }
      }
    } else if (results && !existingResponseId && isAdmin && results.plan.creatorName && results.plan.creatorName !== "n/a") {
      setName(results.plan.creatorName);
    }
  }, [results, existingResponseId, isAdmin]);

  // Admin mutations
  const updateMutation = useMutation({
    mutationFn: () =>
      api.updatePlan(
        planId,
        { title: editTitle, description: editDescription || undefined },
        adminToken!,
      ),
    onSuccess: () => {
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["results", planId] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: (optionId?: string) => api.closePlan(planId, adminToken!, optionId),
    onSuccess: () => {
      setShowCloseModal(false);
      queryClient.invalidateQueries({ queryKey: ["results", planId] });
    },
  });

  const startEditing = () => {
    if (results) {
      setEditTitle(results.plan.title);
      setEditDescription(results.plan.description || "");
      setEditing(true);
    }
  };

  const copyShareLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/p/${planId}`);
    setCopiedShare(true);
    setTimeout(() => setCopiedShare(false), 2000);
  };

  const copyAdminLink = () => {
    navigator.clipboard.writeText(
      `${window.location.origin}/p/${planId}?token=${adminToken}`,
    );
    setCopiedAdmin(true);
    setTimeout(() => setCopiedAdmin(false), 2000);
  };

  // Availability helpers
  const handleAvailDateClick = (date: string) => {
    const existing = availSlots
      .filter((s) => s.date === date)
      .map((s) => ({
        startHour: s.startHour,
        startMinute: s.startMinute,
        endHour: s.endHour,
        endMinute: s.endMinute,
      }));
    setTempRanges(existing);
    setSelectedDate(date);
  };

  const handleSaveAvailDay = () => {
    if (!selectedDate) return;
    const otherSlots = availSlots.filter((s) => s.date !== selectedDate);
    const newSlots = tempRanges.map((r) => ({
      date: selectedDate,
      ...r,
    }));
    setAvailSlots([...otherSlots, ...(newSlots as AvailabilitySlot[])]);
    setSelectedDate(null);
  };

  const availSelectedDates = [...new Set(availSlots.map((s) => s.date))];

  // Submit response mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (results?.plan.mode === "availability") {
        if (existingResponseId && editToken) {
          await api.updateAvailabilityResponse(
            planId,
            existingResponseId,
            { participantName: name, availabilitySlots: availSlots },
            editToken,
          );
          return { updated: true } as const;
        } else {
          const res = await api.submitAvailabilityResponse(planId, {
            participantName: name,
            availabilitySlots: availSlots,
          });
          setEditToken(res.editToken);
          setExistingResponseId(res.id);
          return { updated: false, editToken: res.editToken, responseId: res.id };
        }
      }

      // Poll mode
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
        return { updated: true } as const;
      } else {
        const res = await api.submitResponse(planId, {
          participantName: name,
          selections: selectionList,
        });
        setEditToken(res.editToken);
        setExistingResponseId(res.id);
        return { updated: false, editToken: res.editToken, responseId: res.id };
      }
    },
    onSuccess: (data) => {
      setSubmitted(true);
      if (results?.plan.title && data.editToken && data.responseId) {
        trackPlanJoined(planId, results.plan.title, {
          editToken: data.editToken,
          responseId: data.responseId,
        });
      }
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

  const allAvailDates =
    plan.mode === "availability"
      ? [
          ...new Set(
            results.responses.flatMap((r) => (r.availabilitySlots || []).map((s) => s.date)),
          ),
        ]
      : [];

  return (
    <VStack gap={5}>
      {/* Header */}
      <Box>
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
            {plan.creatorName && plan.creatorName !== "n/a" && (
              <Text size="sm" color="foreground-muted" mb={1}>
                Created by {plan.creatorName}
              </Text>
            )}
            <Text size="xs" color="foreground-muted">
              Times shown in {plan.timezone}
            </Text>
          </Box>
        )}
      </Box>

      {/* Admin controls */}
      {isAdmin && !editing && (
        <Box w="100%" p={3} bg="surface" rounded="md">
          <HStack gap={2} wrap={true}>
            <Button size="sm" variant="outline" onClick={copyShareLink}>
              {copiedShare ? "Copied!" : "Copy share link"}
            </Button>
            <Button size="sm" variant="outline" onClick={copyAdminLink}>
              {copiedAdmin ? "Copied!" : "Copy admin link"}
            </Button>
            <Button size="sm" variant="outline" onClick={startEditing}>
              Edit details
            </Button>
            {plan.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                colorScheme="error"
                onClick={() => {
                  setChosenOptionId(null);
                  setShowCloseModal(true);
                }}
              >
                Close plan
              </Button>
            )}
          </HStack>
        </Box>
      )}

      {/* Chosen time banner */}
      {plan.status === "closed" && plan.chosenOptionId && (() => {
        const chosenOpt = plan.options.find((o) => o.id === plan.chosenOptionId);
        return chosenOpt ? (
          <Box w="100%" p={4} bg="success-subtle" rounded="md">
            <Text size="xs" weight="semibold" color="success" mb={1}>
              Final time
            </Text>
            <Text size="lg" weight="bold">
              {chosenOpt.label}
            </Text>
          </Box>
        ) : null;
      })()}

      {/* Results + response form */}
      {plan.mode === "availability" ? (
        <>
          {/* Best times */}
          <Box w="100%">
            <Heading as="h3" size="lg" mb={3}>
              Best times
            </Heading>
            <BestTimesList
              bestTimes={results.bestTimes || []}
              totalParticipants={results.responses.length}
            />
          </Box>

          {/* Everyone's availability calendar */}
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

          {/* Submit availability form */}
          {plan.status === "open" && (
            <Box w="100%" p={4} border="thin" borderColor="border" rounded="md">
              <Heading as="h3" size="lg" mb={3}>
                {existingResponseId ? "Update your availability" : "Add your availability"}
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
                    Select dates, then pick time slots
                  </Text>
                  <DateCalendar
                    selectedDates={availSelectedDates}
                    onClickDate={handleAvailDateClick}
                    minDate={plan.dateRangeStart || undefined}
                    maxDate={plan.dateRangeEnd || undefined}
                  />
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
                  {existingResponseId ? "Update availability" : "Submit availability"}
                </Button>
              </VStack>
            </Box>
          )}

          {/* Time picker modal for own availability */}
          <Modal isOpen={selectedDate !== null} onClose={() => setSelectedDate(null)} size="md">
            <ModalHeader>
              <Heading as="h3" size="lg">
                {selectedDate
                  ? new Date(selectedDate + "T00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
              </Heading>
            </ModalHeader>
            <ModalBody>
              {selectedDate && (
                <TimeSlotPicker
                  date={selectedDate}
                  existingRanges={tempRanges}
                  onAddRange={(range) => setTempRanges([...tempRanges, range])}
                  onRemoveRange={(i) => setTempRanges(tempRanges.filter((_, idx) => idx !== i))}
                />
              )}
            </ModalBody>
            <ModalFooter>
              <HStack gap={2} justify="end">
                <Button variant="ghost" onClick={() => setSelectedDate(null)}>
                  Cancel
                </Button>
                <Button onClick={handleSaveAvailDay} disabled={tempRanges.length === 0}>
                  Save times
                </Button>
              </HStack>
            </ModalFooter>
          </Modal>

          {/* Read-only availability view modal */}
          <Modal isOpen={viewingDate !== null} onClose={() => setViewingDate(null)} size="md">
            <ModalHeader>
              <Heading as="h3" size="lg">
                {viewingDate
                  ? new Date(viewingDate + "T00:00").toLocaleDateString("en-US", {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })
                  : ""}
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
        <>
          {/* Poll mode */}
          <ResultsTable results={results} />

          {plan.status === "open" && (
            <Box w="100%" p={4} border="thin" borderColor="border" rounded="md">
              <Heading as="h3" size="lg" mb={3}>
                {existingResponseId ? "Update your response" : "Add your response"}
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
                        <HStack
                          key={opt.id}
                          as="button"
                          type="button"
                          gap={2}
                          w="100%"
                          justify="space-between"
                          align="center"
                          p={3}
                          rounded="md"
                          onClick={() => toggleSelection(opt.id)}
                          style={{
                            cursor: "pointer",
                            border: sel === "maybe"
                              ? "1px solid var(--colors-warning, #f59e0b)"
                              : "1px solid var(--colors-border, #e2e8f0)",
                            background: sel === "yes"
                              ? "var(--colors-success-subtle, #dcfce7)"
                              : sel === "maybe"
                                ? "var(--colors-warning-subtle, #fef9c3)"
                                : "transparent",
                          }}
                        >
                          <Text size="sm">{opt.label}</Text>
                          <Badge
                            colorScheme={
                              sel === "yes" ? "success" : sel === "maybe" ? "warning" : "gray"
                            }
                          >
                            {sel === "yes" ? "Yes" : sel === "maybe" ? "Maybe" : "—"}
                          </Badge>
                        </HStack>
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
        </>
      )}
      {/* Close plan modal */}
      {isAdmin && plan.mode === "poll" && (
        <Modal isOpen={showCloseModal} onClose={() => setShowCloseModal(false)} size="md">
          <ModalHeader>
            <Heading as="h3" size="lg">
              Close plan
            </Heading>
          </ModalHeader>
          <ModalBody>
            <Text color="foreground-muted" mb={3}>
              Pick the winning time, or close without choosing.
            </Text>
            <VStack gap={2}>
              {results.optionSummary.map((summary) => {
                const opt = plan.options.find((o) => o.id === summary.optionId);
                if (!opt) return null;
                const isSelected = chosenOptionId === opt.id;
                return (
                  <HStack
                    key={opt.id}
                    as="button"
                    type="button"
                    gap={2}
                    w="100%"
                    justify="space-between"
                    align="center"
                    p={3}
                    rounded="md"
                    onClick={() => setChosenOptionId(isSelected ? null : opt.id)}
                    style={{
                      cursor: "pointer",
                      border: isSelected
                        ? "2px solid var(--colors-success, #16a34a)"
                        : "1px solid var(--colors-border, #e2e8f0)",
                      background: isSelected
                        ? "var(--colors-success-subtle, #dcfce7)"
                        : "transparent",
                    }}
                  >
                    <Text size="sm">{opt.label}</Text>
                    <HStack gap={1}>
                      {summary.yesCount > 0 && (
                        <Badge colorScheme="success" size="sm">{summary.yesCount}</Badge>
                      )}
                      {summary.maybeCount > 0 && (
                        <Badge colorScheme="warning" size="sm">{summary.maybeCount}?</Badge>
                      )}
                    </HStack>
                  </HStack>
                );
              })}
            </VStack>
          </ModalBody>
          <ModalFooter>
            <HStack gap={2} justify="end">
              <Button variant="ghost" onClick={() => setShowCloseModal(false)}>
                Cancel
              </Button>
              <Button
                colorScheme="error"
                onClick={() => closeMutation.mutate(chosenOptionId || undefined)}
                loading={closeMutation.isPending}
              >
                {chosenOptionId ? "Close with winner" : "Close without winner"}
              </Button>
            </HStack>
          </ModalFooter>
        </Modal>
      )}
    </VStack>
  );
}
