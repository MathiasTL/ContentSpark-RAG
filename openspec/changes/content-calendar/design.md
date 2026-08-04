# Design: Content Calendar Generation

References: `openspec/changes/content-calendar/proposal.md` (LOCKED decisions),
`openspec/changes/content-calendar/exploration.md` (evidence base),
`openspec/changes/archive/2026-08-02-onboarding-profile/design.md` (precedent
this design mirrors in structure and in the `profile_service.py` /
`routers/profile.py` layering).

## 1. Component / Layer Architecture

```
backend/app/
├── agents/
│   ├── shared_state.py         MODIFY — finalize CalendarState (§2)
│   └── calendar_agent.py       MODIFY (from stub) — StateGraph, 6 nodes,
│                                FREQUENCY_RECOMMENDATIONS, DEFAULT_FORMAT_MIX,
│                                GeneratedIdea/GeneratedIdeasList Pydantic models
├── services/
│   └── calendar_service.py     CREATE — CRUD, soft-gate, status-transition
│                                guards, profile narrowing (§3), graph invocation
├── routers/
│   └── calendar.py             MODIFY (from stub) — 6 thin endpoint handlers
├── schemas/
│   └── calendar.py             MODIFY — tightened request/response schemas (§7)
├── models/
│   └── calendar.py             UNCHANGED — already matches target schema
└── main.py                     MODIFY — register `calendar.router`

backend/tests/
├── conftest.py                 MODIFY — add `patch_calendar_service` fixture
├── test_calendar.py            MODIFY (from stub) — router tests
├── test_calendar_service.py    CREATE — CRUD/soft-gate/transition tests
└── test_calendar_agent.py      CREATE — node-level unit tests (mocked LLM/Qdrant)

frontend/features/calendar/
├── services/calendar-api.ts    CREATE — 6 functions + TS interfaces
├── store/calendarStore.ts      CREATE — Zustand: calendars, currentCalendar,
│                                viewMode, isLoading, isGenerating, error
├── hooks/useCalendarGeneration.ts  CREATE — form state (period/frequency/formats)
│                                     wrapping store.generate
├── components/
│   ├── TimelineCards.tsx       MODIFY — real data, entry-edit trigger
│   ├── CalendarGrid.tsx        MODIFY — real data, date-aware, viewMode-aware
│   ├── TopBar.tsx              MODIFY — viewMode reads/writes calendarStore
│   ├── GoogleSyncButton.tsx    UNCHANGED — stays mocked (out of scope)
│   ├── PerformancePanel.tsx    UNCHANGED — stays mocked (out of scope)
│   ├── ActivityPanel.tsx       UNCHANGED — stays mocked (out of scope)
│   ├── CreatorTip.tsx          UNCHANGED — stays mocked (out of scope)
│   ├── GenerateControl.tsx     CREATE (net-new UI) — period/frequency/formats
│   │                            panel + "Generar con AI" trigger
│   ├── EntryEditModal.tsx      CREATE (net-new UI) — edit form, PUT entry
│   ├── ConfirmBar.tsx          CREATE (net-new UI) — status badge + confirm
│   │                            action + delete action
│   └── CalendarEmptyState.tsx  CREATE (net-new UI) — soft-gate CTA to /onboarding
└── CalendarView.tsx            MODIFY — composes new components, loads data

frontend/proxy.ts                MODIFY — inline comment only at line 70
                                  documenting the kept `allowWithoutOnboarding`
                                  bypass (no logic change)
```

## 2. The Unified `CalendarState` Contract

This resolves the three-way conflict `exploration.md:83` flags between
`shared_state.py`, the `calendar_agent.py` comment header, and
`schemas/calendar.py`. It **extends** the proposal's table (`proposal.md:112-125`)
with the fields needed to make `receive_params`/`format_calendar` real —
the proposal explicitly left field-level typing detail to this phase.

```python
# backend/app/agents/shared_state.py — CalendarState (replaces lines 25-34)
class CalendarState(TypedDict):
    user_id: str
    profile: dict                      # narrowed subset, see §3
    calendar_id: str | None            # existing draft being regenerated, else None
    period: Literal["current_week", "next_week", "month"]
    start_date: date                   # resolved from period
    end_date: date                     # resolved from period, inclusive
    frequency: int                     # RESOLVED (Decision 7 fallback already applied)
    formats: dict[str, int]            # RESOLVED format -> count map, sums to frequency
    rag_context: str                   # "" on Qdrant failure/empty result, never None
    raw_ideas: list[dict]              # generate_ideas output, pre-optimization,
                                        # each: {title, format, platform, hook, description}
    calendar_entries: list[dict]       # optimize_distribution/format_calendar output,
                                        # each: {date, time_slot, title, format, platform,
                                        #        hook, description} — ready for ContentEntry(**e)
    is_optimized: bool                 # True only after optimize_distribution runs
```

