import { createFileRoute, useNavigate } from "@tanstack/react-router";
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
  Modal,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@tosui/react";
import { api } from "../api";
import { DateCalendar } from "../components/DateCalendar";
import { TimeSlotPicker } from "../components/TimeSlotPicker";

export const Route = createFileRoute("/")({
  component: CreatePlanPage,
});

interface TimeOption {
  date: string; // YYYY-MM-DD
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

function formatTime12(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h} ${ampm}` : `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function formatDateNice(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function CreatePlanPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [options, setOptions] = useState<TimeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Modal state for day time picker
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tempRanges, setTempRanges] = useState<
    Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }>
  >([]);

  const handleDateClick = (date: string) => {
    // Load existing ranges for this date
    const existing = options
      .filter((o) => o.date === date)
      .map((o) => ({
        startHour: o.startHour,
        startMinute: o.startMinute,
        endHour: o.endHour,
        endMinute: o.endMinute,
      }));
    setTempRanges(existing);
    setSelectedDate(date);
  };

  const handleSaveDay = () => {
    if (!selectedDate) return;
    // Remove old options for this date, add new ones
    const otherOptions = options.filter((o) => o.date !== selectedDate);
    const newOptions = tempRanges.map((r) => ({
      date: selectedDate,
      ...r,
    }));
    setOptions([...otherOptions, ...newOptions]);
    setSelectedDate(null);
  };

  const handleClearDay = () => {
    if (!selectedDate) return;
    setOptions(options.filter((o) => o.date !== selectedDate));
    setSelectedDate(null);
  };

  const removeOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  // Get unique dates that have options selected
  const selectedDates = [...new Set(options.map((o) => o.date))];

  // Sort options by date then time
  const sortedOptions = [...options].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startHour * 60 + a.startMinute - (b.startHour * 60 + b.startMinute);
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    if (options.length === 0) {
      setError("Add at least one time option");
      return;
    }

    setSubmitting(true);

    try {
      const planOptions = sortedOptions.map((opt) => {
        const startDate = `${opt.date}T${String(opt.startHour).padStart(2, "0")}:${String(opt.startMinute).padStart(2, "0")}:00`;
        const endDate = `${opt.date}T${String(opt.endHour).padStart(2, "0")}:${String(opt.endMinute).padStart(2, "0")}:00`;
        const startsAt = new Date(startDate).toISOString();
        const endsAt = new Date(endDate).toISOString();
        const label = `${formatDateNice(opt.date)} ${formatTime12(opt.startHour, opt.startMinute)}–${formatTime12(opt.endHour, opt.endMinute)}`;
        return { label, startsAt, endsAt };
      });

      const result = await api.createPlan({
        title,
        description: description || undefined,
        timezone,
        options: planOptions,
      });

      localStorage.setItem(`when-admin-${result.id}`, result.adminToken);

      navigate({
        to: "/a/$planId",
        params: { planId: result.id },
        search: { token: result.adminToken },
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create plan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box>
      <Heading as="h2" size="xl" mb={4}>
        Create a plan
      </Heading>
      <form onSubmit={handleSubmit}>
        <VStack gap={4}>
          <FormField label="Title">
            <Input
              placeholder="Dinner this weekend?"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Description (optional)">
            <Textarea
              placeholder="Add details about the plan..."
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              rows={2}
            />
          </FormField>

          <Box>
            <Text size="sm" color="foreground-muted">
              Timezone: {timezone}
            </Text>
          </Box>

          <Box w="100%">
            <Text weight="semibold" mb={2}>
              Select dates, then pick time slots
            </Text>
            <DateCalendar selectedDates={selectedDates} onClickDate={handleDateClick} />
          </Box>

          {/* Selected options summary */}
          {sortedOptions.length > 0 && (
            <Box w="100%">
              <Text weight="semibold" size="sm" mb={2}>
                Time options ({sortedOptions.length})
              </Text>
              <VStack gap={1}>
                {sortedOptions.map((opt, i) => (
                  <HStack key={i} gap={2} align="center">
                    <Badge colorScheme="success" size="sm">
                      {formatDateNice(opt.date)}
                    </Badge>
                    <Text size="sm">
                      {formatTime12(opt.startHour, opt.startMinute)} –{" "}
                      {formatTime12(opt.endHour, opt.endMinute)}
                    </Text>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeOption(options.indexOf(opt))}
                      type="button"
                    >
                      ✕
                    </Button>
                  </HStack>
                ))}
              </VStack>
            </Box>
          )}

          {error && (
            <Text color="error" size="sm">
              {error}
            </Text>
          )}

          <Button type="submit" loading={submitting} fullWidth>
            Create plan
          </Button>
        </VStack>
      </form>

      {/* Day time picker modal */}
      <Modal
        isOpen={selectedDate !== null}
        onClose={() => setSelectedDate(null)}
        size="md"
      >
        <ModalHeader>
          <Heading as="h3" size="lg">
            {selectedDate ? formatDateNice(selectedDate) : ""}
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
            {tempRanges.length > 0 && options.some((o) => o.date === selectedDate) && (
              <Button variant="ghost" size="sm" colorScheme="error" onClick={handleClearDay}>
                Clear day
              </Button>
            )}
            <Button variant="ghost" onClick={() => setSelectedDate(null)}>
              Cancel
            </Button>
            <Button onClick={handleSaveDay} disabled={tempRanges.length === 0}>
              Save times
            </Button>
          </HStack>
        </ModalFooter>
      </Modal>
    </Box>
  );
}
