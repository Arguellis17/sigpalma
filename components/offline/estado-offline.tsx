"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, CloudOff, CloudUpload, Loader2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { todayLocalYmd } from "@/components/ui/date-picker-field";
import { useToast } from "@/components/ui/toast";
import { precargarReferencia } from "@/lib/offline/precarga";
import { errorDeCaptura } from "@/lib/offline/validar-captura";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  EVENTO_COLA,
  corregirOperacion,
  descartarOperacion,
  encolar,
  hayConexion,
  listarOperaciones,
  reintentarOperacion,
  sincronizarOperacion,
  sincronizarPendientes,
} from "@/lib/offline/cola";
import { contarPendientes, type EstadoOperacion, type Operacion } from "@/lib/offline/reglas";
import { OPERACIONES_OFFLINE, type TipoOperacion } from "@/lib/offline/tipos";
import { cn } from "@/lib/utils";

/** Resultado de guardar desde un formulario: con red igual que la acción; sin red, en el dispositivo. */
export type ResultadoGuardar<T> =
  | { success: true; offline: false; data: T }
  | { success: true; offline: true; data: null }
  | { success: false; error: string };

/** Tipo de `data` de una server action: `guardar<DatosDe<typeof accion>>(…)` (con `import type`). */
export type DatosDe<F extends (...args: never[]) => Promise<{ success: boolean }>> = Extract<
  Awaited<ReturnType<F>>,
  { success: true }
> extends { data: infer D }
  ? D
  : never;

type ContextoOffline = {
  userId: string;
  enLinea: boolean;
  operaciones: Operacion[];
  pendientes: number;
  guardar: <T>(
    tipo: TipoOperacion,
    payload: Record<string, unknown>,
    opts?: { archivos?: File[]; resumen?: string }
  ) => Promise<ResultadoGuardar<T>>;
  sincronizarAhora: () => Promise<void>;
};

const Contexto = createContext<ContextoOffline | null>(null);

const INTERVALO_SYNC_MS = 30_000;
const CLAVE_PRECARGA = "sigpalma-precarga";
const PRECARGA_CADA_MS = 6 * 60 * 60_000;
export const MENSAJE_GUARDADO_OFFLINE =
  "Guardado en este dispositivo. Se enviará automáticamente cuando vuelva la señal.";

const MENSAJE_REQUIERE_CONEXION = "Esta acción requiere conexión a internet.";
/** Botones de gestión y descargas de la API: no funcionan sin conexión. */
const SELECTOR_SOLO_EN_LINEA = '[data-requiere-conexion], a[href^="/api/v1/"]';

/**
 * Proveedor offline-first de la plataforma: estado de conexión real, cola de registros pendientes,
 * sincronización automática (al volver la señal, al abrir la app, cada 30 s y por Background Sync)
 * y precarga de las páginas del rol para poder abrirlas sin conexión.
 */
