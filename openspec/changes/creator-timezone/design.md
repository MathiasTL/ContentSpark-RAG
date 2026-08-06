# Design: Per-Creator Timezone for Calendar Period Resolution

**Change**: `creator-timezone`
**Input**: `openspec/changes/creator-timezone/proposal.md` (authoritative; its five settled
decisions are implemented here, not reopened).

---

## 0. Architecture stance

The change is a **single narrow value threaded along an existing path**, not a new
subsystem. The value is an IANA timezone name; the path is
`browser → API schema → CreatorProfile row → _narrow_profile → CalendarState["profile"] →
_resolve_period`. Every hop already exists. The design's job is to avoid inventing new
hops, and to make the one genuinely hard part — freezing "now" in tests — structurally
easy instead of structurally fragile.

Two architectural commitments follow from that:

1. **No new state key, no new endpoint, no new store.** Timezone rides inside the existing
   `profile` dict, the existing `GET/PUT /api/profile` payload, and the existing
   `useProfileStore`. Adding a top-level `CalendarState["timezone"]` would change the state
   contract that `content-calendar` just froze at 49/49, and would ripple into every node
   signature for zero benefit.
2. **The clock becomes an injectable seam, not a monkeypatched module global.** This is the
   single most important decision in the document and is argued in §6.

---

## 1. Data layer — `CreatorProfile.timezone`

### Column

`backend/app/models/profile.py`, appended after `preferred_formats` (line 32):

```python
timezone: Mapped[str | None] = mapped_column(String(64), nullable=True)
```

**Type and length, deliberately.** IANA zone identifiers are ASCII, `Area/Location` or
`Area/Sub/Location`. The longest identifier in the current tzdb, including `backward`
links, is `America/Argentina/ComodRivadavia` at 32 characters; the longest canonical
zone is `America/North_Dakota/New_Salem` at 30. `String(64)` is exactly 2× the observed
maximum: enough headroom for any plausible future addition, small enough to remain an
obvious "identifier, not free text" signal to the next reader. It is **not** `String(50)`
by habit — 50 has no relationship to the data. In PostgreSQL `varchar(n)` and `text` have
identical storage and performance characteristics, so the bound is purely a validation
guard; it is set at the DB layer as defence behind the Pydantic validator, which is the
real gate.

`nullable=True`, **no server default, no backfill.** A `server_default='UTC'` was
considered and rejected: it would make every pre-existing creator indistinguishable from a
creator who deliberately chose UTC, which destroys the exact signal the nudge banner (§7.3)
depends on. NULL means "never told us"; `'UTC'` means "told us UTC". Those must stay
distinct.

The identifier `timezone` is not a reserved word in PostgreSQL (`timezone()` is a function,
which does not collide with a column name), so no quoting workaround is needed.

### Migration

One new revision under `backend/alembic/versions/`, chained off the current head:

```python
revision: str = '<generated>'
down_revision: Union[str, Sequence[str], None] = 'e7f16d584e97'

def upgrade() -> None:
    op.add_column(
        "creator_profiles",
        sa.Column("timezone", sa.String(length=64), nullable=True),
    )

def downgrade() -> None:
    op.drop_column("creator_profiles", "timezone")
```

Head verified: `e7f16d584e97_drop_users_onboarding_completed.py`
(`down_revision = '04bb76c6e29f'`) is the current tip. Generate with
`mamba run -n contentspark alembic revision --autogenerate -m "add creator_profiles timezone"`,
then **hand-check** the generated body — autogenerate on this project has historically
emitted unrelated drift when models and DB are out of sync. The migration must contain
exactly the one `add_column` and its inverse. `alembic upgrade head` and
`alembic downgrade -1` must both run clean (exit criterion 1).

---

## 2. tzdata — resolved, with a definite conclusion

This was flagged as a live outage risk. Findings, from direct filesystem inspection of the
environment (this executor had no shell tool available, so the check is by file evidence
rather than by executing `python -c`; the evidence is nonetheless conclusive):

