/**
 * Precarga las lecturas de los formularios para poder usarlos sin conexión aunque nunca se hayan
 * abierto con señal. Devuelve true solo si quedaron guardadas (si no, se reintenta en la próxima carga).
 */
import { getReferenciaOffline } from "@/app/actions/referencia-offline";
import { abrirDb } from "./cola";

export async function precargarReferencia(fincaId: string, hoy: string): Promise<boolean> {
  const res = await getReferenciaOffline(fincaId, hoy);
  if (!res.success) return false;
  const db = await abrirDb();
  const tx = db.transaction("referencia", "readwrite");
  for (const [clave, valor] of Object.entries(res.data)) {
    if (valor.success) void tx.store.put({ valor, guardadoEn: Date.now() }, clave);
  }
  await tx.done;
  return true;
}
