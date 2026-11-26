'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

/* ==========================================================================
   TEMA CLARO / OSCURO (data-theme en <html>)
   ========================================================================== */
const CLAVE_TEMA = 'nl-theme';

export function useTema() {
  const [tema, setTema] = useState<string>('light');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      const actual = document.documentElement.getAttribute('data-theme') || localStorage.getItem(CLAVE_TEMA) || 'light';
      setTema(actual);
      document.documentElement.setAttribute('data-theme', actual);
      if (actual === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  }, []);

  const alternar = () => {
    const nuevo = tema === 'dark' ? 'light' : 'dark';
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', nuevo);
      if (nuevo === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem(CLAVE_TEMA, nuevo);
    }
    setTema(nuevo);
  };

  return { tema, alternar };
}

/* ==========================================================================
   BOTÓN (NanoLabsButton / BhButton)
   ========================================================================== */
export interface NanoLabsButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary';
  size?: 'regular' | 'small';
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}

export function NanoLabsButton({
  variant = 'primary',
  size = 'regular',
  icon,
  iconPosition = 'left',
  className = '',
  children,
  ...rest
}: NanoLabsButtonProps) {
  const classes = [
    'bh-btn',
    `bh-btn-${variant}`,
    size === 'small' ? 'bh-btn--small' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button className={classes} {...rest}>
      {icon && iconPosition === 'left' ? icon : null}
      {children}
      {icon && iconPosition === 'right' ? icon : null}
    </button>
  );
}
export const BhButton = NanoLabsButton;

/* ==========================================================================
   CHIP (NanoLabsChip / BhChip)
   ========================================================================== */
export interface NanoLabsChipProps {
  children: ReactNode;
  severity?: 'info' | 'special' | 'danger' | 'warning' | 'success' | 'neutral';
  onClose?: () => void;
  className?: string;
}

export function NanoLabsChip({ children, severity = 'neutral', onClose, className = '' }: NanoLabsChipProps) {
  return (
    <span className={`bh-chip bh-chip--${severity} ${className}`}>
      {children}
      {onClose && (
        <button type="button" className="bh-chip__close" onClick={onClose} aria-label="Quitar">
          ×
        </button>
      )}
    </span>
  );
}
export const BhChip = NanoLabsChip;

/* ==========================================================================
   ALERTA (NanoLabsAlert / BhAlert)
   ========================================================================== */
export interface NanoLabsAlertProps {
  severity?: 'info' | 'error' | 'warning' | 'success';
  title?: string;
  description?: ReactNode;
  onClose?: () => void;
  className?: string;
}

const severityClass: Record<string, string> = {
  info: 'bh-alert--info',
  error: 'bh-alert--danger',
  warning: 'bh-alert--warning',
  success: 'bh-alert--success',
};

export function NanoLabsAlert({ severity = 'info', title, description, onClose, className = '' }: NanoLabsAlertProps) {
  return (
    <div className={`bh-alert ${severityClass[severity]} ${className}`} role="alert">
      <div className="bh-alert__header">
        {title && <strong className="bh-alert__title">{title}</strong>}
        {onClose && (
          <button type="button" className="bh-alert__close" onClick={onClose} aria-label="Cerrar">
            ×
          </button>
        )}
      </div>
      {description &&
        (typeof description === 'string' ? (
          <p className="bh-alert__body">{description}</p>
        ) : (
          <div className="bh-alert__body">{description}</div>
        ))}
    </div>
  );
}
export const BhAlert = NanoLabsAlert;

/* ==========================================================================
   MODAL (NanoLabsModal / BhModal)
   ========================================================================== */
export interface NanoLabsModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number | string; strokeWidth?: number | string }>;
  children: ReactNode;
  width?: number;
  type?: 'center' | 'right';
  centerHeader?: boolean;
  className?: string;
}