| Fact | Evidence |
|---|---|
| Env is CPython 3.11 | `/Users/mathiastl/.local/share/mamba/envs/contentspark/lib/python3.11/` |
| `zoneinfo` TZPATH is **env-local only** | `_sysconfigdata__darwin_darwin.py:1312` → `TZPATH = '<env>/share/zoneinfo:<env>/share/tzinfo'`. It does **not** include `/usr/share/zoneinfo`. |
| The env's zoneinfo tree is populated | `<env>/share/zoneinfo/zone.tab` exists; `<env>/share/zoneinfo/America/Argentina/{Buenos_Aires,Cordoba,...}` — 13 zones under that one subtree alone |
| It comes from a **conda** package | `<env>/conda-meta/tzdata-2025c-hc9c84f9_1.json` |
| The **PyPI** `tzdata` package is absent | no `<env>/lib/python3.11/site-packages/tzdata/` |
| `backend/requirements.txt` does not mention tzdata | read in full; 40 lines, no entry |
| There is **no Dockerfile anywhere in the repo** | `fd`-equivalent glob `**/Dockerfile*` → no matches, despite `docker-compose.yml` declaring `build: ./backend` and `build: ./frontend` |

**Conclusion.** `available_timezones()` is populated *locally* and the tests will pass on
this machine — but only because conda-forge's `tzdata` happens to be installed as a
transitive dependency, and because this env's TZPATH points at conda's tree rather than the
system one. That guarantee is **invisible to `requirements.txt`** and therefore does not
travel. Any pip-based deploy image inherits nothing from it. And the deploy base image is
not merely uncertain — it does not exist yet (`build: ./backend` currently refers to a
missing Dockerfile), so nothing can be verified about it and it must be assumed hostile.

**Decision — add `tzdata` to `backend/requirements.txt`.** This is a required task, not a
suggestion. It costs roughly 350 KB, has no transitive dependencies, and is the officially
documented remedy (`zoneinfo` falls back to the `tzdata` package when the system tree is
absent). Add it under a new section, with the reason inline so nobody deletes it later:

```
# Zonas horarias: zoneinfo cae a este paquete cuando la imagen de deploy
# no trae la tzdata del sistema. Sin el, available_timezones() es vacio.
tzdata
```

An unpinned entry matches the file's existing convention (only `ruff` is pinned). Note the
consequence: with the PyPI package present, tzdata updates ship on rebuild rather than on
OS patching — which is what we want for a Python service.

### Fallback if `available_timezones()` is empty at runtime anyway

Belt and braces, because a validator that rejects every value is a total outage of profile
saves — strictly worse than the bug being fixed. Two independent guards:

1. **Validator degrades, never hard-fails closed.** If the precomputed set is empty, the
   validator *accepts the value unchanged* and logs a warning once at import. Rationale: an
   empty set is a deployment defect, not user input. Punishing every user for it converts a
   silent infrastructure problem into a visible total outage. The 422 contract for genuinely
   invalid names (settled decision 2) is preserved in every environment where validation is
   actually possible.
2. **`_resolve_period` never raises.** `ZoneInfo(tz)` is wrapped; `ZoneInfoNotFoundError` /
   `ValueError` fall back to UTC (§4). So even a value that slipped past a degraded
   validator cannot explode inside a LangGraph node.

Together: a missing-tzdata deploy degrades to "timezone stored but not enforced, all
periods resolved in UTC" — exactly today's documented NULL behaviour — instead of "no
creator can save their profile".

---

## 3. Schema layer — validation at the boundary

All in `backend/app/schemas/profile.py`.

