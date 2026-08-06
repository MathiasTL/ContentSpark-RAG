# Content Calendar Generation Specification — Delta (creator-timezone)

**Base spec target (resolve at apply/archive time):**
`content-calendar` (Fase 3) is complete (49/49 tasks) but is NOT yet
archived/promoted as of this writing. Its capability spec therefore still
lives at `openspec/changes/content-calendar/specs/content-calendar-generation/spec.md`
rather than under `openspec/specs/`. This delta targets that file's
`Requirement: Entries Scheduled Within the Requested Period` as it exists
today.

If `content-calendar` is archived (promoted to
`openspec/specs/content-calendar-generation/spec.md`) before this change is
applied or archived, `sdd-apply`/`sdd-archive` MUST retarget this delta's
merge onto the promoted file instead — the requirement text and scenarios
below are unchanged either way; only the merge destination differs. Do NOT
edit the frozen `content-calendar` change's spec file in place under any
circumstance; this delta file is the only writable artifact for this
change.

## MODIFIED Requirements

### Requirement: Entries Scheduled Within the Requested Period

The system MUST map each optimized idea onto an actual calendar date that
falls within the requested `period` (`current_week`, `next_week`, or
`month`). The period's boundaries MUST be resolved against the requesting
creator's own local date, derived from `CreatorProfile.timezone`
(`datetime.now(ZoneInfo(profile.timezone)).date()`), not the date on which
the application server happens to be running. When the creator's profile
has no stored `timezone` (`NULL`), the system MUST resolve the period
against UTC instead of the server's local timezone. A missing `timezone`
MUST NOT block generation and MUST NOT be added to the profile completion
soft gate's required fields.

#### Scenario: Entries fall within the requested period

- GIVEN a generation request with `period: "next_week"`
- WHEN entries are scheduled
- THEN every generated entry's date falls within the seven days of next
  week, none outside it

#### Scenario: Period resolves against the creator's timezone, not the server's

- GIVEN a creator whose profile `timezone` is
  `"America/Argentina/Buenos_Aires"` (UTC-3), and the server's own clock and
  the creator's wall-clock time together straddle midnight UTC such that
  the creator's local calendar date is one day behind the server's UTC date
  (e.g. server UTC time is `2026-08-05T01:30:00Z`, so the creator's local
  time is `2026-08-04T22:30:00-03:00`)
- WHEN the creator requests `period: "current_week"`
- THEN the resolved period boundaries are computed from the creator's local
  date (`2026-08-04`), not the server's UTC date (`2026-08-05`), and
  generated entries are scheduled accordingly

#### Scenario: NULL timezone falls back to UTC, not server-local

- GIVEN a creator whose profile `timezone` is `NULL`
- WHEN the creator requests calendar generation for any `period`
- THEN the period boundaries are resolved using
  `datetime.now(ZoneInfo("UTC")).date()`, generation is not blocked, and no
  409 is raised on account of the missing timezone

#### Scenario: Missing timezone does not extend the completion soft gate

- GIVEN a creator whose profile is complete under the existing
  `creator-profile` completion contract (`niche`, `primary_goal`, `tone`,
  `target_audience` all set) but whose `timezone` is `NULL`
- WHEN the creator requests calendar generation
- THEN the request passes the `Requirement: Profile Completion Soft Gate`
  check and generation proceeds, resolving the period against UTC

## Non-Modified Requirements (explicitly unaffected)

`Requirement: Profile Completion Soft Gate`,
`Requirement: Frequency Resolution with Niche Fallback`,
`Requirement: Format Resolution with Profile and Default Fallback`,
`Requirement: RAG Context Degrades Gracefully`,
`Requirement: Structured Idea Generation`, and
`Requirement: Deterministic Distribution Constraints` are NOT modified by
this change.
