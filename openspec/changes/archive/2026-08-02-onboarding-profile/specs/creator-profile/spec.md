# Creator Profile Specification

## Purpose

Defines the read/write API for a creator's `CreatorProfile`, its nested
social accounts, and the single derived completion contract that both the
onboarding wizard and the profile editor consume. Completion is computed
from stored field values — it is never stored as a separate flag.

## Requirements

### Requirement: Profile Read

The system MUST expose an endpoint that returns the authenticated user's own
`CreatorProfile`. When no profile row exists yet, the system MUST return a
successful response representing an empty profile (all optional fields
absent/null) rather than a 404, so callers can distinguish "no profile yet"
from "request failed."

#### Scenario: Existing profile is returned

- GIVEN an authenticated user with a `creator_profiles` row
- WHEN the user requests their profile
- THEN the response contains the stored field values for that row only

#### Scenario: No profile yet

- GIVEN an authenticated user with no `creator_profiles` row
- WHEN the user requests their profile
- THEN the response is successful (not 404) with all profile fields empty

### Requirement: Profile Creation and Update

The system MUST allow an authenticated user to create their profile (first
submission, e.g. from the onboarding wizard) and to update it afterward
(partial or full edit). A user MUST have at most one `CreatorProfile` row;
submitting creation input when a row already exists MUST update that row
rather than create a duplicate.

Partial update input MUST only change the fields explicitly supplied and
MUST leave every omitted field at its current stored value.

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

### Requirement: Completion Status Contract

The system MUST expose a single endpoint returning the derived completion
state of the authenticated user's profile: `{ is_complete: bool,
missing_fields: string[] }`. A profile is complete when `niche`,
`primary_goal`, `tone`, and `target_audience` are all non-empty; no other
field affects this determination. `current_frequency` and
`desired_frequency` MUST NOT be required for completion.

This computation MUST exist in exactly one place server-side. No other
component (including the frontend) MAY re-implement or duplicate this rule;
every consumer that needs completion state MUST call this endpoint.

#### Scenario: New user is incomplete

- GIVEN an authenticated user with no `creator_profiles` row
- WHEN the user requests completion status
- THEN `is_complete` is `false` AND `missing_fields` contains all four of
  `niche`, `primary_goal`, `tone`, `target_audience`

#### Scenario: Profile with only some required fields

- GIVEN a profile where `niche` and `tone` are set but `primary_goal` and
  `target_audience` are empty
- WHEN the user requests completion status
- THEN `is_complete` is `false` AND `missing_fields` contains exactly
  `primary_goal` and `target_audience`

#### Scenario: Complete profile

- GIVEN a profile where `niche`, `primary_goal`, `tone`, and
  `target_audience` are all non-empty
- WHEN the user requests completion status
- THEN `is_complete` is `true` AND `missing_fields` is empty, regardless of
  whether frequencies or social accounts are set

### Requirement: Social Accounts as Part of Profile

Social accounts are a nested part of the profile, not a separate onboarding
step or capability. The system MUST allow social accounts to be submitted
together with profile creation/update input and MUST allow zero social
accounts. Social accounts MUST NOT affect the completion contract.

#### Scenario: Profile created without social accounts

- GIVEN an authenticated user submitting profile creation input with no
  social accounts
- THEN the profile is created successfully and completion status is
  unaffected by the absence of social accounts

#### Scenario: Social accounts submitted with profile update

- GIVEN an authenticated user with an existing profile
- WHEN the user submits an update including one or more social accounts
- THEN those social accounts are associated with the user's profile only

### Requirement: Authorization and Ownership

Every profile endpoint MUST require authentication. Every profile query and
mutation MUST be scoped to the authenticated user's own `user_id` derived
from the verified token — never from a client-supplied identifier.

#### Scenario: No token

- GIVEN a request to any profile endpoint with no valid auth token
- WHEN the request is made
- THEN the response status is 401 and no data is read or written

#### Scenario: Cannot access another user's profile

- GIVEN two distinct authenticated users, A and B, each with their own profile
- WHEN user A performs any profile read or write operation
- THEN only user A's own `creator_profiles` row is affected or returned,
  never user B's

### Requirement: Input Validation

The system MUST validate profile input at the API boundary. `niche`,
`primary_goal`, `tone`, and `target_audience` MUST be accepted as strings.
`current_frequency` and `desired_frequency` MUST be accepted as strings
(e.g. `"3 por semana"`), not integers. Malformed input (wrong type, or a
required creation field missing) MUST be rejected with a 422 response and
MUST NOT partially persist.

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
