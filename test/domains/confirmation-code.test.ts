import { describe, expect, it } from "vitest";
import {
	generateConfirmationCode,
	normalizeConfirmationCode,
} from "../../src/domains/confirmation-code";
import { backoffDelay } from "../../src/lib/backoff";

describe("confirmation code", () => {
	it("is the first 5 characters of a UUID: letters and digits", () => {
		const seen = new Set<string>();
		for (let i = 0; i < 2000; i++) {
			const code = generateConfirmationCode();
			expect(code).toMatch(/^[a-z0-9]{5}$/);
			seen.add(code);
		}
		expect(seen.size).toBeGreaterThan(1990);
	});

	it("normalises case and rejects anything else", () => {
		expect(normalizeConfirmationCode(" A2B34 ")).toBe("a2b34");
		expect(normalizeConfirmationCode("a2b3")).toBeNull();
		expect(normalizeConfirmationCode("a2b34x")).toBeNull();
		expect(normalizeConfirmationCode("a2-34")).toBeNull();
	});
});

describe("backoffDelay", () => {
	it("doubles from the ack timeout and caps", () => {
		const policy = { baseMs: 2000, maxMs: 30_000, jitter: 0 };
		expect([1, 2, 3, 4, 5, 6, 50].map((n) => backoffDelay(policy, n))).toEqual([
			2000, 4000, 8000, 16_000, 30_000, 30_000, 30_000,
		]);
	});

	it("spreads by ±jitter", () => {
		const policy = { baseMs: 1000, maxMs: 1000, jitter: 0.2 };
		expect(backoffDelay(policy, 1, () => 0)).toBe(800);
		expect(backoffDelay(policy, 1, () => 1)).toBe(1200);
	});
});
