import { env } from "../config/env";

export type BackoffPolicy = {
	readonly baseMs: number;
	readonly maxMs: number;
	readonly jitter: number;
};

export const backoffDelay = (
	policy: BackoffPolicy,
	attempt: number,
	random: () => number = Math.random,
): number => {
	const exponent = Math.max(0, attempt - 1);
	const raw = Math.min(policy.baseMs * 2 ** exponent, policy.maxMs);
	const spread = raw * policy.jitter * (random() * 2 - 1);
	return Math.max(0, Math.round(raw + spread));
};

export const deliveryBackoff: BackoffPolicy = {
	baseMs: env.DELIVERY_ACK_TIMEOUT_MS,
	maxMs: env.DELIVERY_MAX_BACKOFF_MS,
	jitter: 0.2,
};