```python
import logging
from typing import Annotated
from zoneinfo import available_timezones

from pydantic import AfterValidator, BaseModel, ConfigDict

logger = logging.getLogger(__name__)

# Computed ONCE at import (see rationale below).
_AVAILABLE_TIMEZONES: frozenset[str] = frozenset(available_timezones())
if not _AVAILABLE_TIMEZONES:
    logger.warning(
        "zoneinfo no encontro tzdata: la validacion de timezone queda desactivada "
        "y todos los periodos se resolveran en UTC. Falta el paquete `tzdata`?"
    )


def _validate_timezone(value: str | None) -> str | None:
    if value is None:
        return None
    if not _AVAILABLE_TIMEZONES:
        return value  # degradacion controlada, ver design §2
    if value not in _AVAILABLE_TIMEZONES:
        raise ValueError(
            f"'{value}' no es un identificador IANA de zona horaria valido"
        )
    return value


TimezoneName = Annotated[str | None, AfterValidator(_validate_timezone)]
```

Then one line in each model:

- `ProfileCreate`: `timezone: TimezoneName = None` — optional, so onboarding payloads that
  predate the frontend slice still validate.
- `ProfileUpdate`: `timezone: TimezoneName = None` — participates in the existing
  `model_fields_set` partial-update contract, so *omitted* means "don't touch" and
  *explicit null* means "clear". No service change is required: `update_profile` and
  `complete_onboarding` both iterate `fields`/`data` and `setattr` any attribute the model
  has (`profile_service.py:75-77`, `102-104`), so `timezone` flows through with zero
  edits to `profile_service.py`.
- `ProfileResponse` inherits from `ProfileCreate`, so it gains `timezone` automatically
  (`schemas/profile.py:44`). This is intended and is why the frontend `Profile` type must
  change in the same overall change (§7).

**Placement rationale.** A shared `Annotated` alias rather than two duplicated
`@field_validator` methods: one definition, two use sites, and the alias is reusable if a
third schema ever needs it. `AfterValidator` (not `BeforeValidator`) so Pydantic's own
`str | None` coercion runs first and the validator only ever sees a real `str` or `None`.

**Computed once at import, not per call.** `available_timezones()` walks every directory
on TZPATH on each invocation — tens of milliseconds and thousands of `stat` calls. Doing
that per request on a hot profile endpoint is indefensible. The accepted cost is that
adding tzdata to a running process requires a restart, which is fine for a containerised
service that redeploys to change dependencies anyway. `frozenset` for O(1) membership and
to make accidental mutation impossible.

**Error shape FastAPI produces.** A `ValueError` raised inside `AfterValidator` becomes a
Pydantic `ValidationError`; FastAPI converts request-body validation failures to
**HTTP 422** with:

```json
{"detail": [{
  "type": "value_error",
  "loc": ["body", "timezone"],
  "msg": "Value error, 'Mars/Olympus_Mons' no es un identificador IANA de zona horaria valido",
  "input": "Mars/Olympus_Mons"
}]}
```

Note Pydantic v2 prefixes the message with `Value error, ` — assert on a substring, not on
equality. The frontend's `ensureOk` (`profile-api.ts:58-61`) only surfaces the status code,
so a creator currently sees "updateProfile fallo con status 422". That is acceptable for
this change and is **not** expanded here: surfacing field-level 422 detail is a general
API-error-handling improvement affecting every field, not a timezone concern.

---

## 4. Agent layer — timezone-aware period resolution

`backend/app/agents/calendar_agent.py`. The current `_resolve_period` (lines 88-101) is
replaced by **four small functions** instead of one bigger one:

