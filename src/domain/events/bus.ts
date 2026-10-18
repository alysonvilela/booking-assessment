import { logger } from "../../lib/logger";
import { errorMessage } from "../../lib/result";
import type { DomainEvent } from "./event";

/** A subscriber — in this codebase, a usecase reacting to an event. */
export type EventHandler<E extends DomainEvent = DomainEvent> = (
	event: E,
) => void | Promise<void>;

export interface EventBus {
	/** Registers a handler for `name`; returns an unsubscribe function. */
	subscribe<Payload = unknown>(
		name: string,
		handler: EventHandler<DomainEvent<string, Payload>>,
	): () => void;
	/** Runs every handler subscribed to `event.name`. */
	dispatch(event: DomainEvent): Promise<void>;
}

/**
 * In-memory, in-process bus. Good enough for a single node; swap for a broker
 * (outbox + queue) by implementing `EventBus` without touching call sites.
 *
 * Dispatch is isolated: one failing subscriber must not prevent the others from
 * running, so handlers run via `allSettled` and failures are logged.
 */
export class InMemoryEventBus implements EventBus {
	readonly #handlers = new Map<string, EventHandler[]>();

	subscribe<Payload = unknown>(
		name: string,
		handler: EventHandler<DomainEvent<string, Payload>>,
	) {
		const handlers = this.#handlers.get(name) ?? [];
		handlers.push(handler as EventHandler);
		this.#handlers.set(name, handlers);
		return () => {
			const current = this.#handlers.get(name) ?? [];
			this.#handlers.set(
				name,
				current.filter((candidate) => candidate !== (handler as EventHandler)),
			);
		};
	}

	async dispatch(event: DomainEvent): Promise<void> {
		const handlers = this.#handlers.get(event.name) ?? [];
		// `Promise.resolve().then(...)` so a *synchronous* throw also becomes a
		// rejected promise — otherwise `.map` would reject before `allSettled`.
		const results = await Promise.allSettled(
			handlers.map((handler) => Promise.resolve().then(() => handler(event))),
		);
		for (const result of results) {
			if (result.status === "rejected") {
				logger.error("event handler failed", {
					event: event.name,
					eventId: event.id,
					err: errorMessage(result.reason),
				});
			}
		}
	}
}
