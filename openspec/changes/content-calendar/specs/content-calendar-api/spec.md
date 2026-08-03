# Content Calendar API Specification

## Purpose

Defines the CRUD/generation HTTP surface for `ContentCalendar` and
`ContentEntry`: authentication and ownership scoping, the `draft →
confirmed → synced` status lifecycle and its transition guards, regeneration
semantics, entry editing, and delete rules. Generation behavior itself
(agent internals, soft gate, RAG degradation) belongs to
`content-calendar-generation`; this capability owns the request/response
contract and persistence rules around it.

## Requirements

### Requirement: Authentication and Ownership Scoping

Every calendar endpoint MUST require authentication. Every calendar query
and mutation MUST be scoped to the authenticated user's own `user_id`
derived from the verified token, never from a client-supplied identifier. A
request targeting a calendar or entry that exists but belongs to a different
user MUST be treated identically to a non-existent resource.

#### Scenario: No token

- GIVEN a request to any calendar endpoint with no valid auth token
- WHEN the request is made
- THEN the response status is `401` and no data is read or written

#### Scenario: Cannot access another user's calendar

- GIVEN two distinct authenticated users, A and B, each with their own
  `ContentCalendar` rows
- WHEN user A requests, updates, confirms, or deletes any calendar or entry
  belonging to user B
- THEN the response status is `404`, and user B's data is unaffected and
  never returned in the response body

#### Scenario: List returns only the caller's calendars

- GIVEN two distinct authenticated users, A and B, each with calendars
- WHEN user A requests their calendar list
- THEN the response contains only user A's calendars, newest first, and
  none of user B's

### Requirement: Calendar Generation Endpoint

`POST /api/calendar/generate` MUST accept a `period` (required, one of
`current_week`, `next_week`, `month`), optional `frequency` (1-14), optional
`formats` (map of closed format literals to counts), and optional
`calendar_id` (targets an existing `draft` calendar for regeneration in
place). On success it MUST return the created or updated calendar together
with its entries. It MUST NOT stream partial results; the full response is
returned only once generation completes.

#### Scenario: Generation without `calendar_id` creates a new calendar

- GIVEN an authenticated user with a complete profile
- WHEN the user calls generate without `calendar_id`
- THEN a new `ContentCalendar` row is created with `status: "draft"` and its
  generated `ContentEntry` rows, returned in the response

#### Scenario: Generation with `calendar_id` regenerates a draft in place

- GIVEN an authenticated user with an existing calendar whose `status` is
  `"draft"`
- WHEN the user calls generate with `calendar_id` set to that calendar's id
- THEN that calendar's existing entries are replaced by the newly generated
  entries, the same `ContentCalendar` row is reused, and `status` remains
  `"draft"`

#### Scenario: Regenerating a non-draft calendar is rejected

- GIVEN an authenticated user with an existing calendar whose `status` is
  `"confirmed"` or `"synced"`
- WHEN the user calls generate with that calendar's id as `calendar_id`
- THEN the response status is `409` and no entries are changed

#### Scenario: `calendar_id` targeting another user's calendar

- GIVEN an authenticated user A and a `draft` calendar belonging to user B
- WHEN user A calls generate with `calendar_id` set to user B's calendar id
- THEN the response status is `404` and no entries are changed

#### Scenario: Invalid request body is rejected

- GIVEN a generation request with an invalid `period` value or a `formats`
  key outside the closed format set
- WHEN the request is validated
- THEN the response status is `422` and no calendar or entry row is created
  or modified

#### Scenario: No streaming

- GIVEN a valid generation request
- WHEN the request is processed
- THEN the client receives one complete JSON response after generation
  finishes, not a sequence of partial/streamed events

### Requirement: Calendar List and Detail Retrieval

`GET /api/calendars` MUST return the caller's calendars, newest first,
without their entries. `GET /api/calendars/{id}` MUST return a single
calendar including its entries, scoped to the caller.

#### Scenario: Detail includes entries