```python
from datetime import UTC, date, datetime, timedelta, tzinfo
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError


def _zone_or_utc(tz: str | None) -> tzinfo:
    """Nunca lanza: un nombre invalido o ausente cae a UTC (defensa en
    profundidad — la validacion real vive en el schema, design §3)."""
    if not tz:
        return UTC
    try:
        return ZoneInfo(tz)
    except (ZoneInfoNotFoundError, ValueError):
        return UTC


def _today_in(tz: str | None, now: datetime | None = None) -> date:
    """La fecha local del creador. `now` es una costura de inyeccion de
    reloj para tests — produccion nunca la pasa."""
    instant = now or datetime.now(UTC)
    return instant.astimezone(_zone_or_utc(tz)).date()


def _period_bounds(period: str, today: date) -> tuple[date, date]:
    """Aritmetica pura de calendario: sin reloj, sin zona horaria."""
    if period == "current_week":
        start = today - timedelta(days=today.isoweekday() - 1)   # lunes
        return start, start + timedelta(days=6)                  # domingo
    if period == "next_week":
        start = today - timedelta(days=today.isoweekday() - 1) + timedelta(days=7)
        return start, start + timedelta(days=6)
    if period == "month":
        start = today.replace(day=1)
        _, last_day = calendar.monthrange(today.year, today.month)
        return start, today.replace(day=last_day)
    raise ValueError(f"unknown period: {period}")


def _resolve_period(
    period: str, tz: str | None, now: datetime | None = None
) -> tuple[date, date]:
    return _period_bounds(period, _today_in(tz, now))
```

**`tz` is a required positional parameter, not `tz: str | None = None`.** There is exactly
one production caller, so a default buys nothing and costs a whole class of silent bug:
with a default, a future caller that forgets the argument gets UTC and looks correct in
every test written in a UTC-ish environment. Required means the compiler-adjacent tooling
catches the omission.

**Caller inventory — re-verified.** A repository-wide search for `_resolve_period` and
`date.today()` across `backend/` returns:
- `backend/app/agents/calendar_agent.py:88` (definition), `:90` (`date.today()` inside it),
  `:130` (**the only production call site**, in `receive_params`);
- `backend/app/services/calendar_service.py:131` (the separate inert `date.today()`, §5);
- `backend/tests/test_calendar_agent.py` (11 hits, all test code).

Confirmed: `receive_params` is the sole caller. No router, service, or other agent calls it.

`receive_params` (line 128-138) changes by two lines:

```python
def receive_params(state: CalendarState) -> dict:
    profile = state.get("profile") or {}
    start_date, end_date = _resolve_period(state["period"], profile.get("timezone"))
    ...
```

`.get("timezone")` rather than `["timezone"]` is deliberate: every existing test and any
caller that builds a state with a 7-key profile keeps working and simply resolves in UTC.
`state.get("profile") or {}` guards the `profile: None` case that
`test_calendar_state_accepts_dict_literal`-style minimal states could produce.

**No `CalendarState` change.** `test_calendar_state_has_full_field_set`
(`test_calendar_agent.py:39-57`) asserts an exact 12-field set. That assertion stays green
because the timezone lives inside `profile`, which is already `dict`-typed. Confirmed by
reading the test.

---

## 5. Service layer

`backend/app/services/calendar_service.py`.

**`_narrow_profile` — 7 → 8 keys** (line 34-44):

```python
    "preferred_formats": profile.preferred_formats or [],
    "timezone": profile.timezone,     # None => UTC en _resolve_period
```

Note `or []` is *not* applied — `None` is a meaningful value here (means UTC) and must not
be coerced.

**The inert `date.today()` at line 131.** Confirmed inert by reading the surrounding code:
the seeded `start_date`/`end_date` (lines 136-137) are unconditionally overwritten at lines
164-166 from `final_state`. Replacement:

```python
        else:
            # Marcadores: se sobrescriben en el Paso 5 con final_state
            # ["start_date"]/["end_date"], ya resueltos en la zona horaria
            # del creador. No usar el reloj local del servidor aqui.
            placeholder = date.min
            calendar = ContentCalendar(
                id=uuid.uuid4(),
                user_id=uid,
                status="draft",
                start_date=placeholder,
                end_date=placeholder,
                frequency=frequency or 1,
            )
```

`date.min` (0001-01-01) is within PostgreSQL's `DATE` range and is *obviously* a
placeholder if it ever leaks, which a plausible-looking `today` is not. The `from datetime
import date` import at line 11 stays (it is used by `date.min`) — no import churn.

