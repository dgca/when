# Availability Mode Design

When currently supports a "poll" mode where a creator defines time options and participants vote on them. This spec adds an "availability" mode where participants submit their own free-form availability and the system surfaces overlaps.

## Data Model

### Plans table changes

Two new columns on `plans`:

- `mode` — text, `"poll"` | `"availability"`, default `"poll"`
- `dateRangeStart` — text, optional, `"YYYY-MM-DD"` — start of allowed date range (availability mode)
- `dateRangeEnd` — text, optional, `"YYYY-MM-DD"` — end of allowed date range (availability mode)

Two separate text columns rather than a JSON blob, consistent with the rest of the schema.

### New table: `availabilitySlots`

| Column       | Type    | Notes                              |
|-------------|---------|-------------------------------------|
| id          | text PK | nanoid                              |
| responseId  | text FK | → responses.id                      |
| date        | text    | YYYY-MM-DD                          |
| startHour   | integer | 0–23                                |
| startMinute | integer | 0 or 30 (aligned to 30-min buckets) |
| endHour     | integer | 0–24 (24 = midnight end-of-day)     |
| endMinute   | integer | 0 or 30                             |

Each row is one time range submitted by a participant. A response in availability mode has zero or more `availabilitySlots` (instead of `responseSelections` used in poll mode).

Minutes are constrained to 0 or 30 to align with the 30-minute bucket grid used by the best-times algorithm and the TimeSlotPicker UI.

**Midnight-crossing slots:** Not supported. A range cannot cross midnight (endHour < startHour is invalid). If someone is available 10 PM – 1 AM, they submit two slots: 10 PM – 12 AM on day 1, and 12 AM – 1 AM on day 2. The TimeSlotPicker already enforces this naturally since each day view is independent.

**Update strategy:** On response update, delete all existing `availabilitySlots` for the response and re-insert, matching the existing delete-and-replace pattern used for `responseSelections`.

### Unchanged

The `responses` table is unchanged — it still represents one participant per row with a name and edit token. The `options` and `responseSelections` tables are unchanged and only used in poll mode.

### Timezone

All availability slots are interpreted in the plan's `timezone`. The `date`, `startHour`, `startMinute`, `endHour`, `endMinute` fields are local to that timezone. The best-times algorithm output uses the same timezone. The client renders times using the plan's timezone.

## Creator Flow

The create page (`/`) gets a mode selector (tabs or radio) at the top:

- **Poll mode** — exactly as today: title, description, calendar + time slot picker, submit.
- **Availability mode** — simplified: title, description (optional), optional date range constraint ("Limit to dates between ___ and ___"). No time options. Hit create, get share link.

## Participant Page — Availability Mode

When a participant opens `/p/:planId` for an availability-mode plan:

### Top section
Plan title, description, and date range if set.

### Add your availability
1. Enter name
2. Use the existing calendar + time slot picker (same DateCalendar + TimeSlotPicker components)
3. In availability mode, the calendar constrains to the plan's date range if one is set, and only allows future dates
4. Submit → receives edit token stored in localStorage (`when-edit-{planId}`)
5. Can return and edit using stored token

### Everyone's availability (visible immediately)

**Calendar view:** DateCalendar highlights dates that have any submitted availability. Clicking a date opens a read-only day view showing each participant's time ranges as colored horizontal bars, stacked by person and labeled with names.

**Best times summary:** Sorted list of time windows where the most people overlap. Each entry shows:
- Time range (e.g., "Tue Mar 17, 2–4 PM")
- Participant count and names (e.g., "4/5: Alice, Bob, Carol, Dan")
- Sorted by participant count descending, then duration descending
- Minimum 2 participants to appear in the list
- Capped at 10 results to avoid noise with fragmented availability

## Admin Page — Availability Mode

Same as current admin page with minor adaptations:
- Edit title/description
- Copy share link
- Close plan
- Results view shows the same "Everyone's availability" section (calendar view + best times summary)
- No time options to manage (those are poll-mode only)
- Poll-only endpoints (e.g., adding options) reject with 400 if plan mode is `"availability"`

## API Changes

### Modified endpoints

**POST /api/plans** — `createPlanSchema` updated:
- New field: `mode` (`"poll"` | `"availability"`, required)
- New fields: `dateRangeStart`, `dateRangeEnd` (optional, only accepted when mode is `"availability"`)
- `options` array required only when `mode === "poll"`
- Extra fields for the wrong mode are rejected (e.g., `options` on availability plan → 400)

**GET /api/plans/:planId** — response includes `mode`, `dateRangeStart`, `dateRangeEnd`.

**POST /api/plans/:planId/responses** — request body varies by plan mode:
- Poll mode: `{ participantName, selections }` (unchanged)
- Availability mode: `{ participantName, availabilitySlots }` where each slot is `{ date, startHour, startMinute, endHour, endMinute }`
- Server validates the request body against the plan's mode. Sending `selections` for an availability plan (or vice versa) → 400.

**PUT /api/plans/:planId/responses/:responseId** — same pattern. Availability mode: delete existing slots, insert new ones.

**GET /api/plans/:planId/results** — response varies by mode:
- Poll mode: unchanged (responses with selections, optionSummary)
- Availability mode: responses with their slots, plus `bestTimes` array

### Validation strategy

The route handlers look up the plan's mode, then select the appropriate Zod schema for request validation. Two separate schemas (poll response vs. availability response) rather than a discriminated union, since the mode comes from the plan, not the request body.

### Best times algorithm

1. Discretize all availability slots into 30-minute buckets keyed by (date, hour, minute)
2. For each bucket, record which participant names are present
3. Group contiguous buckets on the same date with the identical participant set
4. Merge into time ranges
5. Filter to ranges with >= 2 participants
6. Return top 10, sorted: most participants first, then longest duration first

## Shared Schemas

New Zod schemas:
- `availabilitySlotSchema` — `{ date: string, startHour: 0-23, startMinute: 0|30, endHour: 0-24, endMinute: 0|30 }` with refinements: start < end, and endHour=24 requires endMinute=0
- `createPlanSchema` updated — two variants: poll (requires options, no dateRange) and availability (no options, optional dateRange)
- `createAvailabilityResponseSchema` — `{ participantName, availabilitySlots: availabilitySlotSchema[] }`
- `updateAvailabilityResponseSchema` — `{ participantName?, availabilitySlots: availabilitySlotSchema[] }`

Existing poll response schemas remain unchanged.

New TypeScript types:
- `AvailabilitySlot` — `{ date, startHour, startMinute, endHour, endMinute }`
- `BestTime` — `{ date, startHour, startMinute, endHour, endMinute, participants: string[] }`
- `PlanSummary` updated — add `mode`, `dateRangeStart?`, `dateRangeEnd?`
- `ParticipantResponse` — availability variant returns `availabilitySlots` instead of `selections`
- `PlanResults` updated — add optional `bestTimes: BestTime[]` (present when mode is availability)

## UI Component Reuse

The availability mode reuses:
- `DateCalendar` — for both selecting dates and viewing aggregate availability
- `TimeSlotPicker` — for participants to draw their time ranges
- The day view for showing stacked participant bars is new but builds on TimeSlotPicker's rendering patterns

## Constraints

- Only future dates are selectable in the UI (soft constraint, not enforced server-side)
- Date range on the plan is optional; when set, the calendar and date validation respect it
- Edit tokens stored in localStorage, same pattern as poll mode
- Minutes constrained to 0 or 30 (enforced in Zod schema and UI)
- No midnight-crossing slots; split across two dates instead
