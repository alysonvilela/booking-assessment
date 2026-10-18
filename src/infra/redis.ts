import { Redis } from "ioredis";
import { env } from "../lib/config";

/**
 * Valkey/Redis client. Used as shared, atomic state — e.g. the idempotency
 * locks, where `SET key value NX PX ttl` decides the winner without a race
 * between nodes.
 */
export const redis = new Redis(env.REDIS_URL, {
	maxRetriesPerRequest: 3,
	lazyConnect: false,
});
