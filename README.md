# Pentice API

HTTP API boilerplate — infrastructure and conventions ready to receive domain
features: runtime, database, migrations, observability, error handling and tests
already wired up.

## Stack

- **Runtime:** Bun
- **HTTP:** [Elysia](https://elysiajs.com) + `@elysiajs/swagger` (OpenAPI at `/openapi`)
- **Database:** PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) (`postgres-js` driver)
- **Cache/locks:** Valkey (Redis) via `ioredis`
- **Observability:** OpenTelemetry → OTLP (one span per request)
- **Quality:** Biome (lint/format), TypeScript `strict`, Vitest

## Layout

```
src/
  index.ts          # builds the Elysia app, health, boot and shutdown
  infra/
    db.ts           # drizzle/postgres connection and client export
    redis.ts        # Valkey/Redis client (ioredis)
    otel.ts         # NodeSDK + OTLP exporter
  lib/
    config.ts       # env validation (TypeBox) — single source of config
    logger.ts       # structured JSON logging
    result.ts       # Result/Ok/Fail + tryCatch
  domain/
    events/         # domain-event bus + collect-then-dispatch plugin
    idempotency.ts  # withIdempotency + Valkey/Redis-backed store
  db/
    schema.ts       # drizzle tables
    migrate.ts      # migration runner
    migrations/     # .sql + meta/_journal.json
test/
  global-setup.ts   # creates/drops an isolated schema per run
  setup-env.ts      # injects env before config is imported
  *.test.ts
```

## Requirements

- Bun
- Docker (for Postgres and Valkey/Redis)

## Running

```bash
docker compose up -d db redis   # Postgres :5432 (pentice_dev) + Valkey :6379
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
(TypeBox) and converts types. Keys: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`,
`API_PORT`, `WEB_ORIGINS`, `OTEL_SERVICE_NAME`, `OTEL_EXPORTER_OTLP_ENDPOINT`. An
empty `OTEL_EXPORTER_OTLP_ENDPOINT` means telemetry off (no-op spans) — the local
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

## Patterns

### Domain events — collect now, dispatch after the response

Handlers never call subscribers inline. They record events on the request-scoped
collector and answer immediately; the events are fanned out to subscribers only
after the response is sent, so a slow or failing subscriber can't delay or break
the HTTP response.

```ts
import { createEvent, InMemoryEventBus, eventsPlugin } from "./domain/events";

const bus = new InMemoryEventBus();
bus.subscribe<{ id: string }>("BookingCreated", async (event) => {
	// a usecase reacting to the event (its own transaction, retries, etc.)
});

new Elysia()
	.use(eventsPlugin(bus))
	.post("/bookings", async ({ events, body }) => {
		const booking = await createBooking(body);
		events.add(createEvent("BookingCreated", { id: booking.id }));
		return booking; // 200 goes out here; dispatch happens after
	});
```

`InMemoryEventBus` is in-process. Swap it for an outbox + broker by implementing
the `EventBus` interface — call sites don't change.

### Idempotency — run at most once per key

`withIdempotency` reserves `(scope, key)` before running, replays the stored
response for duplicates, rejects a concurrent duplicate while the first is still
running, and releases the key when the run throws so the client can retry.

```ts
import { hashRequest, withIdempotency } from "./domain/idempotency";

const { status, body, replayed } = await withIdempotency(
	{ scope: "bookings", key: request.headers["idempotency-key"], requestHash: hashRequest(payload) },
	async () => ({ status: 201, body: await createBooking(payload) }),
);
```

Backed by Valkey/Redis: the key is claimed with an atomic `SET key value NX PX
ttl`, so concurrent requests across nodes can't both win, and entries expire on
their own. A failure `DEL`s the key so the client can retry.
