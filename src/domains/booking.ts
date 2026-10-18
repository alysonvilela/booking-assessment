export type BookingStatus = "pending" | "delivered";

export type Booking = {
	readonly reservationId: string;
	readonly guest: string;
	readonly confirmationCode: string;
	readonly status: BookingStatus;
	readonly createdAt: string;
	readonly deliveryAttempts: number;
	readonly lastAttemptAt: string | null;
	readonly lastChannel: string | null;
	readonly lastDeliveryError: string | null;
	readonly deliveredAt: string | null;
	readonly redeemedAt: string | null;
};

export const createBooking = (input: {
	reservationId: string;
	guest: string;
	confirmationCode: string;
	now?: Date;
}): Booking => ({
	reservationId: input.reservationId,
	guest: input.guest,
	confirmationCode: input.confirmationCode,
	status: "pending",
	createdAt: (input.now ?? new Date()).toISOString(),
	deliveryAttempts: 0,
	lastAttemptAt: null,
	lastChannel: null,
	lastDeliveryError: null,
	deliveredAt: null,
	redeemedAt: null,
});

export const recordAttempt = (
	booking: Booking,
	attempt: { at: Date; channel: string | null; error: string | null },
): Booking =>
	booking.status === "delivered"
		? booking
		: {
				...booking,
				deliveryAttempts: booking.deliveryAttempts + 1,
				lastAttemptAt: attempt.at.toISOString(),
				lastChannel: attempt.channel,
				lastDeliveryError: attempt.error,
			};

export const markDelivered = (booking: Booking, at: Date): Booking =>
	booking.status === "delivered"
		? booking
		: {
				...booking,
				status: "delivered",
				deliveredAt: at.toISOString(),
				lastDeliveryError: null,
			};

export const redeem = (booking: Booking, at: Date): Booking =>
	booking.redeemedAt ? booking : { ...booking, redeemedAt: at.toISOString() };
