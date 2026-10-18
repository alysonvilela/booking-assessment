import { describe, expect, it } from "vitest";
import {
	generateConfirmationCode,
	normalizeConfirmationCode,
} from "../../src/domains/confirmation-code";

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
