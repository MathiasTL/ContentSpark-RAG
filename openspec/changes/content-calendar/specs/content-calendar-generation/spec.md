# Content Calendar Generation Specification

## Purpose

Defines the LangGraph agent that turns a creator's profile plus a requested
period/frequency/format mix into a set of calendar entries: the profile
soft-gate that must pass before the agent runs, the frequency/format
fallback rules, RAG-context degradation, structured LLM output, and the
deterministic distribution constraints. This capability owns generation
behavior only — persistence and lifecycle transitions belong to
`content-calendar-api`.

## Requirements

### Requirement: Profile Completion Soft Gate

The system MUST refuse to generate a calendar for a user whose creator
profile is not complete, using the same completion contract defined by
`creator-profile` (`GET /api/profile/status` — `is_complete`,
`missing_fields`). This check MUST run before any LLM call, RAG query, or
database write for the generation request.

#### Scenario: Incomplete profile blocks generation

- GIVEN an authenticated user whose profile completion status is
  `is_complete: false`
- WHEN the user requests calendar generation
- THEN the request is rejected with `409` and a body containing `detail`
  and `missing_fields` (the same field list `creator-profile`'s status
  endpoint would return), and no `ContentCalendar` or `ContentEntry` row is
  created

#### Scenario: Complete profile passes the gate

- GIVEN an authenticated user whose profile completion status is
  `is_complete: true`
- WHEN the user requests calendar generation
- THEN the request proceeds to frequency/format resolution and the agent
  runs

#### Scenario: Soft gate does not block page access

- GIVEN an authenticated user whose profile is incomplete
- WHEN the user navigates to the calendar page (not the generate action)
- THEN the page loads without redirect; only the generation request itself
  is blocked

### Requirement: Frequency Resolution with Niche Fallback

The system MUST resolve a concrete numeric `frequency` before generating
entries. When the request supplies an explicit `frequency`, that value MUST
be used. When the request omits `frequency`, the system MUST derive it from
`FREQUENCY_RECOMMENDATIONS[profile.niche]`. The system MUST NOT attempt to
parse or derive a numeric frequency from `profile.desired_frequency` (a free
text field) under any circumstance.

#### Scenario: Explicit frequency is honored

- GIVEN a generation request with `frequency: 5`
- WHEN the calendar is generated
- THEN exactly 5 entries are produced for the requested period, regardless
  of any value in `profile.desired_frequency` or the niche table

#### Scenario: Omitted frequency falls back to the niche table

- GIVEN a generation request with no `frequency` field, for a profile whose
  `niche` has an entry in `FREQUENCY_RECOMMENDATIONS`
- WHEN the calendar is generated
- THEN the number of generated entries matches
  `FREQUENCY_RECOMMENDATIONS[profile.niche]`

#### Scenario: `desired_frequency` text is never parsed

- GIVEN a generation request with no `frequency` field, for a profile whose
  `desired_frequency` is set to free text (e.g. `"3 por semana"`)
- WHEN the calendar is generated
- THEN the resolved frequency comes only from
  `FREQUENCY_RECOMMENDATIONS[profile.niche]`, never from parsing
  `desired_frequency`

### Requirement: Format Resolution with Profile and Default Fallback

The system MUST resolve a concrete format distribution before generating
entries, in this order: the request's explicit `formats` map, if supplied;
otherwise `profile.preferred_formats`, weighted evenly across the resolved
frequency, if the profile has at least one preferred format; otherwise a
fixed default format mix. Resolved format keys MUST belong to the closed
`FormatLiteral` set.

#### Scenario: Explicit formats are honored

- GIVEN a generation request with an explicit `formats` map
- WHEN the calendar is generated
- THEN the generated entries' format distribution matches the requested map

#### Scenario: Profile preferred formats used when request omits formats

- GIVEN a generation request with no `formats` field, for a profile with a
  non-empty `preferred_formats` list
- WHEN the calendar is generated
- THEN the generated entries are distributed evenly across
  `profile.preferred_formats`

#### Scenario: Default mix used when neither is available

- GIVEN a generation request with no `formats` field, for a profile with an
  empty or absent `preferred_formats`
- WHEN the calendar is generated
- THEN the generated entries use the system's fixed default format mix

### Requirement: RAG Context Degrades Gracefully

The system MUST perform at most one Qdrant query per generation request,
grounded on the resolved niche/sub-niche. If Qdrant is unreachable or
returns no results, the system MUST proceed with an empty RAG context rather
than failing the request.

#### Scenario: Qdrant unavailable does not fail generation

- GIVEN Qdrant is unreachable when a generation request is processed
- WHEN the calendar is generated
- THEN the request still completes successfully with entries produced from
  profile fields alone, and the response is not a 500

#### Scenario: Qdrant returns no results

- GIVEN Qdrant is reachable but the query returns zero matches
- WHEN the calendar is generated
- THEN generation proceeds using an empty RAG context, not an error

#### Scenario: At most one RAG query per request

- GIVEN a generation request producing multiple entries
- WHEN the calendar is generated
- THEN exactly one Qdrant query is issued for the whole request, never one
  per generated entry

### Requirement: Structured Idea Generation

The system MUST generate calendar entry ideas via a single LLM call using
structured output enforcement (a Pydantic schema), not free-text parsing.
The LLM call MUST receive the resolved profile fields, resolved
frequency/format targets, and the RAG context (which may be empty).

#### Scenario: LLM output conforms to the entry schema

- GIVEN a generation request that passes the soft gate
- WHEN the idea-generation step runs
- THEN the produced ideas are valid instances of the entry Pydantic schema
  (each with `title`, `format`, `platform`, `hook`, `description`) before
  any further processing

### Requirement: Deterministic Distribution Constraints

The system MUST enforce two constraints on the final entry set using
deterministic (non-LLM) logic, after idea generation: the total entry count
MUST equal the resolved `frequency`, and no two consecutive entries (ordered
by scheduled date) MAY share the same `format`.

#### Scenario: Entry count matches resolved frequency

- GIVEN a resolved frequency of N for the requested period
- WHEN distribution optimization runs
- THEN the final entry set contains exactly N entries

#### Scenario: No consecutive entries share a format

- GIVEN a set of generated entry ideas that would otherwise place the same
  format on two adjacent scheduled dates
- WHEN distribution optimization runs
- THEN the final ordered entry set has no two adjacent entries with the same
  `format`

### Requirement: Entries Scheduled Within the Requested Period

The system MUST map each optimized idea onto an actual calendar date that
falls within the requested `period` (`current_week`, `next_week`, or
`month`).

#### Scenario: Entries fall within the requested period

- GIVEN a generation request with `period: "next_week"`
- WHEN entries are scheduled
- THEN every generated entry's date falls within the seven days of next
  week, none outside it