export function OfflineProvider({
  userId,
  fincaId,
  rutasPrecarga,
  children,
}: {
  userId: string;
  /** Finca del usuario de campo; sin ella no se precargan lecturas de formularios. */
  fincaId: string | null;
  rutasPrecarga: string[];
  children: React.ReactNode;
}) {
  const { toast } = useToast();
  const [enLinea, setEnLinea] = useState(true);
  const [operaciones, setOperaciones] = useState<Operacion[]>([]);
  const pendientes = contarPendientes(operaciones, userId);
  const rutasRef = useRef(rutasPrecarga);

  const recargar = useCallback(() => {
    listarOperaciones(userId).then(setOperaciones).catch(() => undefined);
  }, [userId]);

  const sincronizarAhora = useCallback(async () => {
    const conexion = await hayConexion();
    setEnLinea(conexion);
    if (conexion) await sincronizarPendientes(userId).catch(() => undefined);
  }, [userId]);

  useEffect(() => {
    listarOperaciones(userId).then(setOperaciones).catch(() => undefined);
    queueMicrotask(() => void sincronizarAhora());
    // Pedir al navegador que no borre la cola si se queda sin espacio.
    navigator.storage?.persist?.().catch(() => undefined);

    const alCambiar = () => recargar();
    const alConectar = () => void sincronizarAhora();
    const alDesconectar = () => setEnLinea(false);
    const alMensajeSw = (e: MessageEvent) => {
      if ((e.data as { tipo?: string } | null)?.tipo === "sincronizar") void sincronizarAhora();
    };
    const alVolver = () => {
      if (document.visibilityState === "visible") void sincronizarAhora();
    };
    window.addEventListener(EVENTO_COLA, alCambiar);
    window.addEventListener("online", alConectar);
    window.addEventListener("offline", alDesconectar);
    document.addEventListener("visibilitychange", alVolver);
    navigator.serviceWorker?.addEventListener("message", alMensajeSw);
    return () => {
      window.removeEventListener(EVENTO_COLA, alCambiar);
      window.removeEventListener("online", alConectar);
      window.removeEventListener("offline", alDesconectar);
      document.removeEventListener("visibilitychange", alVolver);
      navigator.serviceWorker?.removeEventListener("message", alMensajeSw);
    };
  }, [userId, recargar, sincronizarAhora]);

  // Comprobación periódica: detecta redes sin salida a internet y reintenta lo pendiente.
  useEffect(() => {
    const id = window.setInterval(() => void sincronizarAhora(), INTERVALO_SYNC_MS);
    return () => window.clearInterval(id);
  }, [sincronizarAhora]);

  // Sin conexión, las acciones de gestión (solo en línea) se bloquean con un aviso: su server action
  // fallaría y dejaría el formulario "cargando". Los formularios de campo llevan `data-offline-ok`.
  useEffect(() => {
    if (enLinea) return;
    const bloquear = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      toast(MENSAJE_REQUIERE_CONEXION, "info");
    };
    const alEnviar = (e: Event) => {
      if (!(e.target as Element).closest?.("[data-offline-ok]")) bloquear(e);
    };
    const alClic = (e: Event) => {
      if ((e.target as Element).closest?.(SELECTOR_SOLO_EN_LINEA)) bloquear(e);
    };
    document.addEventListener("submit", alEnviar, true);
    document.addEventListener("click", alClic, true);
    return () => {
      document.removeEventListener("submit", alEnviar, true);
      document.removeEventListener("click", alClic, true);
    };
  }, [enLinea, toast]);

  // Precarga de las páginas del rol en el service worker para abrirlas sin conexión.
  useEffect(() => {
    if (!enLinea) return;
    const clave = `${CLAVE_PRECARGA}:${userId}`;
    let ultima = 0;
    try {
      ultima = Number(localStorage.getItem(clave) ?? 0);
    } catch {
      /* almacenamiento bloqueado: precargar igual */
    }
    if (Date.now() - ultima < PRECARGA_CADA_MS) return;
    const id = window.setTimeout(() => {
      navigator.serviceWorker?.ready
        .then(async (reg) => {
          reg.active?.postMessage({ type: "CACHE_URLS", payload: { urlsToCache: rutasRef.current } });
          // Se marca como hecha solo al terminar: si se interrumpe, se repite en la próxima carga.
          if (fincaId && !(await precargarReferencia(fincaId, todayLocalYmd()))) return;
          try {
            localStorage.setItem(clave, String(Date.now()));
          } catch {
            /* sin almacenamiento: se repetirá en la próxima carga */
          }
        })
        .catch(() => undefined);
    }, 3000);
    return () => window.clearTimeout(id);
  }, [enLinea, userId, fincaId]);

  const guardar = useCallback<ContextoOffline["guardar"]>(
    async (tipo, payload, opts) => {
      const invalido = errorDeCaptura(tipo, payload, opts?.archivos?.length ?? 0);
      if (invalido) return { success: false, error: invalido };
      let op: Operacion;
      try {
        op = await encolar({
          userId,
          tipo,
          payload,
          resumen: opts?.resumen,
          archivos: (opts?.archivos ?? []).map((f) => ({ nombre: f.name, tipo: f.type, blob: f })),
        });
      } catch {
        return { success: false, error: "No se pudo guardar en este dispositivo. Libere espacio e intente de nuevo." };
      }
      const conexion = await hayConexion();
      setEnLinea(conexion);
      if (conexion) {
        const r = await sincronizarOperacion(op.opId);
        if (r?.estado === "ok") return { success: true, offline: false, data: r.data as never };
        if (r?.estado === "rechazado" || r?.estado === "conflicto") {
          // Con red el usuario ve el error en el mismo formulario y corrige: no dejarlo en la cola.
          await descartarOperacion(op.opId);
          return { success: false, error: r.motivo };
        }
      }
      toast(MENSAJE_GUARDADO_OFFLINE, "info");
      return { success: true, offline: true, data: null };
    },
    [userId, toast]
  );

  const valor = useMemo(
    () => ({ userId, enLinea, operaciones, pendientes, guardar, sincronizarAhora }),
    [userId, enLinea, operaciones, pendientes, guardar, sincronizarAhora]
  );
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

export function useOffline() {
  const ctx = useContext(Contexto);
  if (!ctx) throw new Error("useOffline debe usarse dentro de <OfflineProvider>");
  return ctx;
}

/** Para componentes que pueden montarse fuera de la plataforma (p. ej. el botón de cerrar sesión). */
export function useOfflineOpcional() {
  return useContext(Contexto);
}

/** Guardar un registro de campo con soporte sin conexión. */
export function useGuardarOffline() {
  return useOffline().guardar;
}

