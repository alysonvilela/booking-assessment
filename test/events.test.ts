import { Elysia } from "elysia";
import { describe, expect, it } from "vitest";
import {
	createEvent,
	eventsPlugin,
	InMemoryEventBus,
} from "../src/domain/events";

const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

describe("domain events", () => {
	it("dispatches collected events to subscribers after the response", async () => {
		const bus = new InMemoryEventBus();
		const seen: string[] = [];
		bus.subscribe<string>("Ping", (event) => {
			seen.push(event.payload);
		});

		const app = new Elysia()
			.use(eventsPlugin(bus))
			.post("/ping", ({ events }) => {
				events.add(createEvent("Ping", "hello"));
				return { ok: true };
			});

		const res = await app.handle(
			new Request("http://localhost/ping", { method: "POST" }),
		);

		// The client is answered before any subscriber runs.
		expect(res.status).toBe(200);
		expect(seen).toEqual([]);

		await tick();
		expect(seen).toEqual(["hello"]);
	});

	it("keeps dispatching when one subscriber fails", async () => {
		const bus = new InMemoryEventBus();
		const seen: string[] = [];
		bus.subscribe<string>("Ping", () => {
			throw new Error("boom");
		});
		bus.subscribe<string>("Ping", (event) => {
			seen.push(event.payload);
		});

		await bus.dispatch(createEvent("Ping", "hello"));
		expect(seen).toEqual(["hello"]);
	});

	it("stops calling a handler after unsubscribe", async () => {
		const bus = new InMemoryEventBus();
		let calls = 0;
		const unsubscribe = bus.subscribe("Ping", () => {
			calls += 1;
		});

		await bus.dispatch(createEvent("Ping", null));
		unsubscribe();
		await bus.dispatch(createEvent("Ping", null));

		expect(calls).toBe(1);
	});
});
