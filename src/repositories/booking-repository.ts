import { env } from "../config/env";
import type { Booking } from "../domains/booking";
import { InMemoryBookingRepository } from "./in-memory-booking-repository";
import { JsonFileBookingRepository } from "./json-file-booking-repository";

export type InsertResult = "inserted" | "code_taken" | "reservation_taken";

export type RedeemResult =
	| { readonly kind: "redeemed"; readonly booking: Booking }
	| { readonly kind: "already_redeemed" }
	| { readonly kind: "not_found" };

export interface BookingRepository {
	insert(booking: Booking): Promise<InsertResult>;
	findByCode(code: string): Promise<Booking | null>;
	findByReservationId(reservationId: string): Promise<Booking | null>;
	listPending(): Promise<Booking[]>;
	recordAttempt(
		code: string,
		attempt: { at: Date; channel: string | null; error: string | null },
	): Promise<Booking | null>;
	markDelivered(code: string, at: Date): Promise<boolean>;
	redeem(code: string, at: Date): Promise<RedeemResult>;
}

export const bookingRepository: BookingRepository =
	env.STORE_DRIVER === "file"
		? new JsonFileBookingRepository(env.STORE_FILE)
		: new InMemoryBookingRepository();
