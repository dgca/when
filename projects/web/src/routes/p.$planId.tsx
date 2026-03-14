import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import React from "react";
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

  // Availability mode state
  const [availSlots, setAvailSlots] = useState<AvailabilitySlot[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tempRanges, setTempRanges] = useState<
    Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }>
  >([]);
  const [viewingDate, setViewingDate] = useState<string | null>(null);

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
    }
  }, [results, existingResponseId]);

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
          return { updated: true };
        } else {
          const res = await api.submitAvailabilityResponse(planId, {
            participantName: name,
            availabilitySlots: availSlots,
          });
          localStorage.setItem(
            `when-edit-${planId}`,
            JSON.stringify({ editToken: res.editToken, responseId: res.id }),
          );
          setEditToken(res.editToken);
          setExistingResponseId(res.id);
          return { updated: false };
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
        </>
      )}
    </VStack>
  );
}
