import { cors } from "@elysia/cors";
import { swagger } from "@elysiajs/swagger";
import { type Span, trace } from "@opentelemetry/api";
import { Elysia, t } from "elysia";
import { env } from "./config/env";
import { initializeOtel, shutdownOtel } from "./config/otel";
import { logger } from "./lib/logger";
import { errorMessage, isFail, tryCatch, tryCatchSync } from "./lib/result";

type OtelStore = { otelSpan?: Span };

const spanOf = (store: unknown): Span | undefined =>
	(store as OtelStore | undefined)?.otelSpan;

const HealthBody = t.Object({ status: t.Literal("ok") });

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
						description: "API boilerplate: Elysia + OpenTelemetry.",
					},
					tags: [{ name: "health" }],
				},
			}),
		)
		.get("/health", () => ({ status: "ok" as const }), {
			detail: { tags: ["health"] },
			response: { 200: HealthBody },
		});

export const app = createApp();

if (import.meta.main) {
	const otel = tryCatchSync(() =>
		initializeOtel(env.OTEL_SERVICE_NAME, env.OTEL_EXPORTER_OTLP_ENDPOINT),
	);
	if (isFail(otel)) logger.error("failed to initialize otel");

	const shutdown = async (signal: string) => {
		logger.info("shutting down", { signal });
		await tryCatch(async () => {
			await app.stop();
		});
		await tryCatch(async () => {
			await shutdownOtel();
		});
		process.exit(0);
	};
	process.once("SIGTERM", () => void shutdown("SIGTERM"));
	process.once("SIGINT", () => void shutdown("SIGINT"));

	app.listen(env.API_PORT);
	console.log(`pentice api on :${env.API_PORT}`);
}
