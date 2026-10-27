import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { X, Sprout } from "lucide-react";
export const OperationErrorContext = createContext('');

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand">
      <img
        className="brand-logo"
        src="/brand/logo.jpg"
        width="48"
        height="48"
        alt="Escudo del Club Social La Fuente"
      />
      {!compact && (
        <>
          <span className="brand-name">La Fuente Digital</span>
          <small className="brand-tagline">Tu club, más cerca.</small>
        </>
      )}
    </div>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "green" | "amber" | "blue";
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <Sprout size={32} strokeWidth={1.4} />
      <p>{children}</p>
    </div>
  );
}
export function Dialog({
  title,
  children,
  close,
}: {
  title: string;
  children: ReactNode;
  close: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const error = useContext(OperationErrorContext);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    return () => {
      dialog.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="dialog-title" onCancel={close}>
      <div className="dialog-head">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          onClick={close}
          aria-label="Cerrar ventana"
        >
          <X size={20} />
        </button>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      {children}
    </dialog>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="muted">{description}</p>
      </div>
      {action}
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
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
