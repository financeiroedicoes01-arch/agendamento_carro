import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import { readFile, readdir } from "node:fs/promises";
export const ids = {
  driver: "20000000-0000-4000-8000-000000000001",
  manager: "20000000-0000-4000-8000-000000000002",
  admin: "20000000-0000-4000-8000-000000000003",
  other: "20000000-0000-4000-8000-000000000004",
  car1: "30000000-0000-4000-8000-000000000001",
  car2: "30000000-0000-4000-8000-000000000002",
  unit: "10000000-0000-4000-8000-000000000001",
};
export async function database() {
  const db = new PGlite({ extensions: { btree_gist } });
  await db.exec(
    await readFile(
      new URL("../src/demo/bootstrap.sql", import.meta.url),
      "utf8",
    ),
  );
  const migrations = new URL("../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(migrations))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(file, migrations), "utf8"));
  await db.exec(
    await readFile(new URL("../src/demo/seed.sql", import.meta.url), "utf8"),
  );
  return db;
}
export async function as(db, user) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [user]);
  await db.exec("set role authenticated");
}
export async function command(db, action, payload = {}) {
  return (
    await db.query("select app_command($1,$2::jsonb) as result", [
      action,
      JSON.stringify(payload),
    ])
  ).rows[0].result;
}
export async function snapshot(db) {
  return (await db.query("select app_snapshot() as result")).rows[0].result;
}
export function future(day = 10, hour = 10) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + day);
  d.setUTCHours(hour, 0, 0, 0);
  return d.toISOString();
}
