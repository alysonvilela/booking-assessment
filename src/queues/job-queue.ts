export type Job<T> = {
	readonly id: string;
	readonly data: T;
	readonly attemptsMade: number;
};

export type JobOptions = {
	readonly delayMs?: number;
};

export type JobHandler<T> = (job: Job<T>) => Promise<void>;

export type QueueStats = {
	readonly scheduled: number;
	readonly active: number;
};

export interface JobQueue<T> {
	add(id: string, data: T, options?: JobOptions): Promise<boolean>;
	process(handler: JobHandler<T>): void;
	stats(): Promise<QueueStats>;
	close(): Promise<void>;
}
