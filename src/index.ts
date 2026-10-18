import { cors } from "@elysia/cors";
import { swagger } from "@elysiajs/swagger";
import { type Span, trace } from "@opentelemetry/api";
import { Elysia, t } from "elysia";
import { sqlClient } from "./infra/db";
import { initializeOtel, shutdownOtel } from "./infra/otel";
import { env } from "./lib/config";
import { logger } from "./lib/logger";
import { errorMessage, isFail, tryCatch, tryCatchSync } from "./lib/result";

type OtelStore = { otelSpan?: Span };

const spanOf = (store: unknown): Span | undefined =>
	(store as OtelStore | undefined)?.otelSpan;

const HealthBody = t.Object({
	status: t.Union([t.Literal("ok"), t.Literal("degraded")]),
	db: t.Union([t.Literal("up"), t.Literal("down")]),
});

export const createApp = () =>
	new Elysia()
		.onRequest(({ request, store }) => {
			const url = new URL(request.url);
			(store as OtelStore).otelSpan = trace
				.getTracer(env.OTEL_SERVICE_NAME)
				.startSpan(`${request.method} ${url.pathname}`);
		})
		.onAfterResponse(({ store, set }) => {
			const span = spanOf(store);
			if (!span) return;
			span.setAttribute("http.status_code", Number(set.status ?? 200));
			span.end();
		})
		.onError(({ code, error, set, request, store }) => {
			if (code === "VALIDATION") {
				set.status = 422;
				return { error: "invalid data" };
			}
			// A body that isn't valid JSON is a 400, not a 500: without this a
			// truncated body fell through to "internal error".
			if (code === "PARSE") {
				set.status = 400;
				return { error: "invalid body" };
			}
			spanOf(store)?.recordException(
				error instanceof Error ? error : new Error(String(error)),
			);
			logger.error("unhandled error", {
				err: errorMessage(error),
				path: new URL(request.url).pathname,
			});
			set.status = 500;
			return { error: "internal error" };
		})
		.use(cors({ origin: env.WEB_ORIGINS, credentials: true }))
		.use(
			swagger({
				path: "/openapi",
				documentation: {
					info: {
						title: "Pentice API",
						version: "1.0.0",
						description:
							"Boilerplate de API: Elysia + Drizzle/Postgres + OpenTelemetry.",
					},
					tags: [{ name: "health" }],
				},
			}),
		)
		.get(
			"/health",
			async ({ set }) => {
				// Readiness, not liveness: the ping confirms the Postgres
				// connection is alive before reporting the API as healthy.
				const ping = await tryCatch(() => sqlClient`select 1`);
				if (isFail(ping)) {
					set.status = 503;
					return { status: "degraded" as const, db: "down" as const };
				}
				return { status: "ok" as const, db: "up" as const };
			},
			{
				detail: { tags: ["health"] },
				response: { 200: HealthBody, 503: HealthBody },
			},
		);

export const app = createApp();

if (import.meta.main) {
	const otel = tryCatchSync(() =>
		initializeOtel(env.OTEL_SERVICE_NAME, env.OTEL_EXPORTER_OTLP_ENDPOINT),
	);
	if (isFail(otel)) logger.error("failed to initialize otel");

	// SIGTERM (docker stop) and SIGINT (Ctrl-C) close connections before exiting,
	// so in-flight requests aren't dropped and the OTLP exporter isn't left hanging.
	const shutdown = async (signal: string) => {
		logger.info("shutting down", { signal });
		await tryCatch(async () => {
			await app.stop();
		});
		await tryCatch(async () => {
			await shutdownOtel();
		});
		await tryCatch(() => sqlClient.end());
		process.exit(0);
	};
	process.once("SIGTERM", () => void shutdown("SIGTERM"));
	process.once("SIGINT", () => void shutdown("SIGINT"));

	app.listen(env.API_PORT);
	console.log(`pentice api on :${env.API_PORT}`);
}
