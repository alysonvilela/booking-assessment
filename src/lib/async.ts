export const nextTick = (): Promise<void> =>
	new Promise((resolve) => setImmediate(resolve));
