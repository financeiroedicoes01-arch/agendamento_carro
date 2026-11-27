import { test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { database, as, ids } from "./db-helper.mjs";
let db;
before(async () => {
  db = await database();
});
after(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("reset role;begin");
});
afterEach(async () => {
  await db.exec("rollback;reset role");
});
test("somente e-mail indicado e confirmado recebe administração", async () => {
  await db.query(
    "insert into private.admin_onboarding(email) values('admin-indicado@exemplo.org')",
  );
  const id = "20000000-0000-4000-8000-000000000090";
  await db.query(
    "insert into auth.users(id,email,raw_user_meta_data) values($1,'admin-indicado@exemplo.org','{\"full_name\":\"Administrador indicado\"}')",
    [id],
  );
  assert.equal(
    (await db.query("select is_admin from profiles where id=$1", [id])).rows[0]
      .is_admin,
    false,
  );
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    id,
  ]);
  assert.equal(
    (await db.query("select is_admin from profiles where id=$1", [id])).rows[0]
      .is_admin,
    true,
  );
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    id,
  ]);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from audit_log where action='verified_admin_onboarding'",
      )
    ).rows[0].n,
    1,
  );
});
test("conta confirmada sem indicação e metadados editáveis não concedem administração", async () => {
  const id = "20000000-0000-4000-8000-000000000091";
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,'outro-admin@exemplo.org',now(),'{\"is_admin\":true}')",
    [id],
  );
  assert.equal(
    (await db.query("select is_admin from profiles where id=$1", [id])).rows[0]
      .is_admin,
    false,
  );
});
test("indicação consumida não restaura uma permissão retirada posteriormente", async () => {
  await db.query(
    "insert into private.admin_onboarding(email) values('indicado@exemplo.org')",
  );
  const id = "20000000-0000-4000-8000-000000000092";
  await db.query(
    "insert into auth.users(id,email,email_confirmed_at) values($1,'indicado@exemplo.org',now())",
    [id],
  );
  await db.query("update profiles set is_admin=false where id=$1", [id]);
  await db.query("update auth.users set email_confirmed_at=now() where id=$1", [
    id,
  ]);
  assert.equal(
    (await db.query("select is_admin from profiles where id=$1", [id])).rows[0]
      .is_admin,
    false,
  );
});
test("usuário comum não pode indicar a si mesmo como administrador", async () => {
  await as(db, ids.driver);
  await assert.rejects(
    db.query(
      "insert into private.admin_onboarding(email) values('motorista@exemplo.org')",
    ),
    /permission denied/,
  );
});
