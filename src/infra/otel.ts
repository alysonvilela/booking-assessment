import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | undefined;

/**
 * Starts the NodeSDK with the OTLP exporter. Empty endpoint = telemetry off
 * (local behavior): no global provider is registered and spans become no-ops —
 * which is what makes `trace.getTracer(...).startSpan(...)` safe in dev.
 */
export function initializeOtel(serviceName: string, endpoint: string) {
	if (!endpoint) return undefined;
	sdk = new NodeSDK({
		resource: new Resource({ [SEMRESATTRS_SERVICE_NAME]: serviceName }),
		traceExporter: new OTLPTraceExporter({ url: endpoint }),
	});
	sdk.start();
	return sdk;
}

export const shutdownOtel = () => sdk?.shutdown();
