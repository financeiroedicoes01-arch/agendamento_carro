import { useCallback, useEffect, useState } from "react";
import {
  Bell,
  CalendarDays,
  CarFront,
  ClipboardList,
  LogOut,
  Menu,
  Plus,
  Settings2,
  ShieldCheck,
  TriangleAlert,
  UserRound,
  X,
  RefreshCw,
  Check,
  ChevronDown,
} from "lucide-react";
import {
  backend,
  configured,
  demoEnabled,
  supabase,
  friendlyError,
  loadDemo,
} from "./backend";
import type { Backend, Snapshot, CommandResult } from "./types";
import { Context, type Screen, type Dialog } from "./context";
import { setTimezone, fmt } from "./time";
import Auth from "./Auth";
import { Modal, Empty } from "./ui";
import {
  Trips,
  Pending,
  Calendar,
  Incidents,
  Vehicles,
  Administration,
} from "./screens";
import DialogContent from "./dialogs";
import { PushSettings } from "./push";
let demoPromise: Promise<Backend> | null = null;
const demoUserList = [
  ["20000000-0000-4000-8000-000000000001", "Ana · motorista"],
  ["20000000-0000-4000-8000-000000000002", "Pedro · responsável"],
  ["20000000-0000-4000-8000-000000000003", "Maria · administradora"],
  ["20000000-0000-4000-8000-000000000004", "Lucas · responsável do carro 02"],
];
const titles: Record<Screen, string> = {
  trips: "Minhas viagens",
  pending: "Solicitações pendentes",
  calendar: "Calendário",
  incidents: "Ocorrências",
  vehicles: "Veículos",
  admin: "Cadastros",
};
export default function App() {
  const [userId, setUserId] = useState<string | null>(null);
  const [api, setApi] = useState<Backend | null>(null);
  const [isDemo, setDemo] = useState(false);
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState("");
  const [screen, setScreen] = useState<Screen>("trips");
  const [initialized, setInitialized] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [bell, setBell] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [recovery, setRecovery] = useState(
    new URLSearchParams(location.search).has("recovery"),
  );
  const notify = useCallback(
    (message: string, error = false) => setToast({ message, error }),
    [],
  );
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 7000);
      return () => clearTimeout(t);
    }
  }, [toast]);
  const enterDemo = useCallback(async () => {
    if (!loadDemo) return;
    setLoading(true);
    setFatal("");
    try {
      const module = await loadDemo();
      demoPromise ||= module.createDemo();
      const demo = await demoPromise;
      setApi(demo);
      setUserId(module.demoUserId());
      setDemo(true);
      sessionStorage.setItem("shalom-demo-session", "1");
    } catch (err) {
      setFatal(friendlyError(err));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (demoEnabled && sessionStorage.getItem("shalom-demo-session")) {
      void enterDemo();
      return;
    }
    if (!supabase) {
      setLoading(false);
      return;
    }
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      setUserId(session?.user.id || null);
      setApi(session ? backend : null);
      if (!session) {
        setData(null);
        setInitialized(false);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [enterDemo]);
  const refresh = useCallback(async () => {
    if (!api) return;
    const state = await api.snapshot();
    setTimezone(state.settings?.timezone || "America/Sao_Paulo");
    setData(state);
    setFatal("");
  }, [api]);
  useEffect(() => {
    if (!api || !userId) return;
    let mounted = true;
    refresh().catch((e) => {
      if (mounted) setFatal(friendlyError(e));
    });
    const t = setInterval(() => {
      if (document.visibilityState === "visible") refresh().catch(() => {});
    }, 30000);
    const focus = () => {
      void refresh().catch(() => {});
    };
    window.addEventListener("focus", focus);
    return () => {
      mounted = false;
      clearInterval(t);
      window.removeEventListener("focus", focus);
    };
  }, [api, userId, refresh]);
  const user = data?.profiles.find((p) => p.id === userId);
  const manages = useCallback(
    (id: string) =>
      Boolean(
        user?.active &&
        data &&
        (data.vehicles.find((v) => v.id === id)?.manager_id === userId ||
          data.assignments.some(
            (a) =>
              a.vehicle_id === id &&
              a.user_id === userId &&
              new Date(a.starts_at) <= new Date() &&
              new Date(a.ends_at) > new Date(),
          )),
      ),
    [data, userId, user?.active],
  );
  const manager = data?.vehicles.some((v) => manages(v.id)) || false;
  useEffect(() => {
    if (user && !initialized) {
      setScreen(manager ? "pending" : user.is_admin ? "admin" : "trips");
      setInitialized(true);
      if (!user.unit_id || !user.phone || user.full_name.trim().length < 3)
        setDialog({ type: "profile" });
    }
  }, [user, manager, initialized]);
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("notice");
    if (!id || !data || !user || !api) return;
    const n = data.notifications.find((n) => n.id === id);
    history.replaceState({}, "", location.pathname);
    if (!n) {
      notify("Este aviso não está disponível para o seu perfil.");
      return;
    }
    if (
      n.entity_type === "trip" &&
      data.reservations.some((t) => t.id === n.entity_id)
    )
      setDialog({ type: "trip", id: n.entity_id! });
    else if (
      n.entity_type === "request" &&
      data.requests.some((r) => r.id === n.entity_id)
    )
      setDialog({ type: "request", id: n.entity_id! });
    else if (
      n.entity_type === "incident" &&
      data.incidents.some((i) => i.id === n.entity_id)
    )
      setDialog({ type: "incident", id: n.entity_id! });
    else if (n.entity_type === "series")
      setDialog({ type: "series_result", value: n.body });
    void api
      .command("mark_read", { id: n.id })
      .then(refresh)
      .catch(() => {});
  }, [data, user, api, refresh, notify]);
  async function run(
    action: string,
    payload: Record<string, unknown> = {},
    message = "Alteração salva.",
  ) {
    if (!api) throw new Error("Acesso indisponível.");
    const result = await api.command(action, payload);
    await refresh();
    if (message) notify(message);
    return result as CommandResult;
  }
  const navigate = (next: Screen) => {
    setScreen(next);
    setMobile(false);
  };
  async function logout() {
    try {
      if (isDemo) sessionStorage.removeItem("shalom-demo-session");
      await api?.logout();
    } catch (err) {
      notify(friendlyError(err), true);
    }
  }
  const links = [
    { id: "trips" as Screen, label: "Minhas viagens", icon: CarFront },
    {
      id: "pending" as Screen,
      label: "Solicitações",
      icon: ClipboardList,
      visible: manager,
    },
    { id: "calendar" as Screen, label: "Calendário", icon: CalendarDays },
    {
      id: "incidents" as Screen,
      label: "Ocorrências",
      icon: TriangleAlert,
      visible: manager,
    },
    { id: "vehicles" as Screen, label: "Veículos", icon: CarFront },
    {
      id: "admin" as Screen,
      label: "Cadastros",
      icon: Settings2,
      visible: user?.is_admin,
    },
  ].filter((l) => l.visible !== false);
  if (loading)
    return (
      <div className="loading">
        <RefreshCw className="spin" />
        <p>Preparando seu caminho…</p>
      </div>
    );
  if (recovery && configured)
    return <Auth enterDemo={() => void enterDemo()} recovery />;
  if (!userId)
    return (
      <>
        <Auth enterDemo={() => void enterDemo()} />
        {fatal && (
          <div className="toast error" role="alert">
            {fatal}
          </div>
        )}
      </>
    );
  if (!data || !user || !api)
    return (
      <div className="loading">
        <CarFront size={40} />
        <p>
          {fatal ||
            (data
              ? "Seu acesso está inativo. Entre em contato com o administrador."
              : "Carregando suas viagens…")}
        </p>
        {fatal && (
          <button
            className="button secondary"
            onClick={() =>
              void refresh().catch((e) => setFatal(friendlyError(e)))
            }
          >
            Tentar novamente
          </button>
        )}
        <button className="text-button" onClick={() => void logout()}>
          Sair
        </button>
      </div>
    );
  const unread = data.notifications.filter((n) => !n.read_at).length;
  const pending =
    data.candidates.filter(
      (c) =>
        c.status === "pending" &&
        manages(c.vehicle_id) &&
        data.requests.some(
          (r) =>
            r.id === c.request_id &&
            r.status === "pending" &&
            new Date(r.starts_at) > new Date(),
        ),
    ).length +
    data.changes.filter(
      (c) =>
        c.status === "pending" &&
        data.reservations.some(
          (t) => t.id === c.reservation_id && manages(t.vehicle_id),
        ),
    ).length;
  const context = {
    data,
    user,
    api,
    isDemo,
    screen,
    navigate,
    manages,
    name: (id: string) =>
      data.directory.find((p) => p.id === id)?.full_name || "Usuário",
    open: setDialog,
    run,
    notify,
    refresh,
  };
  const openNotice = (n: Snapshot["notifications"][number]) => {
    void run("mark_read", { id: n.id }, "").catch((e) =>
      notify(friendlyError(e), true),
    );
    setBell(false);
    if (
      n.entity_type === "trip" &&
      data.reservations.some((t) => t.id === n.entity_id)
    )
      setDialog({ type: "trip", id: n.entity_id! });
    else if (
      n.entity_type === "request" &&
      data.requests.some((t) => t.id === n.entity_id)
    )
      setDialog({ type: "request", id: n.entity_id! });
    else if (
      n.entity_type === "incident" &&
      data.incidents.some((t) => t.id === n.entity_id)
    )
      setDialog({ type: "incident", id: n.entity_id! });
    else if (n.entity_type === "series") {
      navigate("vehicles");
      setDialog({ type: "series_result", value: n.body });
    } else notify("Este item não está mais disponível para o seu perfil.");
  };
  return (
    <Context.Provider value={context}>
      {isDemo && (
        <div className="demo-bar">
          <span>DEMONSTRAÇÃO · dados fictícios salvos neste navegador</span>
          <label>
            <span className="sr-only">Perfil de demonstração</span>
            <select
              value={userId}
              onChange={async (e) => {
                const id = e.target.value;
                const mod = await loadDemo!();
                await mod.selectDemoUser(id);
                setInitialized(false);
                setData(null);
                setDialog(null);
                setBell(false);
                setUserId(id);
                await refresh();
              }}
            >
              {demoUserList.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </label>
        </div>
      )}
      <div className="app-shell">
        <aside className={`sidebar ${mobile ? "show" : ""}`}>
          <a
            className="brand"
            href="#trips"
            onClick={(e) => {
              e.preventDefault();
              navigate("trips");
            }}
          >
            <span className="brand-symbol">
              <CarFront size={24} />
            </span>
            <div>
              EDIÇÕES SHALOM<small>AGENDAMENTO DE CARROS</small>
            </div>
          </a>
          <div className="sidebar-label">SEU DIA A DIA</div>
          <nav aria-label="Menu principal">
            {links.map((l) => (
              <button
                key={l.id}
                className={`nav-link ${screen === l.id ? "active" : ""}`}
                onClick={() => navigate(l.id)}
              >
                <l.icon size={21} />
                <span>{l.label}</span>
                {l.id === "pending" && pending > 0 && (
                  <b className="nav-count">{pending}</b>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="mission-note">
              <ShieldCheck size={25} />
              <p>
                Cuidar dos nossos carros
                <br />
                também faz parte da missão.
              </p>
            </div>
            <button
              className="profile-button"
              onClick={() => setDialog({ type: "profile" })}
            >
              <span className="avatar">{user.full_name.slice(0, 1)}</span>
              <span>
                <b>{user.full_name.split(" ").slice(0, 2).join(" ")}</b>
                <small>
                  {manager
                    ? "Responsável"
                    : user.is_admin
                      ? "Administrador"
                      : "Motorista"}
                </small>
              </span>
              <Settings2 size={17} />
            </button>
            <button className="logout" onClick={() => void logout()}>
              <LogOut size={17} />
              Sair da conta
            </button>
          </div>
        </aside>
        {mobile && (
          <div className="sidebar-scrim" onClick={() => setMobile(false)} />
        )}
        <div className="workspace">
          <header className="topbar">
            <div className="breadcrumb">
              <button
                className="icon-button mobile-menu"
                onClick={() => setMobile(!mobile)}
                aria-label="Abrir menu"
              >
                <Menu />
              </button>
              <span>Agendamento de carros</span>
              <span className="breadcrumb-separator">/</span>
              <strong>{titles[screen]}</strong>
            </div>
            <div className="topbar-actions">
              <span className="today-label">
                {fmt(new Date(), "dd/MM/yyyy")}
              </span>
              <button
                className="icon-button bell-button"
                aria-label={`Notificações, ${unread} não lidas`}
                onClick={() => setBell(true)}
              >
                <Bell size={21} />
                {unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}
              </button>
              <button
                className="avatar top-avatar"
                onClick={() => setDialog({ type: "profile" })}
                aria-label="Meu perfil"
              >
                {user.full_name.slice(0, 1)}
              </button>
            </div>
          </header>
          <main id="main" className="main-content">
            {fatal && (
              <div role="alert" className="alert error">
                {fatal}
              </div>
            )}
            {screen === "trips" ? (
              <Trips />
            ) : screen === "pending" ? (
              <Pending />
            ) : screen === "calendar" ? (
              <Calendar />
            ) : screen === "incidents" ? (
              <Incidents />
            ) : screen === "vehicles" ? (
              <Vehicles />
            ) : (
              <Administration />
            )}
            <footer className="page-footer">
              Edições Shalom <span>Mobilidade a serviço da nossa missão.</span>
            </footer>
          </main>
          <nav className="bottom-nav" aria-label="Navegação no celular">
            {links.slice(0, 4).map((l) => (
              <button
                key={l.id}
                className={screen === l.id ? "active" : ""}
                onClick={() => navigate(l.id)}
              >
                <l.icon size={21} />
                <span>{l.label}</span>
              </button>
            ))}
            <button
              onClick={() => setDialog({ type: "new_request" })}
              aria-label="Nova solicitação"
            >
              <Plus size={23} />
              <span>Solicitar</span>
            </button>
          </nav>
        </div>
      </div>
      {dialog && (
        <Modal title={dialogTitle(dialog)} close={() => setDialog(null)}>
          <DialogContent dialog={dialog} />
        </Modal>
      )}
      {bell && (
        <Modal title="Seus avisos" close={() => setBell(false)}>
          <div className="notifications-head">
            <p className="muted">
              {unread
                ? `${unread} aviso${unread === 1 ? "" : "s"} não lido${unread === 1 ? "" : "s"}`
                : "Você está em dia."}
            </p>
            <button
              className="text-button"
              onClick={() =>
                void run("mark_read", {}, "Avisos marcados como lidos.").catch(
                  (e) => notify(friendlyError(e), true),
                )
              }
            >
              <Check size={15} />
              Marcar todos como lidos
            </button>
          </div>
          <PushSettings />
          {data.notifications.length ? (
            <div className="notifications-list">
              {data.notifications.map((n) => (
                <button
                  key={n.id}
                  className={`notification ${n.read_at ? "read" : ""}`}
                  onClick={() => openNotice(n)}
                >
                  <span className="notification-icon">
                    <Bell size={18} />
                  </span>
                  <span>
                    <b>{n.title}</b>
                    <span>{n.body}</span>
                    <small>{fmt(n.created_at)}</small>
                  </span>
                  {!n.read_at && <span className="unread-dot" />}
                </button>
              ))}
            </div>
          ) : (
            <Empty title="Nenhum aviso por enquanto">
              As atualizações das suas solicitações aparecerão aqui.
            </Empty>
          )}
        </Modal>
      )}
      {toast && (
        <div
          className={`toast ${toast.error ? "error" : ""}`}
          role={toast.error ? "alert" : "status"}
        >
          <span>{toast.message}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <X size={17} />
          </button>
        </div>
      )}
    </Context.Provider>
  );
}
function dialogTitle(d: Dialog) {
  const titles: Record<string, string> = {
    new_request: "Solicitar um carro",
    trip: "Detalhes da viagem",
    request: "Detalhes da solicitação",
    profile: "Meu perfil",
    checkout: "Registrar retirada",
    checkin: "Registrar devolução",
    change: "Solicitar alteração",
    correct_km: "Corrigir quilometragem",
    cancel: "Cancelar reserva",
    incident: "Detalhes da ocorrência",
    block: "Bloquear para manutenção",
    assignment: "Responsável temporário",
    series: "Criar recorrência",
    edit_series: "Alterar próximas viagens",
    stop_series: "Encerrar recorrência",
    unit: "Cadastro de unidade",
    vehicle: "Cadastro de veículo",
    delete_vehicle: "Excluir carro",
    user: "Cadastro de usuário",
    settings: "Configuração da organização",
    series_result: "Resultado da recorrência",
  };
  return titles[d.type] || "Detalhes";
}
