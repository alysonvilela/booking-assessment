import {
	type Booking,
	markDelivered,
	recordAttempt,
	redeem,
} from "../domains/booking";
import { nextTick } from "../lib/async";
import type {
	BookingRepository,
	InsertResult,
	RedeemResult,
} from "./booking-repository";

export class InMemoryBookingRepository implements BookingRepository {
	protected readonly byCode = new Map<string, Booking>();
	private readonly codeByReservation = new Map<string, string>();

	async insert(booking: Booking): Promise<InsertResult> {
		await this.ready();
		if (this.byCode.has(booking.confirmationCode)) return "code_taken";
		if (this.codeByReservation.has(booking.reservationId)) {
			return "reservation_taken";
		}
		this.put(booking);
		await this.persist();
		return "inserted";
	}

	async findByCode(code: string): Promise<Booking | null> {
		await this.ready();
		return this.byCode.get(code) ?? null;
	}

	async findByReservationId(reservationId: string): Promise<Booking | null> {
		await this.ready();
		const code = this.codeByReservation.get(reservationId);
		return (code && this.byCode.get(code)) || null;
	}

	async listPending(): Promise<Booking[]> {
		await this.ready();
		return [...this.byCode.values()].filter((b) => b.status === "pending");
	}

	async recordAttempt(
		code: string,
		attempt: { at: Date; channel: string | null; error: string | null },
	): Promise<Booking | null> {
		await this.ready();
		const booking = this.byCode.get(code);
		if (!booking) return null;
		const next = recordAttempt(booking, attempt);
		this.put(next);
		await this.persist();
		return next;
	}

	async markDelivered(code: string, at: Date): Promise<boolean> {
		await this.ready();
		const booking = this.byCode.get(code);
		if (!booking || booking.status === "delivered") return false;
		this.put(markDelivered(booking, at));
		await this.persist();
		return true;
	}

	async redeem(code: string, at: Date): Promise<RedeemResult> {
		await this.ready();
		const booking = this.byCode.get(code);
		if (!booking) return { kind: "not_found" };
		if (booking.redeemedAt) return { kind: "already_redeemed" };
		const next = redeem(booking, at);
		this.put(next);
		await this.persist();
		return { kind: "redeemed", booking: next };
	}

	protected put(booking: Booking): void {
		this.byCode.set(booking.confirmationCode, booking);
		this.codeByReservation.set(booking.reservationId, booking.confirmationCode);
	}

	protected async ready(): Promise<void> {
		await nextTick();
	}

	protected async persist(): Promise<void> {}
}
