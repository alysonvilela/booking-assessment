import { cors } from "@elysia/cors";
import { type Span, trace } from "@opentelemetry/api";
import { Elysia, t } from "elysia";
import { env } from "./config/env";
import { openapi } from "./config/openapi";
import { bookingsController } from "./controllers/bookings-controller";
import { simulatorController } from "./controllers/simulator-controller";
import { logger } from "./lib/logger";
import { errorMessage, isFail, tryCatch } from "./lib/result";
import { deliveryQueue } from "./queues/event-emitter-job-queue";
import { bookingRepository } from "./repositories/booking-repository";

type OtelStore = { otelSpan?: Span };

const spanOf = (store: unknown): Span | undefined =>
	(store as OtelStore | undefined)?.otelSpan;

const HealthBody = t.Object({
	status: t.Union([t.Literal("ok"), t.Literal("degraded")]),
	store: t.Union([t.Literal("up"), t.Literal("down")]),
	pendingDeliveries: t.Optional(t.Number()),
	queue: t.Optional(t.Object({ scheduled: t.Number(), active: t.Number() })),
});

export const app = new Elysia()
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
		if (code === "NOT_FOUND") {
			set.status = 404;
			return { error: "not found" };
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
	.use(openapi)
	.get(
		"/health",
		async ({ set }) => {
			const pending = await tryCatch(() => bookingRepository.listPending());
			if (isFail(pending)) {
				set.status = 503;
				return { status: "degraded" as const, store: "down" as const };
			}
			return {
				status: "ok" as const,
				store: "up" as const,
				pendingDeliveries: pending.value.length,
				queue: await deliveryQueue.stats(),
			};
		},
		{
			detail: { tags: ["health"] },
			response: { 200: HealthBody, 503: HealthBody },
		},
	)
	.use(simulatorController)
	.use(bookingsController);