/**
 * Valores de `payload[campo]` de las operaciones `tipo` ya capturadas en este dispositivo (pendientes o
 * enviadas). Las listas de pendientes los ocultan para que no se registre dos veces lo mismo mientras
 * la página muestra datos de antes de sincronizar.
 */
export function useEnCola(tipo: TipoOperacion, campo: string): Set<string> {
  const { operaciones } = useOffline();
  return useMemo(
    () =>
      new Set(
        operaciones
          .filter((o) => o.tipo === tipo && o.estado !== "rechazado" && o.estado !== "conflicto")
          .flatMap((o) => {
            const v = o.payload[campo];
            return Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)];
          })
      ),
    [operaciones, tipo, campo]
  );
}

const ETIQUETA_ESTADO: Record<EstadoOperacion, string> = {
  pendiente: "Pendiente",
  error: "Reintentando",
  sesion: "Inicie sesión",
  conflicto: "Conflicto",
  rechazado: "Rechazado",
  sincronizado: "Sincronizado",
};

const COLOR_ESTADO: Record<EstadoOperacion, string> = {
  pendiente: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  error: "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200",
  sesion: "bg-sky-100 text-sky-900 dark:bg-sky-500/20 dark:text-sky-200",
  conflicto: "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200",
  rechazado: "bg-red-100 text-red-900 dark:bg-red-500/20 dark:text-red-200",
  sincronizado: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-200",
};

function fechaHora(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
}

/** Ids, rutas y metadatos no se corrigen a mano: un lote equivocado se descarta y se registra de nuevo. */
const CAMPO_NO_EDITABLE = /(^|_)id$|_ids$|^source$|^evidencia_urls$/;

const TILDES: Record<string, string> = {
  aplicacion: "aplicación",
  analisis: "análisis",
  compactacion: "compactación",
  desviacion: "desviación",
  ejecucion: "ejecución",
  identificacion: "identificación",
  justificacion: "justificación",
  metodo: "método",
  organica: "orgánica",
  capacidad_vehiculo_kg: "capacidad del vehículo (kg)",
  placa_vehiculo: "placa del vehículo",
};