- GIVEN an authenticated user with a calendar containing entries
- WHEN the user requests that calendar's detail
- THEN the response includes the calendar's fields and its full list of
  entries

#### Scenario: Detail for unknown id

- GIVEN an authenticated user
- WHEN the user requests a calendar id that does not exist
- THEN the response status is `404`

### Requirement: Calendar Status Lifecycle

`ContentCalendar.status` MUST progress `draft → confirmed → synced` and
MUST NOT skip or reverse states through this API. `POST
/api/calendars/{id}/confirm` MUST transition a calendar from `draft` to
`confirmed` and MUST be rejected when the calendar is not currently
`draft`. Transition to `synced` is out of scope for this API surface (it is
written elsewhere, by the not-yet-built sync callback path).

#### Scenario: Confirm a draft calendar

- GIVEN an authenticated user with a calendar whose `status` is `"draft"`
- WHEN the user confirms that calendar
- THEN the response status is `200`, the calendar's `status` becomes
  `"confirmed"`, and the change is persisted

#### Scenario: Confirming twice is rejected

- GIVEN an authenticated user with a calendar whose `status` is already
  `"confirmed"`
- WHEN the user confirms that calendar again
- THEN the response status is `409` and `status` remains `"confirmed"`

#### Scenario: Confirming a synced calendar is rejected

- GIVEN an authenticated user with a calendar whose `status` is `"synced"`
- WHEN the user attempts to confirm that calendar
- THEN the response status is `409` and `status` remains `"synced"`

### Requirement: Entry Editing Independent of Calendar Status

`PUT /api/calendars/{id}/entries/{entry_id}` MUST accept a partial update to
an entry's editable fields (including `status`, one of `idea`, `drafted`,
`recorded`, `published`) and MUST succeed regardless of the parent
calendar's status (`draft`, `confirmed`, or `synced`).

#### Scenario: Editing an entry on a draft calendar

- GIVEN an authenticated user with a `draft` calendar containing an entry
- WHEN the user updates that entry's `title`
- THEN the response status is `200` and the entry's `title` is updated

#### Scenario: Editing an entry on a confirmed calendar

- GIVEN an authenticated user with a `confirmed` calendar containing an
  entry
- WHEN the user updates that entry's `status` to `"recorded"`
- THEN the response status is `200` and the entry's `status` is updated,
  with no change to the parent calendar's `status`

#### Scenario: Editing an entry that does not exist

- GIVEN an authenticated user with an existing calendar
- WHEN the user updates an entry id that does not belong to that calendar
- THEN the response status is `404`

#### Scenario: Invalid entry field value

- GIVEN an authenticated user with an existing entry
- WHEN the user submits an update with `status` outside the closed set of
  `idea`, `drafted`, `recorded`, `published`, or `format`/`platform` outside
  their closed literal sets
- THEN the response status is `422` and the entry is unchanged

### Requirement: Calendar Deletion Rules

`DELETE /api/calendars/{id}` MUST be allowed when the calendar's `status` is
`draft` or `confirmed`, and MUST be rejected with `409` when the calendar's
`status` is `synced`.

#### Scenario: Deleting a draft calendar

- GIVEN an authenticated user with a calendar whose `status` is `"draft"`
- WHEN the user deletes that calendar
- THEN the response status is `204` and the calendar and its entries are
  removed

#### Scenario: Deleting a confirmed calendar

- GIVEN an authenticated user with a calendar whose `status` is
  `"confirmed"`
- WHEN the user deletes that calendar
- THEN the response status is `204` and the calendar and its entries are
  removed

#### Scenario: Deleting a synced calendar is rejected

- GIVEN an authenticated user with a calendar whose `status` is `"synced"`
- WHEN the user attempts to delete that calendar
- THEN the response status is `409` and the calendar and its entries remain

#### Scenario: Deleting an unknown or unowned calendar

- GIVEN an authenticated user
- WHEN the user deletes a calendar id that does not exist or belongs to
  another user
- THEN the response status is `404`
