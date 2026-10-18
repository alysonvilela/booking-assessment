import {
	type BackoffPolicy,
	backoffDelay,
	deliveryBackoff,
} from "../lib/backoff";
import { logger } from "../lib/logger";
import { deliveryQueue } from "../queues/event-emitter-job-queue";
import type { JobQueue } from "../queues/job-queue";
import {
	type BookingRepository,
	bookingRepository,
} from "../repositories/booking-repository";
import type { DeliveryScheduler } from "./create-booking";
import {
	type DeliverConfirmationUseCase,
	deliverConfirmationUseCase,
} from "./deliver-confirmation";

export type DeliveryJob = { readonly confirmationCode: string };

export class DeliveryLoop implements DeliveryScheduler {
	constructor(
		private readonly queue: JobQueue<DeliveryJob>,
		private readonly bookings: BookingRepository,
		private readonly deliver: DeliverConfirmationUseCase,
		private readonly policy: BackoffPolicy,
	) {}

	private started = false;

	async start(): Promise<void> {
		if (this.started) return;
		this.started = true;
		this.process();
		await this.recover();
	}

	async stop(): Promise<void> {
		await this.queue.close();
	}

	private process(): void {
		this.queue.process(async ({ data }) => {
			const outcome = await this.deliver.execute(data.confirmationCode);
			if (outcome.kind !== "awaiting_ack") return;
			await this.queue.add(data.confirmationCode, data, {
				delayMs: backoffDelay(this.policy, outcome.attempts),
			});
		});
	}

	async schedule(confirmationCode: string): Promise<void> {
		await this.queue.add(confirmationCode, { confirmationCode });
	}

	private async recover(): Promise<number> {
		const pending = await this.bookings.listPending();
		for (const booking of pending) {
			await this.schedule(booking.confirmationCode);
		}
		if (pending.length > 0) {
			logger.info("delivery: resumed pending confirmations", {
				count: pending.length,
			});
		}
		return pending.length;
	}
}

export const deliveryLoop = new DeliveryLoop(
	deliveryQueue,
	bookingRepository,
	deliverConfirmationUseCase,
	deliveryBackoff,
);
