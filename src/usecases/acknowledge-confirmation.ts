import type { Booking } from "../domains/booking";
import { normalizeConfirmationCode } from "../domains/confirmation-code";
import { logger } from "../lib/logger";
import { fail, ok, type Result } from "../lib/result";
import {
	type BookingRepository,
	bookingRepository,
} from "../repositories/booking-repository";

export type AcknowledgeResult = {
	readonly booking: Booking;
	readonly firstAck: boolean;
};

export class AcknowledgeConfirmationUseCase {
	constructor(
		private readonly bookings: BookingRepository,
		private readonly now: () => Date = () => new Date(),
	) {}

	async execute(rawCode: string): Promise<Result<AcknowledgeResult>> {
		const code = normalizeConfirmationCode(rawCode);
		if (!code) return fail("invalid confirmation code", 422);

		const firstAck = await this.bookings.markDelivered(code, this.now());
		const booking = await this.bookings.findByCode(code);
		if (!booking) return fail("unknown confirmation code", 404);

		if (firstAck) {
			logger.info("ack: confirmation delivered", {
				confirmationCode: code,
				reservationId: booking.reservationId,
				attempts: booking.deliveryAttempts,
				channel: booking.lastChannel,
			});
		}
		return ok({ booking, firstAck });
	}
}

export const acknowledgeConfirmationUseCase =
	new AcknowledgeConfirmationUseCase(bookingRepository);
