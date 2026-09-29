import { Pool } from "pg";
import {
  drizzle as nodeDrizzle,
  type NodePgDatabase,
} from "drizzle-orm/node-postgres";
import * as schema from "@/db/schema";
import { mkdir } from "node:fs/promises";
import path from "node:path";
export type DB = NodePgDatabase<typeof schema>;
export type Executor = Pick<
  DB,
  "select" | "insert" | "update" | "delete" | "execute"
>;
const globalDb = globalThis as unknown as {
  janvidyaDb?: Promise<DB>;
  janvidyaClose?: () => Promise<void>;
};
export async function getDb(): Promise<DB> {
  if (!globalDb.janvidyaDb) globalDb.janvidyaDb = connect();
  return globalDb.janvidyaDb;
}
async function connect(): Promise<DB> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 15000,
      connectionTimeoutMillis: 10000,
    });
    if (process.env.VERCEL) {
      const { attachDatabasePool } = await import("@vercel/functions");
      attachDatabasePool(pool);
    }
    globalDb.janvidyaClose = () => pool.end();
    return nodeDrizzle(pool, { schema });
  }
  if (process.env.VERCEL)
    throw new Error(
      "DATABASE_URL is required on Vercel. Configure PostgreSQL and run migrations.",
    );
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { migrate } = await import("drizzle-orm/pglite/migrator");
  const directory =
    process.env.PGLITE_DIR || path.join(process.cwd(), ".data", "postgres");
  if (directory !== "memory://") await mkdir(directory, { recursive: true });
  const client = new PGlite(directory);
  await client.waitReady;
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  globalDb.janvidyaClose = () => client.close();
  const shared = db as unknown as DB;
  if ((process.env.DEMO_MODE ?? "true") === "true") {
    const { seedDatabase } = await import("./seed");
    await seedDatabase(shared);
  }
  return shared;
}
export async function closeDb() {
  await globalDb.janvidyaClose?.();
  globalDb.janvidyaDb = undefined;
}
export const demoEnabled = () =>
  process.env.DEMO_MODE === "true" ||
  (!process.env.DATABASE_URL &&
    !process.env.VERCEL &&
    process.env.DEMO_MODE !== "false");
