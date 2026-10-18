import { Type as t } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";
import { CHANNEL_KINDS, type ChannelKind } from "../channels/channel";

const isChannelKind = (value: string): value is ChannelKind =>
	(CHANNEL_KINDS as readonly string[]).includes(value);

const Env = t.Object({
	NODE_ENV: t.String({ default: "development" }),
	STORE_DRIVER: t.Union([t.Literal("file"), t.Literal("memory")], {
		default: "file",
	}),
	STORE_FILE: t.String({ default: "./data/bookings.json" }),
	DELIVERY_CHANNELS: t
		.Transform(t.String({ default: CHANNEL_KINDS.join(",") }))
		.Decode((value) => {
			const kinds = value.split(",").map((kind) => kind.trim());
			const unknown = kinds.filter((kind) => !isChannelKind(kind));
			if (unknown.length > 0 || kinds.length === 0) {
				throw new Error(`unknown channel(s): ${unknown.join(", ")}`);
			}
			return kinds as ChannelKind[];
		})
		.Encode((value) => value.join(",")),
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
