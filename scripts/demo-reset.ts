import { config } from "dotenv";
import { access, mkdir, realpath, rename } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb, closeDb } from "../src/server/db";

config({ path: ".env.local" });
config();

async function main() {
  if (
    process.env.DATABASE_URL ||
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.VERCEL ||
    process.env.DEMO_MODE === "false"
  )
    throw new Error(
      "Demo reset is allowed only for a local embedded demo database.",
    );
  const workspace = await realpath(process.cwd());
  const dataRoot = path.join(workspace, ".data");
  await mkdir(dataRoot, { recursive: true });
  const safeRoot = await realpath(dataRoot);
  if (safeRoot !== dataRoot)
    throw new Error("The demo data directory must be inside this workspace.");
  const target = path.resolve(
    process.env.PGLITE_DIR || path.join(dataRoot, "postgres"),
  );
  const relative = path.relative(safeRoot, target);
  if (
    !relative ||
    relative.startsWith("..") ||
    path.isAbsolute(relative) ||
    relative.includes(path.sep)
  )
    throw new Error("The demo database path must be a direct child of .data.");
  let backup = "";
  try {
    await access(target);
    if ((await realpath(target)) !== target)
      throw new Error("The demo database cannot be a link outside .data.");
    const backupRoot = path.join(safeRoot, "backups");
    await mkdir(backupRoot, { recursive: true });
    if ((await realpath(backupRoot)) !== backupRoot)
      throw new Error("The backup directory cannot be a link outside .data.");
    backup = path.join(
      backupRoot,
      `${path.basename(target)}-${Date.now()}-${randomUUID().slice(0, 8)}`,
    );
    await rename(target, backup);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  await getDb();
  await closeDb();
  console.log(
    `Fictional demo restored.${backup ? ` Previous database backed up at ${backup}.` : ""}`,
  );
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
