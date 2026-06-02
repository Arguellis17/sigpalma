import { NextResponse } from "next/server";
import { getRemisionDetalle } from "@/app/actions/despacho";
import { renderRemisionPdfBuffer } from "@/lib/pdf/render-remision-pdf";

type Params = { params: Promise<{ id: string }> };

/** HU29: descarga PDF de remisión (Node runtime, @react-pdf/renderer). */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const det = await getRemisionDetalle(id);
  if (!det.success) {
    return NextResponse.json({ error: det.error }, { status: 404 });
  }

  try {
    const buf = await renderRemisionPdfBuffer(det.data);
    const filename = `${det.data.numero_remision}.pdf`;
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
    console.error("[remision-pdf]", e);
    return NextResponse.json(
      { error: "No se pudo generar el PDF de la remisión." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
