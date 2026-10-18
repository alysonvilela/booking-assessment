import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

/**
 * Single source of configuration: the schema carries the defaults and the types,
 * and `Value.Parse` (Clean → Default → Convert → Assert) turns `process.env`
 * strings into number/list/boolean. No env is optional — anything missing falls
 * back to the local default (the same values as `docker compose up -d db`), and
 * anything malformed crashes the boot on import pointing at the field, instead
 * of silently becoming `undefined` mid-code.
 */
const Env = t.Object({
	NODE_ENV: t.String({ default: "development" }),
	DATABASE_URL: t.String({
		default: "postgres://sst:sst@localhost:5432/pentice_dev",
	}),
	API_PORT: t.Number({ default: 3000 }),
	WEB_ORIGINS: t
		.Transform(t.String({ default: "http://localhost:3001" }))
		.Decode((value) => value.split(",").map((origin) => origin.trim()))
		.Encode((value) => value.join(",")),
	OTEL_SERVICE_NAME: t.String({ default: "pentice-api" }),
	// Empty = telemetry off (the exporter only starts with an endpoint).
	OTEL_EXPORTER_OTLP_ENDPOINT: t.String({ default: "" }),
});

export const env = Value.Parse(Env, { ...process.env });

export const isProd = env.NODE_ENV === "production";
