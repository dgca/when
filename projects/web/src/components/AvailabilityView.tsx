import React from "react";
import { Text, VStack } from "@tosui/react";
import type { AvailabilitySlot } from "@when/shared";

const SLOT_HEIGHT = 20;
const SLOT_MINUTES = 30;
const DAY_START = 0;
const DAY_END = 24;
const TOTAL_SLOTS = ((DAY_END - DAY_START) * 60) / SLOT_MINUTES;

const PARTICIPANT_COLORS = [
  "#3b82f6", "#a855f7", "#22c55e", "#f59e0b",
  "#ec4899", "#14b8a6", "#ef4444", "#6366f1",
];

function formatTime(hour: number, minute: number): string {
  const h = hour % 12 || 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return minute === 0 ? `${h} ${ampm}` : `${h}:${minute.toString().padStart(2, "0")} ${ampm}`;
}

interface ParticipantSlots {
  name: string;
  slots: AvailabilitySlot[];
}

interface AvailabilityViewProps {
  date: string;
  participants: ParticipantSlots[];
  scrollToHour?: number;
}

export function AvailabilityView({ date, participants, scrollToHour = 8 }: AvailabilityViewProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (scrollRef.current) {
      const scrollSlot = ((scrollToHour - DAY_START) * 60) / SLOT_MINUTES;
      scrollRef.current.scrollTop = scrollSlot * SLOT_HEIGHT;
    }
  }, [scrollToHour]);

  const participantSlotSets = participants.map((p, pIdx) => {
    const covered = new Set<number>();
    for (const slot of p.slots) {
      if (slot.date !== date) continue;
      const startSlot = ((slot.startHour * 60 + slot.startMinute) - DAY_START * 60) / SLOT_MINUTES;
      const endSlot = ((slot.endHour * 60 + slot.endMinute) - DAY_START * 60) / SLOT_MINUTES;
      for (let s = startSlot; s < endSlot; s++) covered.add(s);
    }
    return { name: p.name, color: PARTICIPANT_COLORS[pIdx % PARTICIPANT_COLORS.length], covered };
  });

  return (
    <VStack gap={2}>
      {/* Legend */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
        {participants.map((p, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: PARTICIPANT_COLORS[i % PARTICIPANT_COLORS.length],
                flexShrink: 0,
              }}
            />
            <Text size="xs">{p.name}</Text>
          </div>
        ))}
      </div>

      {/* Time grid */}
      <div ref={scrollRef} style={{ maxHeight: "560px", overflowY: "auto" }}>
        <div style={{ position: "relative" }}>
          {Array.from({ length: TOTAL_SLOTS }, (_, i) => {
            const totalMinutes = DAY_START * 60 + i * SLOT_MINUTES;
            const hour = Math.floor(totalMinutes / 60);
            const minute = totalMinutes % 60;
            const isHourBoundary = minute === 0;

            const activeParticipants = participantSlotSets.filter((p) => p.covered.has(i));

            return (
              <div
                key={i}
                style={{
                  height: `${SLOT_HEIGHT}px`,
                  borderTop: isHourBoundary ? "1px solid #e2e8f0" : "1px solid #f1f5f9",
                  display: "flex",
                  alignItems: "center",
                  paddingLeft: activeParticipants.length > 0 ? `${activeParticipants.length * 4 + 4}px` : "4px",
                  position: "relative",
                  background: activeParticipants.length > 0
                    ? `rgba(59, 130, 246, ${Math.min(0.08 + activeParticipants.length * 0.06, 0.3)})`
                    : "transparent",
                }}
              >
                {activeParticipants.map((p, si) => (
                  <div
                    key={si}
                    style={{
                      position: "absolute",
                      left: si * 4,
                      top: 0,
                      bottom: 0,
                      width: 4,
                      background: p.color,
                    }}
                  />
                ))}
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
      </div>
    </VStack>
  );
}