`Literal` requires `from typing import Literal` added to `shared_state.py`
(currently only imports `Any, TypedDict`).

### Node read/write matrix

| Field | `receive_params` | `analyze_profile` | `query_rag` | `generate_ideas` | `optimize_distribution` | `format_calendar` |
|---|---|---|---|---|---|---|
| `user_id` | R (input) | — | — | — | — | — |
| `profile` | R (input) | R | R | R | — | — |
| `calendar_id` | R (input, passthrough) | — | — | — | — | — |
| `period` | R (input) | — | — | — | — | R |
| `start_date`/`end_date` | **W** (computed from `period`) | — | — | — | — | R |
| `frequency` | R (input, may be `None`) | R, **W** (resolved) | — | R | R | R |
| `formats` | R (input, may be `None`) | R, **W** (resolved) | — | R | R | — |
| `rag_context` | W (init `""`) | — | **W** | R | — | — |
| `raw_ideas` | W (init `[]`) | — | — | **W** | R | — |
| `calendar_entries` | W (init `[]`) | — | — | — | R | **W** |
| `is_optimized` | W (init `False`) | — | — | — | **W** (`True`) | — |

`receive_params` takes the raw, unresolved `frequency`/`formats` (`int | None`,
`dict | None`, exactly `CalendarGenerateRequest`'s optional fields) as its
input state and initializes every derived field — this is why `frequency`/
`formats` are typed as resolved (`int`, `dict[str, int]`) in the TypedDict
itself: by the time `query_rag` runs, `analyze_profile` has already replaced
the raw optional values with resolved ones. LangGraph's node functions return
partial-state dicts that get merged, so `receive_params`'s output legitimately
contains `frequency: int | None` transiently before `analyze_profile` — this
is a known LangGraph TypedDict looseness (not statically enforced) documented
here so `sdd-apply` does not "fix" it into two separate TypedDicts.

## 3. The `profile` Dict Shape

Built in `calendar_service.py`, **not** inside the agent — the agent must
never query the DB directly (same rule as `exploration.md:31`).

```python
# backend/app/services/calendar_service.py
def _narrow_profile(profile: CreatorProfile) -> dict:
    """Narrowed subset passed into CalendarState — never a raw ORM dump."""
    return {
        "niche": profile.niche,
        "sub_niche": profile.sub_niche,
        "primary_goal": profile.primary_goal,
        "tone": profile.tone,
        "target_audience": profile.target_audience,
        "desired_frequency": profile.desired_frequency,     # free text, unused for parsing
        "preferred_formats": profile.preferred_formats or [],
    }
```

`calendar_service.generate_calendar()` calls
`profile_service.get_or_create_profile(db, user_id)` (never a raw
`CreatorProfile` query), narrows it with `_narrow_profile`, and passes the
result as `CalendarState["profile"]` in the initial state dict handed to
`calendar_app.ainvoke(...)`.

## 4. Node-by-Node Behavior

**`receive_params(state) -> dict`** (pure Python, no I/O)
- Input: `user_id`, `profile` (already narrowed, injected by the service),
  `calendar_id`, `period`, raw `frequency: int | None`, raw
  `formats: dict | None`.
- Computes `start_date`/`end_date` from `period` (§5).
- Initializes `rag_context=""`, `raw_ideas=[]`, `calendar_entries=[]`,
  `is_optimized=False`.
- Failure mode: none — `period` is already validated to the closed
  `PeriodLiteral` by `CalendarGenerateRequest` before this node runs, so no
  exception path exists here.

**`analyze_profile(state) -> dict`** (pure Python, no I/O)
- Resolves `frequency` and `formats` per Decision 7's fallback order
  (`proposal.md:134-147`), using `FREQUENCY_RECOMMENDATIONS`/
  `DEFAULT_FORMAT_MIX` module constants in `calendar_agent.py` (§6).
- Failure mode: `profile["niche"]` may be `None`/unrecognized — falls back to
  a hardcoded default (`DEFAULT_FREQUENCY = 4`) rather than a `KeyError`.
  Never raises.

**`query_rag(state) -> dict`**
- One `qdrant_search_service.search_similar(query, top_k=4)` call
  (Decision 2 — single query, not per-entry), grounded on
  `f"{profile['niche']} {profile['sub_niche'] or ''}"`.
- Failure mode: any exception (connection error, timeout, empty result) is
  caught; `rag_context` is set to `""` and the graph proceeds — mirrors
  CRAG's fallback ethos (`rag_service.py:162-167`), but does not fall back to
  DuckDuckGo (that is CRAG's chat-specific behavior, not reused here — the
  calendar generation prompt asks the LLM to fall back to general knowledge
  when `rag_context` is empty, same wording pattern as CRAG's own system
  prompt at `rag_service.py:107-109`).

**`generate_ideas(state) -> dict`**
- The one Groq call: `llm_service.llm.with_structured_output(GeneratedIdeasList)`,
  prompted with `profile`, resolved `frequency`/`formats`, and `rag_context`
  (§6 for the schema and prompt shape).
- Target count: `sum(formats.values())` ideas, with per-format counts stated
  explicitly in the prompt as instructions, not enforced by the schema itself
  (the schema only constrains each idea's `format` to the closed Literal —
  count-matching is `optimize_distribution`'s job, per Decision 2's split of
  "LLM generates content" from "Python enforces constraints").
- Failure modes (all non-fatal, §6 fallback ladder):
  1. Structured-output parse/validation failure or Groq error → retry once
     with a repair prompt.
  2. Repair retry also fails, or returns fewer ideas than
     `sum(formats.values())` → deterministically pad the shortfall with
     template ideas built from `profile`/`formats` alone (no LLM), so this
     node **never raises** to the caller.

**`optimize_distribution(state) -> dict`** (deterministic Python, no LLM, no I/O)
- Reorders `raw_ideas` so no two consecutive entries share a `format`, per
  §5's algorithm.
- Failure mode: none by construction — the algorithm degrades to "best
  effort" (allows one adjacent repeat) only when the format-count skew makes
  the strict constraint impossible (§5), never raises.

**`format_calendar(state) -> dict`** (deterministic Python, no I/O)
- Maps the optimized `raw_ideas` onto concrete `date`/`time_slot` values
  within `[start_date, end_date]` (§5), producing `calendar_entries` — one
  dict per entry with keys matching `ContentEntry` columns exactly
  (`title`, `format`, `platform`, `hook`, `description`, `date`, `time_slot`),
  so the service layer can do `ContentEntry(calendar_id=..., **entry)`
  directly.
- Failure mode: guards `entry_count >= 1` (minimum one entry even for a
  degenerate 1-day period); no exception path otherwise.

## 5. `optimize_distribution` + `format_calendar` — Precise Algorithm

### 5a. Period → date range (`receive_params`)

```python
def _resolve_period(period: str) -> tuple[date, date]:
    today = date.today()
    if period == "current_week":
        start = today - timedelta(days=today.isoweekday() - 1)   # Monday
        return start, start + timedelta(days=6)                   # Sunday
    if period == "next_week":
        start = today - timedelta(days=today.isoweekday() - 1) + timedelta(days=7)
        return start, start + timedelta(days=6)
    if period == "month":
        start = today.replace(day=1)
        _, last_day = calendar.monthrange(today.year, today.month)
        return start, today.replace(day=last_day)
    raise ValueError(f"unknown period: {period}")   # unreachable — Literal-validated upstream
```

### 5b. Resolved `frequency` → entry count

```python
def _entry_count(frequency: int, start_date: date, end_date: date) -> int:
    total_days = (end_date - start_date).days + 1
    weeks = total_days / 7
    return max(1, round(frequency * weeks))
```
For `current_week`/`next_week`, `weeks == 1.0`, so `entry_count == frequency`
exactly — matches the schema's existing "posts por semana" framing
(`schemas/calendar.py:8` comment). For `month`, `weeks ≈ 4.0–4.4`.

### 5c. Resolved `formats` → per-format target counts

Reused by both Decision 7's fallback path (`analyze_profile`) and by
`generate_ideas`'s prompt:

```python
def _distribute(entry_count: int, weights: list[str]) -> dict[str, int]:
    """Largest-remainder rounding: sum(result.values()) == entry_count exactly."""
    n = len(weights)
    base, remainder = divmod(entry_count, n)
    counts = {f: base for f in weights}
    # Distribute the remainder to the first `remainder` formats (stable order)
    for f in weights[:remainder]:
        counts[f] += 1
    return counts
```
`weights` is either `profile["preferred_formats"]` (Decision 7's second
fallback tier) or `list(DEFAULT_FORMAT_MIX.keys())` (third tier). When the
caller supplies `CalendarGenerateRequest.formats` directly, no distribution
runs — the caller's map is used as-is, only re-validated to sum to the
resolved `frequency` is **not** enforced (an explicit caller override is
trusted, matching the schema's own `dict[FormatLiteral, int]` typing with no
cross-field validator — flagged as an accepted gap, not a bug).

### 5d. `optimize_distribution` — no-consecutive-same-format ordering

Deterministic reorder, expand-then-interleave (classic "reorganize string"
via a max-count-first greedy with a one-slot lookback, testable in
isolation from any LLM/DB):

```python
def optimize_distribution(raw_ideas: list[dict]) -> list[dict]:
    from collections import Counter, deque
    buckets: dict[str, deque[dict]] = {}
    for idea in raw_ideas:
        buckets.setdefault(idea["format"], deque()).append(idea)
    counts = Counter({fmt: len(q) for fmt, q in buckets.items()})

    ordered: list[dict] = []
    last_format: str | None = None
    while counts:
        # Highest remaining count, excluding last_format if any alternative exists
        candidates = [f for f in counts if f != last_format] or list(counts)
        fmt = max(candidates, key=lambda f: counts[f])
        idea = buckets[fmt].popleft()
        ordered.append(idea)
        counts[fmt] -= 1
        if counts[fmt] == 0:
            del counts[fmt]
        last_format = fmt
    return ordered
```
When one format's count exceeds `ceil(len(raw_ideas) / 2)`, a strict
no-adjacent-repeat ordering is mathematically impossible; the `candidates`
fallback (`or list(counts)`) then permits exactly the minimum number of
forced adjacent repeats rather than raising — this is the "best-effort"
degradation referenced in §4. Sets `is_optimized = True` unconditionally once
this function returns (even in the degraded case — "attempted the
constraint" is what the flag records, not "constraint perfectly satisfied").

### 5e. `format_calendar` — date/time_slot assignment

```python
TIME_SLOTS = ["morning", "afternoon", "evening"]

def format_calendar(ordered_ideas: list[dict], start_date: date, end_date: date) -> list[dict]:
    total_days = (end_date - start_date).days + 1
    n = len(ordered_ideas)
    step = total_days / n
    entries = []
    used_dates: set[date] = set()
    for i, idea in enumerate(ordered_ideas):
        target = start_date + timedelta(days=round(i * step))
        while target in used_dates and target < end_date:
            target += timedelta(days=1)
        used_dates.add(target)
        entries.append({
            **idea,
            "date": target,
            "time_slot": TIME_SLOTS[i % 3],
        })
    return entries
```
Ties/collisions (when `step < 1`, i.e. `entry_count > total_days`) are
resolved by advancing to the next free day, capped at `end_date` — a
`current_week` request with `frequency=14` (schema max) would stack multiple
entries on `end_date`, which is an accepted edge case, not a bug (the
`frequency` field's own `le=14` cap on a 7-day week already signals this is
expected to happen for high-frequency requests).

## 6. `generate_ideas` — Structured Output Contract

```python
# backend/app/agents/calendar_agent.py
from typing import Literal
from pydantic import BaseModel, Field

FormatLiteral = Literal["short_video", "carousel", "story", "long_video", "post"]
PlatformLiteral = Literal["tiktok", "instagram", "youtube", "linkedin", "x"]

class GeneratedIdea(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    format: FormatLiteral
    platform: PlatformLiteral
    hook: str
    description: str

class GeneratedIdeasList(BaseModel):
    ideas: list[GeneratedIdea]
```

Call shape (new territory — no prior `with_structured_output` usage in
`llm_services.py:21-25`):
```python
structured_llm = llm_service.llm.with_structured_output(
    GeneratedIdeasList, method="json_mode"
)
result: GeneratedIdeasList = await structured_llm.ainvoke(messages)
```

> **REVISED by the Phase 0 spike (2026-08-03).** The original design assumed
> the default tool-calling path and an `OutputParserException`-family failure.
> Measured against the real Groq `llama-3.1-8b-instant` endpoint:
>
> | Arm | Method | Schema-conformant | Failure exception |
> |-----|--------|-------------------|-------------------|
> | A | default (tool calling) | 7/10 | `groq.BadRequestError` (`code: tool_use_failed`, HTTP 400 from `groq/_base_client.py`) |
> | B | `method="json_mode"` | 10/10 | none observed in 10 runs |
>
> Two corrections are binding on task 4b.2:
> 1. Use `method="json_mode"`. The default tool-calling path fails ~30% of the
>    time, and LangChain does **not** wrap the provider error — `groq.BadRequestError`
>    propagates raw through `ChatGroq._generate`.
> 2. `json_mode` does not transmit a tool schema, so the prompt must contain the
>    literal word "JSON" and an inlined description of the expected shape.
>
> Repair-retry (tier 2) recovered non-deterministically under Arm A and was never
> exercised under Arm B. Treat it as best-effort, **not** as a reliability
> guarantee — tier 3 is the only tier proven never to raise.

### Fallback / repair ladder

1. **Happy path**: `result.ideas` has `sum(formats.values())` items — use as-is.
2. **Schema failure**: retry **once** with a repair prompt that appends the raw
   error text and re-states the exact required count/format distribution.
   `json_mode` guarantees syntactically valid JSON but **not** schema
   conformance, and the failing exception family is not fully characterized, so
   the `except` clause must catch all of `OutputParserException`, pydantic
   `ValidationError`, and `groq.APIStatusError` (the base class of
   `groq.BadRequestError`) rather than assuming a single family.
3. **Repair also fails, or `len(result.ideas) < sum(formats.values())`**:
   deterministically pad the shortfall using a template built from `profile`
   alone (no LLM call):
   ```python
   def _template_idea(fmt: str, profile: dict, index: int) -> dict:
       return {
           "title": f"Idea de {fmt} #{index} para {profile['niche'] or 'tu nicho'}",
           "format": fmt,
           "platform": DEFAULT_PLATFORM_BY_FORMAT[fmt],   # module constant
           "hook": "Hook pendiente de personalizar",
           "description": f"Contenido sobre {profile['primary_goal'] or 'tu objetivo'}.",
       }
   ```
   This guarantees `generate_ideas` **never raises** — the worst case is an
   entirely template-generated calendar, which is a documented degradation
   (same posture as RAG degrading to `""`), not a 500.
   Tier 3 must emit a distinct log line each time it fires. The Phase 0 spike
   showed padding is a routine path, not a rare one; silent padding would make
   a degraded calendar indistinguishable from a good one.
4. If `len(result.ideas) > sum(formats.values())`, truncate to the target
   count (drop the excess, preserving order) rather than erroring.

## 7. Schema Tightening (finalizes Decision 6)

```python
# backend/app/schemas/calendar.py
from datetime import date
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field

FormatLiteral = Literal["short_video", "carousel", "story", "long_video", "post"]
PlatformLiteral = Literal["tiktok", "instagram", "youtube", "linkedin", "x"]
PeriodLiteral = Literal["current_week", "next_week", "month"]
EntryStatusLiteral = Literal["idea", "drafted", "recorded", "published"]

class CalendarGenerateRequest(BaseModel):
    period: PeriodLiteral
    frequency: int | None = Field(default=None, ge=1, le=14)
    formats: dict[FormatLiteral, int] | None = None
    calendar_id: str | None = None

class EntryUpdate(BaseModel):
    title: str | None = None
    hook: str | None = None
    description: str | None = None
    format: FormatLiteral | None = None
    platform: PlatformLiteral | None = None
    status: EntryStatusLiteral | None = None
    time_slot: str | None = None

class EntryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    calendar_id: str
    date: date
    time_slot: str | None = None
    title: str
    format: str
    platform: str
    hook: str | None = None
    description: str | None = None
    status: str
    google_calendar_event_id: str | None = None

class CalendarResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str | None = None
    start_date: date
    end_date: date
    frequency: int
    status: str

class CalendarDetailResponse(CalendarResponse):
    entries: list[EntryResponse] = []

class CalendarStatusError(BaseModel):
    detail: str
    missing_fields: list[str]
```
`id`/`calendar_id` typed `str` over UUID columns and populated via
`.model_validate(row)` follows the exact precedent already proven in
`ProfileResponse` (`schemas/profile.py:44-48`, `id: str` over
`CreatorProfile.id: Mapped[uuid.UUID]`) — Pydantic v2's `from_attributes`
path coerces `UUID` to `str` on validation, so no manual `str(x.id)`
conversion helper is needed in the router (unlike `chats.py`'s
`_to_list_item`, which predates the `from_attributes` convention).

## 8. Service / Router Layering

```python
# backend/app/services/calendar_service.py — signatures
class CalendarService:
    async def generate_calendar(
        self, db: AsyncSession, user_id: str,
        period: str, frequency: int | None, formats: dict | None,
        calendar_id: str | None,
    ) -> ContentCalendar: ...   # raises HTTPException 409/404, invokes calendar_app

    async def list_calendars(self, db, user_id: str) -> list[ContentCalendar]: ...
    async def get_calendar(self, db, user_id: str, calendar_id: str) -> ContentCalendar: ...
    async def update_entry(self, db, user_id: str, calendar_id: str,
                            entry_id: str, **fields) -> ContentEntry: ...
    async def confirm_calendar(self, db, user_id: str, calendar_id: str) -> ContentCalendar: ...
    async def delete_calendar(self, db, user_id: str, calendar_id: str) -> None: ...

calendar_service = CalendarService()
```

Every method filters by `user_id` at the query level (`.where(ContentCalendar.user_id == uid)`
joined through to `ContentEntry` for entry-scoped methods), mirroring
`profile_service.py`'s `_to_uuid` + `select(...).where(...)` convention
(`profile_service.py:21-27,46-49`) — a calendar/entry belonging to another
user resolves as `404`, never `403`, matching the profile precedent and the
proposal's explicit API table (`proposal.md:184-187`).

**`generate_calendar` internals**, in order:
1. `is_complete, missing = await profile_service.get_status(db, user_id)` →
   `if not is_complete: raise HTTPException(409, detail=CalendarStatusError(...))`.
2. If `calendar_id` provided: load it scoped to `user_id`; `404` if missing;
   `409` if `status != "draft"`. Else: create a new `ContentCalendar(user_id=..., status="draft")`.
3. Narrow the profile (§3), build the initial `CalendarState`, run
   `await calendar_app.ainvoke(initial_state)`.
4. Replace the target calendar's entries: delete existing `ContentEntry` rows
   (cascade-safe, mirrors `_replace_social_accounts`'s delete-then-insert
   pattern, `profile_service.py:111-120`), insert
   `ContentEntry(calendar_id=calendar.id, **e)` for each `calendar_entries` dict.
5. Update `calendar.start_date/end_date/frequency` from the resolved state,
   `db.flush()`, `db.refresh(calendar)` with `entries` eager-loaded
   (`selectinload(ContentCalendar.entries)`), return.

**Router** (`backend/app/routers/calendar.py`) — thin, `chats.py`-style
(`routers/chats.py:1-104`), all six endpoints per `proposal.md:180-187`,
`Depends(get_current_user)` + `Depends(get_db)` on every handler, registered
in `main.py` alongside the existing five:
```python
app.include_router(calendar.router)   # added after profile.router, main.py:40
```

## 9. Frontend Data Layer

```ts
// frontend/features/calendar/services/calendar-api.ts
export interface EntryItem { id: string; calendar_id: string; date: string;
  time_slot: string | null; title: string; format: string; platform: string;
  hook: string | null; description: string | null; status: string;
  google_calendar_event_id: string | null; }
export interface CalendarItem { id: string; name: string | null;
  start_date: string; end_date: string; frequency: number; status: string; }
export interface CalendarDetail extends CalendarItem { entries: EntryItem[]; }
export interface GenerateInput { period: "current_week" | "next_week" | "month";
  frequency?: number; formats?: Record<string, number>; calendar_id?: string; }
export interface EntryUpdateInput { title?: string; hook?: string;
  description?: string; format?: string; platform?: string; status?: string;
  time_slot?: string; }

export async function getCalendars(): Promise<CalendarItem[]>;
export async function getCalendar(id: string): Promise<CalendarDetail>;
export async function generateCalendar(input: GenerateInput): Promise<CalendarDetail>;
export async function updateEntry(calendarId: string, entryId: string,
  partial: EntryUpdateInput): Promise<EntryItem>;
export async function confirmCalendar(id: string): Promise<CalendarItem>;
export async function deleteCalendar(id: string): Promise<void>;
```
All six use `apiFetch`/`ApiError`/`ensureOk`, exactly `profile-api.ts`'s shape
(`profile-api.ts:1,58-61`). `generateCalendar` must surface a `409` body's
`{detail, missing_fields}` distinctly (via `ApiError.status === 409`) so the
UI can route to `CalendarEmptyState`'s CTA instead of a generic error toast.

```ts
// frontend/features/calendar/store/calendarStore.ts
export interface CalendarState {
  calendars: CalendarItem[];
  currentCalendar: CalendarDetail | null;
  viewMode: "month" | "week";           // lifted from TopBar's local useState
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  setViewMode: (mode: "month" | "week") => void;
  loadCalendars: () => Promise<void>;
  loadCalendar: (id: string) => Promise<void>;
  generate: (input: GenerateInput) => Promise<void>;   // sets currentCalendar
  updateEntry: (entryId: string, partial: EntryUpdateInput) => Promise<void>;
  confirm: () => Promise<void>;
  remove: (id: string) => Promise<void>;
}
```
Mirrors `profileStore.ts`'s `isLoading`/`error` + try/catch/set convention
(`profileStore.ts:19-30`). `useCalendarGeneration.ts` holds the draft
form state (period/frequency/formats before submit) exactly as
`useOnboardingWizard.ts` holds wizard draft state — a partially-filled
generation form is not application state, same D7 rationale as the archived
design (`archive/.../design.md:99-105`).

### Component-by-component change classification

| Component | Kind | Change |
|---|---|---|
| `TimelineCards.tsx` | Mock-replacement | Remove `sampleCards`; render `currentCalendar.entries` filtered to the next 48h; enable the "more options" (`⋮`) button to open `EntryEditModal` for that entry. Pagination arrows stay `disabled` (unrelated, out of scope). |
| `CalendarGrid.tsx` | Mock-replacement | Remove `events`/hardcoded "Octubre 2024"/`FIRST_DAY_OFFSET`; derive the grid from `currentCalendar.start_date`/`end_date` and `calendarStore.viewMode` (month renders the full grid as today; week renders a 7-cell row for the current/next week). Clicking an entry chip opens `EntryEditModal`. |
| `TopBar.tsx` | Mock-replacement (minor) | Month/week toggle reads/writes `calendarStore.viewMode` instead of local `useState`. Tabs, "Sync Calendar", notifications stay `disabled` (unrelated, out of scope — Google sync is Fase 4). |
| `GoogleSyncButton.tsx` | Unchanged | Stays fully mocked — resolved by the user's accepted assumption 3 framing (decorative widgets stay mocked); Google sync itself is explicitly out of scope. |
| `PerformancePanel.tsx` | Unchanged | No backing endpoint in the six-endpoint surface — stays mocked. |
| `ActivityPanel.tsx` | Unchanged | Same — stays mocked. |
| `CreatorTip.tsx` | Unchanged | Same — stays mocked. |
| `GenerateControl.tsx` | **Net-new UI** | Period select, frequency input, per-format count inputs (or "use recommended" toggle mapping to Decision 7's fallback), "Generar con AI" submit calling `calendarStore.generate`. |
| `EntryEditModal.tsx` | **Net-new UI** | Form for `title`/`hook`/`description`/`format`/`platform`/`status`/`time_slot`, submits via `calendarStore.updateEntry`. Opened from `TimelineCards` and `CalendarGrid`. |
| `ConfirmBar.tsx` | **Net-new UI** | Status badge (`draft`/`confirmed`/`synced`) + "Confirmar calendario" button (`calendarStore.confirm`, disabled once not `draft`) + delete action (`calendarStore.remove`, disabled when `synced`, per the locked delete-semantics ruling). |
| `CalendarEmptyState.tsx` | **Net-new UI** | Renders when `calendars.length === 0` or the last `generate()` call resolved a `409`; CTA button links to `/onboarding`. This is the soft-gate's UI half. |
| `CalendarView.tsx` | Modify | Loads `calendarStore.loadCalendars()` on mount; composes `GenerateControl`, `ConfirmBar`, `CalendarEmptyState` (conditional), `EntryEditModal` (portal/overlay), alongside the existing seven components. |

`frontend/proxy.ts:70`'s `allowWithoutOnboarding` bypass gets an inline
comment only — no logic change — documenting that it is deliberate: the page
loads and shows `CalendarEmptyState` for an incomplete profile, rather than a
route-level redirect (this is the soft-gate, not a guard gap).

## 10. Testing Strategy

**Backend** — reuses `conftest.py:44-49`'s `sys.modules` stubbing pattern
(already stubs `llm_services`/`embeddings_service`/`qdrant_services` at
import time, so registering `calendar.router` in `main.py` does not
reintroduce the Qdrant boot blocker for tests):

| Layer | What to test | Approach |
|---|---|---|
| Pure functions | `_resolve_period` (all 3 literals, including month-boundary dates via a frozen `date.today()`), `_entry_count`, `_distribute` (remainder distribution sums exactly), `optimize_distribution` (no-adjacent-repeat property, and the degraded case when one format dominates), `format_calendar` (date/time_slot assignment, collision advancing) | Direct calls with plain dicts/lists — no DB, no client, `monkeypatch` `date.today` where needed |
| Agent nodes | `generate_ideas`'s repair ladder: happy path, schema-failure-then-repair-success, repair-failure-then-template-fallback, over-count truncation | `monkeypatch` `llm_service.llm.with_structured_output` to return a fake structured-llm object whose `.ainvoke` is an `AsyncMock` with scripted side effects |
| Agent nodes | `query_rag` degrades to `rag_context == ""` on a raised exception | `monkeypatch` `qdrant_search_service.search_similar` to raise |
| Service | Soft-gate `409` with `missing_fields`; `calendar_id` regeneration targeting (`404` not owned, `409` not `draft`); confirm `draft→confirmed` and re-confirm `409`; delete allowed on `draft`/`confirmed`, `409` on `synced` | `patch_calendar_service`-style fixture (new, mirrors `patch_profile_service`, `conftest.py:136-149`) for router-level tests; direct service calls with `mock_db_session` for service-level tests |
| Router | All 401/404/409/422 cases from `proposal.md`'s API table | `client` fixture + new `patch_calendar_service` fixture |

**Frontend** — mirrors `profile-api.test.ts`/`profileStore.test.ts`/
`ProfileForm.test.tsx`'s existing patterns:

| Layer | What to test | Approach |
|---|---|---|
| Service | Each of the 6 functions, plus `409` body surfacing `missing_fields` | Mocked `fetch`, `vi.mock` |
| Store | `generate`/`updateEntry`/`confirm`/`remove` set `isLoading`/`error` correctly; `viewMode` toggles | `vi.spyOn` on the api module + `useCalendarStore.getState()` |
| Components | `GenerateControl` submit calls `generate` with the right payload; `EntryEditModal` submit calls `updateEntry`; `TimelineCards`/`CalendarGrid` render `currentCalendar.entries` with no hardcoded arrays remaining; `CalendarEmptyState` shows on empty/409 | `@testing-library/react` + mocked store state |

## 11. Delivery-Slice Plan — Confirmed and Refined

The proposal's 11-unit table (`proposal.md:286-298`) is confirmed as the
correct sequencing and dependency graph. This phase refines four estimates
upward based on the concrete algorithm/schema work specified above, and
flags which units are likely to need a RED/GREEN split at `sdd-tasks` (not
resolved here — `sdd-design` identifies the risk, `sdd-tasks` owns the split):

| # | Unit | Refined estimate | Budget risk | Note |
|---|---|---|---|---|
| 1 | Schema tightening + finalize `CalendarState` | ~110 | Low | Unchanged from proposal; `CalendarState` grew by 4 fields (`calendar_id`, `start_date`, `end_date`, `raw_ideas`) but stays well under budget |
| 2 | `calendar_service.py` (6 methods, soft-gate, transition guards) + tests | ~260 | **High** | At budget already; `sdd-tasks` should split service-implementation from service-tests (RED/GREEN) |
| 3 | `calendar_agent.py` deterministic nodes (`receive_params`, `analyze_profile`, `optimize_distribution`, `format_calendar`) + `_resolve_period`/`_entry_count`/`_distribute` helpers + tests | ~260 | **High** | §5's algorithms are more code than the proposal's placeholder estimate implied; recommend `sdd-tasks` split into 3a (params/profile resolution) and 3b (distribution/format algorithms) |
| 4 | `query_rag` + `generate_ideas` (structured output + 3-tier fallback ladder) + `GeneratedIdea`/`GeneratedIdeasList` + tests | ~240 | **High** | The repair-then-template fallback ladder (§6) is the single largest node; recommend `sdd-tasks` split into 4a (happy path + query_rag) and 4b (repair/template fallback tests) |
| 5 | `routers/calendar.py` + `main.py` registration + tests (401/404/409/422) | ~220 | Med | Unchanged from proposal |
| 6 | `calendar-api.ts` + types + tests | ~150 | Low | Slightly above proposal's ~130 — 6 endpoints vs. profile's 4, plus 409-body handling |
| 7 | `calendarStore.ts` + `useCalendarGeneration.ts` + tests | ~160 | Med | Slightly above proposal's ~150 — includes lifted `viewMode` |
| 8 | Wire `TimelineCards`/`CalendarGrid` to real data, date-aware rendering | ~230 | **High** | Confirms proposal's flag; recommend `sdd-tasks` split into 8a (`TimelineCards`) and 8b (`CalendarGrid`, the harder date-math component) |
| 9 | `GenerateControl.tsx` + tests | ~180 | Med | Unchanged from proposal |
| 10 | `EntryEditModal.tsx` + wiring from both `TimelineCards` and `CalendarGrid` | ~190 | Med | Slightly above proposal's ~170 — two trigger sites, not one |
| 11 | `ConfirmBar.tsx` + `CalendarEmptyState.tsx` + `proxy.ts` comment + tests | ~200 | **High** | Two net-new components bundled in one unit; recommend `sdd-tasks` split into 11a (`ConfirmBar`) and 11b (`CalendarEmptyState` + `proxy.ts` comment) |

**Revised total: ~2200 lines** (proposal forecast ~1990; the delta is
concentrated in units 3, 4, 8, and 11 where this phase had to make the
algorithm/fallback-ladder work concrete). Units 2, 3, 4, 8, and 11 are at or
above the 400-line budget's *effective* per-unit ceiling once tests are
included and are flagged for `sdd-tasks` to split into RED/GREEN
sub-phases — same mitigation the archived onboarding-profile change used
(`archive/.../tasks.md:351-357`). No unit individually needs to exceed 400
lines if split as flagged; `sdd-tasks` should treat this table as a starting
point, not final.

## Migration / Rollout

No migration — confirmed again here: `backend/app/models/calendar.py`
already matches the target schema exactly (unchanged from
`exploration.md:10-11`). Rollback is `git revert` per unit; removing
`app.include_router(calendar.router)` disables the whole API surface
instantly, matching the archived design's rollback posture
(`archive/.../design.md:274-280`).

## Open Questions Carried Forward

- `sdd-tasks` must decide the RED/GREEN split granularity for units 2, 3, 4,
  8, and 11 flagged above.
- `sdd-tasks` must confirm chained-PR vs. sequential-single-branch delivery
  (proposal leaves this open, `proposal.md:301-305`) — this design assumes
  sequential single-branch, matching the archived change's convention.
