import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { RemisionDespachoDocument } from "@/lib/pdf/remision-despacho-document";
import type { RemisionPdfData } from "@/lib/pdf/remision-pdf-types";

/** Solo servidor (Node). No importar desde Client Components. */
export async function renderRemisionPdfBuffer(data: RemisionPdfData): Promise<Buffer> {
  const element = createElement(RemisionDespachoDocument, { data });
  const buf = await renderToBuffer(element as ReactElement<DocumentProps>);
  return Buffer.from(buf);
}
