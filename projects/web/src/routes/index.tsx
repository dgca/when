import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { trackPlanCreated } from "../planStore";
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
import type { CreatePlanResponse } from "@when/shared";
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

interface DayOption {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD (same as startDate for single days)
}

function formatDayOption(opt: DayOption): string {
  if (opt.startDate === opt.endDate) return formatDateNice(opt.startDate);
  return `${formatDateNice(opt.startDate)} – ${formatDateNice(opt.endDate)}`;
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
  const [creatorName, setCreatorName] = useState("");
  const [description, setDescription] = useState("");
  const [timezone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [options, setOptions] = useState<TimeOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<"poll" | "availability">("poll");
  const [includesTimes, setIncludesTimes] = useState(true);
  const [dayOptions, setDayOptions] = useState<DayOption[]>([]);
  const [rangeStart, setRangeStart] = useState<string | null>(null);
  const [dateRangeStart, setDateRangeStart] = useState("");
  const [dateRangeEnd, setDateRangeEnd] = useState("");

  // Modal state for day time picker
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [tempRanges, setTempRanges] = useState<
    Array<{ startHour: number; startMinute: number; endHour: number; endMinute: number }>
  >([]);

  const handleToggleIncludesTimes = (checked: boolean) => {
    setIncludesTimes(checked);
    if (!checked) {
      setOptions([]);
    } else {
      setDayOptions([]);
      setRangeStart(null);
    }
  };

  const handleDateClick = (date: string) => {
    if (!includesTimes) {
      if (rangeStart === null) {
        // First click: set range start
        setRangeStart(date);
      } else {
        // Second click: complete the range (or single day if same date)
        const [start, end] = rangeStart <= date ? [rangeStart, date] : [date, rangeStart];
        setDayOptions((prev) => [...prev, { startDate: start, endDate: end }]);
        setRangeStart(null);
      }
      return;
    }
    // Datetime: open time picker modal
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

  const removeDayOption = (index: number) => {
    setDayOptions((prev) => prev.filter((_, i) => i !== index));
  };

  // Get unique dates that have options selected
  const selectedDates = includesTimes
    ? [...new Set(options.map((o) => o.date))]
    : rangeStart ? [rangeStart] : [];

  // For day-only mode, build range data for the calendar to render multi-day spans
  const calendarDateRanges = !includesTimes
    ? dayOptions.map((o) => ({ start: o.startDate, end: o.endDate }))
    : undefined;

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

    if (!creatorName.trim()) {
      setError("Your name is required");
      return;
    }

    if (mode === "poll") {
      if (includesTimes && options.length === 0) {
        setError("Add at least one time option");
        return;
      }
      if (!includesTimes && dayOptions.length === 0) {
        setError("Add at least one date");
        return;
      }
    }

    setSubmitting(true);

    try {
      let result: CreatePlanResponse;

      if (mode === "poll") {
        if (includesTimes) {
          const planOptions = sortedOptions.map((opt) => {
            const startDate = `${opt.date}T${String(opt.startHour).padStart(2, "0")}:${String(opt.startMinute).padStart(2, "0")}:00`;
            const endDate = `${opt.date}T${String(opt.endHour).padStart(2, "0")}:${String(opt.endMinute).padStart(2, "0")}:00`;
            const startsAt = new Date(startDate).toISOString();
            const endsAt = new Date(endDate).toISOString();
            const label = `${formatDateNice(opt.date)} ${formatTime12(opt.startHour, opt.startMinute)}–${formatTime12(opt.endHour, opt.endMinute)}`;
            return { label, startsAt, endsAt };
          });
          result = await api.createPlan({
            mode: "poll",
            title,
            creatorName,
            description: description || undefined,
            timezone,
            timeGranularity: "datetime",
            options: planOptions,
          });
        } else {
          const sortedDayOptions = [...dayOptions].sort((a, b) =>
            a.startDate.localeCompare(b.startDate),
          );
          const planOptions = sortedDayOptions.map((opt) => ({
            label: formatDayOption(opt),
            startsAt: `${opt.startDate}T00:00:00.000Z`,
            ...(opt.startDate !== opt.endDate
              ? { endsAt: `${opt.endDate}T00:00:00.000Z` }
              : {}),
          }));
          result = await api.createPlan({
            mode: "poll",
            title,
            creatorName,
            description: description || undefined,
            timezone,
            timeGranularity: "day",
            options: planOptions,
          });
        }
      } else {
        result = await api.createPlan({
          mode: "availability",
          title,
          creatorName,
          description: description || undefined,
          timezone,
          dateRangeStart: dateRangeStart || undefined,
          dateRangeEnd: dateRangeEnd || undefined,
        });
      }

      trackPlanCreated(result.id, title, result.adminToken);

      navigate({
        to: "/p/$planId",
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
      <Heading as="h2" size="xl" mb={2}>
        Create a plan
      </Heading>
      <Text color="foreground-muted" mb={6}>
        Create a plan, share the link, and let your group vote on times — no sign-up required.
      </Text>
      <form onSubmit={handleSubmit}>
        <VStack gap={4}>
          <HStack gap={2} mb={2}>
            <Button
              variant={mode === "poll" ? "solid" : "outline"}
              onClick={() => setMode("poll")}
              type="button"
            >
              Poll
            </Button>
            <Button
              variant={mode === "availability" ? "solid" : "outline"}
              onClick={() => setMode("availability")}
              type="button"
            >
              Availability
            </Button>
          </HStack>
          <Text size="sm" color="foreground-muted">
            {mode === "poll"
              ? "You pick specific time slots. Participants vote on which ones work."
              : "Participants share when they're free. You find the overlap."}
          </Text>

          <FormField label="Title">
            <Input
              placeholder="Dinner this weekend?"
              value={title}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
              required
            />
          </FormField>

          <FormField label="Your name">
            <Input
              placeholder="Enter your name"
              value={creatorName}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreatorName(e.target.value)}
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

          {mode === "poll" && (
            <HStack gap={2} align="center">
              <input
                type="checkbox"
                id="includes-times"
                checked={includesTimes}
                onChange={(e) => handleToggleIncludesTimes(e.target.checked)}
              />
              <label htmlFor="includes-times" style={{ cursor: "pointer", fontSize: "14px" }}>
                Include specific times
              </label>
            </HStack>
          )}

          {mode === "poll" ? (
            <Box w="100%">
              <Text weight="semibold" mb={2}>
                {includesTimes
                  ? "Select dates, then pick time slots"
                  : rangeStart
                    ? `Click another date to complete the range (started: ${formatDateNice(rangeStart)})`
                    : "Click a date to add it, or click two dates for a range"}
              </Text>
              {rangeStart && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setRangeStart(null)}
                  type="button"
                  mb={2}
                >
                  Cancel range
                </Button>
              )}
              <DateCalendar selectedDates={selectedDates} dateRanges={calendarDateRanges} onClickDate={handleDateClick} />
            </Box>
          ) : (
            <Box w="100%">
              <Text weight="semibold" mb={2}>
                Optionally limit dates
              </Text>
              <HStack gap={2}>
                <FormField label="From">
                  <Input
                    type="date"
                    value={dateRangeStart}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDateRangeStart(e.target.value)
                    }
                  />
                </FormField>
                <FormField label="To">
                  <Input
                    type="date"
                    value={dateRangeEnd}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setDateRangeEnd(e.target.value)
                    }
                  />
                </FormField>
              </HStack>
            </Box>
          )}

          {/* Selected options summary */}
          {mode === "poll" && includesTimes && sortedOptions.length > 0 && (
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

          {mode === "poll" && !includesTimes && dayOptions.length > 0 && (
            <Box w="100%">
              <Text weight="semibold" size="sm" mb={2}>
                Date options ({dayOptions.length})
              </Text>
              <VStack gap={1}>
                {[...dayOptions]
                  .map((opt, i) => ({ opt, i }))
                  .sort((a, b) => a.opt.startDate.localeCompare(b.opt.startDate))
                  .map(({ opt, i }) => (
                    <HStack key={i} gap={2} align="center">
                      <Badge colorScheme="success" size="sm">
                        {formatDayOption(opt)}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeDayOption(i)}
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
      {mode === "poll" && includesTimes && (
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
      )}
    </Box>
  );
}
