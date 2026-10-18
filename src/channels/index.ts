import { env } from "../config/env";
import { deviceSimulator } from "../simulators/device-simulator";
import type { ChannelKind, GuestDevice, NotificationChannel } from "./channel";
import { EmailChannel } from "./email-channel";
import { PushChannel } from "./push-channel";
import { WebhookChannel } from "./webhook-channel";

const factories: Record<
	ChannelKind,
	(device: GuestDevice) => NotificationChannel
> = {
	push: (device) => new PushChannel(device),
	webhook: (device) => new WebhookChannel(device),
	email: (device) => new EmailChannel(device),
};

export const createChannels = (
	device: GuestDevice,
	order: readonly ChannelKind[],
): NotificationChannel[] => order.map((kind) => factories[kind](device));

export const channels = createChannels(deviceSimulator, env.DELIVERY_CHANNELS);
