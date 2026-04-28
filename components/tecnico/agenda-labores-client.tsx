"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Calendar,
  dateFnsLocalizer,
  Views,
  type SlotInfo,
  type View,
} from "react-big-calendar";
import {
  endOfMonth,
  endOfWeek,
  format,
  getDay,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { actualizarLabor, registrarLabor } from "@/app/actions/labores";
import { getLaboresRango } from "@/app/actions/queries";
import type {
  CatalogoLaborOption,
  LaborAgendaRow,
  LoteOption,
} from "@/app/actions/queries";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";

const locales = { es };

const localizer = dateFnsLocalizer({
  format,
  startOfWeek,
  getDay,
  locales,
});

const messages = {
  allDay: "Todo el día",
  previous: "Anterior",
  next: "Siguiente",
  today: "Hoy",
  month: "Mes",
  week: "Semana",
  day: "Día",
  agenda: "Agenda",
  date: "Fecha",
  time: "Hora",
  event: "Labor",
  showMore: (n: number) => `+${n} más`,
  noEventsInRange: "No hay labores en este rango.",
};

type CalendarEvent = {
  id: string;
  title: string;
  start: Date;
  end: Date;
  allDay: boolean;
  resource: LaborAgendaRow;
};

type Props = {
  fincaId: string;
  catalogoLabores: CatalogoLaborOption[];
  lotes: LoteOption[];
  initialLabores: LaborAgendaRow[];
};

const IDLE_LOTE = "__lote_idle__";
const IDLE_CAT = "__cat_idle__";

function rowsToEvents(rows: LaborAgendaRow[]): CalendarEvent[] {
  return rows.map((row) => {
    const dayStart = parseISO(`${row.fecha_ejecucion}T00:00:00`);
    const dayEnd = parseISO(`${row.fecha_ejecucion}T23:59:59`);
    return {
      id: row.id,
      title: `${row.tipo} · ${row.lote_codigo}`,
      start: dayStart,
      end: dayEnd,
      allDay: true,
      resource: row,
    };
  });
}

function rangeForView(view: View, date: Date): { desde: string; hasta: string } {
  if (view === Views.MONTH) {
    return {
      desde: format(startOfMonth(date), "yyyy-MM-dd"),
      hasta: format(endOfMonth(date), "yyyy-MM-dd"),
    };
  }
  if (view === Views.WEEK) {
    const wkStart = startOfWeek(date, { locale: es });
    const wkEnd = endOfWeek(date, { locale: es });
    return {
      desde: format(wkStart, "yyyy-MM-dd"),
      hasta: format(wkEnd, "yyyy-MM-dd"),
    };
  }
  if (view === Views.DAY) {
    const ymd = format(date, "yyyy-MM-dd");
    return { desde: ymd, hasta: ymd };
  }
  /* agenda */
  return {
    desde: format(startOfMonth(date), "yyyy-MM-dd"),
    hasta: format(endOfMonth(date), "yyyy-MM-dd"),
  };
}

export function AgendaLaboresClient({
  fincaId,
  catalogoLabores,
  lotes,
  initialLabores,
}: Props) {
  const { toast } = useToast();
  const [rows, setRows] = useState<LaborAgendaRow[]>(initialLabores);
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [currentView, setCurrentView] = useState<View>(Views.MONTH);
  const [loadingRange, setLoadingRange] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loteId, setLoteId] = useState("");
  const [catalogoId, setCatalogoId] = useState("");
  const [fechaYmd, setFechaYmd] = useState(format(new Date(), "yyyy-MM-dd"));
  const [notas, setNotas] = useState("");
  const [pending, setPending] = useState(false);

  const events = useMemo(() => rowsToEvents(rows), [rows]);

  const reloadRange = useCallback(
    async (view: View, date: Date) => {
      const { desde, hasta } = rangeForView(view, date);
      setLoadingRange(true);
      const res = await getLaboresRango(fincaId, desde, hasta);
      setLoadingRange(false);
      if (!res.success) {
        toast(`No se pudo cargar el calendario: ${res.error}`, "error");
        return;
      }
      setRows(res.data);
    },
    [fincaId, toast]
  );

  const handleNavigate = useCallback(
    (newDate: Date) => {
      setCalendarDate(newDate);
      void reloadRange(currentView, newDate);
    },
    [currentView, reloadRange]
  );

  const handleViewChange = useCallback(
    (view: View) => {
      setCurrentView(view);
      void reloadRange(view, calendarDate);
    },
    [calendarDate, reloadRange]
  );

  function openCreate(slot: SlotInfo) {
    setEditingId(null);
    const d = slot.start ?? calendarDate;
    setFechaYmd(format(d, "yyyy-MM-dd"));
    setLoteId(lotes[0]?.id ?? IDLE_LOTE);
    setCatalogoId(catalogoLabores[0]?.id ?? IDLE_CAT);
    setNotas("");
    setDialogOpen(true);
  }

  function openEdit(ev: CalendarEvent) {
    const r = ev.resource;
    setEditingId(r.id);
    setLoteId(r.lote_id);
    const matchId =
      (r.catalogo_item_id &&
      catalogoLabores.some((c) => c.id === r.catalogo_item_id)
        ? r.catalogo_item_id
        : catalogoLabores.find(
            (c) => c.nombre.trim().toLowerCase() === r.tipo.trim().toLowerCase()
          )?.id) ??
      catalogoLabores[0]?.id ??
      IDLE_CAT;
    setCatalogoId(matchId);
    setFechaYmd(r.fecha_ejecucion);
    setNotas(r.notas ?? "");
    setDialogOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!loteId || loteId === IDLE_LOTE) {
      toast("Seleccione un lote.", "error");
      return;
    }
    if (!catalogoId || catalogoId === IDLE_CAT) {
      toast("Seleccione el tipo de labor del catálogo.", "error");
      return;
    }
    const catRow = catalogoLabores.find((c) => c.id === catalogoId);
    if (!catRow) {
      toast("Catálogo inválido.", "error");
      return;
    }

    setPending(true);
    if (editingId) {
      const result = await actualizarLabor({
        id: editingId,
        lote_id: loteId,
        tipo: catRow.nombre,
        fecha_ejecucion: fechaYmd,
        notas: notas.trim() || null,
        catalogo_item_id: catalogoId,
      });
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast("Labor actualizada. Los cambios quedaron registrados.");
    } else {
      const result = await registrarLabor({
        finca_id: fincaId,
        lote_id: loteId,
        tipo: catRow.nombre,
        fecha_ejecucion: fechaYmd,
        notas: notas.trim() || null,
        source: "web",
        catalogo_item_id: catalogoId,
      });
      setPending(false);
      if (!result.success) {
        toast(result.error, "error");
        return;
      }
      toast("Labor programada. Queda disponible para el operador de campo.");
    }

    setDialogOpen(false);
    await reloadRange(currentView, calendarDate);
  }

  if (lotes.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        No hay lotes activos en su finca. Revise la gestión de lotes (HU04) antes de programar
        labores.
      </p>
    );
  }

  if (catalogoLabores.length === 0) {
    return (
      <p className="surface-panel rounded-[1.5rem] p-4 text-sm leading-6 text-muted-foreground">
        El catálogo de tipos de labor está vacío o inactivo. Un administrador debe cargar ítems en
        Catálogos → Labores agronómicas.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "rbc-wrapper surface-panel overflow-hidden rounded-[1.25rem] ring-1 ring-border/60",
          loadingRange && "opacity-70"
        )}
      >
        <Calendar
          culture="es"
          localizer={localizer}
          events={events}
          startAccessor="start"
          endAccessor="end"
          style={{ minHeight: "min(70vh, 640px)" }}
          views={[Views.MONTH, Views.WEEK, Views.AGENDA]}
          view={currentView}
          date={calendarDate}
          onNavigate={handleNavigate}
          onView={handleViewChange}
          messages={messages}
          selectable
          onSelectSlot={(slot: SlotInfo) => openCreate(slot)}
          onSelectEvent={(ev) => openEdit(ev as CalendarEvent)}
          eventPropGetter={() => ({
            className:
              "!bg-primary/15 !text-foreground ring-1 ring-primary/25 rounded-md text-xs",
          })}
        />
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editingId ? "Modificar labor programada" : "Nueva labor programada"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-2">
              <div className="grid gap-2">
                <Label>Lote</Label>
                <Select value={loteId || IDLE_LOTE} onValueChange={setLoteId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotes.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.codigo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Tipo de labor (catálogo)</Label>
                <Select value={catalogoId || IDLE_CAT} onValueChange={setCatalogoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccione tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    {catalogoLabores.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Fecha programada</Label>
                <DatePickerField value={fechaYmd} onChange={setFechaYmd} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="notas-agenda">Notas (opcional)</Label>
                <Textarea
                  id="notas-agenda"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  rows={3}
                  className="resize-none rounded-xl"
                  placeholder="Observaciones para operador de campo…"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={pending}>
                {pending ? "Guardando…" : editingId ? "Guardar cambios" : "Programar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
