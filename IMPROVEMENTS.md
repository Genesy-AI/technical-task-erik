# TinyEnginy — Codebase Improvements & Technical Roadmap

> **Status:** Proposal · **Owner:** Erik Pastor Rios · **Last updated:** 2026-10-18
>
> Findings come from a review of `backend/` and `frontend/` done while fixing the CSV and email-verification bugs and shipping the lead fields and phone enrichment. Each item is a ticket: **problem → impact → proposal → effort**. Effort: S (≤1 day), M (2–4 days), L (1–2 weeks).

## TL;DR

The product works for a demo, but three classes of problems will hurt us as soon as we have real customers:

1. **Correctness drift between frontend and backend.** Contracts are written by hand on both sides and have already diverged: some endpoints are broken today.
2. **Long-running work tied to HTTP requests and a single process.** Temporal, the API and the worker share one Node process; enrichment results reach the UI through an in-memory bus.
3. **No guard rails.** Input is never validated, there is no auth, every lead is loaded at once, and CI/lint/typecheck are not enforced (the frontend typecheck was red on `main`).

Recommended order: **Now** = contract and safety fixes, access control, and guard rails (hooks, lint, guidelines): cheap, and they remove live bugs and stop new ones. **Next** = scalability of data and jobs, plus finer-grained permissions. **Later** = observability and product depth.

---

## 🔴 Now (next sprint)

### IMP-1 · Fix broken lead CRUD contracts — S
**Problem.** The frontend and backend disagree on several endpoints:
- `api.leads.update` sends `PUT /leads/:id`, but the backend only exposes `PATCH`, so every update returns 404.
- `api.leads.create` sends `firstName`, but the backend reads `name`, so every create returns 400.
- The `PATCH` handler runs `String(name)` / `String(email)`, so omitted fields are stored as the literal string `"undefined"`.
- `getOne` and `update` output types don't match what the backend returns.

**Impact.** Create and edit are silently broken; nobody noticed because nothing tests the contract.
**Proposal.**
- Fix the verbs and payload names, and make `PATCH` a real partial update.
- **Contract tests:** run the frontend's real API client (`api.leads.*`) against a real backend on a temporary DB, one test per endpoint. They catch what types can't: wrong HTTP verb, wrong path, renamed fields. All of today's breakages would have failed. With a single consumer in the same repo, this is cheaper than consumer-driven tooling (Pact); revisit if external consumers appear.
- IMP-2 then makes type drift a compile error, and these tests guard the wire.

**Acceptance.** Every endpoint in `frontend/src/api/modules` has a contract test, and they run in CI (IMP-3).

### IMP-2 · Shared, validated API contract — M
**Problem.** Request bodies are validated by hand-written `typeof` checks; types are duplicated in `frontend/src/api/types` and implicitly in Prisma. Country-code normalization (`backend/src/utils/countryCodes.ts` and `frontend/src/utils/countryCodes.ts`, each with its own tests), field validators and the template-field registry now exist on **both** sides.
**Proposal.**
- Turn the repo into a pnpm workspace with a `packages/contracts` package: zod schemas for every request and response, plus shared validators (country codes, LinkedIn URL, years). Each validator is written and tested once; the backend and the CSV preview import the same function, and `i18n-iso-countries` becomes a dependency of the package only.
- Backend: one `validate(schema)` middleware that returns 400 with field-level errors.
- Frontend: infer types from the schemas (`z.infer`) and stop hand-writing them.
- Optional follow-up: generate an OpenAPI doc from the schemas (zod-to-openapi) for partners.

### IMP-3 · Quality gates: git hooks + CI — S
**Problem.** Nothing runs on PRs. `tsc -b` was failing on `main`. Frontend ESLint doesn't run at all (legacy `.eslintrc` on ESLint 9), and the backend has no lint.
**Proposal.** Layered, fastest feedback first:
- **pre-commit** (lefthook or husky + lint-staged): prettier and eslint on *staged files only*, kept under ~5s so nobody bypasses it.
- **pre-push:** `tsc` for both apps and unit tests (`vitest related` for changed files).
- **CI stays the source of truth**, because hooks can be skipped (`--no-verify`), aren't installed on every machine, and never run for Dependabot or the GitHub UI. Slow suites (Temporal workflow tests, end-to-end from IMP-17) are CI-only.

CI details:
- Add a GitHub Actions workflow on every PR: `pnpm install --frozen-lockfile`, `tsc` for both apps, `vitest`, `eslint`, `prettier --check`, and `prisma migrate diff` to catch schema changes that have no migration.
- Make it a required check.
- Group the Dependabot PRs: there are 6 open bumps right now.

### IMP-4 · Stop committing the database; fix env handling — S
**Problem.**
- `backend/prisma/dev.db` is tracked, so every local migration or import dirties git and causes merge conflicts.
- `.env.sample` documents a MySQL `DATABASE_URL` that is never read: SQLite is hardcoded in `schema.prisma`.
- Provider API keys and the Temporal address used to be hardcoded.

