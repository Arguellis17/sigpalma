import { NextResponse } from "next/server";
import { buildReporteProductividadPayload } from "@/app/actions/reportes-productividad";
import { buildProductividadWorkbook } from "@/lib/excel/productividad-workbook";
import { parseReporteProductividadQuery } from "@/lib/validations/productividad";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** HU01: export Excel de productividad (t/ha) con gráficos nativos. */
export async function GET(req: Request) {
  const parsed = parseReporteProductividadQuery(new URL(req.url));
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues.map((i) => i.message).join("; ") },
      { status: 400 }
    );
  }

  const built = await buildReporteProductividadPayload(parsed.data, {
    auditAction: "reporte.productividad_exportar",
    auditTitulo: "Exportación Excel reporte de productividad",
    formato: "xlsx",
  });
  if (!built.success) {
    return NextResponse.json({ error: built.error }, { status: 403 });
  }

  try {
    const buf = await buildProductividadWorkbook(built.data);
    const slug = built.data.finca_nombre.replace(/[^\w\-]+/g, "-").slice(0, 40);
    const filename = `productividad-${slug}-${built.data.fecha_desde}_${built.data.fecha_hasta}.xlsx`;
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[productividad-xlsx]", e);
    return NextResponse.json(
      { error: "No se pudo generar el Excel de productividad." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
