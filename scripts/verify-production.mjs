import { readFileSync, readdirSync } from "node:fs";
import { parseEnv } from "node:util";
const env = parseEnv(readFileSync(".env", "utf8"));
const files = readdirSync("dist", { recursive: true });
if (!files.includes("index.html"))
  throw new Error("Página inicial ausente no build.");
if (files.some((f) => /(^|[\\/])\.env($|\.)/.test(f)))
  throw new Error("Arquivo de configuração encontrado no build.");
const code = files
  .filter((f) => /\.(js|html|css|json|webmanifest|map)$/.test(f))
  .map((f) => readFileSync("dist/" + f, "utf8"))
  .join("\n");
for (const key of [
  "NETLIFY_AUTH_TOKEN",
  "SUPABASE_SERVICE_ROLE_KEY",
  "VAPID_PRIVATE_KEY",
])
  if (env[key] && code.includes(env[key]))
    throw new Error("Uma credencial privada foi encontrada no build: " + key);
if (
  !code.includes(env.VITE_SUPABASE_PUBLISHABLE_KEY) ||
  !code.includes(env.VITE_SUPABASE_URL)
)
  throw new Error("O build não contém a conexão pública configurada.");
if (
  code.includes("Destino privado de outro motorista") ||
  files.some((f) => f.endsWith(".wasm"))
)
  throw new Error("Dados de demonstração presentes na publicação real.");
console.log(
  "Build de produção validado: página inicial e conexão pública presentes; nenhuma credencial privada ou dado de demonstração.",
);