function etiquetaCampo(campo: string) {
  const texto = (TILDES[campo] ?? campo.replace(/_/g, " ")).replace(/\p{L}+/gu, (p) => TILDES[p] ?? p);
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Corrige en el panel lo que el servidor rechazó, sin perder las fotos ni la hora de captura. */
function CorregirOperacion({ op, onCerrar }: { op: Operacion; onCerrar: () => void }) {
  const { sincronizarAhora } = useOffline();
  const [valores, setValores] = useState<Record<string, unknown>>(op.payload);
  const [error, setError] = useState<string | null>(null);
  const campos = Object.entries(op.payload).filter(
    ([campo, v]) => !CAMPO_NO_EDITABLE.test(campo) && (v === null || ["string", "number", "boolean"].includes(typeof v))
  );

  async function guardarCorreccion(e: React.FormEvent) {
    e.preventDefault();
    const invalido = errorDeCaptura(op.tipo, valores, op.archivos.length);
    if (invalido) {
      setError(invalido);
      return;
    }
    await corregirOperacion(op.opId, valores);
    onCerrar();
    await sincronizarAhora();
  }

  return (
    <form onSubmit={guardarCorreccion} className="mt-3 flex flex-col gap-3 border-t pt-3" data-offline-ok data-testid="corregir-operacion">
      {campos.map(([campo, original]) => {
        const id = `corregir-${op.opId}-${campo}`;
        const valor = valores[campo];
        if (typeof original === "boolean") {
          return (
            <label key={campo} htmlFor={id} className="flex min-h-10 items-center gap-2 text-sm">
              <input
                id={id}
                type="checkbox"
                className="size-5"
                data-campo={campo}
                checked={Boolean(valor)}
                onChange={(ev) => setValores((p) => ({ ...p, [campo]: ev.target.checked }))}
              />
              {etiquetaCampo(campo)}
            </label>
          );
        }
        const esNumero = typeof original === "number";
        const esFecha = typeof original === "string" && /^\d{4}-\d{2}-\d{2}$/.test(original);
        return (
          <div key={campo} className="space-y-1">
            <Label htmlFor={id}>{etiquetaCampo(campo)}</Label>
            <Input
              id={id}
              className="min-h-12 text-base"
              data-campo={campo}
              type={esNumero ? "number" : esFecha ? "date" : "text"}
              step={esNumero ? "any" : undefined}
              value={valor == null ? "" : String(valor)}
              onChange={(ev) => {
                const t = ev.target.value;
                setValores((p) => ({ ...p, [campo]: t === "" ? null : esNumero ? Number(t) : t }));
              }}
            />
          </div>
        );
      })}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="min-h-12">
          Guardar y reenviar
        </Button>
        <Button type="button" variant="ghost" className="min-h-12" onClick={onCerrar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Indicador de la cabecera: "Sin conexión" y "N por sincronizar", con el panel de la cola. */
export function IndicadorOffline() {
  const { enLinea, operaciones, pendientes, sincronizarAhora } = useOffline();
  const [abierto, setAbierto] = useState(false);
  const [corrigiendo, setCorrigiendo] = useState<string | null>(null);
  const [porDescartar, setPorDescartar] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);
  const revisar = operaciones.filter((o) => o.estado === "conflicto" || o.estado === "rechazado").length;

  async function sincronizar() {
    setSincronizando(true);
    await sincronizarAhora();
    setSincronizando(false);
  }

  return (
    <>
      {enLinea && pendientes === 0 ? null : (
        <button
          type="button"
          onClick={() => setAbierto(true)}
          data-testid="indicador-offline"
          className={cn(
            "inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold sm:text-sm",
            !enLinea
              ? "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-500/15 dark:text-amber-100"
              : revisar > 0
                ? "border-red-500/40 bg-red-50 text-red-900 dark:bg-red-500/15 dark:text-red-100"
                : "border-border bg-background text-foreground"
          )}
          aria-label={`${enLinea ? "En línea" : "Sin conexión"}. ${pendientes} registros por sincronizar.`}
        >
          {!enLinea ? <CloudOff className="size-4" aria-hidden /> : <CloudUpload className="size-4" aria-hidden />}
          <span className="hidden sm:inline">{!enLinea ? "Sin conexión" : revisar > 0 ? "Revisar" : "Sincronizando"}</span>
          {pendientes > 0 ? (
            <span className="rounded-full bg-foreground/10 px-1.5 tabular-nums" data-testid="contador-pendientes">
              {pendientes}
              <span className="hidden xl:inline"> por sincronizar</span>
            </span>
          ) : null}
        </button>
      )}

      <Sheet open={abierto} onOpenChange={setAbierto}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Registros en este dispositivo</SheetTitle>
            <SheetDescription>
              {!enLinea
                ? "Sin conexión. Puede seguir registrando; todo se enviará automáticamente al recuperar la señal."
                : pendientes > 0
                  ? "Con conexión. Los registros pendientes se están enviando."
                  : "Todo está sincronizado."}
            </SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {operaciones.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No hay registros guardados en el dispositivo.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {[...operaciones].reverse().map((op) => (
                  <li key={op.opId} className="rounded-lg border p-3" data-testid="operacion-cola" data-estado={op.estado}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{OPERACIONES_OFFLINE[op.tipo]}</p>
                        {op.resumen ? <p className="truncate text-xs text-muted-foreground">{op.resumen}</p> : null}
                        <p className="text-xs text-muted-foreground">Capturado {fechaHora(op.capturadoEn)}</p>
                      </div>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", COLOR_ESTADO[op.estado])}>
                        {ETIQUETA_ESTADO[op.estado]}
                      </span>
                    </div>
                    {op.ultimoError && op.estado !== "sincronizado" ? (
                      <p className="mt-2 flex gap-1.5 text-xs text-foreground/80">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" aria-hidden />
                        {op.ultimoError}
                      </p>
                    ) : null}
                    {op.estado === "sincronizado" ? (
                      <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="size-3.5" aria-hidden /> Enviado al servidor
                      </p>
                    ) : null}
                    {corrigiendo === op.opId ? (
                      <CorregirOperacion op={op} onCerrar={() => setCorrigiendo(null)} />
                    ) : op.estado === "conflicto" || op.estado === "rechazado" ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {op.estado === "rechazado" ? (
                          <Button type="button" className="min-h-11" onClick={() => setCorrigiendo(op.opId)}>
                            <Pencil data-icon="inline-start" /> Corregir y reenviar
                          </Button>
                        ) : null}
                        <Button type="button" variant="outline" className="min-h-11" onClick={() => reintentarOperacion(op.opId)}>
                          <RotateCcw data-icon="inline-start" /> Reintentar
                        </Button>
                        {/* Descartar borra evidencia capturada en campo: pide una segunda confirmación. */}
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-11 text-destructive"
                          onClick={() => (porDescartar === op.opId ? descartarOperacion(op.opId) : setPorDescartar(op.opId))}
                        >
                          <Trash2 data-icon="inline-start" /> {porDescartar === op.opId ? "¿Borrar definitivamente?" : "Descartar"}
                        </Button>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t p-4">
            <Button type="button" className="min-h-12 w-full" onClick={sincronizar} disabled={sincronizando}>
              {sincronizando ? <Loader2 className="animate-spin" data-icon="inline-start" /> : <CloudUpload data-icon="inline-start" />}
              Sincronizar ahora
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
