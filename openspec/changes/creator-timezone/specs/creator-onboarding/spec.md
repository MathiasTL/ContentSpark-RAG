# Creator Onboarding Specification — Delta (creator-timezone)

Base spec: `openspec/specs/creator-onboarding/spec.md` (promoted).

## MODIFIED Requirements

### Requirement: Multi-Step Wizard Form

The system MUST present onboarding as a multi-step form wizard (4-5 steps),
not a conversational/chat-based flow. The wizard MUST collect, at minimum,
the four fields required for completion (`niche`, `primary_goal`, `tone`,
`target_audience`) across its steps, and MAY collect optional fields
(`display_name`, `bio`, `sub_niche`, `current_frequency`,
`desired_frequency`, `preferred_formats`, social accounts) in the same flow.

The wizard's final submission payload MUST additionally include `timezone`,
populated from the browser's `Intl.DateTimeFormat().resolvedOptions().timeZone`
at submit time. This detection and inclusion MUST be silent: the system MUST
NOT add a wizard step, form field, confirmation dialog, or any other
user-facing prompt to ask the creator about their timezone. The wizard step
count MUST remain unchanged by this addition.

#### Scenario: Wizard collects required fields

- GIVEN an authenticated user going through the onboarding wizard
- WHEN the user completes all wizard steps and submits
- THEN `niche`, `primary_goal`, `tone`, and `target_audience` have all been
  captured and submitted to profile creation

#### Scenario: Wizard is not conversational

- GIVEN a user starting onboarding
- THEN the flow presents a sequence of form steps with discrete fields,
  not a free-text chat/agent interaction

#### Scenario: Submission includes a browser-detected timezone

- GIVEN an authenticated user whose browser resolves
  `Intl.DateTimeFormat().resolvedOptions().timeZone` to
  `"America/Argentina/Buenos_Aires"`
- WHEN the user completes all wizard steps and submits
- THEN the submitted profile-creation payload includes
  `timezone: "America/Argentina/Buenos_Aires"`

#### Scenario: Timezone detection adds no step or question

- GIVEN a user going through the onboarding wizard
- WHEN the user progresses through every step up to and including
  submission
- THEN at no point is the user shown a field, step, or dialog asking them to
  confirm, select, or review a timezone, and the wizard's step count is
  unchanged from before this capability existed

## Non-Modified Requirements (explicitly unaffected)

`Requirement: Frequency Recommendation Fallback`,
`Requirement: Completion-Based Routing`,
`Requirement: Onboarding Route Exemption`, and
`Requirement: Successful Completion Exits the Wizard` are NOT modified by
this change. Completion-based routing continues to derive solely from
`GET /api/profile/status`, which is unaffected by `timezone` (see the
`creator-profile` delta: `timezone` is not part of the completion
determination).
