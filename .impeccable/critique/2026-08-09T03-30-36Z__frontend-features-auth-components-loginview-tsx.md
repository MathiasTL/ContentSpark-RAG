---
target: login
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 4
timestamp: 2026-08-09T03-30-36Z
slug: frontend-features-auth-components-loginview-tsx
---
Method: dual-agent (A: a62315531bdc69102 · B: a4197f901535c42e0), run sequentially rather than in parallel because both would have contended for a single Chrome instance.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Loading is text-only ("Ingresando..."); no inline validation, no spinner. |
| 2 | Match System / Real World | 3 | Spanish copy is natural, but raw English Supabase errors surface verbatim. |
| 3 | User Control and Freedom | 3 | Escape paths exist (forgot-password, signup); error cannot be dismissed. |
| 4 | Consistency and Standards | 1 | Contradicts its own DESIGN.md on gradient, scale transforms, tokens, durations and shadows. |
| 5 | Error Prevention | 2 | Only HTML `required`; no email format check, no autocomplete. |
| 6 | Recognition Rather Than Recall | 4 | Labels always visible above fields; no floating labels. |
| 7 | Flexibility and Efficiency | 1 | No `autoComplete` (password managers do not fill), no `autoFocus`, no remember-me. |
| 8 | Aesthetic and Minimalist Design | 2 | Card separates from page by only 1.30:1 (light) / 1.17:1 (dark); glass reads as absent. |
| 9 | Error Recovery | 1 | No `role="alert"`, untranslated message, detached from the field that failed. |
| 10 | Help and Documentation | 3 | Contextual links present and well placed. |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment**: Category-interchangeable. Strip the wordmark and the Spanish copy and this is a stock glass-card login: centered card, icon-prefixed inputs, gradient pill CTA, "O continúa con" divider, Google button. Nothing expresses "El Estudio de Cristal". The card uses one flat `backdrop-blur-xl` with no relationship to the three-tier glass rule, and the gradient CTA directly contradicts the system's own Primary button spec.

**Deterministic scan**: `detect.mjs` returned **exit 0, zero findings** across all three files. The mechanical detector caught nothing. Everything below came from conformance scanning against DESIGN.md and from rendered-pixel measurement. That gap is itself a finding: the detector does not know this project's rules.

**Rendered evidence**: captured at 1440x900 and 390x844, in both themes, against the running dev server. Contrast measured by decoding the PNGs and sampling actual pixels.

| Element | Light | Dark | AA (4.5:1) |
|---|---|---|---|
| Placeholder `nombre@empresa.com` | 1.86:1 | 1.96:1 | fails both |
| Footer `© 2025 CONTENTSPARK` | 2.17:1 | 2.29:1 | fails both |
| Divider `O CONTINÚA CON` | 3.88:1 | 3.82:1 | fails both |
| Submit button label (white) | 4.50:1 at left edge | 2.40:1 | fails dark |
| Link `¿Olvidaste tu contraseña?` | 5.94:1 | 5.93:1 | passes |
| Card vs page separation | 1.30:1 | 1.17:1 | — |

Contrast of white across the button gradient:

| Position | Light | Dark |
|---|---|---|
| 0% | 6.77:1 OK | 2.97:1 FAILS |
| 25% | 5.39:1 OK | 2.54:1 FAILS |
| 50% | 4.24:1 FAILS | 2.16:1 FAILS |
| 75% | 3.31:1 FAILS | 1.86:1 FAILS |
| 100% | 2.61:1 FAILS | 1.61:1 FAILS |

## Overall Impression

The screen is competent and pleasant on arrival, and genuinely broken under measurement. The single biggest opportunity is the submit button: it is simultaneously the system's most-cited rule violation and the worst accessibility failure on the page, and fixing it properly forces a real gap in DESIGN.md into the open.

Dark mode currently reads *better* than light. In light, the glass card separates from the aurora by 1.30:1 — the material the whole design thesis rests on is nearly invisible.

## What's Working

- **Always-visible uppercase labels** (LoginView.tsx:116,148) match the system's Label role exactly and keep the form scannable.
- **Password visibility toggle** (LoginView.tsx:181-198) is a real aid for a long password on mobile — the concept is right even though its implementation fails a11y.
- **The two links pass contrast in both themes** (5.94:1 / 5.93:1). `text-primary` is doing its job; it is the one colour decision on the page that is fully tokenised and theme-correct.

## Priority Issues

**[P0] The gradient submit button fails WCAG almost everywhere, and dark mode fails at every point**
- *Why it matters*: This is the primary action of the product's front door. In dark mode white-on-violet never exceeds 2.97:1 and drops to 1.61:1 at the right edge. In light it falls below 4.5:1 past the midpoint. Users with low vision cannot reliably read the button that lets them in.
- *Fix*: Flat `bg-primary` per spec, and **add an `on-primary` token to DESIGN.md**. This is a system gap I left open: dark primary `#a97dff` with white text is 2.97:1 even flat, so dark mode needs dark text on the violet button, not white. The button cannot be fixed correctly at the component level alone.
- *Command*: `$impeccable polish`
- LoginView.tsx:206

