import { createClient } from "@supabase/supabase-js";
import type { Backend, Snapshot } from "./types";
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const configured = Boolean(url && key);
export const demoEnabled =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (import.meta.env.DEV && !configured);
export const loadDemo = demoEnabled ? () => import("./demo/backend") : null;
export const supabase = configured
  ? createClient(url!, key!, { auth: { flowType: "pkce" } })
  : null;
export async function authOptions(): Promise<{ google: boolean }> {
  if (!configured) return { google: false };
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: key! },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { google: false };
    const settings = await response.json();
    return { google: settings.external?.google === true };
  } catch {
    return { google: false };
  }
}
export const backend: Backend = {
  async snapshot() {
    const { data, error } = await supabase!.rpc("app_snapshot");
    if (error) throw error;
    return data as Snapshot;
  },
  async command(action, payload = {}) {
    const { data, error } = await supabase!.rpc("app_command", {
      action,
      payload,
    });
    if (error) throw error;
    return data;
  },
  async upload(file, bucket, tripId) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error("Envie uma imagem JPG, PNG ou WebP.");
    if (file.size > 10 * 1024 * 1024)
      throw new Error("A foto deve ter até 10 MB.");
    const {
      data: { user },
      error: authError,
    } = await supabase!.auth.getUser();
    if (authError || !user)
      throw new Error("Entre novamente para enviar fotos.");
    const path = `${user.id}/${tripId || "vehicles"}/${crypto.randomUUID()}.${file.type.split("/")[1]}`;
    const { error } = await supabase!.storage
      .from(bucket)
      .upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return path;
  },
  async fileUrl(bucket, path) {
    const { data, error } = await supabase!.storage
      .from(bucket)
      .createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  },
  async logout() {
    const sub = await navigator.serviceWorker
      ?.getRegistration()
      .then((r) => r?.pushManager.getSubscription())
      .catch(() => null);
    if (sub) {
      await this.command("unsubscribe_push", { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
    const { error } = await supabase!.auth.signOut();
    if (error) throw error;
  },
};
export function friendlyError(error: unknown) {
  const raw =
    error instanceof Error
      ? error.message
      : (error as { message?: string })?.message ||
        "Não foi possível concluir. Tente novamente.";
  if (raw.includes("one_pending_change"))
    return "Já há uma alteração aguardando decisão para esta viagem.";
  if (raw.includes("exclusion constraint"))
    return "O veículo ou o motorista já tem uma reserva nesse período.";
  if (raw.includes("duplicate key"))
    return "Já existe um cadastro com esses dados.";
  if (raw.includes("Invalid login credentials"))
    return "E-mail ou senha incorretos.";
  if (raw.includes("Email not confirmed"))
    return "Confirme seu endereço pelo link enviado por e-mail.";
  if (raw.includes("Failed to fetch"))
    return "Sem conexão com o servidor. Confira sua internet e tente novamente.";
  if (raw.includes("check constraint"))
    return "Confira os dados: horários, valores ou quilometragem inválidos.";
  if (raw.includes("violates not-null") || raw.includes("foreign key"))
    return "Preencha os campos obrigatórios e selecione cadastros válidos.";
  return raw;
}
