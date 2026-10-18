import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { Resource } from "@opentelemetry/resources";
import { NodeSDK } from "@opentelemetry/sdk-node";
import { SEMRESATTRS_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

let sdk: NodeSDK | undefined;

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
