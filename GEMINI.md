# ContentSpark Gemini CLI Context

Use this file when working on ContentSpark with Gemini CLI. Follow it as the primary project context, together with `CLAUDE.md`, `FRONTEND_SPECS.md`, `README.md`, and the files closest to the task.

## Goal

Advance the ContentSpark frontend without breaking the existing architecture, design language, or backend contracts.

## Project Snapshot

- Frontend: Next.js 16 App Router + React 19 + TypeScript + Tailwind CSS 4.
- Auth: Supabase Auth in the frontend, backend verification through FastAPI.
- UI direction: glassmorphism with soft gradients, blur, rounded surfaces, and a polished chat-centric experience.
- Backend access: the frontend never talks to the database directly; all data flows through the FastAPI API.

## Read First

Before changing code, inspect the most relevant files in this order:

1. `CLAUDE.md`
2. `FRONTEND_SPECS.md`
3. `README.md`
4. `frontend/app/layout.tsx`
5. `frontend/app/page.tsx`
6. The feature you are modifying under `frontend/features/`

If the task touches chat, also inspect `frontend/features/chat/ChatView.tsx` and related components or hooks.

## Frontend Rules

- Prefer the App Router structure already in place.
- Keep route files thin; put real UI and logic under `frontend/features/`.
- Use Client Components only when state, effects, or browser APIs are needed.
- Keep state local and minimal; prefer props and composition over global stores.
- Reuse existing shared UI primitives under `frontend/shared/components/` when possible.
- Do not introduce direct database access or backend shortcuts in the frontend.
- Keep API calls consistent with the existing client helpers in `frontend/shared/lib/` or `frontend/lib/`.

## Design Rules

- Preserve the existing glassmorphism visual language.
- Use Inter and the established weight hierarchy when typography changes are needed.
- Avoid generic dashboard layouts and default gray-white UI.
- Favor subtle depth, gradients, layered surfaces, and purposeful spacing.
- Make mobile behavior first-class, not an afterthought.

## Implementation Rules

- Make the smallest change that solves the problem.
- Respect the current feature boundaries and folder structure.
- Do not refactor unrelated code while implementing a UI change.
- Keep generated code consistent with the surrounding style.
- When in doubt, inspect nearby implementations and follow the local pattern.

## Verification

After editing code, verify it with the appropriate checks for the scope of the change:

- TypeScript or React changes: run lint and any relevant frontend tests.
- UI changes: verify responsive behavior and the main user flow.
- API integration changes: confirm request payloads and headers match the backend contract.

## Safety

- Do not modify backend code unless the task explicitly requires it.
- Do not expose secrets, Supabase service keys, or other credentials in the frontend.
- Ask before making destructive changes, broad renames, or cross-cutting architectural shifts.

## Notes For Gemini CLI

- If you need broader project context, read the repository docs first instead of guessing.
- If a task requires reusable instructions, keep them in this `GEMINI.md` file rather than renaming `.claude`.
- `.claude/` is for Claude-specific skills and should remain unchanged for Gemini CLI workflows.