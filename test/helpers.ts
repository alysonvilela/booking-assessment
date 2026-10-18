export const sleep = (ms: number) =>
	new Promise((resolve) => setTimeout(resolve, ms));

export const waitFor = async (
	check: () => Promise<boolean> | boolean,
	timeoutMs = 3000,
): Promise<void> => {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		if (await check()) return;
		await sleep(5);
	}
	throw new Error("waitFor timed out");
};
