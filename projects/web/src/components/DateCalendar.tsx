import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewMonthGrid } from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "@schedule-x/theme-default/dist/index.css";
import "temporal-polyfill/global";
import { useState, useEffect, useRef } from "react";

interface DateRange {
  start: string; // YYYY-MM-DD
  end: string; // YYYY-MM-DD
}

const CALENDAR_COLORS = [
  { name: "color0", light: { main: "#3b82f6", container: "#dbeafe", onContainer: "#1e3a5f" }, dark: { main: "#3b82f6", container: "#1e3a5f", onContainer: "#dbeafe" } },
  { name: "color1", light: { main: "#a855f7", container: "#f3e8ff", onContainer: "#4a1d6e" }, dark: { main: "#a855f7", container: "#4a1d6e", onContainer: "#f3e8ff" } },
  { name: "color2", light: { main: "#22c55e", container: "#dcfce7", onContainer: "#166534" }, dark: { main: "#22c55e", container: "#166534", onContainer: "#dcfce7" } },
  { name: "color3", light: { main: "#f59e0b", container: "#fef3c7", onContainer: "#78350f" }, dark: { main: "#f59e0b", container: "#78350f", onContainer: "#fef3c7" } },
  { name: "color4", light: { main: "#ec4899", container: "#fce7f3", onContainer: "#701a3e" }, dark: { main: "#ec4899", container: "#701a3e", onContainer: "#fce7f3" } },
  { name: "color5", light: { main: "#14b8a6", container: "#ccfbf1", onContainer: "#134e4a" }, dark: { main: "#14b8a6", container: "#134e4a", onContainer: "#ccfbf1" } },
  { name: "color6", light: { main: "#ef4444", container: "#fee2e2", onContainer: "#7f1d1d" }, dark: { main: "#ef4444", container: "#7f1d1d", onContainer: "#fee2e2" } },
  { name: "color7", light: { main: "#6366f1", container: "#e0e7ff", onContainer: "#312e81" }, dark: { main: "#6366f1", container: "#312e81", onContainer: "#e0e7ff" } },
];

const PENDING_CALENDAR = {
  name: "pending",
  light: { main: "#94a3b8", container: "#f1f5f9", onContainer: "#334155" },
  dark: { main: "#94a3b8", container: "#334155", onContainer: "#f1f5f9" },
};

interface DateCalendarProps {
  selectedDates: string[]; // YYYY-MM-DD[] — rendered as individual day markers
  dateRanges?: DateRange[]; // when provided, rendered as spanning multi-day events
  onClickDate: (date: string) => void;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
}

export function DateCalendar({ selectedDates, dateRanges, onClickDate, minDate, maxDate }: DateCalendarProps) {
  const [eventsService] = useState(() => createEventsServicePlugin());
  const containerRef = useRef<HTMLDivElement>(null);
  const minDateRef = useRef(minDate);
  const maxDateRef = useRef(maxDate);
  minDateRef.current = minDate;
  maxDateRef.current = maxDate;

  const onClickDateRef = useRef(onClickDate);
  onClickDateRef.current = onClickDate;

  const calendar = useCalendarApp({
    views: [createViewMonthGrid()],
    events: [],
    plugins: [eventsService],
    callbacks: {
      onClickDate: (date: Temporal.PlainDate) => {
        const dateStr = date.toString();
        if (minDateRef.current && dateStr < minDateRef.current) return;
        if (maxDateRef.current && dateStr > maxDateRef.current) return;
        onClickDateRef.current(dateStr);
      },
    },
    calendars: {
      selected: {
        colorName: "selected",
        lightColors: { main: "#22c55e", container: "#dcfce7", onContainer: "#166534" },
        darkColors: { main: "#22c55e", container: "#166534", onContainer: "#dcfce7" },
      },
      ...Object.fromEntries(
        CALENDAR_COLORS.map((c) => [
          c.name,
          { colorName: c.name, lightColors: c.light, darkColors: c.dark },
        ]),
      ),
      [PENDING_CALENDAR.name]: {
        colorName: PENDING_CALENDAR.name,
        lightColors: PENDING_CALENDAR.light,
        darkColors: PENDING_CALENDAR.dark,
      },
    },
  });

  // Sync selected dates/ranges into the calendar events service
  useEffect(() => {
    const events: Array<{
      id: string;
      title: string;
      start: Temporal.PlainDate;
      end: Temporal.PlainDate;
      calendarId: string;
    }> = [];

    if (dateRanges) {
      // Each range/day gets its own color from the palette
      dateRanges.forEach((range, i) => {
        const colorId = CALENDAR_COLORS[i % CALENDAR_COLORS.length].name;
        events.push({
          id: `range-${i}`,
          title: range.start === range.end ? "✓" : "⇿",
          start: Temporal.PlainDate.from(range.start),
          end: Temporal.PlainDate.from(range.end),
          calendarId: colorId,
        });
      });
      // Pending range start gets a distinct muted color
      const coveredDates = new Set(
        dateRanges.flatMap((r) => {
          const dates: string[] = [];
          let current = Temporal.PlainDate.from(r.start);
          const end = Temporal.PlainDate.from(r.end);
          while (Temporal.PlainDate.compare(current, end) <= 0) {
            dates.push(current.toString());
            current = current.add({ days: 1 });
          }
          return dates;
        }),
      );
      selectedDates
        .filter((d) => !coveredDates.has(d))
        .forEach((date, i) => {
          events.push({
            id: `single-${i}`,
            title: "→",
            start: Temporal.PlainDate.from(date),
            end: Temporal.PlainDate.from(date),
            calendarId: PENDING_CALENDAR.name,
          });
        });
    } else {
      // Flat date list — original behavior
      selectedDates.forEach((date, i) => {
        events.push({
          id: String(i),
          title: "✓",
          start: Temporal.PlainDate.from(date),
          end: Temporal.PlainDate.from(date),
          calendarId: "selected",
        });
      });
    }

    eventsService.set(events);
  }, [selectedDates, dateRanges, eventsService]);

  // Gray out dates outside the allowed range
  useEffect(() => {
    if (!containerRef.current || (!minDate && !maxDate)) return;

    const applyDisabledStyles = () => {
      const el = containerRef.current;
      if (!el) return;
      const dayCells = el.querySelectorAll<HTMLElement>(".sx__month-grid-day");
      for (const cell of dayCells) {
        const dateAttr = cell.getAttribute("data-date");
        if (!dateAttr) continue;
        const isOutOfRange =
          (minDate && dateAttr < minDate) || (maxDate && dateAttr > maxDate);
        if (isOutOfRange) {
          cell.style.opacity = "0.3";
          cell.style.pointerEvents = "none";
        } else {
          cell.style.opacity = "";
          cell.style.pointerEvents = "";
        }
      }
    };

    applyDisabledStyles();
    const observer = new MutationObserver(applyDisabledStyles);
    observer.observe(containerRef.current, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [minDate, maxDate]);

  return (
    <div className="sx-date-calendar" ref={containerRef}>
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
