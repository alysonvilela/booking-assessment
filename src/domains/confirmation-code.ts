import { randomUUID } from "node:crypto";

const PATTERN = /^[a-z0-9]{5}$/;

export const generateConfirmationCode = (): string => randomUUID().slice(0, 5);

export const normalizeConfirmationCode = (raw: string): string | null => {
	const code = raw.trim().toLowerCase();
	return PATTERN.test(code) ? code : null;
};
