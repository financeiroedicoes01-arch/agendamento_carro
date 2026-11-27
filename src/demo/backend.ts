import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";
import bootstrap from "./bootstrap.sql?raw";
import seed from "./seed.sql?raw";
const migrationFiles = import.meta.glob("../../supabase/migrations/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
import type { Backend, Snapshot } from "../types";
export const demoUsers = [
  { id: "20000000-0000-4000-8000-000000000001", name: "Ana · motorista" },
  { id: "20000000-0000-4000-8000-000000000002", name: "Pedro · responsável" },
  {
    id: "20000000-0000-4000-8000-000000000003",
    name: "Maria · administradora",
  },
  {
    id: "20000000-0000-4000-8000-000000000004",
    name: "Lucas · responsável do carro 02",
  },
];
let db: PGlite;
let currentUser = localStorage.getItem("shalom-demo-user") || demoUsers[0].id;
export function demoUserId() {
  return currentUser;
}
export async function createDemo(): Promise<Backend> {
  db = new PGlite("idb://shalom-agendamento-v1-onboarding", {
    extensions: { btree_gist },
  });
  await db.waitReady;
  const exists = await db.query(
    "select 1 from pg_tables where schemaname='public' and tablename='settings'",
  );
  if (!exists.rows.length) {
    await db.exec(bootstrap);
  }
  await db.exec("create schema if not exists private");
  await db.exec(
    "create table if not exists private.demo_migrations (path text primary key)",
  );
  for (const path of Object.keys(migrationFiles).sort()) {
    const applied = await db.query(
      "select 1 from private.demo_migrations where path=$1",
      [path],
    );
    if (applied.rows.length) continue;
    // Instalações anteriores já executaram as três migrações iniciais.
    const legacy =
      exists.rows.length &&
      path.split("/").pop()! <= "20261126202237_harden_server_only_storage.sql";
    await db.transaction(async (tx) => {
      if (!legacy) await tx.exec(migrationFiles[path]);
      await tx.query("insert into private.demo_migrations(path) values($1)", [
        path,
      ]);
    });
  }
  if (!exists.rows.length) {
    await db.exec(seed);
  }
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    currentUser,
  ]);
  await db.exec("set role authenticated");
  const api: Backend = {
    async snapshot() {
      await db.exec("reset role");
      await db.query("select private.maintenance()");
      await db.exec("set role authenticated");
      const r = await db.query<{ data: Snapshot }>(
        "select public.app_snapshot() as data",
      );
      return r.rows[0].data;
    },
    async command(action, payload = {}) {
      const r = await db.query<{ data: Record<string, never> }>(
        "select public.app_command($1,$2::jsonb) as data",
        [action, JSON.stringify(payload)],
      );
      return r.rows[0].data;
    },
    async upload(file, bucket, tripId) {
      if (
        !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
        file.size > 10485760
      )
        throw new Error("Envie uma imagem JPG, PNG ou WebP de até 10 MB.");
      const path = `${currentUser}/${tripId || "vehicles"}/${crypto.randomUUID()}`;
      const data = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(r.result as string);
        r.onerror = reject;
        r.readAsDataURL(file);
      });
      await db.query(
        "insert into storage.objects(bucket_id,name,data_url) values($1,$2,$3)",
        [bucket, path, data],
      );
      return path;
    },
    async fileUrl(bucket, path) {
      const r = await db.query<{ data_url: string }>(
        "select data_url from storage.objects where bucket_id=$1 and name=$2",
        [bucket, path],
      );
      if (!r.rows[0]) throw new Error("Arquivo não encontrado.");
      return r.rows[0].data_url;
    },
    async logout() {
      localStorage.removeItem("shalom-demo-user");
      location.reload();
    },
  };
  return api;
}
export async function selectDemoUser(id: string) {
  currentUser = id;
  localStorage.setItem("shalom-demo-user", id);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
}
