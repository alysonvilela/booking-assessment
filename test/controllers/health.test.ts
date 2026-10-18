import { describe, expect, it } from "vitest";
import { get } from "../helpers";

describe("GET /health", () => {
	it("reports the store up and the delivery backlog", async () => {
		const res = await get("/health");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			status: "ok",
			store: "up",
			pendingDeliveries: 0,
			queue: { scheduled: 0, active: 0 },
		});
	});

	it("static routes aren't shadowed by the /:code catch-all", async () => {
		expect((await get("/openapi")).status).toBe(200);
		expect((await get("/openapi/json")).status).toBe(200);
		expect((await get("/simulator/device")).status).toBe(200);
		expect((await get("/nope!")).status).toBe(404);
	});
});
