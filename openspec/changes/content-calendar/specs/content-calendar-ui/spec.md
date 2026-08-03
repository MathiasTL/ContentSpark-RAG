# Content Calendar UI Specification

## Purpose

Defines the `/calendar` frontend experience: the soft-gate empty state, the
generation configuration control, real-data rendering of the timeline and
grid, and entry editing — all backed by `content-calendar-api`. This
capability owns presentation and client-side wiring only; it does not define
server behavior, which belongs to `content-calendar-api` and
`content-calendar-generation`.

## Requirements

### Requirement: Calendar Page Accessible Without a Complete Profile

The `/calendar` route MUST remain reachable by an authenticated user
regardless of profile completion status (the `allowWithoutOnboarding`
exemption in the route guard is a deliberate part of this capability, not
route-guard drift). The page MUST NOT redirect such a user to onboarding on
load.

#### Scenario: Incomplete-profile user can open the calendar page

- GIVEN an authenticated user whose profile completion status is
  `is_complete: false`
- WHEN the user navigates to `/calendar`
- THEN the page renders without being redirected to `/onboarding`

### Requirement: Empty State with Onboarding CTA

When the authenticated user has no calendars, or their profile is
incomplete, the calendar page MUST render an empty state instead of
attempting generation, including a call-to-action that navigates to
`/onboarding`.

#### Scenario: No calendars yet

- GIVEN an authenticated user with a complete profile and zero calendars
- WHEN the user opens `/calendar`
- THEN the page shows an empty state (not a blank/broken timeline or grid)
  offering to generate a calendar

#### Scenario: Incomplete profile shows onboarding CTA

- GIVEN an authenticated user whose profile is incomplete
- WHEN the user opens `/calendar`
- THEN the page shows an empty state with a CTA linking to `/onboarding`,
  and does not attempt to call the generation endpoint automatically

#### Scenario: Generation request rejected by the soft gate surfaces the CTA

- GIVEN an authenticated user whose profile is incomplete
- WHEN the user triggers calendar generation and the backend responds `409`
  with `missing_fields`
- THEN the page shows the empty state with the onboarding CTA instead of a
  generic error, and does not crash or show a blank screen

### Requirement: Generation Configuration Control

The calendar page MUST provide a control for the user to configure and
trigger generation: a period selector (`current_week`, `next_week`,
`month`), and optional frequency/format inputs, submitting to the
generation endpoint.

#### Scenario: Submitting with only a period

- GIVEN an authenticated user with a complete profile
- WHEN the user selects a period and submits without setting frequency or
  formats
- THEN the generation request is sent with only `period` set, relying on
  server-side fallback for frequency/formats

#### Scenario: Submitting with explicit frequency and formats

- GIVEN an authenticated user with a complete profile
- WHEN the user sets a frequency and a format distribution and submits
- THEN the generation request includes the chosen `frequency` and `formats`
  values

### Requirement: Real-Data Rendering Replaces Mocks

`TimelineCards` and `CalendarGrid` MUST render entries fetched from the
calendar detail endpoint for the active calendar, with no hardcoded sample
arrays or fixed month/date remaining. `CalendarGrid` MUST reflect the
requested period and the live month/week toggle.

#### Scenario: Timeline reflects fetched entries

- GIVEN a confirmed or draft calendar with entries returned by the detail
  endpoint
- WHEN the calendar page renders
- THEN `TimelineCards` shows exactly those entries, not any hardcoded sample
  data

#### Scenario: Grid reflects the current period, not a fixed date

- GIVEN a calendar generated for `period: "month"`
- WHEN the calendar page renders in month view
- THEN `CalendarGrid` displays the actual current month/period, never a
  fixed hardcoded month

### Requirement: Entry Edit Affordance

The calendar page MUST provide an affordance (modal or inline form) to edit
an individual entry's editable fields, wired to the entry update endpoint,
usable regardless of the parent calendar's status.

#### Scenario: Editing an entry updates the displayed data

- GIVEN a rendered calendar with at least one entry
- WHEN the user edits that entry's title or status through the edit
  affordance and saves
- THEN the update request is sent to the entry update endpoint and the
  displayed entry reflects the new value on success

#### Scenario: Entry edit available on a confirmed calendar

- GIVEN a rendered calendar whose status is `"confirmed"`
- WHEN the user opens the edit affordance for one of its entries
- THEN the affordance is available and functional, not disabled because the
  calendar is confirmed
