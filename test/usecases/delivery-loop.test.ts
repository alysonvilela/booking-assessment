import { describe, expect, it } from "vitest";
import { createBooking } from "../../src/domains/booking";
import { EventEmitterJobQueue } from "../../src/queues/event-emitter-job-queue";
import { InMemoryBookingRepository } from "../../src/repositories/in-memory-booking-repository";
import type { DeliverConfirmationUseCase } from "../../src/usecases/deliver-confirmation";
import {
	type DeliveryJob,
	DeliveryLoop,
} from "../../src/usecases/delivery-loop";
import { waitFor } from "../helpers";

const policy = { baseMs: 5, maxMs: 20, jitter: 0 };

class FlakyRepository extends InMemoryBookingRepository {
	failures = 2;

	override async listPending() {
		if (this.failures-- > 0) throw new Error("store unavailable");
		return super.listPending();
	}
}

describe("DeliveryLoop", () => {
	it("keeps retrying the boot recovery instead of crashing", async () => {
		const bookings = new FlakyRepository();
		await bookings.insert(
			createBooking({
				reservationId: "R1",
				guest: "g",
				confirmationCode: "abcde",
			}),
		);
		const delivered: string[] = [];
		const deliver = {
			execute: async (code: string) => {
				delivered.push(code);
				return { kind: "delivered" as const };
			},
		} as unknown as DeliverConfirmationUseCase;
		const queue = new EventEmitterJobQueue<DeliveryJob>("t", policy);
		const loop = new DeliveryLoop(queue, bookings, deliver, policy);

		await expect(loop.start()).resolves.toBeUndefined();
		await waitFor(() => delivered.length === 1);

		expect(delivered).toEqual(["abcde"]);
		expect(bookings.failures).toBeLessThan(0);
		await loop.stop();
	});
});
