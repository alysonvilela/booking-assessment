export type AppError = { message: string; status?: number };

export type Ok<T> = { readonly _tag: "ok"; readonly value: T };
export type Fail<E> = { readonly _tag: "fail"; readonly error: E };
export type Result<T, E = AppError> = Ok<T> | Fail<E>;

export const ok = <T, E = AppError>(value: T): Result<T, E> => ({
	_tag: "ok",
	value,
});
export const fail = (message: string, status?: number): Fail<AppError> => ({
	_tag: "fail",
	error: { message, status },
});

export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> =>
	result._tag === "ok";
export const isFail = <T, E>(result: Result<T, E>): result is Fail<E> =>
	result._tag === "fail";

export function tryCatch<T>(fn: () => Promise<T>): Promise<Result<T, unknown>>;
export function tryCatch<T, E>(
	fn: () => Promise<T>,
	onError: (error: unknown) => E,
): Promise<Result<T, E>>;
export async function tryCatch<T, E>(
	fn: () => Promise<T>,
	onError?: (error: unknown) => E,
): Promise<Result<T, unknown>> {
	try {
		return { _tag: "ok", value: await fn() };
	} catch (error) {
		return { _tag: "fail", error: onError ? onError(error) : error };
	}
}

export function tryCatchSync<T>(fn: () => T): Result<T, unknown>;
export function tryCatchSync<T, E>(
	fn: () => T,
	onError: (error: unknown) => E,
): Result<T, E>;
export function tryCatchSync<T, E>(
	fn: () => T,
	onError?: (error: unknown) => E,
): Result<T, unknown> {
	try {
		return { _tag: "ok", value: fn() };
	} catch (error) {
		return { _tag: "fail", error: onError ? onError(error) : error };
	}
}

export const errorMessage = (error: unknown): string =>
	error instanceof Error ? error.message : String(error);
