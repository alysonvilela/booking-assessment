import { NotificationChannel } from "./channel";

export class WebhookChannel extends NotificationChannel {
	readonly kind = "webhook" as const;

	protected address(guest: string): string {
		return `https://devices.example/${encodeURIComponent(guest)}/confirmations`;
	}
}