*Rejected alternative*: reorder `generate_calendar` so the new `ContentCalendar` is
constructed *after* `calendar_app.ainvoke`, eliminating the placeholder entirely. It is
genuinely cleaner, but it restructures the documented Paso 2/3/4/5 ordering and the
`with_for_update` branch shape for a purely cosmetic gain, in a change already over its
line budget. Deferred, not forgotten.

---

## 6. Test strategy under strict TDD (the load-bearing section)

### The problem, precisely

`test_calendar_agent.py:95-160` contains four tests that each do:

```python
class FixedDate(date):
    @classmethod
    def today(cls): return fixed_today
monkeypatch.setattr(calendar_agent, "date", FixedDate)
start, end = _resolve_period("current_week")
```

That patch point (`calendar_agent.date`, consumed via `date.today()`) **ceases to exist**.
Patching a module-level name is what made these tests brittle; replacing it with a patch of
`calendar_agent.datetime` would recreate the identical fragility one import statement later.
`freezegun` was considered and rejected: a new production-adjacent dependency plus its own
timezone semantics to learn, for four tests.

### The chosen pattern: split the clock out, then inject it

The `_period_bounds` / `_today_in` split in §4 exists *for this reason*. It yields a test
suite with **zero monkeypatching**:

- **`_period_bounds(period, today)` is pure calendar arithmetic.** The four rewritten
  boundary tests pass a literal `date(...)` and assert the same bounds the old tests
  asserted. The rewrite is close to mechanical — delete the four-line `FixedDate` block,
  pass `fixed_today` as the second argument, keep every assertion verbatim. This is
  deliberately the *lowest-risk possible* transformation of the exact tests the proposal
  identified as the likeliest stall point.
- **`_today_in(tz, now=...)` takes an explicit anchor instant.** The timezone-boundary
  proof required by exit criterion 4 passes a frozen UTC instant directly. No patching,
  no subclassing, no global mutation, no ordering dependency between tests.

The `now` parameter is a test seam in a production signature. That is a real, acknowledged
tradeoff — the alternative is monkeypatching a module global, which is precisely the
practice that just cost us four tests. An explicitly injectable clock is the standard
remedy for an untestable clock, and it is documented as such in the docstring so nobody
"cleans it up" later. Production never passes it.

### Rewritten and new backend tests

`backend/tests/test_calendar_agent.py`:

| Test | Shape |
|---|---|
| `test_period_bounds_current_week` | `_period_bounds("current_week", date(2026, 8, 3))` → `(2026-08-03, 2026-08-09)`; keeps the `isoweekday()` 1/7 assertions |
| `test_period_bounds_next_week` | `_period_bounds("next_week", date(2026, 8, 5))` → `(2026-08-10, 2026-08-16)` |
| `test_period_bounds_month_short_february` | `date(2026, 2, 15)` → `(2026-02-01, 2026-02-28)` |
| `test_period_bounds_month_31_day` | `date(2026, 1, 10)` → `(2026-01-01, 2026-01-31)` |
| `test_resolve_period_unknown_raises` | survives with one token added: `_resolve_period("not_a_real_period", None)` |
| `test_today_in_none_is_utc` | `_today_in(None, now=datetime(2026, 8, 3, 1, 0, tzinfo=UTC)) == date(2026, 8, 3)` |
| `test_today_in_applies_zone_offset` | same instant, `tz="America/Argentina/Buenos_Aires"` → `date(2026, 8, 2)` |
| `test_today_in_invalid_zone_falls_back_to_utc` | `tz="Mars/Olympus_Mons"` → same result as `None`, no raise |
| **`test_resolve_period_week_differs_across_utc_boundary`** | **exit criterion 4.** Instant = `datetime(2026, 8, 3, 1, 0, tzinfo=UTC)` — Monday 01:00 UTC = **Sunday 22:00** in Buenos Aires. Assert `_resolve_period("current_week", "America/Argentina/Buenos_Aires", now=I)` → `(2026-07-27, 2026-08-02)` **and** `_resolve_period("current_week", None, now=I)` → `(2026-08-03, 2026-08-09)`. Two different weeks from one instant: the bug, proven, not inspected. |
| `test_receive_params_uses_profile_timezone` | state with `profile={"timezone": "Pacific/Kiritimati"}`; assert result equals `_period_bounds("current_week", _today_in("Pacific/Kiritimati"))` — relational, so it cannot flake at a date boundary |
| `test_receive_params_missing_timezone_key_resolves_utc` | state with a 7-key profile → equals the UTC bounds |

