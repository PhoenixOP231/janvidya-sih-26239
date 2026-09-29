import { config } from "dotenv";
config({ path: ".env.local" });
config();
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import * as schema from "../src/db/schema";
import { seedDatabase } from "../src/server/seed";
import { getDb, closeDb } from "../src/server/db";

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (connectionString) {
    const pool = new Pool({ connectionString });
    try {
      const db = drizzle(pool, { schema });
      await migrate(db, { migrationsFolder: "./drizzle" });
      if (process.argv[2] === "seed") {
        if (process.env.DEMO_MODE !== "true")
          throw new Error("Set DEMO_MODE=true to create fictional demo data.");
        await seedDatabase(db);
      }
    } finally {
      await pool.end();
    }
  } else {
    await getDb();
    await closeDb();
  }
  console.log(
    "Database ready. Seeding is idempotent and preserves existing records.",
  );
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
