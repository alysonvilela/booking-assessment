import { Elysia } from "elysia";
import { logger } from "../../lib/logger";
import { errorMessage } from "../../lib/result";
import type { EventBus } from "./bus";
import { EventCollector } from "./collector";

/**
 * Wires the "collect now, dispatch later" pattern:
 *
 *  1. `derive` gives every request its own `EventCollector` (`context.events`).
 *  2. A handler adds events as it works (`events.add(createEvent(...))`) and
 *     returns its response — the client gets its 200 immediately.
 *  3. `onAfterResponse` drains the collector and fans the events out to the
 *     subscribed usecases, off the response path.
 */
export const eventsPlugin = (bus: EventBus) =>
	new Elysia({ name: "domain-events" })
		.decorate("eventBus", bus)
		.derive({ as: "global" }, () => ({ events: new EventCollector() }))
		.onAfterResponse({ as: "global" }, ({ events }) => {
			for (const event of events.drain()) {
				void bus.dispatch(event).catch((error) =>
					logger.error("event dispatch failed", {
						event: event.name,
						eventId: event.id,
						err: errorMessage(error),
					}),
				);
			}
		});
