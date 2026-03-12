import { useCalendarApp, ScheduleXCalendar } from "@schedule-x/react";
import { createViewMonthGrid } from "@schedule-x/calendar";
import { createEventsServicePlugin } from "@schedule-x/events-service";
import "@schedule-x/theme-default/dist/index.css";
import "temporal-polyfill/global";
import { useState, useEffect } from "react";

interface DateCalendarProps {
  selectedDates: string[]; // YYYY-MM-DD[]
  onClickDate: (date: string) => void;
}

export function DateCalendar({ selectedDates, onClickDate }: DateCalendarProps) {
  const [eventsService] = useState(() => createEventsServicePlugin());

  const calendar = useCalendarApp({
    views: [createViewMonthGrid()],
    events: [],
    plugins: [eventsService],
    callbacks: {
      onClickDate: (date: Temporal.PlainDate) => {
        onClickDate(date.toString());
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

  return (
    <div className="sx-date-calendar">
      <ScheduleXCalendar calendarApp={calendar} />
    </div>
  );
}
