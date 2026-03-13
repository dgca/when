import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const plans = sqliteTable("plans", {
  id: text("id").primaryKey(),
  adminToken: text("admin_token").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  timezone: text("timezone").notNull(),
  mode: text("mode", { enum: ["poll", "availability"] }).notNull().default("poll"),
  dateRangeStart: text("date_range_start"),
  dateRangeEnd: text("date_range_end"),
  status: text("status", { enum: ["open", "closed"] }).notNull().default("open"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const options = sqliteTable("options", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  label: text("label").notNull(),
  startsAt: text("starts_at").notNull(),
  endsAt: text("ends_at"),
  sortOrder: integer("sort_order").notNull(),
});

export const responses = sqliteTable("responses", {
  id: text("id").primaryKey(),
  planId: text("plan_id")
    .notNull()
    .references(() => plans.id),
  participantName: text("participant_name").notNull(),
  editToken: text("edit_token").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const responseSelections = sqliteTable("response_selections", {
  id: text("id").primaryKey(),
  responseId: text("response_id")
    .notNull()
    .references(() => responses.id),
  optionId: text("option_id")
    .notNull()
    .references(() => options.id),
  value: text("value", { enum: ["yes", "maybe"] }).notNull(),
});

export const availabilitySlots = sqliteTable("availability_slots", {
  id: text("id").primaryKey(),
  responseId: text("response_id")
    .notNull()
    .references(() => responses.id),
  date: text("date").notNull(),
  startHour: integer("start_hour").notNull(),
  startMinute: integer("start_minute").notNull(),
  endHour: integer("end_hour").notNull(),
  endMinute: integer("end_minute").notNull(),
});
