import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import pg from "pg";
import process from "node:process";
import { URL } from "node:url";
import console from "node:console";

// Apply every migration in an isolated disposable schema, never the app schema.
const schema = `migration_check_${randomBytes(8).toString("hex")}`;
if (!/^migration_check_[a-f0-9]{16}$/.test(schema)) throw new Error("Invalid cleanup target");
const url = new URL(process.env.DATABASE_URL);
const client = new pg.Client({ connectionString: url.href });
await client.connect();
try {
  await client.query(`CREATE SCHEMA "${schema}"`);
  url.searchParams.set("schema", schema);
  const migrated = spawnSync(
    process.execPath,
    ["node_modules/prisma/build/index.js", "migrate", "deploy"],
    {
      env: { ...process.env, DATABASE_URL: url.href },
      encoding: "utf8",
      windowsHide: true,
    },
  );
  // Avoid printing command output that may contain connection credentials.
  if (migrated.status !== 0) throw new Error("Isolated migration deployment failed");
  const result = await client.query(
    `SELECT count(*)::int AS migrations FROM "${schema}"._prisma_migrations WHERE finished_at IS NOT NULL`,
  );
  console.log(`Migration-from-empty passed: ${result.rows[0].migrations} migrations.`);
} finally {
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await client.end();
}
