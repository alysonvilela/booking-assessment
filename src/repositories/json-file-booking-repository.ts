import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Booking } from "../domains/booking";
import { isFail, tryCatch, tryCatchSync } from "../lib/result";
import { InMemoryBookingRepository } from "./in-memory-booking-repository";

type FileShape = { version: 1; bookings: Booking[] };

export class JsonFileBookingRepository extends InMemoryBookingRepository {
	private loading: Promise<void> | null = null;
	private writing: Promise<void> = Promise.resolve();

	constructor(private readonly path: string) {
		super();
	}

	protected override async ready(): Promise<void> {
		const loading = (this.loading ??= this.load());
		const loaded = await tryCatch(() => loading);
		if (isFail(loaded)) {
			this.loading = null;
			throw loaded.error;
		}
	}

	protected override persist(): Promise<void> {
		const snapshot: FileShape = {
			version: 1,
			bookings: [...this.byCode.values()],
		};
		const previous = this.writing;
		this.writing = tryCatch(() => previous).then(() => this.write(snapshot));
		return this.writing;
	}

	private async load(): Promise<void> {
		const raw = await tryCatch(() => readFile(this.path, "utf8"));
		if (isFail(raw)) {
			if ((raw.error as NodeJS.ErrnoException).code === "ENOENT") return;
			throw raw.error;
		}
		const data = tryCatchSync(() => JSON.parse(raw.value) as FileShape);
		if (isFail(data)) {
			throw new Error(`store file ${this.path} is not valid JSON`);
		}
		for (const booking of data.value.bookings) this.put(booking);
	}

	private async write(snapshot: FileShape): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true });
		const tmp = `${this.path}.${process.pid}.tmp`;
		await writeFile(tmp, JSON.stringify(snapshot, null, 2));
		await rename(tmp, this.path);
	}
}
