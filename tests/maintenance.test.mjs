import { test, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { generateVAPIDKeys } from "web-push";
import maintenance from "../netlify/functions/maintenance.ts";
const variables = [
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];
const original = Object.fromEntries(variables.map((k) => [k, process.env[k]]));
after(() => {
  for (const k of variables)
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
});
test("função agendada carrega as dependências e recusa configuração ausente", async () => {
  for (const k of variables) delete process.env[k];
  const response = await maintenance();
  assert.equal(response.status, 503);
});
test("função agendada executa rotina e fila com biblioteca Web Push ESM", async () => {
  const calls = [];
  const server = createServer((req, res) => {
    calls.push(req.url);
    res.setHeader("Content-Type", "application/json");
    res.end(req.url.endsWith("run_maintenance") ? '{"expired":0}' : "[]");
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const pair = generateVAPIDKeys();
    process.env.SUPABASE_URL = `http://127.0.0.1:${server.address().port}`;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-key";
    process.env.VAPID_PUBLIC_KEY = pair.publicKey;
    process.env.VAPID_PRIVATE_KEY = pair.privateKey;
    process.env.VAPID_SUBJECT = "https://example.org";
    const response = await maintenance();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { processed: 0, failures: 0 });
    assert.deepEqual(calls, [
      "/rest/v1/rpc/run_maintenance",
      "/rest/v1/rpc/claim_push",
    ]);
  } finally {
    server.close();
    await once(server, "close");
  }
});
