import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewMonthGrid } from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "@schedule-x/theme-default/dist/index.css";
import "temporal-polyfill/global";
import { useState, useEffect, useRef } from "react";

interface DateCalendarProps {
  selectedDates: string[]; // YYYY-MM-DD[]
  onClickDate: (date: string) => void;
  minDate?: string; // YYYY-MM-DD
  maxDate?: string; // YYYY-MM-DD
}

export function DateCalendar({ selectedDates, onClickDate, minDate, maxDate }: DateCalendarProps) {
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

  // Sync selected dates into the calendar events service
  useEffect(() => {
    eventsService.set(
      selectedDates.map((date, i) => ({
        id: String(i),
        title: "✓",
        start: Temporal.PlainDate.from(date),
        end: Temporal.PlainDate.from(date),
        calendarId: "selected",
      })),
    );
  }, [selectedDates, eventsService]);

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
