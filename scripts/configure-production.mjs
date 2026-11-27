import { readFileSync, writeFileSync } from "node:fs";
import { parseEnv } from "node:util";
import * as webpush from "web-push";

const target = "https://agendamentocar.netlify.app";
let source = readFileSync(".env", "utf8");
const env = parseEnv(source);
if (
  !env.NETLIFY_AUTH_TOKEN ||
  !/^[0-9a-f-]{36}$/i.test(env.NETLIFY_SITE_ID || "")
)
  throw new Error("Configure o token e o identificador da Netlify.");
if (
  env.VITE_SUPABASE_URL !== "https://naspszjjsibdjvjzfccw.supabase.co" ||
  env.SUPABASE_URL !== env.VITE_SUPABASE_URL
)
  throw new Error("O Supabase precisa apontar para o projeto de agendamento.");
if (
  !env.VITE_SUPABASE_PUBLISHABLE_KEY?.startsWith("sb_publishable_") ||
  !env.SUPABASE_SERVICE_ROLE_KEY
)
  throw new Error("Configure as chaves públicas e de servidor do Supabase.");
function save(name, value) {
  const re = new RegExp("^" + name + "=.*$", "m");
  source = re.test(source)
    ? source.replace(re, () => name + "=" + value)
    : source + "\n" + name + "=" + value + "\n";
  env[name] = value;
}
if (!env.VAPID_PUBLIC_KEY && !env.VAPID_PRIVATE_KEY) {
  const pair = webpush.generateVAPIDKeys();
  save("VAPID_PUBLIC_KEY", pair.publicKey);
  save("VAPID_PRIVATE_KEY", pair.privateKey);
}
if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY)
  throw new Error("O par de chaves VAPID está incompleto.");
save("VITE_VAPID_PUBLIC_KEY", env.VAPID_PUBLIC_KEY);
if (!env.VAPID_SUBJECT || env.VAPID_SUBJECT.includes("exemplo.org"))
  save("VAPID_SUBJECT", target);
save("VITE_DEMO_MODE", "false");
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY,
);
writeFileSync(".env", source);
const api = "https://api.netlify.com/api/v1";
async function request(path, method = "GET", body) {
  const res = await fetch(api + path, {
    method,
    headers: {
      Authorization: "Bearer " + env.NETLIFY_AUTH_TOKEN,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    let message = "";
    try {
      const error = await res.json();
      message = String(error.message || error.error || "");
      for (const value of Object.values(env).filter((v) => v.length > 8))
        message = message.replaceAll(value, "[oculto]");
    } catch {}
    throw new Error(`Netlify retornou HTTP ${res.status}: ${message}`);
  }
  return res.status === 204 ? null : res.json();
}
const site = await request("/sites/" + env.NETLIFY_SITE_ID);
if (site.name !== "agendamentocar" || site.ssl_url !== target)
  throw new Error("O identificador da Netlify corresponde a outro site.");
const envPath = "/accounts/" + site.account_id + "/env";
const query = "?site_id=" + encodeURIComponent(site.id);
const current = await request(envPath + query);
const existing = new Set(current.map((v) => v.key));
const names = [
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_DEMO_MODE",
  "VITE_VAPID_PUBLIC_KEY",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PUBLIC_KEY",
  "VAPID_PRIVATE_KEY",
  "VAPID_SUBJECT",
];
const privateKeys = new Set(["SUPABASE_SERVICE_ROLE_KEY", "VAPID_PRIVATE_KEY"]);
// O plano atual usa os escopos padrão. Somente variáveis VITE_ entram no navegador.
for (const name of names) {
  const record = {
    key: name,
    values: [{ context: "production", value: env[name] }],
  };
  if (existing.has(name))
    await request(envPath + "/" + name + query, "PUT", record);
  else await request(envPath + query, "POST", [record]);
  console.log(
    JSON.stringify({
      configured: name,
      includedInBrowser: name.startsWith("VITE_"),
    }),
  );
}
await request("/sites/" + site.id, "PATCH", {
  build_settings: {
    cmd: "npm run build",
    dir: "dist",
    functions_dir: "netlify/functions",
  },
});
console.log(
  JSON.stringify({
    site: site.name,
    productionConfigured: true,
    pushKeysReady: true,
    credentialsDisplayed: false,
  }),
);
