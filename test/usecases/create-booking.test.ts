import { describe, expect, it } from "vitest";
import { createBooking } from "../../src/domains/booking";
import { isOk } from "../../src/lib/result";
import { InMemoryBookingRepository } from "../../src/repositories/in-memory-booking-repository";
import { CreateBookingUseCase } from "../../src/usecases/create-booking";

const build = (generateCode?: () => string) => {
	const bookings = new InMemoryBookingRepository();
	const scheduled: string[] = [];
	const usecase = new CreateBookingUseCase(
		bookings,
		{
			schedule: async (code) => {
				scheduled.push(code);
			},
		},
		generateCode,
	);
	return { bookings, scheduled, usecase };
};

describe("CreateBookingUseCase", () => {
	it("mints a 5-char code, persists it pending and schedules delivery", async () => {
		const { bookings, scheduled, usecase } = build();

		const result = await usecase.execute({
			reservationId: "R123",
			guest: "ana@example.com",
		});

		if (!isOk(result)) throw new Error("expected ok");
		const code = result.value.booking.confirmationCode;
		expect(code).toMatch(/^[a-z0-9]{5}$/);
		expect((await bookings.findByCode(code))?.status).toBe("pending");
		expect(scheduled).toEqual([code]);
	});

	it("draws again on a code collision instead of overwriting", async () => {
		const codes = ["aaaaa", "bbbbb"];
		const { bookings, usecase } = build(() => codes.shift() as string);
		await bookings.insert(
			createBooking({
				reservationId: "OLD",
				guest: "x",
				confirmationCode: "aaaaa",
			}),
		);

		const result = await usecase.execute({ reservationId: "NEW", guest: "y" });

		if (!isOk(result)) throw new Error("expected ok");
		expect(result.value.booking.confirmationCode).toBe("bbbbb");
		expect((await bookings.findByCode("aaaaa"))?.reservationId).toBe("OLD");
	});

	it("is idempotent per reservationId (no second code, no second delivery)", async () => {
		const { scheduled, usecase } = build();

		const first = await usecase.execute({
			reservationId: "R1",
			guest: "a@b.c",
		});
		const second = await usecase.execute({
			reservationId: "R1",
			guest: "a@b.c",
		});

		if (!isOk(first) || !isOk(second)) throw new Error("expected ok");
		expect(second.value.created).toBe(false);
		expect(second.value.booking.confirmationCode).toBe(
			first.value.booking.confirmationCode,
		);
		expect(scheduled).toHaveLength(1);
	});

	it("rejects an empty reservationId", async () => {
		const result = await build().usecase.execute({
			reservationId: "  ",
			guest: "a@b.c",
		});
		expect(result._tag).toBe("fail");
	});

	it("gives 1000 concurrent bookings 1000 distinct codes", async () => {
		const { usecase } = build();
		const results = await Promise.all(
			Array.from({ length: 1000 }, (_, i) =>
				usecase.execute({ reservationId: `R${i}`, guest: "g" }),
			),
		);
		const codes = results.map((r) =>
			isOk(r) ? r.value.booking.confirmationCode : "",
		);
		expect(new Set(codes).size).toBe(1000);
	});
});
