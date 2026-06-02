import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ExpedienteRspoPdfData } from "@/lib/pdf/expediente-rspo-types";

const styles = StyleSheet.create({
  page: { padding: 36, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, fontWeight: "bold", marginBottom: 4 },
  h2: { fontSize: 11, fontWeight: "bold", marginTop: 12, marginBottom: 6 },
  muted: { color: "#555", marginBottom: 8 },
  warn: { backgroundColor: "#fff8e6", padding: 6, marginBottom: 4, fontSize: 8 },
  row: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: "#ddd", paddingVertical: 3 },
  colDate: { width: "18%" },
  colCat: { width: "22%" },
  colTitle: { width: "60%" },
  footer: { marginTop: 16, fontSize: 7, color: "#666" },
});

const CAT_LABEL: Record<string, string> = {
  material_plan: "Genética/plan",
  vivero: "Vivero",
  labor: "Labores",
  nutricion: "Nutrición",
  sanidad: "Sanidad",
  suelo: "Suelo",
  cosecha: "Cosecha",
  logistica: "Despacho",
};

export function ExpedienteRspoDocument({ data }: { data: ExpedienteRspoPdfData }) {
  const { trazabilidad: tr } = data;
  const eventos = [...tr.eventos].sort(
    (a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime()
  );

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Expediente de trazabilidad RSPO</Text>
        <Text style={styles.muted}>
          {data.finca_nombre} · Lote {data.lote_codigo} · {data.area_ha} ha · Generado{" "}
          {data.fecha_generacion}
        </Text>
        <Text style={styles.muted}>
          Material: {data.material_genetico ?? "—"} · Siembra: {data.anio_siembra} · Estado:{" "}
          {data.estado_cultivo}
        </Text>
        <Text style={styles.muted}>
          La fruta procede de lote registrado en la estructura legal de la finca (verificación de
          procedencia / no deforestación según datos del sistema).
        </Text>

        {data.advertencias.length > 0 ? (
          <>
            <Text style={styles.h2}>Advertencias de completitud</Text>
            {data.advertencias.map((a, i) => (
              <Text key={i} style={styles.warn}>
                • {a.mensaje}
              </Text>
            ))}
          </>
        ) : null}

        <Text style={styles.h2}>Resumen por categoría</Text>
        {Object.entries(tr.resumen.conteoPorCategoria).map(([k, v]) => (
          <Text key={k}>
            {CAT_LABEL[k] ?? k}: {v} evento(s)
          </Text>
        ))}

        <Text style={styles.h2}>Línea de vida (cronológica)</Text>
        <View style={styles.row}>
          <Text style={[styles.colDate, { fontWeight: "bold" }]}>Fecha</Text>
          <Text style={[styles.colCat, { fontWeight: "bold" }]}>Área</Text>
          <Text style={[styles.colTitle, { fontWeight: "bold" }]}>Evento</Text>
        </View>
        {eventos.slice(0, 80).map((ev) => (
          <View key={ev.id} style={styles.row}>
            <Text style={styles.colDate}>{ev.displayDate}</Text>
            <Text style={styles.colCat}>{CAT_LABEL[ev.category] ?? ev.category}</Text>
            <Text style={styles.colTitle}>
              {ev.title}
              {ev.subtitle ? ` — ${ev.subtitle}` : ""}
            </Text>
          </View>
        ))}
        {eventos.length > 80 ? (
          <Text style={styles.muted}>… y {eventos.length - 80} eventos adicionales en sistema.</Text>
        ) : null}

        <Text style={styles.footer}>
          Documento informativo generado por SIG-Palma. No sustituye firma electrónica (CU09.1).
          Los registros anulados se excluyen; cambios históricos constan en auditoría de finca (RN24).
        </Text>
      </Page>
    </Document>
  );
}
