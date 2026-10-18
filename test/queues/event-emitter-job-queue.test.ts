import { afterEach, describe, expect, it } from "vitest";
import { EventEmitterJobQueue } from "../../src/queues/event-emitter-job-queue";
import { sleep, waitFor } from "../helpers";

const policy = { baseMs: 5, maxMs: 20, jitter: 0 };
let queue: EventEmitterJobQueue<{ n: number }>;
afterEach(() => queue.close());

describe("EventEmitterJobQueue", () => {
	it("dedupes on job id while the job is waiting", async () => {
		queue = new EventEmitterJobQueue("t", policy);
		const runs: number[] = [];
		queue.process(async (job) => {
			runs.push(job.data.n);
		});

		expect(await queue.add("a", { n: 1 }, { delayMs: 10 })).toBe(true);
		expect(await queue.add("a", { n: 2 })).toBe(false);
		await waitFor(() => runs.length === 1);
		await sleep(20);
		expect(runs).toEqual([1]);
	});

	it("never runs the same id concurrently", async () => {
		queue = new EventEmitterJobQueue("t", policy);
		let running = 0;
		let maxRunning = 0;
		let runs = 0;
		queue.process(async (job) => {
			running++;
			maxRunning = Math.max(maxRunning, running);
			if (++runs < 3) await queue.add("a", job.data);
			await sleep(15);
			running--;
		});

		await queue.add("a", { n: 1 });
		await waitFor(() => runs === 3 && running === 0);
		expect(maxRunning).toBe(1);
	});

	it("retries a throwing handler without an attempt limit", async () => {
		queue = new EventEmitterJobQueue("t", policy);
		let calls = 0;
		queue.process(async () => {
			calls++;
			if (calls < 8) throw new Error("boom");
		});

		await queue.add("a", { n: 1 });
		await waitFor(() => calls === 8);
		await sleep(30);
		expect(calls).toBe(8);
		expect(await queue.stats()).toEqual({ scheduled: 0, active: 0 });
	});
});
