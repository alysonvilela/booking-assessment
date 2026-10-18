import { defineConfig } from "drizzle-kit";

export default defineConfig({
	schema: "./src/db/schema.ts",
	out: "./src/db/migrations",
	dialect: "postgresql",
	strict: true,
	dbCredentials: {
		url: process.env.DATABASE_URL ?? "postgres://sst:sst@localhost:5432/pentice_dev",
	},
});