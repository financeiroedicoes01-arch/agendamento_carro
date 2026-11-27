import { useEffect, useState, type FormEvent } from "react";
import {
  CarFront,
  CalendarCheck2,
  KeyRound,
  ShieldCheck,
  LoaderCircle,
} from "lucide-react";
import {
  supabase,
  configured,
  demoEnabled,
  friendlyError,
  authOptions,
} from "./backend";
export default function Auth({
  enterDemo,
  recovery = false,
}: {
  enterDemo(): void;
  recovery?: boolean;
}) {
  const [mode, setMode] = useState(recovery ? "password" : "login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [googleEnabled, setGoogleEnabled] = useState(false);
  useEffect(() => {
    let current = true;
    void authOptions().then((options) => {
      if (current) setGoogleEnabled(options.google);
    });
    return () => {
      current = false;
    };
  }, []);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setMessage("");
    if (!supabase) {
      setError(
        "Configure a conexão do Supabase para acessar com sua conta. Você pode explorar a demonstração abaixo.",
      );
      return;
    }
    setBusy(true);
    const f = new FormData(e.currentTarget);
    try {
      const email = String(f.get("email") || "").trim();
      const password = String(f.get("password") || "");
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else if (mode === "register") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: location.origin,
            data: { full_name: f.get("full_name"), phone: f.get("phone") },
          },
        });
        if (error) throw error;
        if (!data.session) {
          setMode("login");
          setMessage(
            "Cadastro criado. Confira seu e-mail para confirmar o endereço e entrar.",
          );
        }
      } else if (mode === "recover") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: location.origin + "/?recovery=1",
        });
        if (error) throw error;
        setMessage(
          "Se o endereço estiver cadastrado, você receberá um link para redefinir a senha.",
        );
      } else {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        location.replace(location.origin);
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }
  async function google() {
    setBusy(true);
    try {
      const { error } = await supabase!.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: location.origin },
      });
      if (error) throw error;
    } catch (err) {
      setError(friendlyError(err));
      setBusy(false);
    }
  }
  return (
    <div className="auth-page">
      <aside className="auth-story">
        <div className="brand light">
          <span className="brand-symbol">
            <CarFront size={24} />
          </span>
          <div>
            EDIÇÕES SHALOM<small>AGENDAMENTO DE CARROS</small>
          </div>
        </div>
        <div className="auth-story-content">
          <span className="eyebrow light">A SERVIÇO DA NOSSA MISSÃO</span>
          <h1>
            Cada caminho,
            <br />
            uma missão.
          </h1>
          <p>
            Mais cuidado com os nossos carros.
            <br />
            Mais tranquilidade para a sua próxima viagem.
          </p>
          <div className="auth-illustration">
            <CarFront size={164} strokeWidth={0.65} />
            <div className="road-line" />
          </div>
          <div className="auth-benefit">
            <CalendarCheck2 size={23} />
            <span>Solicite, acompanhe e viaje.</span>
          </div>
          <div className="auth-benefit">
            <ShieldCheck size={23} />
            <span>Organização e cuidado em cada etapa.</span>
          </div>
        </div>
        <small>Edições Shalom · Mobilidade a serviço da evangelização</small>
      </aside>
      <main className="auth-form">
        <div className="mobile-brand">EDIÇÕES SHALOM</div>
        <div className="auth-form-inner">
          <span className="eyebrow">BEM-VINDO</span>
          <h2>
            {mode === "register"
              ? "Crie sua conta"
              : mode === "recover"
                ? "Recupere seu acesso"
                : mode === "password"
                  ? "Defina sua nova senha"
                  : "Vamos ao próximo destino?"}
          </h2>
          <p className="muted">
            {mode === "register"
              ? "Seu cadastro permite solicitar carros de todas as unidades."
              : mode === "recover"
                ? "Enviaremos um link para redefinir sua senha."
                : mode === "password"
                  ? "Escolha uma senha com pelo menos 8 caracteres."
                  : "Entre para organizar suas viagens."}
          </p>
          {configured && googleEnabled && mode === "login" && (
            <>
              <button
                className="button google"
                disabled={busy}
                onClick={google}
              >
                <span className="google-g">G</span>Continuar com Google
              </button>
              <div className="or">
                <span />
                ou entre com e-mail
                <span />
              </div>
            </>
          )}
          <form onSubmit={submit}>
            <fieldset disabled={busy}>
              {mode === "register" && (
                <>
                  <label className="field">
                    <span>Nome completo</span>
                    <input
                      name="full_name"
                      autoComplete="name"
                      minLength={3}
                      required
                    />
                  </label>
                  <label className="field">
                    <span>WhatsApp</span>
                    <input
                      name="phone"
                      type="tel"
                      autoComplete="tel"
                      minLength={8}
                      required
                      placeholder="(85) 99999-9999"
                    />
                  </label>
                </>
              )}
              {mode !== "password" && (
                <label className="field">
                  <span>E-mail</span>
                  <input
                    type="email"
                    name="email"
                    autoComplete="email"
                    required
                    placeholder="voce@exemplo.org"
                  />
                </label>
              )}
              {mode !== "recover" && (
                <label className="field">
                  <span>Senha</span>
                  <input
                    type="password"
                    name="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "login" ? 1 : 8}
                    required
                    placeholder="Sua senha"
                  />
                </label>
              )}
              {mode === "login" && (
                <button
                  type="button"
                  className="text-button forgot"
                  onClick={() => {
                    setMode("recover");
                    setError("");
                  }}
                >
                  Esqueci minha senha
                </button>
              )}
              {error && (
                <div className="alert error" role="alert">
                  {error}
                </div>
              )}
              {message && (
                <div className="alert success" role="status">
                  {message}
                </div>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? (
                  <LoaderCircle size={18} className="spin" />
                ) : (
                  <KeyRound size={18} />
                )}{" "}
                {busy
                  ? "Aguarde…"
                  : mode === "register"
                    ? "Criar conta"
                    : mode === "recover"
                      ? "Enviar link"
                      : mode === "password"
                        ? "Salvar nova senha"
                        : "Entrar"}
              </button>
            </fieldset>
          </form>
          {mode !== "password" && (
            <p className="auth-switch">
              {mode === "login"
                ? "Ainda não tem uma conta?"
                : "Já tem uma conta?"}{" "}
              <button
                className="text-button"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setError("");
                  setMessage("");
                }}
              >
                {mode === "login" ? "Cadastre-se" : "Entrar"}
              </button>
            </p>
          )}
          {demoEnabled && (
            <div className="demo-entry">
              <span>Conheça o sistema com dados fictícios</span>
              <button className="button secondary full" onClick={enterDemo}>
                Explorar demonstração
              </button>
            </div>
          )}
          {!configured && !demoEnabled && (
            <div className="alert info">
              A instalação precisa ser concluída. Configure VITE_SUPABASE_URL e
              VITE_SUPABASE_PUBLISHABLE_KEY na hospedagem.
            </div>
          )}
          <p className="auth-footer">Acesso seguro · Edições Shalom</p>
        </div>
      </main>
    </div>
  );
}
