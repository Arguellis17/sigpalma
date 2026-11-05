import { NextResponse } from "next/server";
import { obtenerLiquidacion, registrarExportacionLiquidacion } from "@/app/actions/jornales";
import { buildLiquidacionJornalesWorkbook } from "@/lib/excel/liquidacion-jornales-workbook";

const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/** Excel de una liquidación de jornales, con los datos guardados al cerrarla. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const liq = await obtenerLiquidacion(id);
  if (!liq.success) {
    return NextResponse.json({ error: liq.error }, { status: 403 });
  }

  try {
    const buf = await buildLiquidacionJornalesWorkbook(liq.data);
    await registrarExportacionLiquidacion(id, liq.data.finca_id, liq.data.consecutivo);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": XLSX_MIME,
        "Content-Disposition": `attachment; filename="liquidacion-jornales-${liq.data.consecutivo}.xlsx"`,
        "Content-Length": String(buf.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    console.error("[jornales-xlsx]", e);
    return NextResponse.json({ error: "No se pudo generar el Excel de la liquidación." }, { status: 500 });
  }
}

export const runtime = "nodejs";
