import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { ProductividadPdfData } from "@/lib/pdf/productividad-pdf-types";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#444", marginBottom: 16 },
  section: { marginBottom: 12 },
  label: { fontSize: 8, color: "#666", textTransform: "uppercase" },
  value: { fontSize: 10, marginBottom: 6 },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 4,
  },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderColor: "#333",
    paddingVertical: 4,
    fontWeight: "bold",
  },
  colLote: { width: "16%" },
  colHa: { width: "12%", textAlign: "right" },
  colTon: { width: "14%", textAlign: "right" },
  colRac: { width: "14%", textAlign: "right" },
  colReg: { width: "12%", textAlign: "right" },
  colTonHa: { width: "16%", textAlign: "right" },
  totalBox: { marginTop: 12, padding: 8, backgroundColor: "#f5f5f5" },
  footer: { marginTop: 20, fontSize: 8, color: "#555" },
});

function fmt(n: number, digits = 3) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: digits });
}

export function ProductividadDocument({ data }: { data: ProductividadPdfData }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Reporte de productividad RFF</Text>
        <Text style={styles.subtitle}>
          SIG-Palma · {data.finca_nombre} · {data.fecha_desde} — {data.fecha_hasta}
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Resumen finca (RN21)</Text>
          <Text style={styles.value}>
            Total: {fmt(data.resumen.total_ton, 2)} t · Promedio ponderado:{" "}
            {fmt(data.resumen.ton_ha_ponderado)} t/ha · Registros:{" "}
            {data.resumen.total_registros}
          </Text>
        </View>

        {data.filas.length === 0 ? (
          <Text style={styles.value}>
            No hay cosechas registradas en el periodo seleccionado.
          </Text>
        ) : (
          <View style={styles.section}>
            <View style={styles.headerRow}>
              <Text style={styles.colLote}>Lote</Text>
              <Text style={styles.colHa}>Área (ha)</Text>
              <Text style={styles.colTon}>Total (t)</Text>
              <Text style={styles.colRac}>Racimos</Text>
              <Text style={styles.colReg}>Reg.</Text>
              <Text style={styles.colTonHa}>t/ha</Text>
            </View>
            {data.filas.map((f) => (
              <View key={f.lote_id} style={styles.row}>
                <Text style={styles.colLote}>{f.lote_codigo}</Text>
                <Text style={styles.colHa}>{fmt(f.area_ha, 2)}</Text>
                <Text style={styles.colTon}>{fmt(f.total_ton, 2)}</Text>
                <Text style={styles.colRac}>{f.total_racimos}</Text>
                <Text style={styles.colReg}>{f.registros}</Text>
                <Text style={styles.colTonHa}>{fmt(f.ton_ha)}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.totalBox}>
          <Text>
            Área analizada: {fmt(data.resumen.area_ha_analizada, 2)} ha · Racimos:{" "}
            {data.resumen.total_racimos.toLocaleString("es-CO")}
          </Text>
        </View>

        <Text style={styles.footer}>Generado: {data.generado_en} · HU08 RF08</Text>
      </Page>
    </Document>
  );
}
