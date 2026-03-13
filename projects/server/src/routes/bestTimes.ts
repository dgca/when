import type { BestTime } from "@when/shared";

interface SlotInput {
  participantName: string;
  date: string;
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
}

export function computeBestTimes(slots: SlotInput[], maxResults = 10): BestTime[] {
  // Step 1: Discretize into 30-min buckets
  // Key: "YYYY-MM-DD|HH:MM" → Set<participantName>
  const buckets = new Map<string, Set<string>>();

  for (const slot of slots) {
    let h = slot.startHour;
    let m = slot.startMinute;
    const endTotal = slot.endHour * 60 + slot.endMinute;

    while (h * 60 + m < endTotal) {
      const key = `${slot.date}|${h}:${m.toString().padStart(2, "0")}`;
      if (!buckets.has(key)) buckets.set(key, new Set());
      buckets.get(key)!.add(slot.participantName);
      m += 30;
      if (m >= 60) { h++; m = 0; }
    }
  }

  // Step 2: Group contiguous buckets with identical participant sets
  const sortedKeys = [...buckets.keys()].sort();

  const ranges: BestTime[] = [];
  let currentParticipants: string[] | null = null;
  let currentDate = "";
  let rangeStartH = 0;
  let rangeStartM = 0;
  let rangeEndH = 0;
  let rangeEndM = 0;

  function pushRange() {
    if (currentParticipants && currentParticipants.length >= 2) {
      ranges.push({
        date: currentDate,
        startHour: rangeStartH,
        startMinute: rangeStartM,
        endHour: rangeEndH,
        endMinute: rangeEndM,
        participants: currentParticipants,
      });
    }
  }

  for (const key of sortedKeys) {
    const [date, time] = key.split("|");
    const [h, m] = time.split(":").map(Number);
    const participants = [...buckets.get(key)!].sort();
    const participantKey = participants.join(",");

    const isContiguous =
      currentParticipants !== null &&
      date === currentDate &&
      h * 60 + m === rangeEndH * 60 + rangeEndM &&
      participantKey === currentParticipants.join(",");

    if (isContiguous) {
      rangeEndM += 30;
      if (rangeEndM >= 60) { rangeEndH++; rangeEndM = 0; }
    } else {
      pushRange();
      currentDate = date;
      currentParticipants = participants;
      rangeStartH = h;
      rangeStartM = m;
      rangeEndH = h;
      rangeEndM = m + 30;
      if (rangeEndM >= 60) { rangeEndH = h + 1; rangeEndM = 0; }
    }
  }
  pushRange();

  // Step 3: Sort by participant count desc, then duration desc
  ranges.sort((a, b) => {
    if (b.participants.length !== a.participants.length) {
      return b.participants.length - a.participants.length;
    }
    const durationA = (a.endHour * 60 + a.endMinute) - (a.startHour * 60 + a.startMinute);
    const durationB = (b.endHour * 60 + b.endMinute) - (b.startHour * 60 + b.startMinute);
    return durationB - durationA;
  });

  return ranges.slice(0, maxResults);
}
