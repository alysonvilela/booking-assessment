import { Elysia, t } from "elysia";
import { CHANNEL_KINDS } from "../channels/channel";
import { deviceSimulator } from "../simulators/device-simulator";

export const simulatorController = new Elysia({ name: "simulator" })
	.get("/simulator/device", () => deviceSimulator.state(), {
		detail: {
			tags: ["simulator"],
			summary: "Guest device state and inbox (what the guest saw)",
		},
	})
	.post(
		"/simulator/device",
		({ body }) => ({ mode: deviceSimulator.configure(body) }),
		{
			body: t.Partial(
				t.Object({
					online: t.Boolean(),
					unreachableChannels: t.Array(
						t.Union(CHANNEL_KINDS.map((kind) => t.Literal(kind))),
					),
					dropMessageRate: t.Number({ minimum: 0, maximum: 1 }),
					dropAckRate: t.Number({ minimum: 0, maximum: 1 }),
					ackDelayMs: t.Integer({ minimum: 0, maximum: 60_000 }),
				}),
			),
			detail: {
				tags: ["simulator"],
				summary: "Make the guest device offline / lossy / slow",
			},
		},
	);