`backend/tests/test_calendar_service.py`:

- `test_narrow_profile_returns_exactly_seven_keys` (line 36) is **renamed to
  `..._eight_keys`**, its expected dict gains `"timezone": "America/Bogota"`, and the
  `_fake_creator_profile` base dict (lines 23-31) gains a `timezone` key. This test asserts
  full dict equality, so it *will* fail loudly the moment `_narrow_profile` changes — which
  is correct RED behaviour, not an accident.
- New: `test_narrow_profile_preserves_null_timezone` — `timezone=None` stays `None`, is not
  coerced.

`backend/tests/` schema/router level:

- `ProfileCreate`/`ProfileUpdate` accept a valid IANA name, accept `None`, and raise
  `pydantic.ValidationError` on `"Mars/Olympus_Mons"` and on `""`.
- Router: `PUT /api/profile` with an invalid timezone → **422**; with a valid one → 200 and
  the value round-trips through `GET /api/profile` (exit criterion 3), following the
  existing profile-router test pattern.

### TDD ordering — follow this sequence exactly

Strict TDD plus a rewrite of an existing suite has one specific failure mode worth naming:
the four boundary tests import `_period_bounds` at module scope, so the RED step makes the
**entire `test_calendar_agent.py` file fail to collect**, hiding ~40 unrelated tests behind
an `ImportError`. That is a legitimate RED for a new symbol, but it means the file is
temporarily blind. Do not interleave other work while it is uncollectable.

1. **RED** — rewrite the 4 boundary tests against `_period_bounds`; add the `_today_in`
   and boundary-proof tests. Expect `ImportError` on collection.
2. **GREEN** — add `_zone_or_utc`, `_today_in`, `_period_bounds`, rewrite `_resolve_period`.
   Full collection must be restored here, and the whole file must pass, before step 3.
3. **RED** — `receive_params` timezone tests.
4. **GREEN** — two-line `receive_params` change.
5. **RED** — `_narrow_profile` eight-key tests.
6. **GREEN** — one-line `_narrow_profile` change + the `date.min` cleanup.
7. **RED** — schema validation tests.
8. **GREEN** — `TimezoneName` alias + two field declarations + `tzdata` in
   `requirements.txt`.
9. **RED** — router 422 / round-trip tests.
10. **GREEN** — model column + Alembic revision; verify `upgrade head` / `downgrade -1`.

Steps 1-2 are the risky pair. They are first, and they are atomic: if the apply phase
stops anywhere, it must not stop between them.

### Frontend tests

- `ProfileForm.test.tsx` has a `fakeProfile` fixture typed as `Profile`; adding `timezone`
  to the interface breaks it under `tsc`/lint (Vitest itself will not catch it at runtime).
  The fixture must gain `timezone`. Same for any `Profile` fixture in
  `profileStore.test.ts`.
- New: onboarding submits a `timezone` matching
  `Intl.DateTimeFormat().resolvedOptions().timeZone` — stub `Intl.DateTimeFormat` in jsdom
  and assert the value in the `submitOnboarding` payload.
- New: `ProfileForm` renders the timezone control and includes `timezone` in the diff only
  when changed.
- New: the nudge banner renders for `timezone: null`, does not render for a set timezone,
  and does not render after dismissal (`localStorage` pre-seeded).

---

## 7. Frontend

### 7.1 Onboarding auto-detect

