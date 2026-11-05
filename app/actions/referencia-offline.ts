"use server";

import { getCapacidadPalmasLote } from "./censo-sanitario";
import {
  getOperariosCosecha,
  getLotesConCosechaProgramada,
  getLotesCosechables,
  getLotesPorFinca,
  getMaxPesoCosechaLote,
} from "./queries";
import { actionOk, type ActionResult } from "./types";

/**
 * Todas las lecturas de los formularios de campo en una sola petición, para guardarlas en el
 * dispositivo. Las claves son las que usan los formularios con `conCache`. Cada lectura aplica sus
 * propios permisos; una que falle simplemente no se guarda.
 */
export async function getReferenciaOffline(
  fincaId: string,
  hoy: string
): Promise<ActionResult<Record<string, { success: boolean }>>> {
  const [lotes, cosechables, programada, operarios] = await Promise.all([
    getLotesPorFinca(fincaId),
    getLotesCosechables(fincaId, hoy),
    getLotesConCosechaProgramada(fincaId, hoy),
    getOperariosCosecha(),
  ]);
  const porLote = lotes.success
    ? await Promise.all(
        lotes.data.map(async ({ id }) => {
          const [capacidad, maxPeso] = await Promise.all([getCapacidadPalmasLote(id), getMaxPesoCosechaLote(id)]);
          return [
            [`capacidad:${id}`, capacidad],
            [`max-peso:${id}`, maxPeso],
          ] as const;
        })
      )
    : [];
  return actionOk({
    [`lotes:${fincaId}`]: lotes,
    [`cosechables:${fincaId}`]: cosechables,
    [`cosecha-programada:${fincaId}`]: programada,
    [`operarios:${fincaId}`]: operarios,
    ...Object.fromEntries(porLote.flat()),
  });
}
