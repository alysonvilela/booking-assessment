import { defineConfig } from "vitest/config";

/**
 * The API is DB-backed: each test run uses an isolated, random Postgres schema
 * (`test_<rand>`) created by the global-setup, which applies the migrations and
 * hands the URL over via `provide`. The setup-env injects that URL into
 * `process.env` before any module imports `src/lib/config`. The schema is
 * dropped at the end.
 */
export default defineConfig({
	test: {
		globalSetup: ["./test/global-setup.ts"],
		setupFiles: ["./test/setup-env.ts"],
	},
});