`frontend/features/onboarding/hooks/useOnboardingWizard.ts`. **The draft is not touched** —
timezone is never a wizard field, so `OnboardingDraft` and `INITIAL_DRAFT` stay as they
are and `TOTAL_ONBOARDING_STEPS` stays 4 (exit criterion 5). One line is added inside
`submit()`'s payload literal (line 98-110):

```ts
timezone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
```

Detected at submit time, not at hook-mount time, so it reflects the browser at the moment
of the write. `?? null` covers the (rare, old-runtime) case where `timeZone` is undefined;
the backend then stores NULL and the creator falls into the nudge path, which is the
correct degradation. `ProfileOnboardingInput` gains `timezone?: string | null`.

### 7.2 Profile edit control

`frontend/features/profile/components/ProfileForm.tsx`, following the existing pattern
exactly: `EditableFields` gains `timezone: string`; `toEditable` gains
`timezone: profile?.timezone ?? ""`; `diffEditable` needs **no change** — its generic
string branch already maps `""` → `null` and skips unchanged keys.

**Control: a `<select>` over a curated list, not a text input and not a search/geo picker.**
The proposal puts a search/geo picker out of scope, and a free-text input over ~600 IANA
names is a 422 generator. The middle path is a small module-level constant of the zones this
product's creators plausibly use — Latin America, Spain, and the major US/EU zones — added
to `frontend/shared/constants/` next to `NICHES`/`FORMATS`/`PLATFORMS`, rendered with the
same `<select>` markup as the existing `niche` field (lines 188-200), plus an empty option
labelled "Sin especificar". The detected browser zone is **prepended to the list if it is
not already in it**, so a creator whose real zone is outside the curated set can still see
and keep it rather than being silently forced off it. That single rule is what keeps a
curated list from being lossy, and it must not be dropped in implementation.

`ProfileUpdateInput` gains `timezone?: string | null`; `Profile` gains
`timezone: string | null` (required, matching the backend response contract).

### 7.3 The NULL-timezone nudge banner

New client component, `frontend/features/profile/components/TimezoneNudge.tsx`, mounted in
`frontend/app/(app)/layout.tsx` inside `SidebarShell` above `{children}` — so it appears on
every authenticated route, including `/calendar` where the symptom actually shows, and
inherits the existing layout chrome.

- **Visibility condition**: `profile !== null && profile.timezone === null && !dismissed`.
  Note it requires a *loaded* profile — a null store means "not loaded yet", not "no
  timezone", and must not flash the banner.
- **Loading**: the component runs the same idempotent mount effect `ProfileView` already
  uses (`ProfileView.tsx:16-21`), guarded additionally on `isLoading`:
  `if (!profile && !isLoading) void load();`. The store is a singleton, so on `/profile`
  the two mounts share one fetch and every other route pays at most one
  `GET /api/profile` per session. No new endpoint, no new store, no new state shape.
- **Dismissal**: `localStorage.setItem("cs.timezone-nudge.dismissed", "1")`, read once into
  `useState` via a lazy initialiser so SSR does not touch `localStorage`. Client-side only —
  no new column, no new API field, per settled decision 3.
- **Content**: one line of Spanish UI copy explaining that the calendar is being generated
  in UTC, a `next/link` to `/profile`, and a dismiss button.

### 7.4 `TimelineCards.tsx` — untouched

Line 111's browser-local `now` stays as-is (settled decision 4). Record the residual
inconsistency as a known limitation in the change record; do not add a TODO in the source,
which would read as an unfinished task rather than an accepted boundary.

---

## 8. ADR-style decision record

