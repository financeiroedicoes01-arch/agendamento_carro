// Executa a CLI com credenciais somente no ambiente do processo filho.
import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const values = {};
for (const file of [".env", ".env.local"])
  if (existsSync(file))
    Object.assign(values, parseEnv(readFileSync(file, "utf8")));
const secrets = Object.values(values)
  .filter((v) => v.length >= 12)
  .sort((a, b) => b.length - a.length);
function redact(message) {
  for (const value of secrets) message = message.replaceAll(value, "[oculto]");
  return message;
}
const cli = fileURLToPath(
  new URL("../node_modules/netlify-cli/bin/run.js", import.meta.url),
);
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], {
  cwd: fileURLToPath(new URL("../", import.meta.url)),
  env: {
    ...process.env,
    ...values,
    NETLIFY_TELEMETRY_DISABLED: "1",
    CI: "true",
  },
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
});
child.stdout.on("data", (data) =>
  process.stdout.write(redact(data.toString())),
);
child.stderr.on("data", (data) =>
  process.stderr.write(redact(data.toString())),
);
child.on("error", () => {
  console.error("Não foi possível executar a CLI da Netlify.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
