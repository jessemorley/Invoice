# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev      # start dev server at localhost:3000
npm run build    # production build (runs type-check + Next.js compiler)
npm run lint     # ESLint
```

There are no automated tests. Verify changes manually via the dev server.

## Stack

- **Next.js 16** (React 19) — APIs differ significantly from training data. Read `node_modules/next/dist/docs/` before writing code.
- **Supabase** — auth + Postgres database with RLS. Types generated in `src/lib/database.types.ts`.
- **Tailwind CSS v4** — configured in `src/app/globals.css`, not `tailwind.config.js`.
- **shadcn/ui** — components in `src/components/ui/`. Always use the `shadcn` MCP skill before adding a new component.
- **Inngest** — background job queue for invoice email delivery (`src/inngest/`).
- **Resend** — transactional email provider, called from Inngest functions only.
- **@react-pdf/renderer** — PDF generation for invoices, served via `GET /api/invoices/[id]/pdf`.

## Server-side caching

Queries in `src/lib/queries.ts` use Next.js `"use cache"` + `cacheTag(CACHE_TAGS.xxx)`. Mutations must call `revalidateTag(CACHE_TAGS.xxx)` (server-side) *and* `invalidate(tag)` (client-side) to keep both the Next.js cache and the SPA state in sync.

`CACHE_TAGS` keys map 1:1 to `InvalidationTag` values in `src/lib/invalidate.ts`.

## Auth pattern

All server actions and API routes call `getAuth()` from `src/lib/auth.ts`, which returns `{ userId, token }`. The `token` (JWT) is passed to `createTokenClient(token)` from `src/lib/supabase.ts` to create a per-request Supabase client that respects RLS policies.

```ts
const { userId, token } = await getAuth();
const supabase = createTokenClient(token);
```

Never use the cookie-based `createClient()` (from `src/lib/supabase-server.ts`) inside server actions — that is only for auth checks in middleware/layout.

## Background email jobs (Inngest)

Invoice emails are queued via Inngest events (`invoice/email.scheduled`). The Inngest function in `src/inngest/send-invoice-email.ts`:
1. Mints a short-lived user token via admin API
2. Calls `POST /api/invoices/[id]/pdf` internally (requires `INTERNAL_API_SECRET` header)
3. Sends via Resend with the PDF attached
4. Updates `scheduled_emails` row status to `sent`
5. On final failure, reverts invoice status from `issued` → `draft`

The Inngest route is at `src/app/api/inngest/route.ts`.

## Database migrations

Migrations live in `supabase/migrations/`. Run `supabase db push` or apply manually via the Supabase dashboard. Types should be regenerated after schema changes with `supabase gen types typescript`.

## Workflow Orchestration

### 1. Plan Mode Default

- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately
- Use plan mode for verification steps, not just building

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update tasks/lessons.md with the pattern
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Ask yourself: "Would a staff engineer approve this?"
- Run build and lint before committing

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- Skip this for simple, obvious fixes — don't over-engineer

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them

## Task Management

1. Plan First: Write plan to tasks/todo.md with checkable items
2. Verify Plan: Check in before starting implementation
3. Track Progress: Mark items complete as you go
4. Explain Changes: High-level summary at each step
5. Document Results: Add review section to tasks/todo.md
6. Capture Lessons: Update tasks/lessons.md after corrections

## Core Principles

- Simplicity First: Make every change as simple as possible. Impact minimal code.
- No Laziness: Find root causes. No temporary fixes. Senior developer standards.
- Minimal Impact: Only touch what's necessary. No side effects with new bugs.
