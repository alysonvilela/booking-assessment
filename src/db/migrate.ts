import { join } from "node:path";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db, sqlClient } from "../infra/db";

export async function runMigrations() {
	await migrate(db, {
		migrationsFolder: join(process.cwd(), "src/db/migrations"),
	});
}

if (import.meta.main) {
	await runMigrations();
	await sqlClient.end();
	console.log("migrations completed");
}
