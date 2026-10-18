import { EventEmitter } from "node:events";
import {
	type BackoffPolicy,
	backoffDelay,
	deliveryBackoff,
} from "../lib/backoff";
import { logger } from "../lib/logger";
import { errorMessage, isOk, tryCatch } from "../lib/result";
import type { DeliveryJob } from "../usecases/delivery-loop";
import type {
	Job,
	JobHandler,
	JobOptions,
	JobQueue,
	QueueStats,
} from "./job-queue";

type Scheduled<T> = {
	readonly job: Job<T>;
	readonly timer: ReturnType<typeof setTimeout>;
};

const BUSY_RECHECK_MS = 10;

export class EventEmitterJobQueue<T> implements JobQueue<T> {
	private readonly emitter = new EventEmitter();
	private readonly scheduled = new Map<string, Scheduled<T>>();
	private readonly active = new Set<string>();
	private closed = false;

	constructor(
		private readonly name: string,
		private readonly retry: BackoffPolicy,
	) {}

	async add(id: string, data: T, options: JobOptions = {}): Promise<boolean> {
		if (this.closed || this.scheduled.has(id)) return false;
		this.schedule({ id, data, attemptsMade: 0 }, options.delayMs ?? 0);
		return true;
	}

	process(handler: JobHandler<T>): void {
		this.emitter.on("due", (job: Job<T>) => {
			void this.run(job, handler);
		});
	}

	async stats(): Promise<QueueStats> {
		return { scheduled: this.scheduled.size, active: this.active.size };
	}

	async close(): Promise<void> {
		this.closed = true;
		for (const { timer } of this.scheduled.values()) clearTimeout(timer);
		this.scheduled.clear();
		this.emitter.removeAllListeners();
	}

	private schedule(job: Job<T>, delayMs: number): void {
		const timer = setTimeout(() => this.fire(job.id), delayMs);
		timer.unref?.();
		this.scheduled.set(job.id, { job, timer });
	}

	private fire(id: string): void {
		const entry = this.scheduled.get(id);
		if (!entry || this.closed) return;
		if (this.active.has(id)) {
			this.schedule(entry.job, BUSY_RECHECK_MS);
			return;
		}
		this.scheduled.delete(id);
		this.emitter.emit("due", entry.job);
	}

	private async run(job: Job<T>, handler: JobHandler<T>): Promise<void> {
		this.active.add(job.id);
		const result = await tryCatch(() => handler(job));
		this.active.delete(job.id);
		if (isOk(result)) return;

		const attemptsMade = job.attemptsMade + 1;
		const delayMs = backoffDelay(this.retry, attemptsMade);
		logger.warn("job failed, retrying", {
			queue: this.name,
			jobId: job.id,
			attemptsMade,
			nextInMs: delayMs,
			err: errorMessage(result.error),
		});
		if (!this.closed && !this.scheduled.has(job.id)) {
			this.schedule({ ...job, attemptsMade }, delayMs);
		}
	}
}

export const deliveryQueue = new EventEmitterJobQueue<DeliveryJob>(
	"deliveries",
	deliveryBackoff,
);
