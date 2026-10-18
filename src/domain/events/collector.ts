import type { DomainEvent } from "./event";

/**
 * Request-scoped buffer. Handlers push events here while doing their work; the
 * bus is fed only after the response is sent (see `eventsPlugin`), so a slow or
 * failing subscriber never delays or breaks the HTTP response.
 */
export class EventCollector {
	#events: DomainEvent[] = [];

	add(event: DomainEvent): void {
		this.#events.push(event);
	}

	drain(): DomainEvent[] {
		const drained = this.#events;
		this.#events = [];
		return drained;
	}
}
