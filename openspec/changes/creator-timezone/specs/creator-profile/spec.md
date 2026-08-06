# Creator Profile Specification — Delta (creator-timezone)

Base spec: `openspec/specs/creator-profile/spec.md` (promoted).

## MODIFIED Requirements

### Requirement: Profile Read

The system MUST expose an endpoint that returns the authenticated user's own
`CreatorProfile`. When no profile row exists yet, the system MUST return a
successful response representing an empty profile (all optional fields
absent/null) rather than a 404, so callers can distinguish "no profile yet"
from "request failed." The returned profile MUST include the `timezone`
field (an IANA timezone name, or `null` when unset).

#### Scenario: Existing profile is returned

- GIVEN an authenticated user with a `creator_profiles` row
- WHEN the user requests their profile
- THEN the response contains the stored field values for that row only

#### Scenario: No profile yet

- GIVEN an authenticated user with no `creator_profiles` row
- WHEN the user requests their profile
- THEN the response is successful (not 404) with all profile fields empty

#### Scenario: Profile with a stored timezone is returned

- GIVEN an authenticated user whose `creator_profiles` row has
  `timezone: "America/Argentina/Buenos_Aires"`
- WHEN the user requests their profile
- THEN the response's `timezone` field is `"America/Argentina/Buenos_Aires"`

#### Scenario: Profile with no timezone returns null

- GIVEN an authenticated user whose `creator_profiles` row has `timezone`
  unset (`NULL`)
- WHEN the user requests their profile
- THEN the response's `timezone` field is `null`, not an empty string and
  not `"UTC"`

### Requirement: Profile Creation and Update

The system MUST allow an authenticated user to create their profile (first
submission, e.g. from the onboarding wizard) and to update it afterward
(partial or full edit). A user MUST have at most one `CreatorProfile` row;
submitting creation input when a row already exists MUST update that row
rather than create a duplicate.

Partial update input MUST only change the fields explicitly supplied and
MUST leave every omitted field at its current stored value.

`timezone` MUST be an optional field on both creation and update input. When
supplied, it MUST be persisted as the given IANA name. When explicitly
supplied as `null` on an update, the stored value MUST be cleared back to
`NULL`. When omitted on an update, the previously stored `timezone` value
MUST be left unchanged.

#### Scenario: First-time creation

- GIVEN an authenticated user with no `creator_profiles` row
- WHEN the user submits `niche`, `primary_goal`, `tone`, and
  `target_audience` (plus any optional fields)
- THEN a `CreatorProfile` row is created for that user with the submitted values

#### Scenario: Partial update preserves other fields

- GIVEN an authenticated user with an existing profile where `tone` is set
- WHEN the user submits an update containing only `bio`
- THEN `bio` is updated and `tone` (and every other previously stored field)
  is unchanged

#### Scenario: Re-submitting onboarding updates, not duplicates

- GIVEN an authenticated user who already completed onboarding once
- WHEN the user submits the onboarding creation input again
- THEN the existing `creator_profiles` row is updated, no second row is created

#### Scenario: Timezone is set on creation

- GIVEN an authenticated user with no `creator_profiles` row
- WHEN the user submits creation input including
  `timezone: "America/Argentina/Buenos_Aires"`
- THEN the created `CreatorProfile` row has that value stored in `timezone`

#### Scenario: Timezone is updated

- GIVEN an authenticated user with an existing profile where
  `timezone: "UTC"`
- WHEN the user submits an update with `timezone: "Europe/Madrid"`
- THEN the stored `timezone` becomes `"Europe/Madrid"`

#### Scenario: Timezone is cleared

- GIVEN an authenticated user with an existing profile where
  `timezone: "Europe/Madrid"`
- WHEN the user submits an update with `timezone: null`
- THEN the stored `timezone` becomes `NULL`

#### Scenario: Omitted timezone on update leaves it unchanged

- GIVEN an authenticated user with an existing profile where
  `timezone: "Europe/Madrid"`
- WHEN the user submits an update containing only `bio` (no `timezone` key)
- THEN the stored `timezone` remains `"Europe/Madrid"`

### Requirement: Input Validation

The system MUST validate profile input at the API boundary. `niche`,
`primary_goal`, `tone`, and `target_audience` MUST be accepted as strings.
`current_frequency` and `desired_frequency` MUST be accepted as strings
(e.g. `"3 por semana"`), not integers. Malformed input (wrong type, or a
required creation field missing) MUST be rejected with a 422 response and
MUST NOT partially persist.

`timezone`, when supplied and non-null, MUST be validated as a member of the
running Python runtime's `zoneinfo.available_timezones()` set. A value that
is not a member of that set MUST be rejected with a 422 response before any
write occurs; the system MUST NOT silently substitute `"UTC"` or any other
value for an invalid `timezone` input.

#### Scenario: String frequency accepted

- GIVEN an authenticated user submitting profile input with
  `current_frequency: "3 por semana"`
- WHEN the profile is created or updated
- THEN the value is persisted as submitted with no coercion error

#### Scenario: Missing required creation field rejected

- GIVEN an authenticated user with no existing profile
- WHEN the user submits creation input missing `niche`
- THEN the response status is 422 and no `creator_profiles` row is created

#### Scenario: Wrong-typed field rejected

- GIVEN an authenticated user submitting `current_frequency` as an integer
- WHEN the request is validated
- THEN the response status is 422

#### Scenario: Valid IANA timezone accepted

- GIVEN an authenticated user submitting profile input with
  `timezone: "America/Argentina/Buenos_Aires"`
- WHEN the profile is created or updated
- THEN the request succeeds and the value is persisted as submitted

#### Scenario: Invalid timezone string rejected

- GIVEN an authenticated user submitting profile input with
  `timezone: "Not/A_Real_Zone"`
- WHEN the request is validated
- THEN the response status is 422, no `creator_profiles` row is created or
  modified, and the stored `timezone` (if any) is unchanged

## Non-Modified Requirements (explicitly unaffected)

`Requirement: Completion Status Contract` is NOT modified by this change.
`timezone` MUST NOT be added to the four fields (`niche`, `primary_goal`,
`tone`, `target_audience`) that determine `is_complete`, and MUST NOT appear
in `missing_fields`.
