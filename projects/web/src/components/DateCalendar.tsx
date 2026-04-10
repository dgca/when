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
        lightColors: {
          main: "#22c55e",
          container: "#dcfce7",
          onContainer: "#166534",
        },
        darkColors: {
          main: "#22c55e",
          container: "#166534",
          onContainer: "#dcfce7",
        },
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
      // Render multi-day ranges as spanning events
      dateRanges.forEach((range, i) => {
        events.push({
          id: `range-${i}`,
          title: range.start === range.end ? "✓" : "⇿",
          start: Temporal.PlainDate.from(range.start),
          end: Temporal.PlainDate.from(range.end),
          calendarId: "selected",
        });
      });
      // Also render any selectedDates not covered by ranges (e.g. pending range start)
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
            calendarId: "selected",
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
