# Creator Onboarding Specification

## Purpose

Defines the first-run wizard flow that collects the fields required by the
`creator-profile` completion contract, and the routing behavior that sends
an authenticated user with an incomplete profile to that wizard. Onboarding
has no state of its own — it reads and writes through the `creator-profile`
capability and relies solely on its completion contract.

## Requirements

### Requirement: Multi-Step Wizard Form

The system MUST present onboarding as a multi-step form wizard (4-5 steps),
not a conversational/chat-based flow. The wizard MUST collect, at minimum,
the four fields required for completion (`niche`, `primary_goal`, `tone`,
`target_audience`) across its steps, and MAY collect optional fields
(`display_name`, `bio`, `sub_niche`, `current_frequency`,
`desired_frequency`, `preferred_formats`, social accounts) in the same flow.

#### Scenario: Wizard collects required fields

- GIVEN an authenticated user going through the onboarding wizard
- WHEN the user completes all wizard steps and submits
- THEN `niche`, `primary_goal`, `tone`, and `target_audience` have all been
  captured and submitted to profile creation

#### Scenario: Wizard is not conversational

- GIVEN a user starting onboarding
- THEN the flow presents a sequence of form steps with discrete fields,
  not a free-text chat/agent interaction

### Requirement: Frequency Recommendation Fallback

Frequency fields (`current_frequency`, `desired_frequency`) MUST NOT be
required to finish the wizard. When the user leaves them unset, the system
MUST derive a recommended value from `FREQUENCY_RECOMMENDATIONS[niche]` for
display/suggestion purposes once `niche` is known. Leaving them unset MUST
NOT block wizard completion or profile-completion status.

#### Scenario: User skips frequency fields

- GIVEN a user who has selected a `niche` and left frequency fields blank
- WHEN the user finishes the wizard
- THEN the profile is created successfully and completion status is
  unaffected by the absent frequency values

#### Scenario: Recommendation shown once niche is known

- GIVEN a user who has selected a `niche` in the wizard
- WHEN the frequency step is reached
- THEN a recommended frequency derived from
  `FREQUENCY_RECOMMENDATIONS[niche]` is available to the user as a
  suggestion, not a forced value

### Requirement: Completion-Based Routing

The system MUST derive first-run routing solely from the `creator-profile`
completion contract (`GET /api/profile/status`) — never from a locally
re-implemented completeness check. An authenticated user whose profile is
incomplete, navigating into the protected app area, MUST be routed to the
onboarding wizard. An authenticated user whose profile is already complete
MUST NOT be redirected to onboarding.

#### Scenario: Incomplete profile is redirected

- GIVEN an authenticated user whose profile completion status is
  `is_complete: false`
- WHEN the user navigates to a protected app route
- THEN the user is routed to the onboarding wizard

#### Scenario: Complete profile is never redirected

- GIVEN an authenticated user whose profile completion status is
  `is_complete: true`
- WHEN the user navigates to any protected app route
- THEN the user is not redirected to onboarding

### Requirement: Onboarding Route Exemption

The routing guard MUST exempt the onboarding wizard's own route from the
completion redirect, so that an incomplete-profile user landing on the
wizard is not redirected away from (or endlessly back into) it.

#### Scenario: No redirect loop on the onboarding route itself

- GIVEN an authenticated user whose profile completion status is
  `is_complete: false`
- WHEN the user is already on the onboarding wizard route
- THEN the guard does not redirect the user away from or back into that
  route, and the wizard renders normally

### Requirement: Successful Completion Exits the Wizard

Once the wizard submission results in `is_complete: true`, the system MUST
allow the user to proceed into the protected app area without further
onboarding-guard interference.

#### Scenario: Finishing the wizard unlocks the app

- GIVEN a user mid-wizard whose profile is still incomplete
- WHEN the user submits the final step and the resulting profile satisfies
  all four required fields
- THEN the user can navigate to protected app routes without being routed
  back to onboarding
