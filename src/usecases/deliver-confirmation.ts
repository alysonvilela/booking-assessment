import { channels } from "../channels";
import type { NotificationChannel } from "../channels/channel";
import { logger } from "../lib/logger";
import { errorMessage } from "../lib/result";
import {
	type BookingRepository,
	bookingRepository,
} from "../repositories/booking-repository";

export type DeliveryOutcome =
	| { readonly kind: "delivered" }
	| { readonly kind: "not_found" }
	| {
			readonly kind: "awaiting_ack";
			readonly attempts: number;
			readonly channel: string | null;
	  };

export class DeliverConfirmationUseCase {
	constructor(
		private readonly bookings: BookingRepository,
		private readonly channels: readonly NotificationChannel[],
		private readonly now: () => Date = () => new Date(),
	) {}

	async execute(confirmationCode: string): Promise<DeliveryOutcome> {
		const booking = await this.bookings.findByCode(confirmationCode);
		if (!booking) {
			logger.warn("deliver: booking not found", { confirmationCode });
			return { kind: "not_found" };
		}
		if (booking.status === "delivered") return { kind: "delivered" };

		const message = {
			confirmationCode,
			reservationId: booking.reservationId,
		};
		let channel: string | null = null;
		const errors: string[] = [];
		for (const candidate of this.channels) {
			try {
				await candidate.send(booking.guest, message);
				channel = candidate.kind;
				break;
			} catch (cause) {
				errors.push(errorMessage(cause));
			}
		}

		const updated = await this.bookings.recordAttempt(confirmationCode, {
			at: this.now(),
			channel,
			error: errors.length > 0 ? errors.join("; ") : null,
		});
		if (!updated || updated.status === "delivered") {
			return { kind: "delivered" };
		}

		logger.info("deliver: attempt made, awaiting ack", {
			confirmationCode,
			attempt: updated.deliveryAttempts,
			channel,
			errors,
		});
		return {
			kind: "awaiting_ack",
			attempts: updated.deliveryAttempts,
			channel,
		};
	}
}

export const deliverConfirmationUseCase = new DeliverConfirmationUseCase(
	bookingRepository,
	channels,
);
