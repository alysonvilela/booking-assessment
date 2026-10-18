import { beforeEach, describe, expect, it } from "vitest";
import {
	hashRequest,
	IdempotencyInProgressError,
	IdempotencyMismatchError,
	withIdempotency,
} from "../src/domain/idempotency";
import { redis } from "../src/infra/redis";

beforeEach(async () => {
	const keys = await redis.keys("idempotency:*");
	if (keys.length > 0) await redis.del(...keys);
});

describe("withIdempotency", () => {
	it("runs once and replays the stored response", async () => {
		let runs = 0;
		const run = async () => {
			runs += 1;
			return { status: 201, body: { id: runs } };
		};

		const first = await withIdempotency({ scope: "t", key: "k" }, run);
		const second = await withIdempotency({ scope: "t", key: "k" }, run);

		expect(first).toEqual({ status: 201, body: { id: 1 }, replayed: false });
		expect(second).toEqual({ status: 201, body: { id: 1 }, replayed: true });
		expect(runs).toBe(1);
	});

	it("runs every time when there is no key", async () => {
		let runs = 0;
		const run = async () => ({ status: 200, body: ++runs });

		await withIdempotency({ scope: "t" }, run);
		await withIdempotency({ scope: "t" }, run);

		expect(runs).toBe(2);
	});

	it("rejects a concurrent duplicate while the first is in progress", async () => {
		let markStarted: () => void = () => {};
		const started = new Promise<void>((resolve) => {
			markStarted = resolve;
		});
		let release: () => void = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});

		const first = withIdempotency({ scope: "t", key: "k" }, async () => {
			markStarted();
			await gate;
			return { status: 200, body: { n: 1 } };
		});

		await started;
		await expect(
			withIdempotency({ scope: "t", key: "k" }, async () => ({
				status: 200,
				body: { n: 2 },
			})),
		).rejects.toBeInstanceOf(IdempotencyInProgressError);

		release();
		expect((await first).replayed).toBe(false);
	});

	it("rejects the same key with a different request hash", async () => {
		await withIdempotency(
			{ scope: "t", key: "k", requestHash: hashRequest({ a: 1 }) },
			async () => ({ status: 200, body: "ok" }),
		);

		await expect(
			withIdempotency(
				{ scope: "t", key: "k", requestHash: hashRequest({ a: 2 }) },
				async () => ({ status: 200, body: "ok" }),
			),
		).rejects.toBeInstanceOf(IdempotencyMismatchError);
	});

	it("releases the key so a failed run can be retried", async () => {
		await expect(
			withIdempotency({ scope: "t", key: "k" }, async () => {
				throw new Error("boom");
			}),
		).rejects.toThrow("boom");

		const retry = await withIdempotency({ scope: "t", key: "k" }, async () => ({
			status: 200,
			body: "retried",
		}));
		expect(retry.body).toBe("retried");
	});
});

describe("hashRequest", () => {
	it("is stable regardless of object key order", () => {
		expect(hashRequest({ a: 1, b: 2 })).toBe(hashRequest({ b: 2, a: 1 }));
	});
});
