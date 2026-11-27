import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
interface OutboxRow {
  notification: { id: string; title: string; body: string };
  subscriptions: { id: string; subscription: webpush.PushSubscription }[];
}
export default async function () {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Configuração Supabase ausente na função agendada.");
    return new Response("Configuração ausente", { status: 503 });
  }
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.rpc("run_maintenance");
  if (error) {
    console.error("Falha na rotina de reservas:", error.code);
    return new Response("Falha na rotina", { status: 500 });
  }
  const vapidPublic = process.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  // Sem push configurado, os avisos permanecem na central. Nenhum e-mail é enviado.
  if (!vapidPublic || !vapidPrivate || !subject)
    return new Response("Central atualizada; push não configurado.");
  webpush.setVapidDetails(subject, vapidPublic, vapidPrivate);
  const { data, error: claimError } = await client.rpc("claim_push");
  if (claimError) return new Response("Falha na fila de push", { status: 500 });
  let failures = 0;
  const rows = (data || []) as OutboxRow[];
  async function deliver(row: OutboxRow) {
    let retry = false;
    await Promise.all(
      row.subscriptions.map(async (device) => {
        const endpoint = new URL(device.subscription.endpoint);
        const allowed =
          [
            "fcm.googleapis.com",
            "android.googleapis.com",
            "updates.push.services.mozilla.com",
            "web.push.apple.com",
          ].includes(endpoint.hostname) ||
          endpoint.hostname.endsWith(".notify.windows.com") ||
          endpoint.hostname.endsWith(".push.apple.com");
        if (
          endpoint.protocol !== "https:" ||
          !allowed ||
          endpoint.username ||
          endpoint.password ||
          endpoint.port
        ) {
          await client.from("push_subscriptions").delete().eq("id", device.id);
          return;
        }
        try {
          await webpush.sendNotification(
            device.subscription,
            JSON.stringify({
              id: row.notification.id,
              title: row.notification.title,
              body: row.notification.body,
            }),
            { TTL: 3600, timeout: 4000 },
          );
          const { error } = await client.from("push_deliveries").upsert(
            {
              notification_id: row.notification.id,
              subscription_id: device.id,
            },
            {
              onConflict: "notification_id,subscription_id",
              ignoreDuplicates: true,
            },
          );
          if (error) retry = true;
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            const { error } = await client
              .from("push_subscriptions")
              .delete()
              .eq("id", device.id);
            if (error) retry = true;
          } else {
            retry = true;
            failures++;
          }
        }
      }),
    );
    const { error: updateError } = await client
      .from("notifications")
      .update(
        retry
          ? { push_claimed_at: null }
          : { push_sent_at: new Date().toISOString(), push_claimed_at: null },
      )
      .eq("id", row.notification.id);
    if (updateError) failures++;
  }
  for (let i = 0; i < rows.length; i += 5)
    await Promise.all(rows.slice(i, i + 5).map(deliver));
  return new Response(
    JSON.stringify({ processed: data?.length || 0, failures }),
    {
      status: failures ? 207 : 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}
