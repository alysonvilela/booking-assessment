import { NotificationChannel } from "./channel";

export class PushChannel extends NotificationChannel {
	readonly kind = "push" as const;

	protected address(guest: string): string {
		return `push-token:${guest}`;
	}
}
