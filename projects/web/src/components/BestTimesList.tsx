import { Text, VStack, HStack, Badge } from "@tosui/react";
import type { BestTime } from "@when/shared";

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

interface BestTimesListProps {
  bestTimes: BestTime[];
  totalParticipants: number;
}

export function BestTimesList({ bestTimes, totalParticipants }: BestTimesListProps) {
  if (bestTimes.length === 0) {
    return (
      <Text size="sm" color="foreground-muted">
        No overlapping availability yet.
      </Text>
    );
  }

  return (
    <VStack gap={2}>
      {bestTimes.map((bt, i) => (
        <HStack key={i} gap={2} align="center">
          <Badge colorScheme={bt.participants.length === totalParticipants ? "success" : "primary"}>
            {bt.participants.length}/{totalParticipants}
          </Badge>
          <Text size="sm" weight="semibold">
            {formatDateNice(bt.date)}{" "}
            {formatTime12(bt.startHour, bt.startMinute)}–
            {formatTime12(bt.endHour, bt.endMinute)}
          </Text>
          <Text size="xs" color="foreground-muted">
            {bt.participants.join(", ")}
          </Text>
        </HStack>
      ))}
    </VStack>
  );
}
