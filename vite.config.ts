import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  cacheDir:
    process.env.AGENDAMENTO_E2E === "1"
      ? "node_modules/.vite-e2e"
      : "node_modules/.vite",
  plugins: [react()],
  server: { port: 5173, strictPort: true },
});