**Proposal.**
- Untrack `dev.db`, add it to `.gitignore`, and add a `prisma db seed` script that builds demo data from `docs/*.csv`.
- Read `DATABASE_URL` from env.
- Add one typed config module (zod-validated `process.env`) and fail fast when required secrets are missing.

### IMP-5 · Destructive actions need confirmation — S
**Problem.** Clicking *Delete* removes the selected leads immediately: no confirmation, no undo.
**Proposal.** A confirmation dialog stating the count, plus soft delete (`deletedAt`) so the 30-day undo/restore in IMP-11 has something to restore.

### IMP-13 · Authentication, tenant isolation & API hardening — M
**Problem.** There is no authentication, CORS is `*`, and every lead is global. Anyone who can reach the API can read, export or delete all leads. Leads are personal data (GDPR), so this blocks the **first** external customer, not the hundredth.
**Proposal (Now).**
- Authentication: managed provider or session/JWT.
- `organizationId` on `lead`, with every query scoped by it through a Prisma extension or middleware.
- A CORS allowlist from config.
- Request body size limits.
- Basic per-IP and per-user API rate limiting.

**Why now.** Retrofitting tenant scoping gets more expensive with every table and endpoint we add (enrichment runs, templates…).
**Follow-ups (Next):** roles/permissions, audit log, per-tenant quotas for enrichment spend (ties into IMP-12).
**Scale.** For "many users" load concerns specifically, see IMP-7 (Postgres), IMP-6 (worker split) and IMP-10 (pagination).

### IMP-18 · Frontend guidelines, enforced by lint — S
**Problem.** Without written conventions, each feature copies the nearest file. That's how `LeadsList.tsx` grew and hand-rolled modals multiplied. The cleanup (IMP-15) can be gradual; *stopping the pattern from spreading* should not.
**Proposal.**
- Fix ESLint (flat config).
- A short `frontend/CONTRIBUTING.md`, with a lint rule for each guideline where possible:
  - one data hook per resource (`useLeads`, `useLeadActions`); no `api.*` calls inside components
  - a component-size budget (`max-lines` warning at ~200)
  - accessible headless primitives (Radix or React Aria) for dialogs, menus and comboboxes; no new hand-rolled ones
  - no new `any` / `$TSFixMe` (`@typescript-eslint/no-explicit-any`)
  - shared UI states (loading, empty, error) as components
- An axe accessibility check in CI.
- Review checklist item: "follows CONTRIBUTING.md".

---

## 🟠 Next (this quarter)

### IMP-6 · Split the Temporal worker from the API — M
**Problem.** `index.ts` boots both Express and the Temporal worker. A crash or CPU spike in one takes down the other. They can't be scaled independently, and each API deploy restarts in-flight activities. The SSE bus (`events/leadEvents.ts`) relies on both living in the same process.
**Proposal.**
- Give the worker its own entrypoint (`pnpm worker`) and deployment.
- Swap the in-memory `LeadEvents` implementation for Redis pub/sub or Postgres `LISTEN/NOTIFY`. The interface already exists, so callers don't change.
- Have each process create one shared Temporal client at boot (partly done for email verification and phone enrichment).

### IMP-7 · Move to Postgres — M
**Problem.** SQLite has a single writer. Bulk import, enrichment activities and message generation all write row by row and will contend for the lock under load. There are no indexes beyond the primary key.
**Proposal.**
- Postgres (Neon or RDS).
- Native enums for the enrichment states.
- Indexes on `email` and on `(firstName, lastName)` for the dedupe lookup.
- Statuses with `updatedAt` so stuck jobs can be found.

### IMP-8 · Bulk paths are N+1 — S/M
**Problem.**
- `/leads/bulk` inserts one row at a time and builds one giant `OR` query for duplicates.
- `/leads/generate-messages` updates one row at a time.
- `/leads/verify-emails` and `/leads/enrich-phone` start one workflow per lead in a loop.

**Proposal.**
- Use `createMany` / a transaction for import.
- Batch the message updates.
- For enrichment above about 100 leads, start a single parent "batch" workflow that fans out child workflows; this also gives us batch progress for free.
- Run large CSVs as a background import job with a progress bar, instead of one request.

### IMP-9 · Duplicate detection is on the wrong key — S
**Problem.** Duplicates are detected by `firstName + lastName`, both in the import preview and on the backend. Two different "John Smith"s collide, while the same person with a different spelling of their name gets imported twice. `leads-with-errors.csv` has two different people sharing one email.
**Proposal.**
- Dedupe on normalized email (lowercased, trimmed) with a unique index.
- Show the conflicts in the preview with a per-row choice: *skip / update existing*.

### IMP-10 · Pagination, sorting, filtering — M
**Problem.** `GET /leads` returns the whole table and the UI renders every row. "Select all" selects every lead in the database.
**Proposal.**
- Cursor-based pagination plus server-side sort and filter: status, country, "has phone".
- A virtualized table (TanStack Table + Virtual).
- An explicit "select all N matching" pattern.