| # | Decision | Rationale | Rejected alternative |
|---|---|---|---|
| D1 | `String(64)` nullable, no server default | 2× the 32-char observed max IANA identifier; NULL must stay distinguishable from a deliberate `'UTC'` for the nudge to work | `String(50)` (arbitrary); `server_default='UTC'` (erases the nudge signal); `Text` (loses the "identifier" signal) |
| D2 | Add `tzdata` to `requirements.txt` | Local support comes from a **conda** package invisible to pip; there is no Dockerfile, so the deploy image must be assumed hostile | Rely on system tzdata (unverifiable — the image does not exist yet) |
| D3 | Validator degrades to accept-all when the zone set is empty | An empty set is an infra defect; rejecting every value converts it into a total outage of profile saves | Fail closed (worse than the bug being fixed) |
| D4 | `available_timezones()` computed once at import into a `frozenset` | It stats every TZPATH directory per call; unacceptable on a hot endpoint | Per-call (slow); lazy `functools.cache` (same effect, extra indirection) |
| D5 | Split `_resolve_period` into `_zone_or_utc` / `_today_in` / `_period_bounds` | Makes the calendar arithmetic pure and testable with literal dates; removes all monkeypatching from the rewritten suite | Keep one function and patch `calendar_agent.datetime` (recreates the exact fragility being repaired) |
| D6 | `now: datetime \| None = None` injection seam | Explicit injectable clock is the standard remedy for an untestable clock; documented in-docstring | `freezegun` (new dependency for 4 tests); module-global patching (see D5) |
| D7 | `tz` required positional on `_resolve_period` | One caller; a default would let a future caller silently get UTC and still look right in tests | `tz: str \| None = None` |
| D8 | `_resolve_period` never raises on a bad zone | A LangGraph node is the worst place to surface a data error; the 422 gate is upstream | Let `ZoneInfoNotFoundError` propagate |
| D9 | Timezone rides in `profile`, no new `CalendarState` key | The 12-field state contract was frozen at `content-calendar` 49/49; the dict is already there | New top-level state key (ripples through every node signature) |
| D10 | `date.min` placeholder at `calendar_service.py:131` | Obviously-a-placeholder if it ever leaks; keeps the diff at ~4 lines | Reorder `generate_calendar` to build the row after the graph (cleaner, but restructures documented Paso ordering in an over-budget change) |
| D11 | Curated `<select>` + prepend the detected zone if absent | Free text over ~600 names is a 422 generator; a bare curated list is lossy for creators outside it | Free-text input; full 600-entry select; search/geo picker (explicitly out of scope) |
| D12 | Nudge mounted in `(app)/layout.tsx`, `localStorage` dismissal | Appears on `/calendar` where the symptom shows; no new column/endpoint per settled decision 3 | Mount on `/calendar` only (misses other entry points); server-side dismissal flag (new column) |

---

## 9. Delivery shape

The proposal's two-slice recommendation stands and this design maps onto it cleanly:

- **Slice 1 — backend** (§1-§6, plus `tzdata` in `requirements.txt`). Independently
  correct: with no frontend change every profile has NULL timezone and the system resolves
  in documented UTC instead of accidental server-local. Verifiable by
  `mamba run -n contentspark pytest backend/tests`. Revertible by one `alembic downgrade -1`.
- **Slice 2 — frontend** (§7). Depends on slice 1's API contract. Verifiable by
  `pnpm --dir frontend test`.

Note for `sdd-tasks`: the `tzdata` requirements entry and the `Profile`-type fixture
updates are easy to lose between slices. `tzdata` belongs in slice 1 (step 8 of the TDD
sequence); the fixture updates belong in slice 2 and will surface as type errors, not test
failures.

## 10. Open items handed to later phases

- **Spec target file** for `content-calendar-generation` depends on whether
  `content-calendar` is archived at apply time (proposal, "Affected capabilities").
  `sdd-spec` resolves it; this design does not.
- **Alembic head contention**: the revision chains off `e7f16d584e97`. If other work lands
  a migration first, rebase `down_revision` rather than creating a branch.
- **No Dockerfile exists** despite `docker-compose.yml` declaring `build: ./backend`. That
  is a pre-existing defect outside this change's scope, but it is the reason D2 is
  mandatory rather than optional, and it should be raised separately.
