import type { Booking } from "../domains/booking";
import { normalizeConfirmationCode } from "../domains/confirmation-code";
import { fail, ok, type Result } from "../lib/result";
import {
	type BookingRepository,
	bookingRepository,
} from "../repositories/booking-repository";

export class RedeemConfirmationUseCase {
	constructor(
		private readonly bookings: BookingRepository,
		private readonly now: () => Date = () => new Date(),
	) {}

	async execute(rawCode: string): Promise<Result<Booking>> {
		const code = normalizeConfirmationCode(rawCode);
		if (!code) return fail("confirmation code not found", 404);

		const result = await this.bookings.redeem(code, this.now());
		if (result.kind === "not_found") {
			return fail("confirmation code not found", 404);
		}
		if (result.kind === "already_redeemed") {
			return fail("confirmation code already used", 410);
		}
		return ok(result.booking);
	}
}

export const redeemConfirmationUseCase = new RedeemConfirmationUseCase(
	bookingRepository,
);
