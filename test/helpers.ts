import { app } from "../src/app";
import { bookingRepository } from "../src/repositories/booking-repository";
import { deviceSimulator } from "../src/simulators/device-simulator";

export const post = (path: string, body: unknown) =>
	app.handle(
		new Request(`http://localhost${path}`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(body),
		}),
	);

export const get = (path: string) =>
	app.handle(new Request(`http://localhost${path}`));

export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const waitFor = async (
	check: () => Promise<boolean> | boolean,
	timeoutMs = 3000,
): Promise<void> => {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await check()) return;
		await sleep(5);
	}
	throw new Error("waitFor timed out");
};

export const resetDevice = () => deviceSimulator.reset({ ackDelayMs: 2 });

export const inboxEntry = (reservationId: string) =>
	deviceSimulator
		.state()
		.inbox.find((entry) => entry.reservationId === reservationId);

export const bookingOf = (reservationId: string) =>
	bookingRepository.findByReservationId(reservationId);

export const isDelivered = async (reservationId: string) =>
	(await bookingOf(reservationId))?.status === "delivered";

export const attempts = async (reservationId: string) =>
	(await bookingOf(reservationId))?.deliveryAttempts ?? 0;
