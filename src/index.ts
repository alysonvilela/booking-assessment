import { app } from "./app";
import { env } from "./config/env";
import { initializeOtel, shutdownOtel } from "./config/otel";
import { logger } from "./lib/logger";
import { isFail, tryCatch, tryCatchSync } from "./lib/result";
import { deliveryLoop } from "./usecases/delivery-loop";

const otel = tryCatchSync(() =>
	initializeOtel(env.OTEL_SERVICE_NAME, env.OTEL_EXPORTER_OTLP_ENDPOINT),
);
if (isFail(otel)) logger.error("failed to initialize otel");

await deliveryLoop.start();

const shutdown = async (signal: string) => {
	logger.info("shutting down", { signal });
	await tryCatch(async () => {
		await app.stop();
	});
	await tryCatch(() => deliveryLoop.stop());
	await tryCatch(async () => {
		await shutdownOtel();
	});
	process.exit(0);
};
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));

app.listen(env.API_PORT);
console.log(`pentice api on :${env.API_PORT}`);