**[P0] Password toggle is invisible to screen readers and un-hittable on mobile**
- *Why it matters*: Icon-only `<button>` with no `aria-label` announces as "button" — Sam cannot know what it does. Its hit area is the bare 18x18px SVG with no padding, against the system's own 44px Regla del Pulgar.
- *Fix*: Add `aria-label` that reflects state ("Mostrar contraseña" / "Ocultar contraseña"), and padding to reach 44px.
- *Command*: `$impeccable harden`
- LoginView.tsx:181-198

**[P1] Labels are not associated with their inputs**
- *Why it matters*: No `id` / `htmlFor` pair anywhere. Clicking a label does not focus its field, and screen readers cannot announce which field is which. The labels *look* correct while being functionally decorative.
- *Fix*: Add `id` to both inputs and `htmlFor` to both labels.
- *Command*: `$impeccable harden`
- LoginView.tsx:116,134,148,173

**[P1] No `autoComplete`, no `autoFocus` — password managers do not fill this form**
- *Why it matters*: Every returning user pays a manual-typing tax on every login. This is the highest-frequency interaction in the product and it fights the browser instead of using it.
- *Fix*: `autoComplete="email"` / `autoComplete="current-password"`, and `autoFocus` on email.
- *Command*: `$impeccable harden`
- LoginView.tsx:134-141,173-180

**[P1] The error state is silent, foreign and misplaced**
- *Why it matters*: Three failures at the worst moment. No `role="alert"`, so screen-reader users get nothing. The raw Supabase string ("Invalid login credentials") is English in a Spanish-first product. And a wrong password renders as a form-wide banner far from the password field, against the system's own field-level error rule. Its colours (`border-red-200/60 bg-red-50/80 text-red-700`) have no dark pair at all.
- *Fix*: `role="alert"`; map Supabase codes to Spanish; attribute credential errors to the password field with `border-danger` plus helper text; use `danger` / `danger-container` tokens.
- *Command*: `$impeccable clarify` then `$impeccable harden`
- LoginView.tsx:33,57,106-110

**[P1] 24 theme-inert colour declarations on one screen**
- *Why it matters*: 8 hardcoded palette utilities and 16 loose hex values. `text-[#75777b]` alone appears 7 times for icons, placeholders and footer. These do not respond to the theme, which is why the placeholder measures 1.86:1 in light and 1.96:1 in dark — bad in both, for different reasons.
- *Fix*: Replace all with `on-surface-variant`, `glass-edge`, `glass-edge-soft`, `danger`.
- *Command*: `$impeccable polish`
- LoginView.tsx:85,107,121,140,153,160,179,184,214,215,218,224,249

**[P2] The glass card barely exists in light mode**
- *Why it matters*: 1.30:1 separation from the background. The structural-glass thesis is invisible precisely where it should be most legible, and the form loses its container.
- *Fix*: Raise card opacity or strengthen `glass-edge` in light; verify against the same measurement.
- *Command*: `$impeccable layout`
- LoginView.tsx:85

## Persona Red Flags

**Jordan (first-timer)**: Types a wrong password and gets an English sentence in a red bar at the top of the card, while the field that failed sits untouched below it. The recovery link "¿Olvidaste tu contraseña?" is above the error, so the problem and its fix never appear together. Nothing tells Jordan whether the email or the password was wrong.

**Sam (screen reader / keyboard)**: Three compounding failures. Labels are unassociated, so tabbing into the email field announces no name. The password toggle announces as "button". The login failure is never announced at all — no `role="alert"`. Sam can reach the form but cannot understand it, and cannot tell that a submission failed.

**Casey (mobile, one-handed)**: The password toggle is an 18px target at the right edge of the field — the hardest place to reach one-handed and less than half the required size. Submit (48px) and Google (47px) do pass. No `autoComplete` means Casey types a full password on a phone keyboard, which is exactly where that tax hurts most.

## Minor Observations

- Motion is off-spec: `duration-300` on both buttons where the system says 150ms (LoginView.tsx:206,224).
- Five `scale` transforms remain (LoginView.tsx:206,224) against the explicit ban.
- `shadow-lg` plus `shadow-primary/20` under the submit button (LoginView.tsx:206) — a violet-tinted shadow under an interactive control, which the 10% rule forbids. The card's own `0 32px 64px -16px rgba(110,44,224,0.10)` is the one sanctioned exception and is used correctly.
- Responsive radius swaps (`rounded-2xl sm:rounded-3xl` on the card, `rounded-xl sm:rounded-2xl` on both inputs) mean the form's corner language changes at 640px for no reason.
- Footer says "© 2025"; it is 2026.
- `AuthBackground` hand-codes 6 hex blobs with 6 matching `dark:` hex overrides — dual-coded by hand instead of tokenised.
- `MotionImage` declares 56x56 intrinsic but renders at 48/56px (LoginView.tsx:94-96).

## Questions to Consider

1. If white text cannot pass on the violet button in dark mode even when flat, is the dark primary wrong — or is the assumption that a primary button always carries white text wrong?
2. The glass card measures 1.30:1 against its background. Is "El Estudio de Cristal" actually being rendered, or has the metaphor stayed in the document?
3. This screen has five continuously animating background blobs and no `autoComplete`. What does that ratio say about where the effort went?
