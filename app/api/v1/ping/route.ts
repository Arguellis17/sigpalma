/** Comprobación real de conectividad para la cola offline (navigator.onLine no basta). */
export function GET() {
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
