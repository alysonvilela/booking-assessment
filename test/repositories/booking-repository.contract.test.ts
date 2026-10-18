import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { createBooking } from "../../src/domains/booking";
import { generateConfirmationCode } from "../../src/domains/confirmation-code";
import type { BookingRepository } from "../../src/repositories/booking-repository";
import { InMemoryBookingRepository } from "../../src/repositories/in-memory-booking-repository";
import { JsonFileBookingRepository } from "../../src/repositories/json-file-booking-repository";

const dirs: string[] = [];
const tempFile = async () => {
	const dir = await mkdtemp(join(tmpdir(), "pentice-"));
	dirs.push(dir);
	return join(dir, "nested", "bookings.json");
};
afterAll(() => Promise.all(dirs.map((dir) => rm(dir, { recursive: true }))));

const adapters: Array<[string, () => Promise<BookingRepository>]> = [
	["in-memory", async () => new InMemoryBookingRepository()],
	["json-file", async () => new JsonFileBookingRepository(await tempFile())],
];

const newBooking = (
	reservationId = `R-${crypto.randomUUID()}`,
	confirmationCode = generateConfirmationCode(),
) => createBooking({ reservationId, guest: "a@b.c", confirmationCode });

const attempt = (error: string | null = null) => ({
	at: new Date(),
	channel: error ? null : "push",
	error,
});

describe.each(adapters)("BookingRepository (%s)", (_name, make) => {
	it("round-trips and transitions to delivered exactly once", async () => {
		const repo = await make();
		const booking = newBooking();
		const code = booking.confirmationCode;

		expect(await repo.insert(booking)).toBe("inserted");
		expect((await repo.findByCode(code))?.reservationId).toBe(
			booking.reservationId,
		);
		expect(
			(await repo.findByReservationId(booking.reservationId))?.confirmationCode,
		).toBe(code);
		expect(await repo.findByCode("zzzzz")).toBeNull();
		expect(await repo.listPending()).toHaveLength(1);

		expect(
			(await repo.recordAttempt(code, attempt("offline")))?.deliveryAttempts,
		).toBe(1);
		expect(await repo.markDelivered(code, new Date())).toBe(true);
		expect(await repo.markDelivered(code, new Date())).toBe(false);
		expect((await repo.findByCode(code))?.status).toBe("delivered");
		expect(await repo.listPending()).toHaveLength(0);

		await repo.recordAttempt(code, attempt());
		expect((await repo.findByCode(code))?.status).toBe("delivered");
	});

	it("refuses a taken code or reservation instead of overwriting", async () => {
		const repo = await make();
		const first = newBooking("R1");
		await repo.insert(first);

		const sameCode = newBooking("R2", first.confirmationCode);
		expect(await repo.insert(sameCode)).toBe("code_taken");
		expect(await repo.insert(newBooking("R1"))).toBe("reservation_taken");
		expect((await repo.findByCode(first.confirmationCode))?.reservationId).toBe(
			"R1",
		);
	});

	it("redeems a code once, even under concurrent use", async () => {
		const repo = await make();
		const booking = newBooking();
		const code = booking.confirmationCode;
		await repo.insert(booking);

		const results = await Promise.all([
			repo.redeem(code, new Date()),
			repo.redeem(code, new Date()),
		]);
		expect(results.map((r) => r.kind).sort()).toEqual([
			"already_redeemed",
			"redeemed",
		]);
		expect((await repo.findByCode(code))?.redeemedAt).not.toBeNull();
		expect((await repo.redeem("zzzzz", new Date())).kind).toBe("not_found");
	});
});

describe("JsonFileBookingRepository", () => {
	it("survives a restart, pending deliveries included", async () => {
		const path = await tempFile();
		const before = new JsonFileBookingRepository(path);
		const booking = newBooking("R-restart");
		await before.insert(booking);
		await before.recordAttempt(booking.confirmationCode, attempt("offline"));

		const after = new JsonFileBookingRepository(path);
		const [pending] = await after.listPending();
		expect(pending?.reservationId).toBe("R-restart");
		expect(pending?.deliveryAttempts).toBe(1);
		expect(JSON.parse(await readFile(path, "utf8")).bookings).toHaveLength(1);
	});

	it("serialises concurrent writes", async () => {
		const path = await tempFile();
		const repo = new JsonFileBookingRepository(path);
		await Promise.all(
			Array.from({ length: 50 }, (_, i) => repo.insert(newBooking(`R${i}`))),
		);

		const reloaded = new JsonFileBookingRepository(path);
		expect(await reloaded.listPending()).toHaveLength(50);
	});
});
