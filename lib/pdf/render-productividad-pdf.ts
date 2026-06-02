import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { ProductividadDocument } from "@/lib/pdf/productividad-document";
import type { ProductividadPdfData } from "@/lib/pdf/productividad-pdf-types";

/** Solo servidor (Node). No importar desde Client Components. */
export async function renderProductividadPdfBuffer(
  data: ProductividadPdfData
): Promise<Buffer> {
  const element = createElement(ProductividadDocument, { data });
  const buf = await renderToBuffer(element as ReactElement<DocumentProps>);
  return Buffer.from(buf);
}
