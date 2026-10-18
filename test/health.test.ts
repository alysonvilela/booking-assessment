import { describe, expect, it } from "vitest";
import { createApp } from "../src/index";

const app = createApp();

describe("GET /health", () => {
	it("reports ok", async () => {
		const res = await app.handle(new Request("http://localhost/health"));

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ status: "ok" });
	});
});
