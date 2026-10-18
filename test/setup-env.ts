import { inject } from "vitest";

declare module "vitest" {
	interface ProvidedContext {
		dbUrl: string;
	}
}

// Runs before any import of `src/lib/config`, which reads `process.env` at
// module top level — so these values must be set here.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = inject("dbUrl");
process.env.REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
process.env.API_PORT = "0";
process.env.WEB_ORIGINS = "http://localhost:3001";
process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "";
