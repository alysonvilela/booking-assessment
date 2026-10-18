import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { Booking } from "../domains/booking";
import { InMemoryBookingRepository } from "./in-memory-booking-repository";

type FileShape = { version: 1; bookings: Booking[] };

export class JsonFileBookingRepository extends InMemoryBookingRepository {
	private loading: Promise<void> | null = null;
	private writing: Promise<void> = Promise.resolve();

	constructor(private readonly path: string) {
		super();
	}

	protected override async ready(): Promise<void> {
		this.loading ??= this.load();
		await this.loading;
	}

	protected override persist(): Promise<void> {
		const snapshot: FileShape = {
			version: 1,
			bookings: [...this.byCode.values()],
		};
		this.writing = this.writing
			.catch(() => {})
			.then(() => this.write(snapshot));
		return this.writing;
	}

	private async load(): Promise<void> {
		let raw: string;
		try {
			raw = await readFile(this.path, "utf8");
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
			throw error;
		}
		const data = JSON.parse(raw) as FileShape;
		for (const booking of data.bookings) this.put(booking);
	}

	private async write(snapshot: FileShape): Promise<void> {
		await mkdir(dirname(this.path), { recursive: true });
		const tmp = `${this.path}.${process.pid}.tmp`;
		await writeFile(tmp, JSON.stringify(snapshot, null, 2));
		await rename(tmp, this.path);
	}
}
