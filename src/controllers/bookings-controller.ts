import { Elysia, t } from "elysia";
import { isFail } from "../lib/result";
import { acknowledgeConfirmationUseCase } from "../usecases/acknowledge-confirmation";
import { createBookingUseCase } from "../usecases/create-booking";
import { redeemConfirmationUseCase } from "../usecases/redeem-confirmation";

export const bookingsController = new Elysia({ name: "bookings" })
	.post(
		"/bookings",
		async ({ body, set }) => {
			const result = await createBookingUseCase.execute(body);
			if (isFail(result)) {
				set.status = result.error.status ?? 400;
				return { error: result.error.message };
			}
			set.status = result.value.created ? 201 : 200;
			return {
				reservationId: result.value.booking.reservationId,
				status: result.value.booking.status,
			};
		},
		{
			body: t.Object({
				reservationId: t.String({ minLength: 1, maxLength: 128 }),
				guest: t.String({ minLength: 1, maxLength: 320 }),
			}),
			detail: {
				tags: ["bookings"],
				summary: "Create a booking (confirmation delivered out-of-band)",
			},
		},
	)
	.post(
		"/webhooks/guest-ack",
		async ({ body, set }) => {
			const result = await acknowledgeConfirmationUseCase.execute(
				body.confirmationCode,
			);
			if (isFail(result)) {
				set.status = result.error.status ?? 400;
				return { error: result.error.message };
			}
			return {
				confirmationCode: result.value.booking.confirmationCode,
				status: result.value.booking.status,
				duplicate: !result.value.firstAck,
			};
		},
		{
			body: t.Object({ confirmationCode: t.String() }),
			detail: {
				tags: ["bookings"],
				summary: "Guest device acknowledges receipt",
			},
		},
	)
	.get(
		"/:code",
		async ({ params, set }) => {
			const result = await redeemConfirmationUseCase.execute(params.code);
			if (isFail(result)) {
				set.status = result.error.status ?? 400;
				return { error: result.error.message };
			}
			const booking = result.value;
			return {
				reservationId: booking.reservationId,
				guest: booking.guest,
				confirmationCode: booking.confirmationCode,
				status: booking.status,
				createdAt: booking.createdAt,
				redeemedAt: booking.redeemedAt,
				delivery: {
					attempts: booking.deliveryAttempts,
					lastAttemptAt: booking.lastAttemptAt,
					lastChannel: booking.lastChannel,
					lastError: booking.lastDeliveryError,
					deliveredAt: booking.deliveredAt,
				},
			};
		},
		{
			params: t.Object({ code: t.String() }),
			detail: {
				tags: ["bookings"],
				summary: "Use a confirmation code (single use: 410 once used)",
			},
		},
	);
