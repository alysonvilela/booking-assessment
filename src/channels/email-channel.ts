import { NotificationChannel } from "./channel";

export class EmailChannel extends NotificationChannel {
	readonly kind = "email" as const;

	protected address(guest: string): string {
		return `mailto:${guest}`;
	}
}
