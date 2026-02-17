# CiteCreate Engine

![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Vitest](https://img.shields.io/badge/Tests-Vitest-6E9F18?logo=vitest&logoColor=white)

Modular platform/engine that ingests PDFs, enriches metadata, extracts evidence claims with LLMs, generates social-ready post variants, and exports portfolio visuals (PNG/JPEG).

## Portfolio Highlights
- End-to-end pipeline: upload -> parse -> enrich -> extract -> generate -> export.
- Multi-provider LLM layer with resilience: Gemini primary + Groq fallback.
- Strict contract validation with Zod (LLM-safe JSON outputs).
- Persistent job tracing (`JobRun`) with stage status, duration, and errors.
- Export engine with Playwright HTML-to-image templates.
- Responsive UI for upload, processing, editing posts, and generating assets.

## Architecture (Layered)
- `app/`: Next.js App Router pages + API route handlers.
- `src/contracts/`: Zod schemas and inferred TS types for extraction/post contracts.
- `src/lib/pdf/`: PDF parsing + DOI detection.
- `src/lib/external/`: Crossref + Unpaywall clients.
- `src/lib/llm/`: provider interface, Gemini/Groq providers, router with retry/fallback.
- `src/lib/pipeline/`: orchestration + stage/job persistence.
- `src/lib/export/`: template rendering + Playwright export engine.
- `prisma/`: PostgreSQL schema and migrations.

## ASCII Diagram
```text
          ┌────────────────────────────┐
          │      Next.js UI/API        │
          │  /upload /process /status  │
          └──────────────┬─────────────┘
                         │
                         v
               ┌───────────────────┐
               │  Pipeline Service │
               │ parse -> enrich   │
               │ -> extract -> gen │
               │ -> export         │
               └───────┬───────────┘
                       │
    ┌──────────────────┼──────────────────┐
    v                  v                  v
┌───────────┐   ┌──────────────┐   ┌──────────────┐
│ PDF Layer │   │ External APIs │   │ LLM Router   │
│ pdf-parse │   │ Crossref/OA   │   │ Gemini->Groq │
└─────┬─────┘   └──────┬───────┘   └──────┬───────┘
      │                │                  │
      └────────────────┴──────────────────┘
                       v
              ┌───────────────────┐
              │ PostgreSQL/Prisma │
              │ Document/Metadata │
              │ Extraction/Posts  │
              │ Export/JobRun     │
              └───────────────────┘
```

## Local Setup
1. Install deps:
```bash
npm install
```
2. Copy env:
```bash
cp .env.example .env
```
3. Start local Postgres:
```bash
npm run db:up
```
4. Generate Prisma client and migrate:
```bash
npm run prisma:generate
npm run prisma:migrate
```
5. Install Playwright Chromium (required for export):
```bash
npm run playwright:install
```
6. Run app:
```bash
npm run dev
```

## Environment Variables
From `.env.example`:
- `DATABASE_URL`: local PostgreSQL connection string.
- `GEMINI_API_KEY`: Gemini provider key.
- `GROQ_API_KEY`: Groq provider key.
- `UNPAYWALL_EMAIL`: contact email required by Unpaywall API.
- `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`: local Docker DB bootstrap.

## LLM Providers + Fallback Strategy
- Providers implement a shared `LLMProvider` interface:
  - `extractClaims(input)`
  - `generatePosts(input)`
- Both providers enforce strict JSON output prompts.
- Returned JSON is validated against Zod schemas.
- On invalid JSON/schema mismatch:
  - one repair prompt attempt is executed,
  - then validation is retried.
- Router behavior:
  - primary: Gemini,
  - retries on `429` or `5xx` with backoff `500ms`, `1500ms`,
  - fallback: Groq,
  - if both fail => `LLM_UNAVAILABLE`.

## Zod Validation (What/Why)
Validated contracts:
- `Extraction`: claims, PICO-like fields, confidence, citations.
- `Post`: platform/content/citation block (+ optional hashtags).

Why:
- protects DB integrity from malformed LLM outputs,
- provides predictable API contracts for UI,
- enables safe repair flow instead of silently accepting bad JSON.

## Tests
Run full test suite:
```bash
npm test
```
Type-check + lint + tests:
```bash
npm run check
```

Current coverage includes:
- contract validation schemas,
- DOI/abstract extraction logic,
- external client parsing + error handling,
- LLM router retry/fallback behavior.

## Limitations
- Safe mode is enforced when OA is false/unknown:
  - only abstract/snippet is sent to LLM (not full text).
- External APIs are rate-limited and network-dependent.
- Unpaywall enrichment is best-effort and may be partial.
- Export currently supports PNG/JPEG via Playwright (no PDF render yet).
- Template set is intentionally minimal (`carousel_basic`, `myth_vs_fact`, `clinical_summary`).

## Roadmap
- Add `OpenAIProvider` implementing the same `LLMProvider` interface.
- Add queue/worker execution mode for background processing.
- Add richer export templates and design systems.
- Add auth and per-user workspaces.
- Add observability dashboards for stage-level metrics.

## Portfolio Checklist
- [x] Modular architecture with clear boundaries.
- [x] Strong schema-first contracts (Zod + TypeScript).
- [x] Database-backed orchestration with stage telemetry.
- [x] Multi-LLM resiliency strategy.
- [x] Automated tests for core behaviors.
- [x] Visual export artifacts for recruiter demos.
