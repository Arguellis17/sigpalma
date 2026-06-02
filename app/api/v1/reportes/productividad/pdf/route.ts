import { NextResponse } from "next/server";
import { buildReporteProductividadPayload } from "@/app/actions/reportes-productividad";
import { renderProductividadPdfBuffer } from "@/lib/pdf/render-productividad-pdf";
import { reporteProductividadSchema } from "@/lib/validations/productividad";

/** HU08 CU08.1: export PDF de productividad RFF. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const loteIdsRaw = url.searchParams.get("lote_ids");
  const lote_ids = loteIdsRaw
    ? loteIdsRaw.split(",").map((s) => s.trim()).filter(Boolean)
    : undefined;

  const parsed = reporteProductividadSchema.safeParse({
    finca_id: url.searchParams.get("finca_id"),
    fecha_desde: url.searchParams.get("fecha_desde"),
    fecha_hasta: url.searchParams.get("fecha_hasta"),
    lote_ids,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const built = await buildReporteProductividadPayload(parsed.data, {
    auditAction: "reporte.productividad_exportar",
    auditTitulo: "Exportación PDF reporte de productividad",
  });

  if (!built.success) {
    return NextResponse.json({ error: built.error }, { status: 403 });
  }

  try {
    const buf = await renderProductividadPdfBuffer({
      ...built.data,
      generado_en: new Date().toISOString(),
    });
    const slug = built.data.finca_nombre.replace(/[^\w\-]+/g, "-").slice(0, 40);
    const filename = `productividad-${slug}-${built.data.fecha_desde}_${built.data.fecha_hasta}.pdf`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[productividad-pdf]", e);
    return NextResponse.json(
      { error: "No se pudo generar el PDF de productividad." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
