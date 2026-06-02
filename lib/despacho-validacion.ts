/** HU29: reglas de negocio para remisiones de despacho. */

export type CosechaDespachoRow = {
  id: string;
  fecha: string;
  peso_kg: number;
  conteo_racimos: number;
};

const PLACA_RE = /^[A-Z]{3}[0-9]{2,3}[A-Z0-9]?$/;

export function normalizarPlaca(placa: string): string {
  return placa.replace(/\s|-/g, "").toUpperCase();
}

export function validarPlacaVehiculo(placa: string): { ok: true; placa: string } | { ok: false; error: string } {
  const p = normalizarPlaca(placa);
  if (p.length < 5 || p.length > 8) {
    return { ok: false, error: "Placa inválida. Use formato colombiano (ej. ABC123 o ABC12D)." };
  }
  if (!PLACA_RE.test(p)) {
    return { ok: false, error: "Formato de placa no reconocido. Verifique letras y números." };
  }
  return { ok: true, placa: p };
}

/** RN83: todas las cosechas deben ser del mismo día de cosecha. */
export function validarMismaFechaCosechas(
  cosechas: CosechaDespachoRow[]
): { ok: true; fecha: string } | { ok: false; error: string } {
  if (cosechas.length === 0) {
    return { ok: false, error: "Seleccione al menos un registro de cosecha." };
  }
  const fechas = [...new Set(cosechas.map((c) => c.fecha))];
  if (fechas.length > 1) {
    return {
      ok: false,
      error:
        "Todas las cosechas de una remisión deben ser del mismo día (RN83). Ajuste la selección.",
    };
  }
  return { ok: true, fecha: fechas[0]! };
}

export function calcularTotalesRemision(cosechas: CosechaDespachoRow[]): {
  peso_total_kg: number;
  total_racimos: number;
} {
  const peso = cosechas.reduce((s, c) => s + c.peso_kg, 0);
  const racimos = cosechas.reduce((s, c) => s + c.conteo_racimos, 0);
  return {
    peso_total_kg: Math.round(peso * 1000) / 1000,
    total_racimos: racimos,
  };
}

export function advertenciaSobrecarga(
  pesoTotalKg: number,
  capacidadKg: number | null | undefined
): string | null {
  if (capacidadKg == null || !Number.isFinite(capacidadKg) || capacidadKg <= 0) {
    return null;
  }
  if (pesoTotalKg > capacidadKg) {
    const exceso = Math.round((pesoTotalKg - capacidadKg) * 100) / 100;
    return `El peso total (${pesoTotalKg.toLocaleString("es-CO")} kg) supera la capacidad indicada del vehículo (${capacidadKg.toLocaleString("es-CO")} kg) por ${exceso} kg.`;
  }
  return null;
}

export function generarNumeroRemision(
  fincaId: string,
  year: number,
  countEnFincaAnio: number
): string {
  const seq = String(countEnFincaAnio + 1).padStart(4, "0");
  const shortFinca = fincaId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `REM-${shortFinca}-${year}-${seq}`;
}
