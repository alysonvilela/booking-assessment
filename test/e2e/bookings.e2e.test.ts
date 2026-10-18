import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deliveryQueue } from "../../src/queues/event-emitter-job-queue";
import { deviceSimulator } from "../../src/simulators/device-simulator";
import { deliveryLoop } from "../../src/usecases/delivery-loop";
import {
	attempts,
	bookingOf,
	get,
	inboxEntry,
	isDelivered,
	post,
	resetDevice,
	sleep,
	waitFor,
} from "../helpers";

beforeAll(() => deliveryLoop.start());
afterAll(() => deliveryLoop.stop());
beforeEach(() => resetDevice());

describe("bookings flow (e2e)", () => {
	it("the brief's example: POST, out-of-band delivery, ack, GET", async () => {
		const res = await post("/bookings", {
			reservationId: "R123",
			guest: "ana@example.com",
		});
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			reservationId: "R123",
			status: "pending",
		});

		await waitFor(() => inboxEntry("R123") !== undefined);
		const code = inboxEntry("R123")?.confirmationCode as string;
		expect(code).toMatch(/^[a-z0-9]{5}$/);
		await waitFor(() => isDelivered("R123"));

		const read = await get(`/${code.toUpperCase()}`);
		expect(read.status).toBe(200);
		expect(await read.json()).toMatchObject({
			reservationId: "R123",
			guest: "ana@example.com",
			confirmationCode: code,
			status: "delivered",
			delivery: { attempts: 1, lastChannel: "push" },
		});
		expect((await get("/zzzzz")).status).toBe(404);
	});

	it("a confirmation code works once, then it's invalidated", async () => {
		await post("/bookings", { reservationId: "R2", guest: "g@x.io" });
		await waitFor(() => inboxEntry("R2") !== undefined);
		const code = inboxEntry("R2")?.confirmationCode as string;

		const [a, b] = await Promise.all([get(`/${code}`), get(`/${code}`)]);
		expect([a.status, b.status].sort()).toEqual([200, 410]);

		const again = await get(`/${code}`);
		expect(again.status).toBe(410);
		expect(await again.json()).toEqual({
			error: "confirmation code already used",
		});
		expect((await bookingOf("R2"))?.redeemedAt).not.toBeNull();
	});

	it("fails over to the next channel when one is unreachable", async () => {
		deviceSimulator.configure({ unreachableChannels: ["push", "webhook"] });

		await post("/bookings", { reservationId: "R3", guest: "g@x.io" });
		await waitFor(() => isDelivered("R3"));

		const booking = await bookingOf("R3");
		expect(booking?.deliveryAttempts).toBe(1);
		expect(booking?.lastChannel).toBe("email");
		expect(inboxEntry("R3")).toMatchObject({
			firstChannel: "email",
			timesReceived: 1,
		});
	});

	it("keeps retrying while the guest is offline, no manual replay", async () => {
		deviceSimulator.configure({ online: false });

		await post("/bookings", { reservationId: "R9", guest: "g@x.io" });

		await waitFor(async () => (await attempts("R9")) >= 6);
		expect(await isDelivered("R9")).toBe(false);
		expect((await bookingOf("R9"))?.lastChannel).toBeNull();

		deviceSimulator.configure({ online: true });
		await waitFor(() => isDelivered("R9"));
		expect(inboxEntry("R9")?.timesReceived).toBe(1);
	});

	it("redelivers when the ack is lost, and the guest still sees it once", async () => {
		deviceSimulator.configure({ dropAckRate: 1 });

		await post("/bookings", { reservationId: "R7", guest: "g@x.io" });
		await waitFor(() => (inboxEntry("R7")?.timesReceived ?? 0) >= 2);
		expect(await isDelivered("R7")).toBe(false);

		deviceSimulator.configure({ dropAckRate: 0 });
		await waitFor(() => isDelivered("R7"));

		expect(
			deviceSimulator.state().inbox.filter((e) => e.reservationId === "R7"),
		).toHaveLength(1);
		expect(inboxEntry("R7")?.timesReceived).toBeGreaterThanOrEqual(3);
	});

	it("redelivers a message lost in transit", async () => {
		deviceSimulator.configure({ dropMessageRate: 1 });

		await post("/bookings", { reservationId: "R8", guest: "g@x.io" });
		await waitFor(async () => (await attempts("R8")) >= 2);
		expect(inboxEntry("R8")).toBeUndefined();

		deviceSimulator.configure({ dropMessageRate: 0 });
		await waitFor(() => isDelivered("R8"));
	});

	it("stops sending once acknowledged", async () => {
		await post("/bookings", { reservationId: "R5", guest: "g@x.io" });
		await waitFor(() => isDelivered("R5"));
		const code = inboxEntry("R5")?.confirmationCode as string;

		await sleep(250);
		expect(inboxEntry("R5")?.timesReceived).toBe(1);
		expect(await attempts("R5")).toBe(1);
		expect(await deliveryQueue.stats()).toEqual({ scheduled: 0, active: 0 });

		const ack = await post("/webhooks/guest-ack", { confirmationCode: code });
		expect(await ack.json()).toMatchObject({
			status: "delivered",
			duplicate: true,
		});
	});

	it("a repeated POST for the same reservation never mints a second code", async () => {
		const body = { reservationId: "R1", guest: "g@x.io" };

		const [a, b] = await Promise.all([
			post("/bookings", body),
			post("/bookings", body),
		]);
		expect([a.status, b.status].sort()).toEqual([200, 201]);

		await sleep(100);
		expect(
			deviceSimulator.state().inbox.filter((e) => e.reservationId === "R1"),
		).toHaveLength(1);
		const conflict = await post("/bookings", { ...body, guest: "other@x.io" });
		expect(conflict.status).toBe(409);
	});

	it("validates input", async () => {
		expect((await post("/bookings", { reservationId: "R1" })).status).toBe(422);
		expect(
			(await post("/bookings", { reservationId: " ", guest: "g" })).status,
		).toBe(422);
		expect(
			(await post("/webhooks/guest-ack", { confirmationCode: "nope!" })).status,
		).toBe(422);
		expect(
			(await post("/webhooks/guest-ack", { confirmationCode: "zzzzz" })).status,
		).toBe(404);
	});
});
