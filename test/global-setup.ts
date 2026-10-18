import { randomBytes } from "node:crypto";
import { join } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const BASE_URL =
	process.env.DATABASE_URL ?? "postgres://sst:sst@localhost:5432/pentice_dev";

type Provide = (key: "dbUrl", value: string) => void;

/**
 * Creates a throwaway schema, applies the migrations to it and hands the schema
 * URL to the tests via `provide`. One schema per run avoids collisions between
 * runs and between test files, without relying on truncate/order.
 */
export default async function setup({ provide }: { provide: Provide }) {
	const schema = `test_${randomBytes(6).toString("hex")}`;
	const admin = postgres(BASE_URL, { max: 1, prepare: false });

	await admin.unsafe(`create schema "${schema}"`);

	const url = new URL(BASE_URL);
	url.searchParams.set("options", `-csearch_path=${schema}`);
	const testUrl = url.toString();

	const client = postgres(testUrl, { max: 1, prepare: false });
	await migrate(drizzle(client), {
		migrationsFolder: join(process.cwd(), "src/db/migrations"),
	});
	await client.end();
	await admin.end();

	provide("dbUrl", testUrl);

	return async () => {
		const cleanup = postgres(BASE_URL, { max: 1, prepare: false });
		await cleanup.unsafe(`drop schema if exists "${schema}" cascade`);
		await cleanup.end();
	};
}
