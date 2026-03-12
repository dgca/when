import { useState, useRef, useCallback } from "react";
import { Box, Text, Button, HStack, VStack } from "@tosui/react";

interface TimeRange {
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

interface TimeSlotPickerProps {
  date: string; // YYYY-MM-DD
  existingRanges: TimeRange[];
  onAddRange: (range: TimeRange) => void;
  onRemoveRange: (index: number) => void;
  dayStart?: number; // hour (default 8)
  dayEnd?: number; // hour (default 22)
}

const SLOT_HEIGHT = 20; // px per 30-min slot
const SLOT_MINUTES = 30;

// Palette of distinguishable colors for ranges
const RANGE_COLORS = [
  { bg: "rgba(59, 130, 246, 0.18)", border: "#3b82f6", dot: "#3b82f6" },   // blue
  { bg: "rgba(168, 85, 247, 0.18)", border: "#a855f7", dot: "#a855f7" },   // purple
  { bg: "rgba(34, 197, 94, 0.18)", border: "#22c55e", dot: "#22c55e" },    // green
  { bg: "rgba(245, 158, 11, 0.18)", border: "#f59e0b", dot: "#f59e0b" },   // amber
  { bg: "rgba(236, 72, 153, 0.18)", border: "#ec4899", dot: "#ec4899" },   // pink
  { bg: "rgba(20, 184, 166, 0.18)", border: "#14b8a6", dot: "#14b8a6" },   // teal
  { bg: "rgba(239, 68, 68, 0.18)", border: "#ef4444", dot: "#ef4444" },    // red
  { bg: "rgba(99, 102, 241, 0.18)", border: "#6366f1", dot: "#6366f1" },   // indigo
];

function getRangeColor(index: number) {
  return RANGE_COLORS[index % RANGE_COLORS.length];
}

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h} ${ampm}` : `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

function slotToTime(slot: number, dayStart: number): { hour: number; minute: number } {
  const totalMinutes = dayStart * 60 + slot * SLOT_MINUTES;
  return { hour: Math.floor(totalMinutes / 60), minute: totalMinutes % 60 };
}

function timeToSlot(hour: number, minute: number, dayStart: number): number {
  return (hour * 60 + minute - dayStart * 60) / SLOT_MINUTES;
}

export function TimeSlotPicker({
  date,
  existingRanges,
  onAddRange,
  onRemoveRange,
  dayStart = 8,
  dayEnd = 22,
}: TimeSlotPickerProps) {
  const totalSlots = ((dayEnd - dayStart) * 60) / SLOT_MINUTES;
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragStart, setDragStart] = useState<number | null>(null);
  const [dragEnd, setDragEnd] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const getSlotFromY = useCallback(
    (clientY: number): number => {
      if (!containerRef.current) return 0;
      const rect = containerRef.current.getBoundingClientRect();
      const y = clientY - rect.top;
      const slot = Math.floor(y / SLOT_HEIGHT);
      return Math.max(0, Math.min(totalSlots - 1, slot));
    },
    [totalSlots],
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    const slot = getSlotFromY(e.clientY);
    setDragStart(slot);
    setDragEnd(slot);
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging) return;
    const slot = getSlotFromY(e.clientY);
    setDragEnd(slot);
  };

  const handlePointerUp = () => {
    if (!isDragging || dragStart === null || dragEnd === null) return;
    setIsDragging(false);

    const startSlot = Math.min(dragStart, dragEnd);
    const endSlot = Math.max(dragStart, dragEnd) + 1;

    const start = slotToTime(startSlot, dayStart);
    const end = slotToTime(endSlot, dayStart);

    const newRange = {
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
    };

    const isDuplicate = existingRanges.some(
      (r) =>
        r.startHour === newRange.startHour &&
        r.startMinute === newRange.startMinute &&
        r.endHour === newRange.endHour &&
        r.endMinute === newRange.endMinute,
    );

    if (!isDuplicate) {
      onAddRange(newRange);
    }

    setDragStart(null);
    setDragEnd(null);
  };

  // Map each slot to which range indices cover it (supports overlaps)
  const slotRanges: Map<number, number[]> = new Map();
  existingRanges.forEach((range, rangeIdx) => {
    const start = timeToSlot(range.startHour, range.startMinute, dayStart);
    const end = timeToSlot(range.endHour, range.endMinute, dayStart);
    for (let s = start; s < end; s++) {
      const existing = slotRanges.get(s) || [];
      existing.push(rangeIdx);
      slotRanges.set(s, existing);
    }
  });

  const dragMin = dragStart !== null && dragEnd !== null ? Math.min(dragStart, dragEnd) : -1;
  const dragMax = dragStart !== null && dragEnd !== null ? Math.max(dragStart, dragEnd) : -1;

  // The next color that will be assigned to a new range
  const nextColor = getRangeColor(existingRanges.length);

  return (
    <Box>
      <Text size="sm" color="foreground-muted" mb={2}>
        Click and drag to select time ranges for{" "}
        <Text as="span" weight="semibold">
          {date}
        </Text>
      </Text>

      <div
        ref={containerRef}
        style={{ position: "relative", userSelect: "none", cursor: "crosshair" }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {Array.from({ length: totalSlots }, (_, i) => {
          const { hour, minute } = slotToTime(i, dayStart);
          const isHourBoundary = minute === 0;
          const isDragSelected = isDragging && i >= dragMin && i <= dragMax;
          const rangeIndices = slotRanges.get(i);

          // Build background: layer range colors, with drag on top
          let background = "transparent";
          if (rangeIndices && rangeIndices.length > 0) {
            // Use the last range's color (topmost visually)
            background = getRangeColor(rangeIndices[rangeIndices.length - 1]).bg;
          }
          if (isDragSelected) {
            background = nextColor.bg;
          }

          return (
            <div
              key={i}
              style={{
                height: `${SLOT_HEIGHT}px`,
                borderTop: isHourBoundary ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
                background,
                display: "flex",
                alignItems: "center",
                paddingLeft: "4px",
                transition: "background 0.05s",
              }}
            >
              {isHourBoundary && (
                <Text
                  size="xs"
                  color="foreground-muted"
                  style={{ pointerEvents: "none", minWidth: "60px" }}
                >
                  {formatTime(hour, 0)}
                </Text>
              )}
            </div>
          );
        })}
      </div>

      {existingRanges.length > 0 && (
        <VStack gap={1} mt={3}>
          <Text size="xs" weight="semibold" color="foreground-muted">
            Selected times:
          </Text>
          {existingRanges.map((range, i) => {
            const color = getRangeColor(i);
            return (
              <HStack key={i} gap={2} align="center">
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: color.dot,
                    flexShrink: 0,
                  }}
                />
                <Text size="sm">
                  {formatTime(range.startHour, range.startMinute)} –{" "}
                  {formatTime(range.endHour, range.endMinute)}
                </Text>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onRemoveRange(i);
                  }}
                  type="button"
                >
                  ✕
                </Button>
              </HStack>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}
