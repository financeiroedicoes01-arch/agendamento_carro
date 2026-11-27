import { useEffect, useState } from "react";
import { BellRing, BellOff } from "lucide-react";
import { useApp } from "./context";
import { friendlyError } from "./backend";
export function PushSettings() {
  const { api, isDemo, notify } = useApp();
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const supported =
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  const key = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  useEffect(() => {
    if (supported)
      navigator.serviceWorker
        .getRegistration()
        .then((r) => r?.pushManager.getSubscription())
        .then((s) => setSubscribed(Boolean(s)))
        .catch(() => {});
  }, [supported]);
  async function toggle() {
    setBusy(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      if (existing) {
        await api.command("unsubscribe_push", { endpoint: existing.endpoint });
        await existing.unsubscribe();
        setSubscribed(false);
        notify("Avisos no celular desativados. A central continua disponível.");
        return;
      }
      const permission = await Notification.requestPermission();
      if (permission !== "granted")
        throw new Error(
          "A permissão não foi concedida. Você pode acompanhar todos os avisos pelo sino.",
        );
      const normalized = key!.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = Uint8Array.from(
        atob(normalized + "=".repeat((4 - (normalized.length % 4)) % 4)),
        (c) => c.charCodeAt(0),
      );
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: bytes,
      });
      try {
        await api.command("subscribe_push", {
          subscription: subscription.toJSON(),
        });
      } catch (e) {
        await subscription.unsubscribe();
        throw e;
      }
      setSubscribed(true);
      notify("Notificações ativadas neste aparelho.");
    } catch (e) {
      notify(friendlyError(e), true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="push-settings">
      <div>
        <BellRing size={22} />
        <div>
          <b>Avisos no seu celular</b>
          <p>
            {isDemo
              ? "A demonstração usa apenas a central do aplicativo."
              : subscribed
                ? "Ativos neste aparelho."
                : "Ative para acompanhar as atualizações."}
          </p>
        </div>
      </div>
      <button
        className="button secondary compact"
        disabled={busy || isDemo || !supported || (!key && !subscribed)}
        onClick={() => void toggle()}
      >
        {subscribed ? <BellOff size={16} /> : <BellRing size={16} />}{" "}
        {busy ? "Aguarde…" : subscribed ? "Desativar" : "Ativar"}
      </button>
      <details>
        <summary>Como ativar no iPhone e em outros aparelhos</summary>
        <p>
          No iPhone com iOS 16.4 ou posterior, abra pelo Safari, toque em
          Compartilhar e em Adicionar à Tela de Início. Abra pelo novo ícone e
          toque em Ativar para autorizar os avisos.
        </p>
        <p>
          No Android, abra o aplicativo em um navegador compatível e toque em
          Ativar. As notificações dependem de conexão e das permissões do
          aparelho.
        </p>
        {!supported && (
          <p>
            Este navegador ainda não permite ativar o push. Seus avisos
            continuam no sino.
          </p>
        )}
        {!key && !isDemo && (
          <p>
            O envio de push ainda precisa ser configurado pela equipe
            responsável pelo sistema.
          </p>
        )}
      </details>
    </div>
  );
}
