import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  GraduationCap,
  HeartHandshake,
  House,
  LayoutGrid,
  LogOut,
  Menu,
  RefreshCw,
  Trophy,
  UsersRound,
  Wallet,
  X,
  Building2,
} from "lucide-react";
import type { ClubData, Page, Profile } from "./domain/types";
import { canManage, canViewPage } from "./domain/permissions";
import { demoProfiles, initialDemo, scopeDemo } from "./data/demo";
import { loadClub, loadProfile } from "./data/repository";
import { isLive, signIn, signOut } from "./lib/supabase";
import { Badge, Brand, Empty, OperationErrorContext } from "./components/ui";
import { People } from "./components/People";
import { Activities, Groups, Matches } from "./components/Sports";
import { Finance, Rentals } from "./components/Finance";

export type Perform = (
  remote: () => Promise<unknown>,
  demo: (state: ClubData) => ClubData,
  message: string,
) => Promise<boolean>;
const storageKey = "la-fuente-digital-demo-v1";
const navigation: { id: Page; label: string; icon: typeof House }[] = [
  { id: "inicio", label: "Inicio", icon: House },
  { id: "personas", label: "Personas", icon: UsersRound },
  { id: "actividades", label: "Actividades", icon: LayoutGrid },
  { id: "grupos", label: "Grupos y asistencia", icon: GraduationCap },
  { id: "partidos", label: "Jornadas y resultados", icon: Trophy },
  { id: "tesoreria", label: "Tesorería", icon: Wallet },
  { id: "alquileres", label: "Alquileres", icon: Building2 },
];
function readDemo(): ClubData {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null");
    if (
      value &&
      [
        "activities",
        "people",
        "enrollments",
        "groups",
        "members",
        "attendance",
        "matches",
        "rentals",
      ].every((k) => Array.isArray(value[k]))
    )
      return { ...value, club_address: value.club_address ?? "Dr. A Melo 3951, Remedios de Escalada.", instructors: value.instructors ?? initialDemo().instructors };
  } catch {
    /* Un almacenamiento no disponible no impide explorar la demostración. */
  }
  return initialDemo();
}
function currentPage(): Page {
  const hash = window.location.hash.slice(1).split('/')[0];
  return navigation.find((n) => n.id === hash)?.id ?? "inicio";
}
function currentActivity() {
  try { return decodeURIComponent(window.location.hash.split('/')[1] ?? '') } catch { return '' }
}
export default function App() {
  const [profile, setProfile] = useState<Profile | null>(
    isLive ? null : demoProfiles[0],
  );
  const [raw, setRaw] = useState<ClubData>(
    isLive
      ? {
          activities: [],
          people: [],
          enrollments: [],
          groups: [],
          members: [],
          attendance: [],
          matches: [],
          rentals: [],
        }
      : readDemo,
  );
  const [page, setPage] = useState<Page>(currentPage),
    [menu, setMenu] = useState(false);
  const [activityId, setActivityId] = useState(currentActivity);
  const [busy, setBusy] = useState(false),
    [toast, setToast] = useState(""),
    [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const handler = () => {
      if (navigation.some((n) => n.id === window.location.hash.slice(1).split('/')[0])) {
        setPage(currentPage());
        setActivityId(currentActivity());
      }
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    if (!isLive) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(raw));
      } catch {
        /* Demo remains in memory. */
      }
    }
  }, [raw]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    if (profile && !canViewPage(profile.roles, page)) {
      setPage("inicio");
      window.location.hash = "inicio";
    }
  }, [profile, page]);
  const navigate = (next: Page, activity = '') => {
    setPage(next);
    setActivityId(activity);
    window.location.hash = next + (activity ? `/${encodeURIComponent(activity)}` : '');
    setMenu(false);
    window.scrollTo({ top: 0 });
    document.getElementById("main-content")?.focus();
  };
  const perform: Perform = useCallback(
    async (remote, demo, message) => {
      if (busy) return false;
      setBusy(true);
      setError("");
      try {
        if (isLive) {
          await remote();
          setRaw(await loadClub());
        } else setRaw((state) => demo(state));
        setToast(message);
        return true;
      } catch (failure) {
        setError(
          failure instanceof Error
            ? failure.message
            : "No pudimos completar la operación.",
        );
        return false;
      } finally {
        setBusy(false);
      }
    },
    [busy],
  );
  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError("");
    try {
      const user = await signIn(
        String(form.get("email")),
        String(form.get("password")),
      );
      const nextProfile = await loadProfile(user);
      const data = await loadClub();
      setRaw(data);
      setProfile(nextProfile);
    } catch (failure) {
      setError((failure as Error).message);
      await signOut();
    } finally {
      setBusy(false);
    }
  }
  async function refresh() {
    setLoading(true);
    setError("");
    try {
      setRaw(await loadClub());
      setToast("Información actualizada.");
    } catch (failure) {
      setError((failure as Error).message);
    } finally {
      setLoading(false);
    }
  }
  if (!profile)
    return (
      <div className="login-layout">
        <section className="login-story">
          <Brand />
          <div>
            <p className="eyebrow">CLUB SOCIAL LA FUENTE</p>
            <h1>
              El club lo
              <br />
              hacemos juntos.
            </h1>
            <p>Un espacio para acompañar, organizar y seguir compartiendo.</p>
          </div>
          <span>La Fuente Digital · Tu club, más cerca.</span>
        </section>
        <main className="login-panel">
          <form onSubmit={(e) => void login(e)}>
            <span className="badge blue">Acceso al club</span>
            <h2>Qué bueno verte.</h2>
            <p className="muted">
              Ingresá con la cuenta que te asignó administración.
            </p>
            <label className="field">
              <span>Correo electrónico</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                required
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p className="error" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? "Ingresando…" : "Entrar a mi club"}
              <ArrowRight size={18} />
            </button>
            <p className="form-note">
              Si necesitás acceso o recuperar tu cuenta, acercate a
              administración.
            </p>
          </form>
        </main>
      </div>
    );
  const data = isLive ? raw : scopeDemo(raw, profile);
  const allowed = navigation.filter((n) => canViewPage(profile.roles, n.id));
  const safePage = canViewPage(profile.roles, page) ? page : "inicio";
  const props = { data, profile, perform, busy };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Saltar al contenido
      </a>
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <div className="sidebar-brand">
          <Brand />
          <button
            className="icon-button mobile-close"
            aria-label="Cerrar menú"
            onClick={() => setMenu(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="club-label">
          <span className="club-dot" /> CLUB SOCIAL LA FUENTE
        </div>
        <p className="nav-label">MI CLUB</p>
        <nav aria-label="Navegación principal">
          {allowed.filter(n => n.id !== 'grupos' && n.id !== 'partidos' && n.id !== 'alquileres').map((n) => (
            <a
              key={n.id}
              className={`nav-item ${safePage === n.id ? "active" : ""}`}
              href={`#${n.id}`}
              aria-current={safePage === n.id ? "page" : undefined}
              onClick={(e) => {
                e.preventDefault();
                navigate(n.id);
              }}
            >
              <n.icon size={19} />
              <span>{n.label}</span>
              {safePage === n.id && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="community-card">
            <HeartHandshake size={24} />
            <p>
              Acá, nadie se
              <br />
              queda afuera.
            </p>
            <small>El club siempre es encuentro.</small>
          </div>
          <div className="sidebar-user">
            <span className="user-avatar">
              {profile.display_name.slice(0, 1)}
            </span>
            <div>
              <strong>{profile.display_name}</strong>
              <small>
                {profile.roles.includes("admin")
                  ? "Administración del club"
                  : profile.roles.includes("tesorero")
                    ? "Tesorería"
                    : profile.roles.includes("profe")
                      ? "Equipo docente"
                      : "Familia del club"}
              </small>
            </div>
            {isLive && (
              <button
                className="icon-button"
                aria-label="Cerrar sesión"
                onClick={() => {
                  void signOut();
                  setProfile(null);
                  setRaw(initialDemo());
                  setError("");
                }}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-overlay"
          aria-label="Cerrar menú de navegación"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button menu-toggle"
              aria-label="Abrir menú"
              onClick={() => setMenu(true)}
            >
              <Menu size={22} />
            </button>
            <span>Mi club</span>
            <ChevronRight size={14} />
            <strong>{navigation.find((n) => n.id === safePage)?.label}</strong>
          </div>
          <div className="topbar-right">
            <span className="today">
              <CalendarDays size={16} />
              {new Date().toLocaleDateString("es-AR", {
                day: "numeric",
                month: "long",
              })}
            </span>
            {isLive && (
              <button
                className="icon-button"
                aria-label="Actualizar datos"
                disabled={loading}
                onClick={() => void refresh()}
              >
                <RefreshCw size={18} />
              </button>
            )}
            <span className="user-avatar small-avatar">
              {profile.display_name[0]}
            </span>
          </div>
        </header>
        {!isLive && (
          <div className="demo-bar">
            <span>
              <strong>Demostración</strong> · Datos ficticios guardados solo en
              este navegador.
            </span>
            <div>
              <label>
                Ver como{" "}
                <select
                  aria-label="Perfil de demostración"
                  value={profile.id}
                  onChange={(e) => {
                    setProfile(
                      demoProfiles.find((p) => p.id === e.target.value)!,
                    );
                    setError("");
                  }}
                >
                  {demoProfiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.display_name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setRaw(initialDemo());
                  setToast("Demostración restablecida.");
                }}
              >
                Restablecer
              </button>
            </div>
          </div>
        )}
        <main id="main-content" tabIndex={-1}>
          <OperationErrorContext.Provider value={error}>
          {error && (
            <div className="error error-banner" role="alert">
              <span>{error}</span>
              <button
                className="icon-button"
                aria-label="Cerrar aviso"
                onClick={() => setError("")}
              >
                <X size={18} />
              </button>
            </div>
          )}
          {safePage === "inicio" && (
            <Dashboard data={data} profile={profile} navigate={navigate} />
          )}
          {safePage === "personas" && <People key={profile.id} {...props} />}
          {safePage === "actividades" && <Activities key={`${profile.id}:${activityId}`} {...props} initialActivityId={activityId} onSelect={id => navigate('actividades', id)} />}
          {safePage === "grupos" && <Groups key={profile.id} {...props} />}
          {safePage === "partidos" && <Matches key={profile.id} {...props} />}
          {safePage === "tesoreria" && <Finance />}
          {safePage === "alquileres" && <Rentals key={profile.id} {...props} />}
          </OperationErrorContext.Provider>
          <footer className="page-footer">
            <span>La Fuente Digital</span>
            <span>
              Tu club, más cerca. <span className="footer-heart">♥</span>
            </span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <CheckCheck size={20} />
          {toast}
        </div>
      )}
    </div>
  );
}

function Dashboard({
  data,
  profile,
  navigate,
}: {
  data: ClubData;
  profile: Profile;
  navigate: (page: Page, activity?: string) => void;
}) {
  const active = data.enrollments.filter((e) => e.status === "activa").length;
  const pending = data.people.filter(
    (p) => p.validation_status === "pendiente",
  );
  const next = [...data.matches]
    .filter((m) => m.status === "programado")
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0];
  return (
    <>
      <div className="dashboard-heading">
        <div>
          <p className="eyebrow">UN NUEVO DÍA EN EL CLUB</p>
          <h1>
            Hola,{" "}
            {canManage(profile.roles)
              ? "equipo"
              : profile.roles.includes("profe")
                ? "profe"
                : profile.roles.includes("tesorero")
                  ? "Tesorería"
                  : "familia"}{" "}
            <span className="wave">☀</span>
          </h1>
          <p className="muted">Todo lo que nos une, en un mismo lugar.</p>
        </div>
        <span className="season-label">
          Temporada {new Date().getFullYear()}
        </span>
      </div>
      <section className="club-banner">
        <img
          src="/brand/banner.png"
          width="960"
          height="365"
          fetchPriority="high"
          alt="Somos barrio. Somos club. Somos La Fuente."
        />
        <div className="club-banner-bar">
          <div>
            <h2>Tu club, más cerca.</h2>
            <p>Actividades, encuentros y todo lo que nos une.</p>
          </div>
          <button
            className="button primary"
            onClick={() => navigate("actividades")}
          >
            Explorar actividades <ArrowRight size={17} />
          </button>
        </div>
      </section>
      <div className="stats-grid">
        <Stat
          icon={UsersRound}
          value={data.people.length}
          label="Personas en tu vista"
          detail="Cada historia cuenta"
        />
        <Stat
          icon={LayoutGrid}
          value={data.activities.filter((a) => a.status === "activa").length}
          label="Actividades abiertas"
          detail="Distintas formas de crecer"
        />
        <Stat
          icon={GraduationCap}
          value={active}
          label="Inscripciones activas"
          detail="Compartiendo el camino"
        />
        <Stat
          icon={CalendarDays}
          value={data.groups.length}
          label="Grupos de temporada"
          detail="Aprender y acompañar"
        />
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">EL CORAZÓN DEL CLUB</p>
              <h2>Nuestras actividades</h2>
            </div>
            <button
              className="text-button"
              onClick={() => navigate("actividades")}
            >
              Ver todas <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="activity-rows">
            {data.activities.slice(0, 4).map((a, i) => (
              <button
                key={a.id}
                onClick={() => navigate("actividades", a.id)}
                className="activity-row"
              >
                <span className={`activity-initial initial-${i}`}>
                  {i === 0 ? "↗" : i === 1 ? "✳" : i === 2 ? "◈" : "↔"}
                </span>
                <span className="grow">
                  <strong>{a.name}</strong>
                  <small>
                    {a.management === "club"
                      ? "Formación del club"
                      : "Con profesor externo"}
                  </small>
                </span>
                <Badge tone={a.status === "activa" ? "green" : "neutral"}>
                  {a.status === "activa" ? "Activa" : "Sin altas"}
                </Badge>
                <ChevronRight size={17} />
              </button>
            ))}
          </div>
        </section>
        <section className="panel next-match">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">NOS ENCONTRAMOS EN LA CANCHA</p>
              <h2>Próximo partido</h2>
            </div>
            <Trophy size={23} />
          </div>
          {next ? (
            <>
              <img
                className="match-club-logo"
                src="/brand/logo.jpg"
                width="68"
                height="68"
                alt="La Fuente"
              />
              <h3>
                La Fuente <span>vs.</span>
                <br />
                {next.opponent}
              </h3>
              <p className="muted">
                {next.series && `Tira ${next.series} · `}{next.category ?? data.groups.find((g) => g.id === next.group_id)?.name}
              </p>
              <p className="next-date">
                <CalendarDays size={17} />
                {new Date(next.scheduled_at).toLocaleDateString("es-AR", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                ·{" "}
                {new Date(next.scheduled_at).toLocaleTimeString("es-AR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              <button className="button" onClick={() => navigate("partidos")}>
                Ver partidos <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <Empty>Todavía no hay próximos partidos en tu vista.</Empty>
          )}
        </section>
      </div>
      <div className="dashboard-columns bottom-columns">
        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">A MANO, COMO EN EL CLUB</p>
              <h2>Accesos rápidos</h2>
            </div>
          </div>
          <div className="quick-links">
            {[
              {
                page: "personas" as Page,
                icon: UsersRound,
                title: "Personas",
                detail: "Fichas e inscripciones",
              },
              {
                page: "grupos" as Page,
                icon: CheckCheck,
                title: "Asistencia",
                detail: "Cada encuentro cuenta",
              },
              {
                page: "partidos" as Page,
                icon: Trophy,
                title: "Resultados",
                detail: "Nuestro recorrido",
              },
              {
                page: "tesoreria" as Page,
                icon: Wallet,
                title: "Planificador",
                detail: "Simular las cuotas",
              },
            ]
              .filter((link) => canViewPage(profile.roles, link.page))
              .map((link) => (
                <button key={link.page} onClick={() => navigate(link.page)}>
                  <link.icon size={22} />
                  <strong>{link.title}</strong>
                  <small>{link.detail}</small>
                </button>
              ))}
          </div>
        </section>
        <section className="care-card">
          <HeartHandshake size={29} />
          <h2>Primero, las personas.</h2>
          <p>
            Ninguna situación económica deja a un chico afuera. Ese es nuestro
            compromiso.
          </p>
          {canManage(profile.roles) && pending.length > 0 && (
            <button
              className="text-button"
              onClick={() => navigate("personas")}
            >
              {pending.length}{" "}
              {pending.length === 1
                ? "ficha por validar"
                : "fichas por validar"}{" "}
              <ArrowRight size={16} />
            </button>
          )}
        </section>
      </div>
    </>
  );
}
function Stat({
  icon: Icon,
  value,
  label,
  detail,
}: {
  icon: typeof UsersRound;
  value: number;
  label: string;
  detail: string;
}) {
  return (
    <article className="panel stat">
      <span className="stat-icon">
        <Icon size={20} />
      </span>
      <strong>{value.toString().padStart(2, "0")}</strong>
      <p>{label}</p>
      <small>{detail}</small>
    </article>
  );
}
