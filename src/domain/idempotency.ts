import { createHash } from "node:crypto";
import { redis } from "../infra/redis";

export const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

/** Another request with the same key is still running. */
export class IdempotencyInProgressError extends Error {
	constructor() {
		super("a request with this idempotency key is already in progress");
		this.name = "IdempotencyInProgressError";
	}
}

/** Same key reused with a different request payload. */
export class IdempotencyMismatchError extends Error {
	constructor() {
		super("idempotency key reused with a different request");
		this.name = "IdempotencyMismatchError";
	}
}

export type IdempotentResponse<T> = {
	status: number;
	body: T;
	/** `true` when the stored response was returned instead of running again. */
	replayed: boolean;
};

/**
 * Value stored under a key. `pending` means a request reserved it and is still
 * running; `done` holds the response to replay.
 */
type State =
	| { state: "pending"; requestHash: string | null }
	| {
			state: "done";
			status: number;
			body: unknown;
			requestHash: string | null;
	  };

const keyOf = (scope: string, key: string) => `idempotency:${scope}:${key}`;

/**
 * Deterministic hash of a request payload, so a replay can be told apart from a
 * key reuse with a different body. Key order in plain objects is normalized.
 */
export const hashRequest = (value: unknown): string =>
	createHash("sha256").update(stableStringify(value)).digest("hex");

const stableStringify = (value: unknown): string => {
	if (value === null || typeof value !== "object")
		return JSON.stringify(value) ?? "null";
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	const entries = Object.entries(value as Record<string, unknown>)
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`);
	return `{${entries.join(",")}}`;
};

/**
 * Runs `run` at most once per `(scope, key)`:
 *
 *  - no key           → just run.
 *  - key already done → return the stored response (`replayed: true`).
 *  - key in progress  → throw `IdempotencyInProgressError` (retry later).
 *  - key + new body   → throw `IdempotencyMismatchError`.
 *
 * The key is claimed with an atomic `SET key value NX PX ttl` *before* running,
 * so concurrent duplicates across nodes lose the race instead of both executing;
 * a failure releases the key so the client can retry. TTL makes entries expire
 * on their own.
 */
export async function withIdempotency<T>(
	input: {
		scope: string;
		key?: string | null;
		requestHash?: string | null;
		ttlMs?: number;
	},
	run: () => Promise<{ status: number; body: T }>,
): Promise<IdempotentResponse<T>> {
	if (!input.key) {
		const { status, body } = await run();
		return { status, body, replayed: false };
	}

	const { scope, key } = input;
	const requestHash = input.requestHash ?? null;
	const ttlMs = input.ttlMs ?? DEFAULT_TTL_MS;
	const redisKey = keyOf(scope, key);

	const reserved: State = { state: "pending", requestHash };
	const result = await redis.set(
		redisKey,
		JSON.stringify(reserved),
		"PX",
		ttlMs,
		"NX",
	);

	if (result !== "OK") {
		const raw = await redis.get(redisKey);
		if (!raw) throw new IdempotencyInProgressError();
		const existing = JSON.parse(raw) as State;
		if (
			existing.requestHash &&
			requestHash &&
			existing.requestHash !== requestHash
		) {
			throw new IdempotencyMismatchError();
		}
		if (existing.state === "pending") throw new IdempotencyInProgressError();
		return {
			status: existing.status,
			body: existing.body as T,
			replayed: true,
		};
	}

	try {
		const { status, body } = await run();
		const done: State = { state: "done", status, body, requestHash };
		await redis.set(redisKey, JSON.stringify(done), "PX", ttlMs);
		return { status, body, replayed: false };
	} catch (error) {
		await redis.del(redisKey);
		throw error;
	}
}
