import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const Env = t.Object({
	NODE_ENV: t.String({ default: "development" }),
	STORE_DRIVER: t.Union([t.Literal("file"), t.Literal("memory")], {
		default: "file",
	}),
	STORE_FILE: t.String({ default: "./data/bookings.json" }),
	API_PORT: t.Number({ default: 3000 }),
	WEB_ORIGINS: t
		.Transform(t.String({ default: "http://localhost:3001" }))
		.Decode((value) => value.split(",").map((origin) => origin.trim()))
		.Encode((value) => value.join(",")),
	OTEL_SERVICE_NAME: t.String({ default: "pentice-api" }),
	OTEL_EXPORTER_OTLP_ENDPOINT: t.String({ default: "" }),
});

export const env = Value.Parse(Env, { ...process.env });

export const isProd = env.NODE_ENV === "production";
