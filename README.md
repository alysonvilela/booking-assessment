# Pentice API

HTTP API boilerplate — infrastructure and conventions ready to receive domain
features: runtime, database, migrations, observability, error handling and tests
already wired up.

## Stack

- **Runtime:** Bun
- **HTTP:** [Elysia](https://elysiajs.com) + `@elysiajs/swagger` (OpenAPI at `/openapi`)
- **Database:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) (`postgres-js` driver)
- **Observability:** OpenTelemetry → OTLP (one span per request)
- **Quality:** Biome (lint/format), TypeScript `strict`, Vitest

## Layout

```
src/
  index.ts          # builds the Elysia app, health, boot and shutdown
  infra/
    db.ts           # drizzle/postgres connection and client export
    otel.ts         # NodeSDK + OTLP exporter
  lib/
    config.ts       # env validation (TypeBox) — single source of config
    logger.ts       # structured JSON logging
    result.ts       # Result/Ok/Fail + tryCatch
  db/
    schema.ts       # drizzle tables (domain)
    migrate.ts      # migration runner
    migrations/     # .sql + meta/_journal.json
test/
  global-setup.ts   # creates/drops an isolated schema per run
  setup-env.ts      # injects env before config is imported
  *.test.ts
```

## Requirements

- Bun
- Docker (for Postgres)

## Running

```bash
docker compose up -d db     # Postgres on localhost:5432 (db: pentice_dev)
bun install
bun run db:generate         # generate a migration from src/db/schema.ts
bun run db:migrate          # apply migrations
bun run dev                 # API on http://localhost:3000
```

Interactive docs: <http://localhost:3000/openapi> · Health: `/health`.

## Scripts

| Script | Description |
| --- | --- |
| `dev` | Run with watch |
| `start` | Run without watch |
| `build` | Bundle to `dist/` (Bun) |
| `typecheck` | `tsc --noEmit` (includes `test/`) |
| `test` | Vitest (isolated Postgres schema per run) |
| `lint` / `format` | Biome |
| `db:generate` | Generate a migration from the schema |
| `db:migrate` | Apply migrations |

## Configuration

`src/lib/config.ts` is the single source: it validates `process.env` at boot
(TypeBox) and converts types. Keys: `NODE_ENV`, `DATABASE_URL`, `API_PORT`,
`WEB_ORIGINS`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`. An empty
`OTEL_EXPORTER_OTLP_ENDPOINT` means telemetry off (no-op spans) — the local
behavior.

## Decisions

- **Result instead of exceptions** for predictable I/O (`lib/result.ts`); edge
  errors become HTTP responses via `onError` (`422` validation, `400` parse,
  `500` the rest).
- **Health = readiness**: besides `status`, it runs `select 1` and returns `503`
  when Postgres is down.
- **Graceful shutdown**: `SIGTERM`/`SIGINT` stop the app, the OTLP exporter and
  the pool.
- **Isolated tests**: each run uses a random Postgres schema (migrations applied
  to it) and drops it at the end — no truncate, no ordering.
