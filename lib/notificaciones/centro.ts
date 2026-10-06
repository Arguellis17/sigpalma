/** Utilidades puras del centro de notificaciones. */

/** "ahora", "hace 5 min", "hace 3 h", "ayer", "hace 4 días" o la fecha (dd/mm/aaaa) si es más antigua. */
export function tiempoRelativo(iso: string, ahora: Date = new Date()): string {
  const fecha = new Date(iso);
  const seg = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 1000));
  if (seg < 60) return "ahora";
  const min = Math.floor(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.floor(h / 24);
  if (dias === 1) return "ayer";
  if (dias < 7) return `hace ${dias} días`;
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "America/Bogota" }).format(fecha);
}

/** Texto del contador del icono (máximo "99+"). */
export function etiquetaContador(noLeidas: number): string | null {
  if (noLeidas <= 0) return null;
  return noLeidas > 99 ? "99+" : String(noLeidas);
}
