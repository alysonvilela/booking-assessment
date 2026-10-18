import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../db/schema";
import { env } from "../lib/config";

const client = postgres(env.DATABASE_URL, {
	max: Number(process.env.DB_POOL_SIZE ?? 10),
	prepare: false,
});
export const db = drizzle(client, { schema });
export type Db = typeof db;
export { client as sqlClient };
