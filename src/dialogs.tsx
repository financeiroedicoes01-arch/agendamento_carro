import { useState } from "react";
import {
  CarFront,
  Plus,
  Trash2,
  MapPin,
  Clock3,
  ShieldCheck,
  Repeat2,
  AlertTriangle,
  UserRound,
} from "lucide-react";
import { useApp, type Dialog } from "./context";
import {
  Form,
  Field,
  NoticeBox,
  Status,
  Period,
  Destination,
  PrivateImage,
  labels,
} from "./ui";
import { fmt, inputTime, iso, today, nearPrevious, overlap } from "./time";
import type { CommandResult, Trip } from "./types";
const str = (f: FormData, key: string) => String(f.get(key) || "").trim();
function actionText(action: string) {
  const list: Record<string, string> = {
    checkout: "Retirada registrada",
    checkin: "Devolução registrada",
    correct_km: "Quilometragem corrigida",
    cancel_trip: "Reserva cancelada",
    propose_change: "Alteração solicitada",
    decide_change: "Alteração decidida",
    decide_request: "Solicitação decidida",
    create_block: "Bloqueio de manutenção criado",
    release_block: "Veículo liberado",
    edit_series: "Recorrência alterada",
    create_series: "Recorrência criada",
  };
  return list[action] || "Registro atualizado";
}
export default function DialogContent({ dialog: d }: { dialog: Dialog }) {
  const { data, open, run, user, manages, name } = useApp();
  if (d.type === "new_request") return <RequestForm vehicleId={d.vehicleId} />;
  if (d.type === "trip") return <TripDetails id={d.id!} />;
  if (d.type === "request") return <RequestDetails id={d.id!} />;
  if (d.type === "profile") return <ProfileForm />;
  if (
    d.type === "checkout" ||
    d.type === "checkin" ||
    d.type === "correct_km" ||
    d.type === "change"
  )
    return <TripForm type={d.type} id={d.id!} />;
  if (d.type === "incident") return <IncidentDetails id={d.id!} />;
  if (d.type === "block") return <BlockForm vehicleId={d.vehicleId!} />;
  if (d.type === "assignment")
    return <AssignmentForm vehicleId={d.vehicleId!} />;
  if (d.type === "series" || d.type === "edit_series")
    return <SeriesForm id={d.id} vehicleId={d.vehicleId} />;
  if (["unit", "vehicle", "user", "settings"].includes(d.type))
    return <RegistryForm dialog={d} />;
  if (d.type === "series_result") return <p>{d.value}</p>;
  if (d.type === "delete_vehicle")
    return (
      <Form
        submit="Confirmar exclusão"
        onSubmit={() =>
          run(
            "delete_vehicle",
            { id: d.id },
            "Carro excluído. O histórico foi preservado.",
          )
        }
      >
        <p>Excluir {data.vehicles.find((v) => v.id === d.id)?.name}?</p>
        <NoticeBox>
          O carro ficará inativo e não receberá novas solicitações. O histórico
          de viagens será preservado. Antes de excluir, encerre as recorrências
          e resolva as solicitações pendentes e viagens abertas.
        </NoticeBox>
      </Form>
    );
  if (d.type === "release_block")
    return (
      <Form
        submit="Liberar carro"
        onSubmit={() => run("release_block", { id: d.id }, "Veículo liberado.")}
      >
        <p>
          O bloqueio será encerrado. Novas reservas poderão ser confirmadas
          respeitando a agenda.
        </p>
      </Form>
    );
  if (d.type === "remove_assignment")
    return (
      <Form
        submit="Remover atribuição"
        onSubmit={() =>
          run(
            "save_assignment",
            { id: d.id, vehicle_id: d.vehicleId },
            "Atribuição removida.",
          )
        }
      >
        <p>
          A pessoa deixará de ser responsável temporária por este carro. As
          decisões e viagens anteriores ficam preservadas.
        </p>
      </Form>
    );
  if (d.type === "stop_series")
    return (
      <Form
        submit="Encerrar recorrência"
        onSubmit={() =>
          run("stop_series", { id: d.id }, "Recorrência encerrada.")
        }
      >
        <NoticeBox>
          As próximas reservas ainda não iniciadas serão canceladas. O histórico
          e as viagens em andamento serão preservados.
        </NoticeBox>
      </Form>
    );
  if (d.type === "cancel" || d.type === "cancel_request")
    return (
      <Form
        submit="Confirmar cancelamento"
        onSubmit={() =>
          run(
            d.type === "cancel" ? "cancel_trip" : "cancel_request",
            { id: d.id },
            "Cancelamento registrado.",
          )
        }
      >
        <NoticeBox>
          A reserva ou solicitação será cancelada. Para viajar depois, faça um
          novo pedido.
        </NoticeBox>
      </Form>
    );
  return <p>Registro não encontrado.</p>;
}
function RequestForm({ vehicleId }: { vehicleId?: string }) {
  const { data, user, manages, run, notify } = useApp();
  const [car, setCar] = useState(vehicleId || "");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const startIso = start ? iso(start) : "";
  const endIso = end ? iso(end) : "";
  const near = start
    ? data.vehicles.filter(
        (v) =>
          (!car || v.id === car) && nearPrevious(data.calendar, startIso, v.id),
      )
    : [];
  const conflicts =
    start && end
      ? data.calendar.filter(
          (e) =>
            e.kind !== "history" &&
            (!car || e.vehicle_id === car) &&
            overlap(
              e.starts_at,
              e.ends_at === "infinity" ? "9999-12-31" : e.ends_at,
              startIso,
              endIso,
            ),
        )
      : [];
  return (
    <Form
      submit={
        car && manages(car) ? "Confirmar minha reserva" : "Enviar solicitação"
      }
      onSubmit={async (f) => {
        const result = await run(
          "create_request",
          {
            destination: str(f, "destination"),
            vehicle_id: car || null,
            starts_at: iso(start),
            ends_at: iso(end),
          },
          "",
        );
        notify(
          result.reservation_id
            ? "Sua reserva foi confirmada."
            : "Solicitação enviada aos responsáveis.",
        );
      }}
    >
      <p className="muted">
        O motorista desta viagem é você, {user.full_name.split(" ")[0]}.
      </p>
      <Field label="Destino">
        <input
          name="destination"
          required
          placeholder="Para onde você vai?"
          maxLength={500}
        />
      </Field>
      <div className="form-grid">
        <Field label="Saída prevista">
          <input
            name="starts_at"
            type="datetime-local"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </Field>
        <Field label="Retorno previsto">
          <input
            name="ends_at"
            type="datetime-local"
            required
            value={end}
            min={start || undefined}
            onChange={(e) => setEnd(e.target.value)}
          />
        </Field>
      </div>
      <Field label="Escolha do carro">
        <select
          name="vehicle_id"
          value={car}
          onChange={(e) => setCar(e.target.value)}
        >
          <option value="">Qualquer carro disponível</option>
          {data.vehicles
            .filter((v) => v.active)
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.model}
              </option>
            ))}
        </select>
      </Field>
      {near.length > 0 && (
        <NoticeBox>
          O retorno de outra reserva está a até 30 minutos da sua saída (
          {near.map((v) => v.name).join(", ")}). Pode haver atraso na retirada.
        </NoticeBox>
      )}
      {conflicts.length > 0 && (
        <NoticeBox>
          Há períodos ocupados nesse intervalo.{" "}
          {car
            ? "Escolha outro horário ou carro."
            : "A solicitação considerará apenas os carros disponíveis."}
        </NoticeBox>
      )}
      <NoticeBox>
        {car && manages(car)
          ? "Você é responsável por este carro. Sua reserva será confirmada se o período estiver disponível."
          : "O pedido depende da decisão de um responsável. O período fica reservado após a confirmação."}
      </NoticeBox>
      <p className="field-hint">Horários no fuso {data.settings.timezone}.</p>
    </Form>
  );
}
function ProfileForm() {
  const { user, data, run } = useApp();
  return (
    <Form
      submit="Salvar meu perfil"
      onSubmit={(f) =>
        run(
          "save_profile",
          {
            full_name: str(f, "full_name"),
            phone: str(f, "phone"),
            unit_id: str(f, "unit_id"),
          },
          "Perfil atualizado.",
        )
      }
    >
      <Field label="Nome completo">
        <input
          name="full_name"
          required
          minLength={3}
          defaultValue={user.full_name}
          autoComplete="name"
        />
      </Field>
      <Field label="E-mail">
        <input type="email" value={user.email} disabled />
      </Field>
      <Field label="WhatsApp">
        <input
          name="phone"
          required
          minLength={8}
          type="tel"
          defaultValue={user.phone}
          autoComplete="tel"
        />
      </Field>
      <Field label="Seu vínculo">
        <select name="unit_id" required defaultValue={user.unit_id || ""}>
          <option value="" disabled>
            Selecione o setor ou casa comunitária
          </option>
          {data.units
            .filter((u) => u.active || u.id === user.unit_id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </Field>
      {data.units.length === 0 && (
        <NoticeBox>
          O administrador precisa cadastrar as unidades para que você possa
          completar o vínculo e solicitar um carro.
        </NoticeBox>
      )}
    </Form>
  );
}
function RequestDetails({ id }: { id: string }) {
  const { data, user, open, name } = useApp();
  const r = data.requests.find((r) => r.id === id);
  if (!r) return <p>Solicitação não disponível para o seu perfil.</p>;
  const trip = data.reservations.find((t) => t.request_id === id);
  return (
    <div className="detail-content">
      <Status value={r.status} />
      <Destination value={r.destination} />
      <Period start={r.starts_at} end={r.ends_at} />
      <p>
        <UserRound size={16} /> Motorista: {name(r.driver_id)}
      </p>
      <p>
        {r.mode === "any"
          ? "Solicitação única para qualquer carro disponível."
          : "Solicitação para um carro específico."}
      </p>
      <div className="detail-section">
        <h3>Veículos e decisões</h3>
        {data.candidates
          .filter((c) => c.request_id === id)
          .map((c) => (
            <div className="detail-row" key={c.id}>
              <span>
                {data.vehicles.find((v) => v.id === c.vehicle_id)?.name}
              </span>
              <Status value={c.status} />
              {c.reason && <p>{c.reason}</p>}
            </div>
          ))}
      </div>
      {r.status === "pending" && (
        <NoticeBox>
          O período ainda não está reservado. Uma recusa parcial em pedido para
          qualquer carro mantém os demais candidatos pendentes.
        </NoticeBox>
      )}
      {trip && (
        <button
          className="button primary"
          onClick={() => open({ type: "trip", id: trip.id })}
        >
          Ver reserva confirmada
        </button>
      )}
      {r.status === "pending" && r.driver_id === user.id && (
        <button
          className="button secondary"
          onClick={() => open({ type: "cancel_request", id })}
        >
          Cancelar solicitação
        </button>
      )}
    </div>
  );
}
function TripDetails({ id }: { id: string }) {
  const { data, user, manages, name, open } = useApp();
  const t = data.reservations.find((t) => t.id === id);
  if (!t) return <p>Viagem não disponível para o seu perfil.</p>;
  const v = data.vehicles.find((v) => v.id === t.vehicle_id)!;
  const responsible = manages(v.id);
  const changes = data.changes.filter((c) => c.reservation_id === id);
  const pending = changes.some((c) => c.status === "pending");
  const incidents = data.incidents.filter((i) => i.reservation_id === id);
  const fuels = data.fuels.filter((f) => f.reservation_id === id);
  const audits = data.audit_log.filter((a) => a.entity_id === id);
  return (
    <div className="detail-content">
      <div className="trip-card-head">
        <div>
          <h3>{v.name}</h3>
          <p className="muted">
            {v.model} · {v.plate}
          </p>
        </div>
        <Status value={t.status} />
      </div>
      <Destination value={t.destination} />
      <p className="driver-line">
        <UserRound size={17} />
        {name(t.driver_id)}
      </p>
      <Period start={t.starts_at} end={t.ends_at} />
      {t.series_id && (
        <NoticeBox>
          Esta é uma ocorrência de uma série. As ações abaixo alteram apenas
          esta viagem. Para alterar ou encerrar todas as futuras, acesse
          Veículos.
        </NoticeBox>
      )}
      {t.actual_start && (
        <div className="detail-section">
          <h3>Registro do uso</h3>
          <div className="detail-row">
            <span>Retirada</span>
            <b>
              {fmt(t.actual_start)} · {t.km_out} km
            </b>
          </div>
          <small>
            Registrada por {name(t.departure_by || t.driver_id)}
            {t.departure_note && ` · ${t.departure_note}`}
          </small>
          {t.actual_end && (
            <>
              <div className="detail-row">
                <span>Devolução</span>
                <b>
                  {fmt(t.actual_end)} · {t.km_in} km
                </b>
              </div>
              <small>
                Registrada por {name(t.return_by || t.driver_id)}
                {t.return_note && ` · ${t.return_note}`}
              </small>
              <div className="detail-row">
                <span>Distância registrada</span>
                <b>{Number(t.km_in) - Number(t.km_out)} km</b>
              </div>
            </>
          )}
        </div>
      )}
      {changes.length > 0 && (
        <div className="detail-section">
          <h3>Alterações e prorrogações</h3>
          {changes.map((c) => (
            <div className="change-detail" key={c.id}>
              <Status value={c.status} />
              <p>{c.destination}</p>
              <Period start={c.starts_at} end={c.ends_at} />
              {c.status === "pending" && (
                <p className="muted">
                  O período aprovado acima continua válido até a decisão.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
      {fuels.length > 0 && (
        <div className="detail-section">
          <h3>Abastecimentos</h3>
          {fuels.map((f, i) => (
            <div key={f.id} className="fuel-detail">
              <b>
                {Number(f.amount).toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </b>
              <PrivateImage
                path={f.receipt_path}
                alt={`Comprovante ${i + 1}`}
              />
            </div>
          ))}
        </div>
      )}
      {t.status === "completed" && (
        <div className="detail-section">
          <h3>Ocorrências</h3>
          {t.no_incidents ? (
            <p>Nenhum problema ou acidente informado.</p>
          ) : (
            incidents.map((i) => (
              <button
                key={i.id}
                className="incident-link"
                onClick={() => open({ type: "incident", id: i.id })}
              >
                <span>
                  {i.kind === "problem" ? "Problema" : "Acidente"} ·{" "}
                  {i.description}
                </span>
                <Status
                  value={i.status}
                  text={i.status === "pending" ? "Pendente" : undefined}
                />
              </button>
            ))
          )}
        </div>
      )}
      {audits.length > 0 && (
        <details className="audit-details">
          <summary>Histórico de registros e correções</summary>
          {audits.map((a) => (
            <div key={a.id} className="audit-entry">
              <b>{actionText(a.action)}</b>
              <span>
                {name(a.actor_id || "")} · {fmt(a.created_at)}
              </span>
              {typeof a.after_data?.justification === "string" &&
                a.after_data.justification && (
                  <p>Justificativa: {a.after_data.justification}</p>
                )}
              {a.action === "correct_km" && (
                <p>
                  Saída: {String(a.after_data.km_out)} km · Retorno:{" "}
                  {String(a.after_data.km_in || "ainda não registrado")} km
                </p>
              )}
            </div>
          ))}
        </details>
      )}
      <div className="detail-actions">
        {t.status === "approved" && (
          <>
            <button
              className="button primary"
              onClick={() => open({ type: "checkout", id })}
            >
              {t.driver_id === user.id
                ? "Registrar retirada"
                : "Registrar retirada esquecida"}
            </button>
            {t.driver_id === user.id && !pending && (
              <button
                className="button secondary"
                onClick={() => open({ type: "change", id })}
              >
                Solicitar alteração
              </button>
            )}
            <button
              className="button secondary danger-text"
              onClick={() => open({ type: "cancel", id })}
            >
              Cancelar reserva
            </button>
          </>
        )}
        {t.status === "in_progress" && (
          <>
            <button
              className="button primary"
              onClick={() => open({ type: "checkin", id })}
            >
              {t.driver_id === user.id
                ? "Registrar devolução"
                : "Registrar devolução esquecida"}
            </button>
            {t.driver_id === user.id && !pending && (
              <button
                className="button secondary"
                onClick={() => open({ type: "change", id })}
              >
                Solicitar prorrogação
              </button>
            )}
          </>
        )}
        {responsible && t.actual_start && (
          <button
            className="button secondary"
            onClick={() => open({ type: "correct_km", id })}
          >
            Corrigir quilometragem
          </button>
        )}
      </div>
    </div>
  );
}
function TripForm({ type, id }: { type: string; id: string }) {
  const { data, user, run } = useApp();
  const t = data.reservations.find((t) => t.id === id)!;
  const isOther = t.driver_id !== user.id;
  if (type === "checkin") return <ReturnForm trip={t} />;
  if (type === "change")
    return (
      <Form
        submit={
          t.status === "in_progress" ? "Pedir prorrogação" : "Enviar alteração"
        }
        onSubmit={(f) =>
          run(
            "propose_change",
            {
              id,
              destination: str(f, "destination"),
              starts_at:
                t.status === "in_progress"
                  ? t.starts_at
                  : iso(str(f, "starts_at")),
              ends_at: iso(str(f, "ends_at")),
            },
            "Proposta enviada. Sua reserva original permanece válida.",
          )
        }
      >
        <NoticeBox>
          A alteração depende de aprovação. Até a decisão, permanecem os
          horários confirmados.
        </NoticeBox>
        <Field label="Destino">
          <input
            name="destination"
            defaultValue={t.destination}
            required
            readOnly={t.status === "in_progress"}
          />
        </Field>
        {t.status !== "in_progress" && (
          <Field label="Nova saída prevista">
            <input
              type="datetime-local"
              name="starts_at"
              defaultValue={inputTime(t.starts_at)}
              required
            />
          </Field>
        )}
        <Field label="Novo retorno previsto">
          <input
            type="datetime-local"
            name="ends_at"
            defaultValue={inputTime(t.ends_at)}
            required
          />
        </Field>
      </Form>
    );
  if (type === "correct_km")
    return (
      <Form
        submit="Salvar correção"
        onSubmit={(f) =>
          run(
            "correct_km",
            {
              id,
              km_out: Number(f.get("km_out")),
              km_in: t.actual_end ? Number(f.get("km_in")) : null,
              justification: str(f, "justification"),
            },
            "Correção registrada no histórico.",
          )
        }
      >
        <Field label="Quilometragem de retirada">
          <input
            type="number"
            step="0.1"
            min="0"
            name="km_out"
            defaultValue={t.km_out ?? ""}
            required
          />
        </Field>
        {t.actual_end && (
          <Field label="Quilometragem de devolução">
            <input
              type="number"
              step="0.1"
              min="0"
              name="km_in"
              defaultValue={t.km_in ?? ""}
              required
            />
          </Field>
        )}
        <Field label="Justificativa da correção">
          <textarea name="justification" required />
        </Field>
        <NoticeBox>
          Seu nome e a justificativa ficarão registrados no histórico da viagem.
        </NoticeBox>
      </Form>
    );
  const latest = data.reservations
    .filter(
      (r) => r.vehicle_id === t.vehicle_id && r.actual_end && r.km_in !== null,
    )
    .sort((a, b) => +new Date(b.actual_end!) - +new Date(a.actual_end!))[0];
  return (
    <Form
      submit="Confirmar retirada"
      onSubmit={(f) =>
        run(
          "checkout",
          {
            id,
            km: Number(f.get("km")),
            actual_at: isOther ? iso(str(f, "actual_at")) : null,
            justification: str(f, "justification"),
          },
          "Boa viagem! Retirada registrada.",
        )
      }
    >
      <p>
        {data.vehicles.find((v) => v.id === t.vehicle_id)?.name} ·{" "}
        {t.destination}
      </p>
      <Field label="Quilometragem de saída">
        <input
          name="km"
          type="number"
          min="0"
          step="0.1"
          defaultValue={latest?.km_in ?? ""}
          required
          placeholder="Km no painel do carro"
        />
      </Field>
      <p className="field-hint">
        A última quilometragem de devolução é uma sugestão. Confira o painel e
        ajuste se necessário.
      </p>
      {isOther && (
        <>
          <Field label="Horário real da retirada">
            <input
              name="actual_at"
              type="datetime-local"
              defaultValue={inputTime()}
              required
            />
          </Field>
          <Field label="Justificativa do registro pelo responsável">
            <textarea name="justification" required />
          </Field>
        </>
      )}
      <NoticeBox>
        {isOther
          ? "O registro identificará o motorista e você como responsável pelo lançamento."
          : "O horário real será registrado agora. Retiradas antecipadas também passam pela verificação de disponibilidade."}
      </NoticeBox>
    </Form>
  );
}
interface FuelDraft {
  id: string;
  amount: string;
  file: File | null;
}
interface IncidentDraft {
  id: string;
  kind: string;
  description: string;
  occurred_at: string;
  location: string;
  files: File[];
}
function ReturnForm({ trip: t }: { trip: Trip }) {
  const { user, run, api } = useApp();
  const [fuels, setFuels] = useState<FuelDraft[]>([]);
  const [incidents, setIncidents] = useState<IncidentDraft[]>([]);
  const [declaration, setDeclaration] = useState("");
  const isOther = t.driver_id !== user.id;
  const changeFuel = (id: string, patch: Partial<FuelDraft>) =>
    setFuels((items) =>
      items.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  const changeIncident = (id: string, patch: Partial<IncidentDraft>) =>
    setIncidents((items) =>
      items.map((f) => (f.id === id ? { ...f, ...patch } : f)),
    );
  return (
    <Form
      submit="Concluir devolução"
      onSubmit={async (f) => {
        if (!declaration)
          throw new Error("Declare se houve problemas ou acidentes.");
        if (declaration === "incidents" && !incidents.length)
          throw new Error("Adicione uma ocorrência.");
        const fuelRows = [];
        for (const fuel of fuels) {
          if (!fuel.file || Number(fuel.amount) <= 0)
            throw new Error(
              "Cada abastecimento exige valor e foto do comprovante.",
            );
          fuelRows.push({
            amount: Number(fuel.amount),
            receipt_path: await api.upload(fuel.file, "trip-files", t.id),
          });
        }
        const incidentRows = [];
        if (declaration === "incidents")
          for (const i of incidents) {
            if (!i.files.length)
              throw new Error("Cada ocorrência exige ao menos uma foto.");
            incidentRows.push({
              kind: i.kind,
              description: i.description,
              occurred_at: iso(i.occurred_at),
              location: i.location,
              photos: await Promise.all(
                i.files.map((file) => api.upload(file, "trip-files", t.id)),
              ),
            });
          }
        await run(
          "checkin",
          {
            id: t.id,
            km: Number(f.get("km")),
            actual_at: isOther ? iso(str(f, "actual_at")) : null,
            justification: str(f, "justification"),
            no_incidents: declaration === "none",
            fuels: fuelRows,
            incidents: incidentRows,
          },
          "Devolução registrada. Obrigado por cuidar do nosso carro.",
        );
      }}
    >
      <Field label="Quilometragem de retorno">
        <input
          name="km"
          type="number"
          step="0.1"
          min={t.km_out ?? 0}
          required
          placeholder={`Saída: ${t.km_out} km`}
        />
      </Field>
      {isOther && (
        <>
          <Field label="Horário real da devolução">
            <input
              name="actual_at"
              type="datetime-local"
              required
              defaultValue={inputTime()}
            />
          </Field>
          <Field label="Justificativa do registro pelo responsável">
            <textarea name="justification" required />
          </Field>
        </>
      )}
      <div className="form-section-head">
        <h3>Abastecimentos</h3>
        <button
          type="button"
          className="text-button"
          onClick={() =>
            setFuels([
              ...fuels,
              { id: crypto.randomUUID(), amount: "", file: null },
            ])
          }
        >
          <Plus size={16} />
          Adicionar
        </button>
      </div>
      <p className="field-hint">
        Se abasteceu durante a viagem, informe o valor e envie o comprovante.
      </p>
      {fuels.map((fuel, i) => (
        <div key={fuel.id} className="nested-form">
          <div className="nested-form-head">
            <b>Abastecimento {i + 1}</b>
            <button
              type="button"
              className="icon-button"
              aria-label={`Remover abastecimento ${i + 1}`}
              onClick={() => setFuels(fuels.filter((f) => f.id !== fuel.id))}
            >
              <Trash2 size={17} />
            </button>
          </div>
          <Field label="Valor total (R$)">
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={fuel.amount}
              onChange={(e) => changeFuel(fuel.id, { amount: e.target.value })}
            />
          </Field>
          <Field label="Foto do comprovante">
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required
              onChange={(e) =>
                changeFuel(fuel.id, { file: e.target.files?.[0] || null })
              }
            />
          </Field>
        </div>
      ))}
      <div className="form-section-head">
        <h3>Problemas e acidentes</h3>
      </div>
      <label className="radio-card">
        <input
          type="radio"
          name="declaration"
          required
          value="none"
          checked={declaration === "none"}
          onChange={() => setDeclaration("none")}
        />
        <span>Não houve problemas nem acidentes</span>
      </label>
      <label className="radio-card">
        <input
          type="radio"
          name="declaration"
          required
          value="incidents"
          checked={declaration === "incidents"}
          onChange={() => setDeclaration("incidents")}
        />
        <span>Preciso registrar uma ocorrência</span>
      </label>
      {declaration === "incidents" && (
        <>
          <NoticeBox>
            As ocorrências avisam os responsáveis. O bloqueio do carro é
            decidido por eles.
          </NoticeBox>
          {incidents.map((incident, i) => (
            <div key={incident.id} className="nested-form">
              <div className="nested-form-head">
                <b>Ocorrência {i + 1}</b>
                <button
                  type="button"
                  className="icon-button"
                  aria-label={`Remover ocorrência ${i + 1}`}
                  onClick={() =>
                    setIncidents(incidents.filter((x) => x.id !== incident.id))
                  }
                >
                  <Trash2 size={17} />
                </button>
              </div>
              <Field label="Tipo">
                <select
                  value={incident.kind}
                  onChange={(e) =>
                    changeIncident(incident.id, { kind: e.target.value })
                  }
                >
                  <option value="problem">Problema</option>
                  <option value="accident">Acidente</option>
                </select>
              </Field>
              <Field label="Descrição">
                <textarea
                  required
                  value={incident.description}
                  onChange={(e) =>
                    changeIncident(incident.id, { description: e.target.value })
                  }
                />
              </Field>
              <Field label="Data e horário do fato">
                <input
                  type="datetime-local"
                  required
                  value={incident.occurred_at}
                  onChange={(e) =>
                    changeIncident(incident.id, { occurred_at: e.target.value })
                  }
                />
              </Field>
              <Field label="Local">
                <input
                  required
                  value={incident.location}
                  onChange={(e) =>
                    changeIncident(incident.id, { location: e.target.value })
                  }
                />
              </Field>
              <Field label="Fotos obrigatórias">
                <input
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/webp"
                  required
                  onChange={(e) =>
                    changeIncident(incident.id, {
                      files: Array.from(e.target.files || []),
                    })
                  }
                />
              </Field>
            </div>
          ))}
          <button
            type="button"
            className="button secondary"
            onClick={() =>
              setIncidents([
                ...incidents,
                {
                  id: crypto.randomUUID(),
                  kind: "problem",
                  description: "",
                  occurred_at: inputTime(),
                  location: "",
                  files: [],
                },
              ])
            }
          >
            <Plus size={17} />
            Adicionar ocorrência
          </button>
        </>
      )}
      <p className="field-hint">
        Fotos em JPG, PNG ou WebP, até 10 MB cada.{" "}
        {isOther
          ? "O horário informado será preservado com sua autoria."
          : "O horário real da devolução será registrado ao concluir."}
      </p>
    </Form>
  );
}
function IncidentDetails({ id }: { id: string }) {
  const { data, run, manages, open } = useApp();
  const i = data.incidents.find((i) => i.id === id);
  if (!i) return <p>Ocorrência não disponível para o seu perfil.</p>;
  const t = data.reservations.find((t) => t.id === i.reservation_id)!;
  return (
    <>
      <div className="detail-content">
        <Status
          value={i.status}
          text={i.status === "pending" ? "Pendente" : undefined}
        />
        <h3>
          {i.kind === "problem" ? "Problema" : "Acidente"} ·{" "}
          {data.vehicles.find((v) => v.id === t.vehicle_id)?.name}
        </h3>
        <p>{i.description}</p>
        <p className="muted">
          {fmt(i.occurred_at)} · {i.location}
        </p>
        <div className="photo-gallery">
          {i.photos.map((p, index) => (
            <PrivateImage
              key={p}
              path={p}
              alt={`Foto ${index + 1} da ocorrência`}
            />
          ))}
        </div>
      </div>
      {manages(t.vehicle_id) ? (
        <Form
          submit="Salvar tratamento"
          onSubmit={(f) =>
            run(
              "update_incident",
              { id, status: str(f, "status"), measures: str(f, "measures") },
              "Ocorrência atualizada.",
            )
          }
        >
          <Field label="Situação">
            <select name="status" defaultValue={i.status}>
              <option value="pending">Pendente</option>
              <option value="in_resolution">Em resolução</option>
              <option value="resolved">Resolvido</option>
            </select>
          </Field>
          <Field label="Providências tomadas">
            <textarea name="measures" defaultValue={i.measures} rows={4} />
          </Field>
          <button
            type="button"
            className="button secondary"
            onClick={() => open({ type: "block", vehicleId: t.vehicle_id })}
          >
            Bloquear carro para manutenção
          </button>
        </Form>
      ) : (
        i.measures && <p>Providências: {i.measures}</p>
      )}
    </>
  );
}
function BlockForm({ vehicleId }: { vehicleId: string }) {
  const { data, run } = useApp();
  return (
    <Form
      submit="Criar bloqueio"
      onSubmit={(f) =>
        run(
          "create_block",
          {
            vehicle_id: vehicleId,
            starts_at: iso(str(f, "starts_at")),
            ends_at: str(f, "ends_at") ? iso(str(f, "ends_at")) : null,
            reason: str(f, "reason"),
          },
          "Bloqueio criado. Reservas atingidas foram canceladas e os motoristas avisados.",
        )
      }
    >
      <p>{data.vehicles.find((v) => v.id === vehicleId)?.name}</p>
      <Field label="Motivo da manutenção">
        <textarea name="reason" required />
      </Field>
      <div className="form-grid">
        <Field label="Início do bloqueio">
          <input
            type="datetime-local"
            name="starts_at"
            required
            defaultValue={inputTime()}
          />
        </Field>
        <Field label="Término (opcional)">
          <input type="datetime-local" name="ends_at" />
        </Field>
      </div>
      <NoticeBox>
        Reservas confirmadas atingidas serão canceladas e os motoristas
        avisados. Viagens em andamento continuam exigindo devolução. Sem
        término, o bloqueio dura até a liberação manual.
      </NoticeBox>
    </Form>
  );
}
function AssignmentForm({ vehicleId }: { vehicleId: string }) {
  const { data, run, user } = useApp();
  return (
    <Form
      submit="Incluir temporário"
      onSubmit={(f) =>
        run(
          "save_assignment",
          {
            vehicle_id: vehicleId,
            user_id: str(f, "user_id"),
            starts_at: iso(str(f, "starts_at")),
            ends_at: iso(str(f, "ends_at")),
          },
          "Responsável temporário incluído.",
        )
      }
    >
      <Field label="Pessoa indicada">
        <select name="user_id" required defaultValue="">
          <option value="" disabled>
            Selecione uma pessoa
          </option>
          {data.directory
            .filter((p) => p.id !== user.id)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Início da atribuição">
        <input type="datetime-local" name="starts_at" required />
      </Field>
      <Field label="Fim da atribuição">
        <input type="datetime-local" name="ends_at" required />
      </Field>
      <NoticeBox>
        As permissões valem durante este período. Você continua podendo decidir
        como responsável principal.
      </NoticeBox>
    </Form>
  );
}
function SeriesForm({ vehicleId, id }: { vehicleId?: string; id?: string }) {
  const { data, run, open } = useApp();
  const rule = data.series.find((s) => s.id === id);
  const [frequency, setFrequency] = useState(rule?.frequency || "weekly");
  const [result, setResult] = useState<CommandResult | null>(null);
  if (result)
    return (
      <div className="detail-content">
        <NoticeBox success>
          {result.created ?? result.updated ?? 0} viagem(ns){" "}
          {id ? "atualizada(s)" : "criada(s)"}.
        </NoticeBox>
        {result.skipped?.length ? (
          <>
            <h3>Datas preservadas ou não criadas por conflito</h3>
            <ul className="skip-list">
              {result.skipped.map((s, i) => (
                <li key={i}>
                  <b>{s.date.split("-").reverse().join("/")}</b>
                  <span>{s.reason}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Nenhum conflito nas datas geradas.</p>
        )}
        <p className="muted">
          A geração continua diariamente dentro de uma janela de{" "}
          {data.settings.recurrence_horizon} dias. Consulte as viagens no
          calendário.
        </p>
        <button className="button primary" onClick={() => open(null)}>
          Concluir
        </button>
      </div>
    );
  return (
    <Form
      closeOnSuccess={false}
      submit={id ? "Alterar todas as futuras" : "Criar recorrência"}
      onSubmit={async (f) => {
        const result = await run(
          id ? "edit_series" : "create_series",
          {
            id,
            vehicle_id: vehicleId,
            destination: str(f, "destination"),
            start_date: str(f, "start_date"),
            end_date: str(f, "end_date") || null,
            start_time: str(f, "start_time"),
            end_time: str(f, "end_time"),
            day_span: Number(f.get("day_span") || 0),
            frequency,
            weekdays: f.getAll("weekdays").map(Number),
          },
          "",
        );
        setResult(result);
      }}
    >
      <NoticeBox>
        O motorista das corridas recorrentes é o próprio responsável. As
        ocorrências de temporários ficam limitadas à vigência da atribuição.
      </NoticeBox>
      <Field label="Destino">
        <input name="destination" required defaultValue={rule?.destination} />
      </Field>
      {!id && (
        <>
          <Field label="Repetição">
            <select
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              <option value="daily">Diariamente</option>
              <option value="weekly">Semanalmente</option>
              <option value="fortnightly">
                Quinzenalmente · a cada 15 dias
              </option>
              <option value="monthly">Mensalmente</option>
            </select>
          </Field>
          <div className="form-grid">
            <Field label="Primeira data">
              <input
                name="start_date"
                type="date"
                required
                min={today()}
                defaultValue={today()}
              />
            </Field>
            <Field label="Última data (opcional)">
              <input name="end_date" type="date" min={today()} />
            </Field>
          </div>
          {frequency === "weekly" && (
            <div className="weekday-checkboxes">
              {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map(
                (label, i) => (
                  <label key={i}>
                    <input type="checkbox" name="weekdays" value={i} />
                    {label}
                  </label>
                ),
              )}
            </div>
          )}
          {frequency === "monthly" && (
            <p className="field-hint">
              Meses que não tenham o dia escolhido são pulados.
            </p>
          )}
        </>
      )}
      <div className="form-grid">
        <Field label="Horário de saída">
          <input
            name="start_time"
            type="time"
            required
            defaultValue={rule?.start_time.slice(0, 5)}
          />
        </Field>
        <Field label="Horário de retorno">
          <input
            name="end_time"
            type="time"
            required
            defaultValue={rule?.end_time.slice(0, 5)}
          />
        </Field>
      </div>
      <Field label="Dias entre saída e retorno">
        <input
          name="day_span"
          type="number"
          required
          min="0"
          defaultValue={rule?.day_span || 0}
        />
      </Field>
      <p className="field-hint">
        Use 0 se a viagem termina no mesmo dia ou 1 para terminar no dia
        seguinte.
      </p>
      {id && (
        <NoticeBox>
          O histórico fica preservado. Se um novo horário conflitar, a reserva
          válida será mantida e a data será listada no resultado.
        </NoticeBox>
      )}
    </Form>
  );
}
function RegistryForm({ dialog: d }: { dialog: Dialog }) {
  const { data, run, user, api } = useApp();
  if (d.type === "settings")
    return (
      <Form
        onSubmit={(f) =>
          run(
            "save_settings",
            { timezone: str(f, "timezone") },
            "Fuso atualizado.",
          )
        }
      >
        <Field label="Fuso oficial da organização">
          <select name="timezone" defaultValue={data.settings.timezone}>
            {[
              "America/Sao_Paulo",
              "America/Fortaleza",
              "America/Manaus",
              "America/Belem",
              "America/Recife",
              "America/Rio_Branco",
              "America/Cuiaba",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <NoticeBox>
          Os horários armazenados permanecem os mesmos instantes. As telas e as
          próximas gerações de recorrência usarão o fuso escolhido.
        </NoticeBox>
      </Form>
    );
  if (d.type === "unit") {
    const unit = data.units.find((u) => u.id === d.id);
    return (
      <Form
        onSubmit={(f) =>
          run(
            "save_unit",
            {
              id: d.id,
              name: str(f, "name"),
              kind: str(f, "kind"),
              active: f.get("active") === "on",
            },
            "Unidade salva.",
          )
        }
      >
        <Field label="Nome da unidade">
          <input name="name" required defaultValue={unit?.name} />
        </Field>
        <Field label="Tipo">
          <select name="kind" defaultValue={unit?.kind || "house"}>
            <option value="sector">Setor</option>
            <option value="house">Casa comunitária</option>
          </select>
        </Field>
        <label className="checkbox-label">
          <input
            name="active"
            type="checkbox"
            defaultChecked={unit?.active ?? true}
          />
          Unidade ativa
        </label>
      </Form>
    );
  }
  if (d.type === "user") {
    const u = data.profiles.find((u) => u.id === d.id)!;
    return (
      <Form
        onSubmit={(f) =>
          run(
            "save_user",
            {
              id: u.id,
              full_name: str(f, "full_name"),
              phone: str(f, "phone"),
              unit_id: str(f, "unit_id") || null,
              is_admin: f.get("is_admin") === "on",
              active: f.get("active") === "on",
            },
            "Usuário atualizado.",
          )
        }
      >
        <Field label="Nome completo">
          <input name="full_name" required defaultValue={u.full_name} />
        </Field>
        <Field label="E-mail">
          <input value={u.email} disabled />
        </Field>
        <Field label="WhatsApp">
          <input name="phone" type="tel" defaultValue={u.phone} />
        </Field>
        <Field label="Vínculo">
          <select name="unit_id" defaultValue={u.unit_id || ""}>
            <option value="">Sem vínculo</option>
            {data.units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </Field>
        <label className="checkbox-label">
          <input name="is_admin" type="checkbox" defaultChecked={u.is_admin} />
          Administrador de cadastros
        </label>
        <label className="checkbox-label">
          <input name="active" type="checkbox" defaultChecked={u.active} />
          Usuário ativo
        </label>
      </Form>
    );
  }
  const v = data.vehicles.find((v) => v.id === d.id);
  return (
    <Form
      onSubmit={async (f) => {
        const file = f.get("photo") as File | null;
        const photo = file?.size
          ? await api.upload(file, "vehicle-photos")
          : v?.photo_path || null;
        await run(
          "save_vehicle",
          {
            id: d.id,
            name: str(f, "name"),
            model: str(f, "model"),
            plate: str(f, "plate"),
            unit_id: str(f, "unit_id"),
            manager_id: user.is_admin ? str(f, "manager_id") : user.id,
            photo_path: photo,
            color: str(f, "color"),
            active: f.get("active") === "on",
          },
          "Veículo salvo.",
        );
      }}
    >
      <Field label="Nome de identificação">
        <input
          name="name"
          required
          defaultValue={v?.name}
          placeholder="Ex.: Carro 01"
        />
      </Field>
      <div className="form-grid">
        <Field label="Modelo">
          <input name="model" required defaultValue={v?.model} />
        </Field>
        <Field label="Placa">
          <input name="plate" required defaultValue={v?.plate} maxLength={12} />
        </Field>
      </div>
      <Field label="Unidade proprietária">
        <select name="unit_id" required defaultValue={v?.unit_id || ""}>
          <option value="" disabled>
            Selecione a unidade
          </option>
          {data.units
            .filter((u) => u.active || u.id === v?.unit_id)
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
        </select>
      </Field>
      <Field label="Responsável principal">
        {user.is_admin ? (
          <select name="manager_id" required defaultValue={v?.manager_id || ""}>
            <option value="" disabled>
              Selecione uma pessoa
            </option>
            {data.directory.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name}
              </option>
            ))}
          </select>
        ) : (
          <input value={user.full_name} readOnly />
        )}
      </Field>
      <Field
        label={v?.photo_path ? "Substituir foto (opcional)" : "Foto do carro"}
      >
        <input
          name="photo"
          type="file"
          required={!v?.photo_path}
          accept="image/jpeg,image/png,image/webp"
        />
      </Field>
      <Field label="Cor no calendário">
        <select name="color" defaultValue={v?.color || "#01478d"}>
          <option value="#01478d">Azul Shalom</option>
          <option value="#47776b">Verde</option>
          <option value="#4676a5">Azul</option>
          <option value="#8a6d3b">Ocre</option>
          <option value="#766098">Violeta</option>
        </select>
      </Field>
      <label className="checkbox-label">
        <input
          name="active"
          type="checkbox"
          defaultChecked={v?.active ?? true}
        />
        Veículo ativo
      </label>
      {data.units.length === 0 && (
        <NoticeBox>Cadastre uma unidade antes de cadastrar o carro.</NoticeBox>
      )}
    </Form>
  );
}
