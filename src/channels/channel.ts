import { logger } from "../lib/logger";

export const CHANNEL_KINDS = ["push", "webhook", "email"] as const;

export type ChannelKind = (typeof CHANNEL_KINDS)[number];

export type ConfirmationMessage = {
	readonly confirmationCode: string;
	readonly reservationId: string;
};

export class GuestUnreachableError extends Error {
	constructor(
		readonly confirmationCode: string,
		readonly channel: ChannelKind,
	) {
		super(`guest unreachable on ${channel} for ${confirmationCode}`);
		this.name = "GuestUnreachableError";
	}
}

export interface GuestDevice {
	receive(channel: ChannelKind, message: ConfirmationMessage): Promise<void>;
}

export abstract class NotificationChannel {
	abstract readonly kind: ChannelKind;

	constructor(private readonly device: GuestDevice) {}

	async send(guest: string, message: ConfirmationMessage): Promise<void> {
		logger.info(`${this.kind}: sending confirmation`, {
			to: this.address(guest),
			...message,
		});
		await this.device.receive(this.kind, message);
	}

	protected abstract address(guest: string): string;
}
