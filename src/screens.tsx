import { useMemo, useState } from "react";
import {
  Plus,
  Search,
  SlidersHorizontal,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  CarFront,
  Clock3,
  UserRound,
  Wrench,
  Repeat2,
  ShieldCheck,
  Check,
  X,
  Pencil,
  Users,
  Building2,
} from "lucide-react";
import { useApp } from "./context";
import { Empty, Status, VehicleImage, Period, Destination } from "./ui";
import { fmt, today, plusDays, dayIso, overlap } from "./time";
import { friendlyError } from "./backend";
import type { Trip, Request, CalendarEvent } from "./types";
function Heading({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </div>
  );
}
function NewButton() {
  const { open } = useApp();
  return (
    <button
      className="button primary"
      onClick={() => open({ type: "new_request" })}
    >
      <Plus size={19} />
      Nova solicitação
    </button>
  );
}
function TripCard({ trip }: { trip: Trip }) {
  const { data, open, name, user } = useApp();
  const v = data.vehicles.find((v) => v.id === trip.vehicle_id)!;
  const late =
    trip.status === "in_progress" && new Date(trip.ends_at) < new Date();
  const change = data.changes.some(
    (c) => c.reservation_id === trip.id && c.status === "pending",
  );
  return (
    <article className="trip-card">
      <div className="trip-card-head">
        <div className="vehicle-title">
          <VehicleImage id={v.id} small />
          <div>
            <h3>{v.name}</h3>
            <p>
              {v.model} <span>· {v.plate}</span>
            </p>
          </div>
        </div>
        <Status value={trip.status} />
      </div>
      <Destination value={trip.destination} />
      {trip.driver_id !== user.id && (
        <div className="driver-line">
          <UserRound size={16} />
          {name(trip.driver_id)}
        </div>
      )}
      <Period start={trip.starts_at} end={trip.ends_at} />
      {late && (
        <div className="inline-warning">
          Devolução atrasada · a viagem continua em andamento
        </div>
      )}
      {change && (
        <div className="inline-warning">
          Alteração aguardando decisão · horário original mantido
        </div>
      )}
      <div className="trip-card-footer">
        <span>
          {trip.series_id ? (
            <>
              <Repeat2 size={15} />
              Viagem recorrente
            </>
          ) : (
            <>
              <ShieldCheck size={15} />
              Reserva individual
            </>
          )}
        </span>
        <button
          className="text-button"
          onClick={() => open({ type: "trip", id: trip.id })}
        >
          Ver detalhes
        </button>
      </div>
    </article>
  );
}
function RequestCard({ request }: { request: Request }) {
  const { data, open } = useApp();
  const candidates = data.candidates.filter((c) => c.request_id === request.id);
  const v =
    candidates.length === 1
      ? data.vehicles.find((v) => v.id === candidates[0].vehicle_id)
      : null;
  return (
    <article className="trip-card request-card">
      <div className="trip-card-head">
        <div className="vehicle-title">
          <span className="request-icon">
            <Clock3 size={25} />
          </span>
          <div>
            <h3>
              {request.mode === "any"
                ? "Qualquer carro disponível"
                : v?.name || "Carro solicitado"}
            </h3>
            <p>Solicitação enviada</p>
          </div>
        </div>
        <Status
          value={
            request.status === "pending" &&
            new Date(request.starts_at) <= new Date()
              ? "expired"
              : request.status
          }
        />
      </div>
      <Destination value={request.destination} />
      <Period start={request.starts_at} end={request.ends_at} />
      <div className="trip-card-footer">
        <span>A confirmação aparecerá no sino.</span>
        <button
          className="text-button"
          onClick={() => open({ type: "request", id: request.id })}
        >
          Ver solicitação
        </button>
      </div>
    </article>
  );
}
export function Trips() {
  const { data, user, open } = useApp();
  const [tab, setTab] = useState("upcoming");
  const [search, setSearch] = useState("");
  const [vehicle, setVehicle] = useState("");
  const own = data.reservations.filter((t) => t.driver_id === user.id);
  const requests = data.requests.filter(
    (r) =>
      r.driver_id === user.id &&
      r.status !== "approved" &&
      !data.reservations.some((t) => t.request_id === r.id),
  );
  const match = (t: Trip | Request) =>
    t.destination.toLowerCase().includes(search.toLowerCase()) &&
    (!vehicle ||
      ("vehicle_id" in t
        ? t.vehicle_id === vehicle
        : data.candidates.some(
            (c) => c.request_id === t.id && c.vehicle_id === vehicle,
          )));
  const trips = own
    .filter((t) =>
      tab === "active"
        ? t.status === "in_progress"
        : tab === "history"
          ? ["completed", "cancelled"].includes(t.status) ||
            (t.status === "approved" && new Date(t.ends_at) <= new Date())
          : t.status === "approved" && new Date(t.ends_at) > new Date(),
    )
    .filter(match)
    .sort((a, b) =>
      tab === "history"
        ? +new Date(b.starts_at) - +new Date(a.starts_at)
        : +new Date(a.starts_at) - +new Date(b.starts_at),
    );
  const pending = requests
    .filter((r) =>
      tab === "upcoming"
        ? r.status === "pending" && new Date(r.starts_at) > new Date()
        : tab === "history" &&
          (r.status !== "pending" || new Date(r.starts_at) <= new Date()),
    )
    .filter(match);
  return (
    <>
      <Heading
        eyebrow="SEU CAMINHO, ORGANIZADO"
        title="Minhas viagens"
        description="Do pedido ao retorno, acompanhe cada etapa por aqui."
      >
        <NewButton />
      </Heading>
      <div className="welcome-banner">
        <div>
          <span className="banner-kicker">VAMOS JUNTOS</span>
          <h2>Um carro para o seu próximo destino.</h2>
          <p>Consulte a agenda e solicite o veículo de que você precisa.</p>
          <button onClick={() => open({ type: "new_request" })}>
            Planejar minha viagem <Plus size={17} />
          </button>
        </div>
        <div className="banner-car">
          <CarFront size={122} strokeWidth={0.8} />
          <div className="banner-road" />
        </div>
      </div>
      <div className="list-toolbar">
        <div className="tabs" role="tablist" aria-label="Filtrar viagens">
          {[
            ["upcoming", "Próximas"],
            ["active", "Em andamento"],
            ["history", "Histórico"],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
              {id === "active" &&
                own.some((t) => t.status === "in_progress") && (
                  <b>{own.filter((t) => t.status === "in_progress").length}</b>
                )}
            </button>
          ))}
        </div>
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Buscar destino"
              placeholder="Buscar destino"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label className="filter-select">
            <SlidersHorizontal size={17} />
            <select
              aria-label="Filtrar veículo"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
            >
              <option value="">Todos os carros</option>
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div className="section-caption">
        <span>
          {tab === "upcoming"
            ? "SUAS PRÓXIMAS SAÍDAS"
            : tab === "active"
              ? "VIAGENS EM ANDAMENTO"
              : "SEU HISTÓRICO"}
        </span>
        <small>
          {pending.length + trips.length} registro
          {pending.length + trips.length === 1 ? "" : "s"}
        </small>
      </div>
      {pending.length + trips.length ? (
        <div className="trip-grid">
          {pending.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </div>
      ) : (
        <Empty
          title={
            search || vehicle
              ? "Nenhuma viagem com esse filtro"
              : tab === "active"
                ? "Nenhuma viagem em andamento"
                : tab === "history"
                  ? "Seu histórico começa na primeira viagem"
                  : "Seu próximo caminho começa aqui"
          }
          action={tab === "upcoming" ? <NewButton /> : undefined}
        >
          {tab === "upcoming"
            ? "Solicite um carro e acompanhe a confirmação nesta página."
            : "Seus registros aparecerão aqui."}
        </Empty>
      )}
    </>
  );
}
export function Pending() {
  const { data, manages, name, open, run, notify } = useApp();
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState("");
  const rows = data.candidates
    .filter(
      (c) =>
        c.status === "pending" &&
        manages(c.vehicle_id) &&
        (!filter || filter === c.vehicle_id),
    )
    .map((c) => ({ c, r: data.requests.find((r) => r.id === c.request_id) }))
    .filter(
      (x) => x.r?.status === "pending" && new Date(x.r.starts_at) > new Date(),
    );
  const changes = data.changes
    .filter((c) => c.status === "pending")
    .map((c) => ({
      c,
      t: data.reservations.find((t) => t.id === c.reservation_id),
    }))
    .filter(
      (x) =>
        x.t &&
        manages(x.t.vehicle_id) &&
        (!filter || filter === x.t.vehicle_id),
    );
  async function decide(action: string, p: Record<string, unknown>) {
    setBusy(String(p.id));
    try {
      await run(
        action,
        p,
        p.approve ? "Solicitação aprovada." : "Decisão registrada.",
      );
    } catch (e) {
      notify(friendlyError(e), true);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <Heading
        eyebrow="SOB SUA RESPONSABILIDADE"
        title="Solicitações pendentes"
        description="Confira os pedidos dos seus veículos e decida com tranquilidade."
      />
      <div className="list-toolbar">
        <p className="muted">Pedidos pendentes ainda não reservam o período.</p>
        <select
          aria-label="Veículo das solicitações"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos os meus carros</option>
          {data.vehicles
            .filter((v) => manages(v.id))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </div>
      {rows.length + changes.length ? (
        <div className="trip-grid">
          {rows.map(({ c, r }) => {
            const v = data.vehicles.find((v) => v.id === c.vehicle_id)!;
            return (
              <article className="trip-card" key={c.id}>
                <div className="trip-card-head">
                  <div className="vehicle-title">
                    <VehicleImage id={v.id} small />
                    <div>
                      <h3>{v.name}</h3>
                      <p>{name(r!.driver_id)}</p>
                    </div>
                  </div>
                  <Status value="pending" />
                </div>
                <Destination value={r!.destination} />
                <Period start={r!.starts_at} end={r!.ends_at} />
                {r!.mode === "any" && (
                  <p className="muted">
                    Pedido para qualquer disponível. Sua decisão envolve somente
                    este carro.
                  </p>
                )}
                <button
                  className="text-button"
                  onClick={() =>
                    open({ type: "request", id: r!.id, vehicleId: v.id })
                  }
                >
                  Consultar solicitação
                </button>
                <div className="decision-actions">
                  <button
                    className="button secondary"
                    disabled={busy === r!.id}
                    onClick={() =>
                      void decide("decide_request", {
                        id: r!.id,
                        vehicle_id: v.id,
                        approve: false,
                      })
                    }
                  >
                    <X size={17} />
                    Recusar este carro
                  </button>
                  <button
                    className="button primary"
                    disabled={busy === r!.id}
                    onClick={() =>
                      void decide("decide_request", {
                        id: r!.id,
                        vehicle_id: v.id,
                        approve: true,
                      })
                    }
                  >
                    <Check size={17} />
                    Aprovar
                  </button>
                </div>
              </article>
            );
          })}
          {changes.map(({ c, t }) => (
            <article className="trip-card" key={c.id}>
              <div className="trip-card-head">
                <h3>
                  {c.kind === "extension" ? "Prorrogação" : "Alteração"} ·{" "}
                  {data.vehicles.find((v) => v.id === t!.vehicle_id)?.name}
                </h3>
                <Status value="pending" />
              </div>
              <p>{name(t!.driver_id)}</p>
              <Destination value={c.destination} />
              <small className="eyebrow">PERÍODO PROPOSTO</small>
              <Period start={c.starts_at} end={c.ends_at} />
              <p className="muted">
                Atual: {fmt(t!.starts_at)} até {fmt(t!.ends_at)}. A reserva
                original continua válida.
              </p>
              <div className="decision-actions">
                <button
                  className="button secondary"
                  disabled={busy === c.id}
                  onClick={() =>
                    void decide("decide_change", { id: c.id, approve: false })
                  }
                >
                  Recusar
                </button>
                <button
                  className="button primary"
                  disabled={busy === c.id}
                  onClick={() =>
                    void decide("decide_change", { id: c.id, approve: true })
                  }
                >
                  Aprovar alteração
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty title="Tudo em dia por aqui">
          Novas solicitações e alterações dos seus carros aparecerão nesta
          página.
        </Empty>
      )}
    </>
  );
}
const endOf = (e: CalendarEvent) =>
  e.ends_at === "infinity" ? "9999-12-31T23:59:59Z" : e.ends_at;
export function Calendar() {
  const { data, open, notify } = useApp();
  const [date, setDate] = useState(today());
  const [mode, setMode] = useState("week");
  const [filter, setFilter] = useState("");
  const dayOfWeek = new Date(date + "T12:00:00Z").getUTCDay();
  const first =
    mode === "month"
      ? date.slice(0, 7) + "-01"
      : mode === "week"
        ? plusDays(date, -((dayOfWeek + 6) % 7))
        : date;
  const monthFirst =
    mode === "month"
      ? plusDays(first, -((new Date(first + "T12:00:00Z").getUTCDay() + 6) % 7))
      : first;
  const days = Array.from(
    { length: mode === "month" ? 42 : mode === "week" ? 7 : 1 },
    (_, i) => plusDays(monthFirst, i),
  );
  const events = data.calendar.filter(
    (e) => !filter || filter === e.vehicle_id,
  );
  function move(sign: number) {
    if (mode === "month") {
      const d = new Date(date + "T12:00Z");
      d.setUTCDate(1);
      d.setUTCMonth(d.getUTCMonth() + sign);
      setDate(d.toISOString().slice(0, 10));
    } else setDate(plusDays(date, sign * (mode === "week" ? 7 : 1)));
  }
  return (
    <>
      <Heading
        eyebrow="DISPONIBILIDADE DA FROTA"
        title="Calendário"
        description="Escolha um período e veja os horários ocupados de cada carro."
      >
        <NewButton />
      </Heading>
      <div className="calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-date-nav">
            <button
              className="icon-button"
              aria-label="Período anterior"
              onClick={() => move(-1)}
            >
              <ChevronLeft size={21} />
            </button>
            <h2>{fmt(dayIso(date), "MMMM 'de' yyyy")}</h2>
            <button
              className="icon-button"
              aria-label="Próximo período"
              onClick={() => move(1)}
            >
              <ChevronRight size={21} />
            </button>
            <button
              className="button secondary compact"
              onClick={() => setDate(today())}
            >
              Hoje
            </button>
          </div>
          <div className="calendar-options">
            <input
              type="date"
              aria-label="Data do calendário"
              value={date}
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
            <select
              aria-label="Carro no calendário"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="">Todos os carros</option>
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <div className="segmented">
              {[
                ["day", "Dia"],
                ["week", "Semana"],
                ["month", "Mês"],
              ].map(([id, label]) => (
                <button
                  className={mode === id ? "active" : ""}
                  key={id}
                  onClick={() => setMode(id)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="calendar-legend">
          {data.vehicles.map((v) => (
            <span key={v.id}>
              <i style={{ background: v.color }} />
              {v.name}
            </span>
          ))}
          <span>
            <i className="maintenance-legend" />
            Manutenção
          </span>
        </div>
        <div className={`calendar-grid ${mode}`}>
          {days.map((day) => {
            const s = dayIso(day),
              e = dayIso(plusDays(day, 1));
            const items = events
              .filter((ev) => overlap(ev.starts_at, endOf(ev), s, e))
              .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
            return (
              <div
                className={`calendar-day ${day === today() ? "today" : ""} ${mode === "month" && day.slice(0, 7) !== date.slice(0, 7) ? "outside" : ""}`}
                key={day}
              >
                <button
                  className="calendar-day-label"
                  onClick={() => {
                    setDate(day);
                    setMode("day");
                  }}
                >
                  <span>
                    {
                      ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][
                        new Date(day + "T12:00Z").getUTCDay()
                      ]
                    }
                  </span>
                  <b>{day.slice(8)}</b>
                </button>
                <div className="calendar-events">
                  {items.map((ev) => {
                    const v = data.vehicles.find((v) => v.id === ev.vehicle_id);
                    const trip = data.reservations.find(
                      (t) => t.id === ev.reservation_id,
                    );
                    return (
                      <button
                        key={ev.id}
                        className={`calendar-event ${ev.kind === "maintenance" ? "maintenance" : ""}`}
                        style={
                          { "--event-color": v?.color } as React.CSSProperties
                        }
                        onClick={() => {
                          if (ev.reservation_id && trip)
                            open({ type: "trip", id: trip.id });
                          else
                            notify(
                              ev.kind === "maintenance"
                                ? "Carro indisponível por manutenção."
                                : "Ocupado. Os detalhes desta viagem são privados.",
                            );
                        }}
                      >
                        <b>{v?.name}</b>
                        <span>
                          {+new Date(ev.starts_at) < +new Date(s)
                            ? "Desde " + fmt(ev.starts_at, "dd/MM")
                            : fmt(ev.starts_at, "HH:mm")}{" "}
                          –{" "}
                          {+new Date(endOf(ev)) > +new Date(e)
                            ? "continua"
                            : fmt(endOf(ev), "HH:mm")}
                        </span>
                        <small>
                          {ev.kind === "maintenance"
                            ? "Manutenção"
                            : trip?.destination || "Ocupado"}
                        </small>
                      </button>
                    );
                  })}
                  {!items.length && mode === "day" && (
                    <span className="muted">
                      Nenhuma reserva confirmada para este dia.
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <div className="calendar-privacy">
          <ShieldCheck size={17} />
          Os detalhes de outras viagens são visíveis apenas aos respectivos
          motoristas e responsáveis.
        </div>
      </div>
    </>
  );
}
export function Incidents() {
  const { data, manages, open, name } = useApp();
  const [tab, setTab] = useState("pending");
  const [filter, setFilter] = useState("");
  const rows = data.incidents.filter((i) => {
    const t = data.reservations.find((t) => t.id === i.reservation_id);
    return (
      t &&
      manages(t.vehicle_id) &&
      (!filter || t.vehicle_id === filter) &&
      (tab === "history" ? i.status === "resolved" : i.status !== "resolved")
    );
  });
  return (
    <>
      <Heading
        eyebrow="CUIDADO COM OS VEÍCULOS"
        title="Ocorrências"
        description="Acompanhe problemas, acidentes e as providências tomadas."
      />
      <div className="list-toolbar">
        <div className="tabs">
          <button
            className={tab === "pending" ? "active" : ""}
            onClick={() => setTab("pending")}
          >
            Pendentes e em resolução
          </button>
          <button
            className={tab === "history" ? "active" : ""}
            onClick={() => setTab("history")}
          >
            Resolvidas
          </button>
        </div>
        <select
          aria-label="Veículo das ocorrências"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos os meus carros</option>
          {data.vehicles
            .filter((v) => manages(v.id))
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </div>
      {rows.length ? (
        <div className="trip-grid">
          {rows.map((i) => {
            const t = data.reservations.find((t) => t.id === i.reservation_id)!;
            return (
              <article className="trip-card" key={i.id}>
                <div className="trip-card-head">
                  <h3>
                    {data.vehicles.find((v) => v.id === t.vehicle_id)?.name} ·{" "}
                    {i.kind === "problem" ? "Problema" : "Acidente"}
                  </h3>
                  <Status
                    value={i.status}
                    text={i.status === "pending" ? "Pendente" : undefined}
                  />
                </div>
                <p>{i.description}</p>
                <p className="muted">
                  {fmt(i.occurred_at)} · {i.location}
                </p>
                <div className="trip-card-footer">
                  <span>{name(t.driver_id)}</span>
                  <button
                    className="text-button"
                    onClick={() => open({ type: "incident", id: i.id })}
                  >
                    Ver ocorrência
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <Empty
          title={
            tab === "history"
              ? "Nenhuma ocorrência resolvida"
              : "Nenhuma ocorrência pendente"
          }
        >
          Os registros das viagens dos seus carros aparecerão aqui.
        </Empty>
      )}
    </>
  );
}
export function Vehicles() {
  const { data, user, manages, name, open, run, notify } = useApp();
  const canRegister =
    user.is_admin || data.vehicles.some((v) => v.manager_id === user.id);
  const vehicles = data.vehicles.filter(
    (v) => v.active || user.is_admin || v.manager_id === user.id,
  );
  return (
    <>
      <Heading
        eyebrow="CONHEÇA A NOSSA FROTA"
        title="Veículos"
        description="Carros das unidades e os cuidados de quem está à frente."
      >
        {canRegister && (
          <button
            className="button primary"
            onClick={() => open({ type: "vehicle" })}
          >
            <Plus size={17} /> Cadastrar carro
          </button>
        )}
      </Heading>
      <div className="vehicle-grid">
        {vehicles.map((v) => {
          const managed = manages(v.id);
          const blocks = data.blocks.filter(
            (b) =>
              b.vehicle_id === v.id &&
              !b.released_at &&
              (b.ends_at === null || new Date(b.ends_at) > new Date()),
          );
          const series = data.series.filter(
            (s) => s.vehicle_id === v.id && s.active,
          );
          return (
            <article className="vehicle-card" key={v.id}>
              <VehicleImage id={v.id} />
              <div className="vehicle-card-body">
                <div className="trip-card-head">
                  <div>
                    <h2>{v.name}</h2>
                    <p className="muted">
                      {v.model} · {v.plate}
                    </p>
                  </div>
                  {!v.active && <Status value="unavailable" text="Inativo" />}
                </div>
                <p>
                  <Building2 size={17} />
                  {data.units.find((u) => u.id === v.unit_id)?.name}
                </p>
                <p>
                  <UserRound size={17} />
                  Responsável: {name(v.manager_id)}
                </p>
                {managed && (
                  <span className="managed-label">
                    <ShieldCheck size={15} />
                    Você é responsável por este carro
                  </span>
                )}
                <div className="vehicle-actions">
                  {v.active && (
                    <button
                      className="button secondary"
                      onClick={() =>
                        open({ type: "new_request", vehicleId: v.id })
                      }
                    >
                      Solicitar carro
                    </button>
                  )}
                  {(user.is_admin || v.manager_id === user.id) && (
                    <>
                      <button
                        className="button secondary"
                        onClick={() => open({ type: "vehicle", id: v.id })}
                      >
                        <Pencil size={16} /> Editar carro
                      </button>
                      {v.active && (
                        <button
                          className="text-button danger-text"
                          onClick={() =>
                            open({ type: "delete_vehicle", id: v.id })
                          }
                        >
                          Excluir carro
                        </button>
                      )}
                    </>
                  )}
                  {managed && v.active && (
                    <>
                      <button
                        className="button secondary"
                        onClick={() => open({ type: "block", vehicleId: v.id })}
                      >
                        <Wrench size={16} />
                        Manutenção
                      </button>
                      <button
                        className="button secondary"
                        onClick={() =>
                          open({ type: "series", vehicleId: v.id })
                        }
                      >
                        <Repeat2 size={16} />
                        Recorrência
                      </button>
                    </>
                  )}
                  {v.manager_id === user.id && (
                    <button
                      className="text-button"
                      onClick={() =>
                        open({ type: "assignment", vehicleId: v.id })
                      }
                    >
                      Indicar temporário
                    </button>
                  )}
                </div>
                {managed &&
                  blocks.map((b) => (
                    <div className="management-item" key={b.id}>
                      <div>
                        <b>Bloqueio: {b.reason}</b>
                        <small>
                          {fmt(b.starts_at)} até{" "}
                          {b.ends_at ? fmt(b.ends_at) : "liberação manual"}
                        </small>
                      </div>
                      <button
                        className="text-button"
                        onClick={() =>
                          open({ type: "release_block", id: b.id })
                        }
                      >
                        Liberar
                      </button>
                    </div>
                  ))}
                {managed &&
                  data.assignments
                    .filter(
                      (a) =>
                        a.vehicle_id === v.id &&
                        new Date(a.ends_at) > new Date(),
                    )
                    .map((a) => (
                      <div className="management-item" key={a.id}>
                        <div>
                          <b>Temporário: {name(a.user_id)}</b>
                          <small>
                            {fmt(a.starts_at)} até {fmt(a.ends_at)}
                          </small>
                        </div>
                        {v.manager_id === user.id && (
                          <button
                            className="text-button"
                            onClick={() =>
                              open({
                                type: "remove_assignment",
                                id: a.id,
                                vehicleId: v.id,
                              })
                            }
                          >
                            Remover
                          </button>
                        )}
                      </div>
                    ))}
                {managed &&
                  series.map((s) => (
                    <div className="management-item" key={s.id}>
                      <div>
                        <b>
                          <Repeat2 size={14} /> {s.destination}
                        </b>
                        <small>
                          {s.frequency === "fortnightly"
                            ? "A cada 15 dias"
                            : s.frequency === "monthly"
                              ? "Mensalmente"
                              : s.frequency === "weekly"
                                ? "Semanalmente"
                                : "Diariamente"}{" "}
                          ·{" "}
                          {s.end_date ? "até " + s.end_date : "sem data final"}
                        </small>
                      </div>
                      <div className="inline-actions">
                        {s.driver_id === user.id && (
                          <button
                            className="text-button"
                            onClick={() =>
                              open({ type: "edit_series", id: s.id })
                            }
                          >
                            Alterar
                          </button>
                        )}
                        <button
                          className="text-button danger-text"
                          onClick={() =>
                            open({ type: "stop_series", id: s.id })
                          }
                        >
                          Encerrar
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </article>
          );
        })}
      </div>
      {vehicles.length === 0 && (
        <Empty title="A frota ainda não foi cadastrada">
          O administrador e os responsáveis principais podem cadastrar carros.
        </Empty>
      )}
    </>
  );
}
export function Administration() {
  const { data, user, open, name } = useApp();
  const [tab, setTab] = useState("vehicles");
  const [search, setSearch] = useState("");
  const rows = useMemo(
    () =>
      tab === "vehicles"
        ? data.vehicles.filter((v) =>
            (v.name + v.model + v.plate)
              .toLowerCase()
              .includes(search.toLowerCase()),
          )
        : tab === "units"
          ? data.units.filter((u) =>
              u.name.toLowerCase().includes(search.toLowerCase()),
            )
          : data.profiles.filter((p) =>
              (p.full_name + p.email)
                .toLowerCase()
                .includes(search.toLowerCase()),
            ),
    [tab, data, search],
  );
  if (!user.is_admin) return <Empty title="Área restrita ao administrador" />;
  return (
    <>
      <Heading
        eyebrow="ORGANIZAÇÃO E ACESSO"
        title="Cadastros"
        description="Gerencie pessoas, unidades, carros e responsáveis principais."
      >
        <button
          className="button secondary"
          onClick={() => open({ type: "settings" })}
        >
          <SettingsIcon />
          Configurações
        </button>
      </Heading>
      <div className="alert info">
        <ShieldCheck size={20} />
        <span>
          O perfil administrativo gerencia cadastros. As decisões de viagens
          pertencem aos responsáveis de cada carro.
        </span>
      </div>
      <div className="list-toolbar">
        <div className="tabs">
          {[
            ["vehicles", "Veículos"],
            ["units", "Unidades"],
            ["users", "Usuários"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={tab === id ? "active" : ""}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="filters">
          <label className="search">
            <Search size={17} />
            <input
              aria-label="Buscar cadastro"
              placeholder="Buscar cadastro"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {tab !== "users" && (
            <button
              className="button primary"
              onClick={() =>
                open({ type: tab === "units" ? "unit" : "vehicle" })
              }
            >
              <Plus size={17} />
              Novo cadastro
            </button>
          )}
        </div>
      </div>
      {tab === "users" && (
        <p className="muted">
          Novos usuários criam a própria conta na tela de acesso. Aqui você
          altera seus dados e o perfil administrativo.
        </p>
      )}
      <div className="registry-list">
        {rows.map((row) => {
          const id = row.id;
          if ("plate" in row)
            return (
              <div className="registry-row" key={id}>
                <VehicleImage id={id} small />
                <div>
                  <h3>{row.name}</h3>
                  <p>
                    {row.model} · {row.plate} · Responsável:{" "}
                    {name(row.manager_id)}
                  </p>
                </div>
                <span className="registry-state">
                  {row.active ? "Ativo" : "Inativo"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Editar ${row.name}`}
                  onClick={() => open({ type: "vehicle", id })}
                >
                  <Pencil size={18} />
                </button>
              </div>
            );
          if ("kind" in row)
            return (
              <div className="registry-row" key={id}>
                <span className="registry-icon">
                  <Building2 size={22} />
                </span>
                <div>
                  <h3>{row.name}</h3>
                  <p>{row.kind === "sector" ? "Setor" : "Casa comunitária"}</p>
                </div>
                <span className="registry-state">
                  {row.active ? "Ativa" : "Inativa"}
                </span>
                <button
                  className="icon-button"
                  aria-label={`Editar ${row.name}`}
                  onClick={() => open({ type: "unit", id })}
                >
                  <Pencil size={18} />
                </button>
              </div>
            );
          return (
            <div className="registry-row" key={id}>
              <span className="avatar">{row.full_name[0]}</span>
              <div>
                <h3>{row.full_name}</h3>
                <p>
                  {row.email} · {row.is_admin ? "Administrador" : "Usuário"}
                </p>
              </div>
              <span className="registry-state">
                {row.active ? "Ativo" : "Inativo"}
              </span>
              <button
                className="icon-button"
                aria-label={`Editar ${row.full_name}`}
                onClick={() => open({ type: "user", id })}
              >
                <Pencil size={18} />
              </button>
            </div>
          );
        })}
        {rows.length === 0 && <Empty title="Nenhum cadastro encontrado" />}
      </div>
    </>
  );
}
function SettingsIcon() {
  return <SlidersHorizontal size={17} />;
}
