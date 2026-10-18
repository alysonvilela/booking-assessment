type Level = "info" | "warn" | "error";

/** Structured JSON log. Don't log secrets. */
function emit(
	level: Level,
	msg: string,
	fields: Record<string, unknown> = {},
): void {
	console.log(
		JSON.stringify({ level, msg, ts: new Date().toISOString(), ...fields }),
	);
}

export const logger = {
	info: (msg: string, fields?: Record<string, unknown>) =>
		emit("info", msg, fields),
	warn: (msg: string, fields?: Record<string, unknown>) =>
		emit("warn", msg, fields),
	error: (msg: string, fields?: Record<string, unknown>) =>
		emit("error", msg, fields),
};
