import { config } from "dotenv";
import { Client } from "pg";

config({ path: ".env.local" });
config();

async function main() {
  const connectionString =
    process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!connectionString) throw new Error("Set a Supabase database URL first.");
  const hostname = new URL(connectionString).hostname;
  if (
    !hostname.endsWith(".pooler.supabase.com") &&
    !hostname.endsWith(".supabase.co")
  )
    throw new Error("This command only runs against Supabase PostgreSQL.");

  const client = new Client({ connectionString });
  await client.connect();
  try {
    const role = await client.query<{ current_user: string }>(
      "SELECT current_user",
    );
    if (role.rows[0]?.current_user !== "janvidya_runtime")
      throw new Error("Connect as the dedicated janvidya_runtime table owner.");

    const tables = await client.query<{ qualified: string }>(`
      SELECT format('%I.%I', n.nspname, c.relname) AS qualified
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND pg_get_userbyid(c.relowner) = current_user
      ORDER BY c.relname
    `);
    if (!tables.rows.length) throw new Error("No JanVidya tables were found.");

    await client.query("BEGIN");
    try {
      for (const table of tables.rows) {
        await client.query(
          `ALTER TABLE ${table.qualified} ENABLE ROW LEVEL SECURITY`,
        );
        await client.query(
          `REVOKE ALL ON TABLE ${table.qualified} FROM PUBLIC, anon, authenticated`,
        );
      }
      await client.query(
        "ALTER FUNCTION public.prevent_audit_mutation() SET search_path = ''",
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    const check = await client.query<{
      total: number;
      protected: number;
      client_readable: number;
    }>(`
      SELECT count(*)::int AS total,
        count(*) FILTER (WHERE c.relrowsecurity)::int AS protected,
        count(*) FILTER (WHERE
          has_table_privilege('anon', c.oid, 'SELECT') OR
          has_table_privilege('authenticated', c.oid, 'SELECT'))::int
          AS client_readable
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relkind IN ('r', 'p')
        AND pg_get_userbyid(c.relowner) = current_user
    `);
    const result = check.rows[0];
    if (
      !result ||
      result.total !== tables.rows.length ||
      result.protected !== result.total ||
      result.client_readable !== 0
    )
      throw new Error("Supabase table protection verification failed.");
    console.log(`Protected ${result.total} JanVidya tables from Data API clients.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