### IMP-11 · Enrichment platform, not one-off features — M
**Problem.** Email verification, phone enrichment and the gender-guess PR each add their own columns, endpoint, workflow and UI badge.
**Proposal.**
- A generic `enrichment_run` table: lead, type, status, provider, attempts, error, timestamps. Per-lead status columns become a projection of it.
- One `POST /leads/enrich { type }` endpoint and a reusable `<EnrichmentStatusBadge>`.
- Provider config (order, rate limits, timeouts) in the DB or a feature-flag service, so ops can reorder the phone waterfall without a deploy.
- Track hit rate, latency and cost per provider to inform that order.
- Store phones in E.164 with `libphonenumber-js`. Nimbus already returns a country code we currently drop.

### IMP-12 · Provider rate limits & cost control — S/M
**Current state.** Each phone provider has its own Temporal task queue with `maxTaskQueueActivitiesPerSecond` from env, and a 429 response is retried honouring `Retry-After`.
**Finding.** When tested locally, Temporal's task-queue limit holds the *average* rate but releases queued tasks in bursts (e.g. 1 call, then 3 at once). A provider that enforces a strict per-second limit would answer some of those with 429; they are retried after `Retry-After`, but the cost is wasted calls and added latency.
**Next.**
- Smooth the bursts: a shared token bucket in front of each provider (Redis), or the per-queue rate-limit config in newer Temporal server versions. Validate against the provider's real limits once they're published.
- Per-tenant quotas.
- Circuit breaker per provider: skip a provider for N minutes after X% failures, instead of every workflow paying for its retries.
- Cache results by `(provider, input hash)` so we never pay twice for the same lookup.

---

## 🟢 Later

### IMP-14 · Observability — M
- Structured logs (pino) with request IDs.
- OpenTelemetry traces linking the HTTP request, the Temporal workflow and the provider HTTP call. Temporal has an OTel interceptor.
- Sentry on both apps.
- Dashboards: enrichment success rate per provider, queue latency, import errors.

### IMP-15 · Frontend architecture — M (gradual)
- `LeadsList.tsx` (~330 lines) mixes data fetching, mutations, dropdown state and the table. Split it into `useLeads` / `useLeadActions` hooks plus presentational components. Do it as part of feature work that touches the file, following IMP-18.
- The custom `useApiMutation` type machinery (ts-toolbelt paths) is only used by `create` and is hard to follow. Prefer a plain `queryOptions` / `mutationOptions` factory.
- Replace the hand-rolled dropdowns and modals (no focus trap, no outside-click close on *Enrich*, no focus restore) with the headless kit chosen in IMP-18.
- Error states: the "Refresh page" button should be a `refetch()`.

### IMP-16 · Message composition → real templating — M
The template engine is a regex replace that fails the lead whenever a field is missing. Next steps:
- Fallbacks: `{firstName|there}`.
- Saved templates.
- Per-lead preview before writing.
- Optionally, AI-personalised messages generated in a Temporal workflow with human approval.

### IMP-17 · Testing strategy — M
Today we have unit tests for pure utilities and Temporal workflow tests. The target test pyramid:
- **Contract tests** (IMP-1): the frontend's API client against a real backend.
- **API integration tests:** supertest against a temporary SQLite/Postgres DB.
- **Workflow tests:** `@temporalio/testing` with time skipping, so retry and timeout behaviour is deterministic. Already in place for email verification and phone enrichment.
- **Full-stack end-to-end tests:** Playwright against the real stack: backend, frontend, Temporal dev server and a seeded DB.
  - Third-party providers point (via the existing env-configurable base URLs) at a local stub server, with scripted no-data, 500, 429 and slow responses. This keeps runs deterministic and free.
  - Happy path: import CSV → verify emails → enrich phone → generate messages, checking that live SSE updates reach the table.
  - A couple of failure paths: a provider down → "Couldn't complete, retry"; an invalid CSV → warnings shown.
  - One smoke run on every PR (~2 min), the full suite nightly. Traces and screenshots are uploaded on failure.

---

## Roadmap at a glance

| Slot | Items | Outcome |
|---|---|---|
| Sprint 1 | IMP-1, IMP-3, IMP-4, IMP-5, IMP-18 | No known broken flows; hooks and CI block regressions; frontend conventions written and linted |
| Sprint 2 | IMP-13, IMP-2, IMP-9 | Authenticated, tenant-scoped API; one source of truth for contracts; correct dedupe |
| Sprint 3–4 | IMP-6, IMP-7, IMP-8, IMP-17 (end-to-end) | Worker scales independently; bulk ops at 10k+ leads; full-stack happy path tested on every PR |
| Sprint 5–6 | IMP-10, IMP-11, IMP-12 | Enrichment is a platform; providers are configurable and observable |
| Ongoing | IMP-15 | Gradual frontend cleanup, done with the feature work that touches each file |
| Later | IMP-14, IMP-16, IMP-13 follow-ups | Observability, richer templating, roles/audit |

## Risks & open questions
- **Postgres migration timing.** Doing IMP-7 before IMP-11 avoids migrating the enrichment schema twice.
- **Provider contracts.** The live Nimbus API already differs from its docs (`phoneNmbr` vs `number`). Add contract tests that hit provider sandboxes nightly and alert on drift.
- **SSE behind proxies or load balancers.** Needs sticky sessions or a shared bus (IMP-6), plus disabled response buffering on the proxy.