export function NanoLabsModal({
  open,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  width = 640,
  type = 'center',
  centerHeader = false,
  className = '',
}: NanoLabsModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const isRight = type === 'right';

  return (
    <div
      className={isRight ? 'bh-overlay bh-overlay--right' : 'bh-overlay'}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={[isRight ? 'bh-dialog bh-dialog--right' : 'bh-dialog bh-dialog--scroll', className].filter(Boolean).join(' ')}
        style={isRight ? undefined : { maxWidth: width }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={`bh-dialog__header${Icon ? ' bh-dialog__header--icon' : ''}`}>
          {Icon && (
            <div className="bh-dialog__icon-chip">
              <Icon size={20} strokeWidth={2} />
            </div>
          )}
          {Icon ? (
            <div className="bh-dialog__heading">
              <h2 className="bh-dialog__title">{title}</h2>
              {subtitle && <p className="bh-dialog__subtitle">{subtitle}</p>}
            </div>
          ) : (
            <div className="bh-dialog__heading" style={centerHeader ? { textAlign: 'center' } : undefined}>
              <h2 className="bh-dialog__title" style={{ margin: 0 }}>
                {title}
              </h2>
              {subtitle && <p className="bh-dialog__subtitle">{subtitle}</p>}
            </div>
          )}
          <button type="button" className="bh-header__icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export const BhModal = NanoLabsModal;

/* ==========================================================================
   TABS (NanoLabsTabs / BhTabs)
   ========================================================================== */
export interface NanoLabsTab<T extends string = string> {
  id: T;
  label: ReactNode;
  disabled?: boolean;
  motivoDeshabilitada?: string;
}

export interface NanoLabsTabsProps<T extends string = string> {
  tabs: NanoLabsTab<T>[];
  activa: T;
  onCambiar: (id: T) => void;
  idBase: string;
  children: ReactNode;
}

export function NanoLabsTabs<T extends string = string>({ tabs, activa, onCambiar, idBase, children }: NanoLabsTabsProps<T>) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const habilitadas = tabs.filter((t) => !t.disabled);

  const moverFoco = (e: KeyboardEvent<HTMLDivElement>) => {
    const indice = habilitadas.findIndex((t) => t.id === activa);
    let destino: NanoLabsTab<T> | undefined;
    if (e.key === 'ArrowRight') destino = habilitadas[(indice + 1) % habilitadas.length];
    else if (e.key === 'ArrowLeft') destino = habilitadas[(indice - 1 + habilitadas.length) % habilitadas.length];
    else if (e.key === 'Home') destino = habilitadas[0];
    else if (e.key === 'End') destino = habilitadas[habilitadas.length - 1];
    if (!destino) return;
    e.preventDefault();
    onCambiar(destino.id);
    refs.current[destino.id]?.focus();
  };

  return (
    <div className="bh-tabs">
      <div className="bh-tabs__lista" role="tablist" onKeyDown={moverFoco}>
        {tabs.map((tab) => {
          const seleccionada = tab.id === activa;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                refs.current[tab.id] = el;
              }}
              type="button"
              role="tab"
              id={`${idBase}-tab-${tab.id}`}
              aria-controls={`${idBase}-panel`}
              aria-selected={seleccionada}
              tabIndex={seleccionada ? 0 : -1}
              disabled={tab.disabled}
              title={tab.disabled ? tab.motivoDeshabilitada : undefined}
              className={`bh-tabs__tab${seleccionada ? ' bh-tabs__tab--activa' : ''}`}
              onClick={() => onCambiar(tab.id)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className="bh-tabs__panel" role="tabpanel" id={`${idBase}-panel`} aria-labelledby={`${idBase}-tab-${activa}`}>
        {children}
      </div>
    </div>
  );
}
export const BhTabs = NanoLabsTabs;

/* ==========================================================================
   PATRONES DE PÁGINA (Encabezado, Indicador, Volver, Cargando, Vacio)
   ========================================================================== */
export type IconoNanoLabs = ComponentType<{ size?: number | string; strokeWidth?: number | string; className?: string }>;

export function Encabezado({
  icono: I,
  antetitulo,
  titulo,
  bajada,
  accion,
}: {
  icono: IconoNanoLabs;
  antetitulo: string;
  titulo: ReactNode;
  bajada?: ReactNode;
  accion?: ReactNode;
}) {
  return (
    <header className="pry-encabezado">
      <div className="pry-encabezado__titulo">
        <span className="pry-encabezado__icono">
          <I size={22} />
        </span>
        <div>
          <span className="pry-antetitulo">{antetitulo}</span>
          <h1>{titulo}</h1>
          {bajada && <p>{bajada}</p>}
        </div>
      </div>
      {accion}
    </header>
  );
}

export type Tono = 'primary' | 'success' | 'warning' | 'danger' | 'info';

export function Indicador({
  tono,
  icono: I,
  valor,
  etiqueta,
  activo,
  onClick,
}: {
  tono: Tono;
  icono: IconoNanoLabs;
  valor: ReactNode;
  etiqueta: string;
  activo?: boolean;
  onClick?: () => void;
}) {
  const cuerpo = (
    <>
      <span className="bh-stat-card__accent" />
      <span className="bh-stat-card__icon">
        <I size={19} strokeWidth={2} />
      </span>
      <span className="bh-stat-card__body">
        <span className="bh-stat-card__value">{valor}</span>
        <span className="bh-stat-card__label">
          {etiqueta}
          {onClick && <ArrowRight size={12} className="bh-stat-card__arrow" />}
        </span>
      </span>
    </>
  );
  const clase = `bh-stat-card bh-stat-card--tone-${tono}`;
  if (!onClick) return <div className={clase}>{cuerpo}</div>;
  return (
    <button
      type="button"
      className={`${clase} bh-stat-card--clickable${activo ? ' bh-stat-card--active' : ''}`}
      aria-pressed={!!activo}
      onClick={onClick}
    >
      {cuerpo}
    </button>
  );
}

export function Volver({ a, children }: { a: string; children: ReactNode }) {
  return (
    <Link href={a} className="bh-btn bh-btn-tertiary bh-btn--small ot-volver">
      <ArrowLeft size={16} /> {children}
    </Link>
  );
}

export function Cargando({ texto }: { texto: string }) {
  return (
    <div className="bh-empty">
      <div className="bh-spinner" />
      <span>{texto}</span>
    </div>
  );
}

export function Vacio({ titulo, texto }: { titulo: string; texto?: string }) {
  return (
    <div className="bh-empty">
      <span className="bh-list-primary">{titulo}</span>
      {texto && <span className="bh-list-secondary">{texto}</span>}
    </div>
  );
}

/* ==========================================================================
   TOAST PROVIDER / USETOAST
   ========================================================================== */
export type TipoToast = 'ok' | 'error' | 'info';
type Avisar = (texto: string, tipo?: TipoToast) => void;

const ToastContext = createContext<Avisar>(() => undefined);

export const useToast = () => useContext(ToastContext);

const ICONO_TOAST = { ok: CheckCircle2, error: AlertCircle, info: Info };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [avisos, setAvisos] = useState<{ id: number; texto: string; tipo: TipoToast }[]>([]);
  const cerrar = useCallback((id: number) => setAvisos((a) => a.filter((x) => x.id !== id)), []);
  const avisar = useCallback<Avisar>(
    (texto, tipo = 'ok') => {
      const id = Date.now() + Math.random();
      setAvisos((a) => [...a, { id, texto, tipo }]);
      if (typeof window !== 'undefined') {
        window.setTimeout(() => cerrar(id), tipo === 'error' ? 8000 : 5000);
      }
    },
    [cerrar]
  );
  return (
    <ToastContext.Provider value={avisar}>
      {children}
      <div className="ot-toasts" role="status" aria-live="polite">
        {avisos.map((a) => {
          const I = ICONO_TOAST[a.tipo];
          return (
            <div key={a.id} className={`ot-toast ot-toast--${a.tipo}`}>
              <I size={18} />
              <span>{a.texto}</span>
              <button type="button" aria-label="Cerrar" onClick={() => cerrar(a.id)}>
                <X size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}
