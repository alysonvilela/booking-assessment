import {
	type ChannelKind,
	type ConfirmationMessage,
	type GuestDevice,
	GuestUnreachableError,
} from "../channels/channel";
import { logger } from "../lib/logger";
import { errorMessage, isOk } from "../lib/result";
import { acknowledgeConfirmationUseCase } from "../usecases/acknowledge-confirmation";

export type DeviceMode = {
	online: boolean;
	unreachableChannels: ChannelKind[];
	dropMessageRate: number;
	dropAckRate: number;
	ackDelayMs: number;
};

export type InboxEntry = {
	readonly confirmationCode: string;
	readonly reservationId: string;
	readonly firstReceivedAt: string;
	readonly firstChannel: ChannelKind;
	readonly timesReceived: number;
};

export type AckSender = (confirmationCode: string) => Promise<void>;

const DEFAULT_MODE: DeviceMode = {
	online: true,
	unreachableChannels: [],
	dropMessageRate: 0,
	dropAckRate: 0,
	ackDelayMs: 50,
};

export class DeviceSimulator implements GuestDevice {
	private mode: DeviceMode = { ...DEFAULT_MODE };
	private readonly inbox = new Map<string, InboxEntry>();

	constructor(private readonly sendAck: AckSender) {}

	reset(changes: Partial<DeviceMode> = {}): DeviceMode {
		this.inbox.clear();
		this.mode = { ...DEFAULT_MODE, ...changes };
		return this.mode;
	}

	configure(changes: Partial<DeviceMode>): DeviceMode {
		this.mode = { ...this.mode, ...changes };
		return this.mode;
	}

	state(): { mode: DeviceMode; inbox: InboxEntry[] } {
		return { mode: this.mode, inbox: [...this.inbox.values()] };
	}

	async receive(
		channel: ChannelKind,
		message: ConfirmationMessage,
	): Promise<void> {
		if (!this.mode.online || this.mode.unreachableChannels.includes(channel)) {
			throw new GuestUnreachableError(message.confirmationCode, channel);
		}
		if (Math.random() < this.mode.dropMessageRate) {
			logger.warn("device: message lost in transit", { channel, ...message });
			return;
		}

		const seen = this.inbox.get(message.confirmationCode);
		if (seen) {
			this.inbox.set(message.confirmationCode, {
				...seen,
				timesReceived: seen.timesReceived + 1,
			});
			logger.info("device: duplicate ignored, re-acking", {
				channel,
				...message,
			});
		} else {
			this.inbox.set(message.confirmationCode, {
				confirmationCode: message.confirmationCode,
				reservationId: message.reservationId,
				firstReceivedAt: new Date().toISOString(),
				firstChannel: channel,
				timesReceived: 1,
			});
			logger.info("device: confirmation shown to guest", {
				channel,
				...message,
			});
		}

		const dropAck = Math.random() < this.mode.dropAckRate;
		setTimeout(() => {
			if (dropAck) {
				logger.warn("device: ack lost in transit", { channel, ...message });
				return;
			}
			this.sendAck(message.confirmationCode).catch((error) => {
				logger.warn("device: ack failed", {
					...message,
					err: errorMessage(error),
				});
			});
		}, this.mode.ackDelayMs).unref?.();
	}
}

export const deviceSimulator = new DeviceSimulator(async (code) => {
	const result = await acknowledgeConfirmationUseCase.execute(code);
	if (!isOk(result)) throw new Error(result.error.message);
});
