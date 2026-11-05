/**
 * Lecturas que hacen los formularios desde el navegador (lotes cosechables, capacidad del lote,
 * cosechas para despacho…). Con red se consulta al servidor y se guarda copia; sin red se usa la
 * última copia guardada en el dispositivo.
 */
import { abrirDb } from "./cola";

type ConExito = { success: boolean };

/** Nunca rechaza: sin red y sin copia devuelve `{ success: false, error }` como cualquier acción. */
export async function conCache<T extends ConExito>(clave: string, leer: () => Promise<T>): Promise<T> {
  try {
    const valor = await leer();
    if (valor.success) {
      abrirDb()
        .then((db) => db.put("referencia", { valor, guardadoEn: Date.now() }, clave))
        .catch(() => undefined);
    }
    return valor;
  } catch {
    // Sin red la server action rechaza la promesa: usar la última copia del dispositivo.
    const guardado = await abrirDb()
      .then((db) => db.get("referencia", clave))
      .catch(() => undefined);
    if (guardado) return guardado.valor as T;
    return { success: false, error: "Sin conexión: estos datos aún no están guardados en este dispositivo." } as unknown as T;
  }
}
