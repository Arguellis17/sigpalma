/**
 * Compresión de fotos en el navegador antes de subirlas a Storage.
 * WebP (o JPEG si el navegador no codifica WebP, p. ej. Safari antiguo) con el encoder nativo
 * del canvas: sin dependencias. Corrige la orientación EXIF y elimina metadatos (incluido GPS del
 * archivo; la ubicación del registro se guarda aparte en la base de datos).
 */

/** Reducción mínima buscada respecto al archivo original (60 %). */
export const OBJETIVO_REDUCCION = 0.6;

export type PasoCompresion = { maxLado: number; calidad: number };

/**
 * Escalera de calidad: se detiene en el primer paso que logra el objetivo.
 * El primero ya es alta calidad para evidencia (1920 px, q 0.82); el último no baja de 1280 px.
 */
export const PASOS_COMPRESION: PasoCompresion[] = [
  { maxLado: 1920, calidad: 0.82 },
  { maxLado: 1920, calidad: 0.72 },
  { maxLado: 1600, calidad: 0.72 },
  { maxLado: 1280, calidad: 0.68 },
];

export function dimensionesObjetivo(ancho: number, alto: number, maxLado: number) {
  const escala = Math.min(1, maxLado / Math.max(ancho, alto));
  return {
    ancho: Math.max(1, Math.round(ancho * escala)),
    alto: Math.max(1, Math.round(alto * escala)),
  };
}

/**
 * Recorre los pasos hasta lograr ≥ OBJETIVO_REDUCCION. Si ninguno lo logra (foto ya optimizada),
 * devuelve el resultado más pequeño solo si pesa menos que el original; si no, null.
 */
export async function buscarMejorCompresion(
  bytesOriginal: number,
  codificar: (paso: PasoCompresion) => Promise<Blob>,
  pasos: PasoCompresion[] = PASOS_COMPRESION
): Promise<{ blob: Blob; paso: PasoCompresion } | null> {
  const limite = bytesOriginal * (1 - OBJETIVO_REDUCCION);
  let mejor: { blob: Blob; paso: PasoCompresion } | null = null;
  for (const paso of pasos) {
    const blob = await codificar(paso);
    if (!mejor || blob.size < mejor.blob.size) mejor = { blob, paso };
    if (blob.size <= limite) return { blob, paso };
  }
  return mejor && mejor.blob.size < bytesOriginal ? mejor : null;
}

export type ResultadoCompresion = {
  archivo: File;
  bytesOriginal: number;
  bytesFinal: number;
  /** 0..1 (0.87 = 87 % menos). */
  reduccion: number;
  comprimido: boolean;
};

const TIPOS_COMPRIMIBLES = /^image\/(jpeg|png|webp|bmp|avif|heic|heif)$/i;

let webpSoportado: boolean | null = null;
function navegadorCodificaWebp(): boolean {
  if (webpSoportado === null) {
    const c = document.createElement("canvas");
    c.width = c.height = 1;
    webpSoportado = c.toDataURL("image/webp").startsWith("data:image/webp");
  }
  return webpSoportado;
}

function canvasABlob(canvas: HTMLCanvasElement, tipo: string, calidad: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("No se pudo codificar la imagen."))), tipo, calidad)
  );
}

function renombrar(nombre: string, ext: string): string {
  const base = nombre.replace(/\.[^.]+$/, "") || "foto";
  return `${base}.${ext}`;
}

function sinCambios(file: File): ResultadoCompresion {
  return { archivo: file, bytesOriginal: file.size, bytesFinal: file.size, reduccion: 0, comprimido: false };
}

/** Comprime una foto para subirla. Nunca falla: ante cualquier problema devuelve el original. */
export async function comprimirImagen(file: File): Promise<ResultadoCompresion> {
  if (!TIPOS_COMPRIMIBLES.test(file.type)) return sinCambios(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return sinCambios(file); // p. ej. HEIC en navegadores que no lo decodifican
  }

  try {
    const webp = navegadorCodificaWebp();
    const tipo = webp ? "image/webp" : "image/jpeg";
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return sinCambios(file);

    const resultado = await buscarMejorCompresion(file.size, async ({ maxLado, calidad }) => {
      const { ancho, alto } = dimensionesObjetivo(bitmap.width, bitmap.height, maxLado);
      canvas.width = ancho;
      canvas.height = alto;
      if (!webp) {
        // JPEG no tiene transparencia: fondo blanco en lugar de negro para PNG con alfa.
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, ancho, alto);
      }
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(bitmap, 0, 0, ancho, alto);
      return canvasABlob(canvas, tipo, calidad);
    });

    if (!resultado) return sinCambios(file);
    const archivo = new File([resultado.blob], renombrar(file.name, webp ? "webp" : "jpg"), {
      type: tipo,
      lastModified: file.lastModified,
    });
    return {
      archivo,
      bytesOriginal: file.size,
      bytesFinal: archivo.size,
      reduccion: 1 - archivo.size / file.size,
      comprimido: true,
    };
  } catch {
    return sinCambios(file);
  } finally {
    bitmap.close();
  }
}

export function formatearBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("es-CO", { maximumFractionDigits: 1 })} MB`;
}

/** "3,2 MB → 410 KB (−87 %)" */
export function resumenCompresion(r: ResultadoCompresion): string {
  if (!r.comprimido) return `${formatearBytes(r.bytesFinal)} (sin cambios)`;
  return `${formatearBytes(r.bytesOriginal)} → ${formatearBytes(r.bytesFinal)} (−${Math.round(r.reduccion * 100)} %)`;
}
