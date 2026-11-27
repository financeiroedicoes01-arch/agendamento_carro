import {
  useEffect,
  useRef,
  useState,
  useId,
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  X,
  CarFront,
  CalendarDays,
  MapPin,
  Clock3,
  CheckCircle2,
  AlertCircle,
  LoaderCircle,
} from "lucide-react";
import { useApp } from "./context";
import { fmt } from "./time";
import { friendlyError } from "./backend";
export const labels: Record<string, string> = {
  pending: "Aguardando decisão",
  approved: "Confirmada",
  in_progress: "Em andamento",
  completed: "Concluída",
  cancelled: "Cancelada",
  rejected: "Não aprovada",
  expired: "Expirada",
  closed: "Encerrada",
  unavailable: "Indisponível",
  in_resolution: "Em resolução",
  resolved: "Resolvido",
  problem: "Problema",
  accident: "Acidente",
  daily: "Diariamente",
  weekly: "Semanalmente",
  fortnightly: "A cada 15 dias",
  monthly: "Mensalmente",
};
export function Status({ value, text }: { value: string; text?: string }) {
  return (
    <span className={`status ${value}`}>{text || labels[value] || value}</span>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <CalendarDays size={34} strokeWidth={1.3} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}
export function VehicleImage({
  id,
  small = false,
}: {
  id: string;
  small?: boolean;
}) {
  const { data } = useApp();
  const v = data.vehicles.find((v) => v.id === id);
  return (
    <div
      className={`vehicle-image ${small ? "small" : ""}`}
      style={{ "--vehicle-color": v?.color } as React.CSSProperties}
    >
      {v?.photo_path ? (
        <PrivateImage
          bucket="vehicle-photos"
          path={v.photo_path}
          alt={v.name}
        />
      ) : (
        <CarFront size={small ? 26 : 72} strokeWidth={1.1} />
      )}
    </div>
  );
}
export function PrivateImage({
  bucket = "trip-files",
  path,
  alt,
}: {
  bucket?: string;
  path: string;
  alt: string;
}) {
  const { api } = useApp();
  const [url, setUrl] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    api
      .fileUrl(bucket, path)
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [api, bucket, path]);
  return error ? (
    <span className="muted">Foto indisponível</span>
  ) : url ? (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt={alt} loading="lazy" />
    </a>
  ) : (
    <span className="muted">Carregando foto…</span>
  );
}
export function Period({ start, end }: { start: string; end: string }) {
  return (
    <div className="period">
      <div>
        <CalendarDays size={17} />
        <span>
          {fmt(start, "dd/MM/yyyy")}
          <b>{fmt(start, "HH:mm")}</b>
        </span>
      </div>
      <span className="period-divider" />
      <div>
        <Clock3 size={17} />
        <span>
          {fmt(end, "dd/MM/yyyy")}
          <b>{fmt(end, "HH:mm")}</b>
        </span>
      </div>
    </div>
  );
}
export function Destination({ value }: { value: string }) {
  return (
    <div className="destination">
      <MapPin size={17} />
      {value}
    </div>
  );
}
export function Modal({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close(): void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const el = dialog.current!;
    el.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const items = Array.from(
          el.querySelectorAll<HTMLElement>(
            'button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]',
          ),
        );
        const first = items[0],
          last = items.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.body.style.overflow = original;
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
      >
        <div className="modal-head">
          <h2 id="dialog-title">{title}</h2>
          <button className="icon-button" aria-label="Fechar" onClick={close}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Form({
  children,
  onSubmit,
  submit = "Salvar",
  cancel = true,
  closeOnSuccess = true,
}: {
  children: ReactNode;
  onSubmit(form: FormData): Promise<unknown>;
  submit?: string;
  cancel?: boolean;
  closeOnSuccess?: boolean;
}) {
  const { open } = useApp();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onSubmit(new FormData(e.currentTarget));
      if (closeOnSuccess) open(null);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <form onSubmit={save}>
      <fieldset disabled={busy}>{children}</fieldset>
      {error && (
        <p className="alert error" role="alert">
          <AlertCircle size={18} />
          {error}
        </p>
      )}
      <div className="form-actions">
        {cancel && (
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => open(null)}
          >
            Voltar
          </button>
        )}
        <button className="button primary" disabled={busy}>
          {busy && <LoaderCircle className="spin" size={17} />}{" "}
          {busy ? "Salvando…" : submit}
        </button>
      </div>
    </form>
  );
}
export function NoticeBox({
  children,
  success = false,
}: {
  children: ReactNode;
  success?: boolean;
}) {
  return (
    <div className={`alert ${success ? "success" : "info"}`}>
      {success ? <CheckCircle2 size={19} /> : <AlertCircle size={19} />}
      <div>{children}</div>
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {isValidElement(children)
        ? cloneElement(children as ReactElement<{ id?: string }>, { id })
        : children}
    </div>
  );
}
