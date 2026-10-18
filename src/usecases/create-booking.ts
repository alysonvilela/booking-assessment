import { type Booking, createBooking } from "../domains/booking";
import { generateConfirmationCode } from "../domains/confirmation-code";
import { fail, ok, type Result } from "../lib/result";
import {
	type BookingRepository,
	bookingRepository,
} from "../repositories/booking-repository";
import { deliveryLoop } from "./delivery-loop";

export type CreateBookingInput = {
	reservationId: string;
	guest: string;
};

export type CreateBookingResult = {
	readonly booking: Booking;
	readonly created: boolean;
};

export interface DeliveryScheduler {
	schedule(confirmationCode: string): Promise<void>;
}

const CODE_ATTEMPTS = 10;

export class CreateBookingUseCase {
	constructor(
		private readonly bookings: BookingRepository,
		private readonly delivery: DeliveryScheduler,
		private readonly generateCode: () => string = generateConfirmationCode,
	) {}

	async execute(
		input: CreateBookingInput,
	): Promise<Result<CreateBookingResult>> {
		const reservationId = input.reservationId.trim();
		const guest = input.guest.trim();
		if (!reservationId || !guest) {
			return fail("reservationId and guest are required", 422);
		}

		for (let attempt = 0; attempt < CODE_ATTEMPTS; attempt++) {
			const booking = createBooking({
				reservationId,
				guest,
				confirmationCode: this.generateCode(),
			});
			const inserted = await this.bookings.insert(booking);

			if (inserted === "code_taken") continue;
			if (inserted === "reservation_taken") {
				return this.replay(reservationId, guest);
			}

			await this.delivery.schedule(booking.confirmationCode);
			return ok({ booking, created: true });
		}
		return fail("could not allocate a unique confirmation code", 503);
	}

	private async replay(
		reservationId: string,
		guest: string,
	): Promise<Result<CreateBookingResult>> {
		const existing = await this.bookings.findByReservationId(reservationId);
		if (!existing) return fail("reservation conflict, retry", 409);
		if (existing.guest !== guest) {
			return fail("reservation already booked for another guest", 409);
		}
		return ok({ booking: existing, created: false });
	}
}

export const createBookingUseCase = new CreateBookingUseCase(
	bookingRepository,
	deliveryLoop,
);
