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
    const endSlot = Math.max(dragStart, dragEnd) + 1; // inclusive end

    const start = slotToTime(startSlot, dayStart);
    const end = slotToTime(endSlot, dayStart);

    const newRange = {
      startHour: start.hour,
      startMinute: start.minute,
      endHour: end.hour,
      endMinute: end.minute,
    };

    // No-op if an identical range already exists
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

  // Compute which slots are covered by existing ranges
  const coveredSlots = new Set<number>();
  const rangeSlotMap: Map<number, number> = new Map(); // slot -> range index
  existingRanges.forEach((range, rangeIdx) => {
    const start = timeToSlot(range.startHour, range.startMinute, dayStart);
    const end = timeToSlot(range.endHour, range.endMinute, dayStart);
    for (let s = start; s < end; s++) {
      coveredSlots.add(s);
      rangeSlotMap.set(s, rangeIdx);
    }
  });

  // Current drag selection
  const dragMin = dragStart !== null && dragEnd !== null ? Math.min(dragStart, dragEnd) : -1;
  const dragMax = dragStart !== null && dragEnd !== null ? Math.max(dragStart, dragEnd) : -1;


  const hours: number[] = [];
  for (let h = dayStart; h <= dayEnd; h++) hours.push(h);

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
          const isSelected = coveredSlots.has(i);
          const isDragSelected = isDragging && i >= dragMin && i <= dragMax;

          return (
            <div
              key={i}
              style={{
                height: `${SLOT_HEIGHT}px`,
                borderTop: isHourBoundary ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
                background: isDragSelected
                  ? "rgba(59, 130, 246, 0.3)"
                  : isSelected
                    ? "rgba(34, 197, 94, 0.2)"
                    : "transparent",
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
          {existingRanges.map((range, i) => (
            <HStack key={i} gap={2} align="center">
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
          ))}
        </VStack>
      )}
    </Box>
  );
}
