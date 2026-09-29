import { defineConfig } from "drizzle-kit";
import { config } from "dotenv";
config({ path: ".env.local" });
config();
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
  },
});
