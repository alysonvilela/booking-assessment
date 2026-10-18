/**
 * A domain event is a fact that already happened. It carries an `id` (used for
 * dedup/idempotency downstream), a `name` (the routing key subscribers register
 * on) and an immutable payload.
 */
export type DomainEvent<Name extends string = string, Payload = unknown> = {
	readonly id: string;
	readonly name: Name;
	readonly occurredAt: Date;
	readonly payload: Payload;
};

export const createEvent = <Name extends string, Payload>(
	name: Name,
	payload: Payload,
): DomainEvent<Name, Payload> => ({
	id: crypto.randomUUID(),
	name,
	occurredAt: new Date(),
	payload,
});
