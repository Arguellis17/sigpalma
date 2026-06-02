import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import type { RemisionPdfData } from "@/lib/pdf/remision-pdf-types";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, fontFamily: "Helvetica" },
  title: { fontSize: 16, fontWeight: "bold", marginBottom: 4 },
  subtitle: { fontSize: 9, color: "#444", marginBottom: 16 },
  section: { marginBottom: 12 },
  label: { fontSize: 8, color: "#666", textTransform: "uppercase" },
  value: { fontSize: 10, marginBottom: 6 },
  row: { flexDirection: "row", borderBottomWidth: 1, borderColor: "#ddd", paddingVertical: 4 },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderColor: "#333",
    paddingVertical: 4,
    fontWeight: "bold",
  },
  colLote: { width: "22%" },
  colFecha: { width: "18%" },
  colKg: { width: "20%", textAlign: "right" },
  colRac: { width: "18%", textAlign: "right" },
  colTon: { width: "22%", textAlign: "right" },
  footer: { marginTop: 20, fontSize: 8, color: "#555" },
  totalBox: { marginTop: 8, padding: 8, backgroundColor: "#f5f5f5" },
});

function fmtKg(n: number) {
  return n.toLocaleString("es-CO", { maximumFractionDigits: 3 });
}

export function RemisionDespachoDocument({ data }: { data: RemisionPdfData }) {
  const ton = data.peso_total_kg / 1000;
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Remisión de despacho — RFF</Text>
        <Text style={styles.subtitle}>
          SIG-Palma · {data.finca_nombre} · {data.numero_remision}
        </Text>

        <View style={styles.section}>
          <Text style={styles.label}>Fecha y hora de salida</Text>
          <Text style={styles.value}>
            {data.fecha_despacho} · {data.hora_salida}
          </Text>
          <Text style={styles.label}>Vehículo / conductor</Text>
          <Text style={styles.value}>
            Placa {data.placa_vehiculo} · Doc. {data.conductor_identificacion}
            {data.conductor_nombre ? ` · ${data.conductor_nombre}` : ""}
          </Text>
          {data.destino ? (
            <>
              <Text style={styles.label}>Destino</Text>
              <Text style={styles.value}>{data.destino}</Text>
            </>
          ) : null}
          {data.latitud != null && data.longitud != null ? (
            <>
              <Text style={styles.label}>GPS salida</Text>
              <Text style={styles.value}>
                {data.latitud.toFixed(6)}, {data.longitud.toFixed(6)}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.headerRow}>
            <Text style={styles.colLote}>Lote</Text>
            <Text style={styles.colFecha}>Fecha cosecha</Text>
            <Text style={styles.colKg}>Peso (kg)</Text>
            <Text style={styles.colRac}>Racimos</Text>
            <Text style={styles.colTon}>Ton</Text>
          </View>
          {data.lineas.map((l, i) => (
            <View key={i} style={styles.row}>
              <Text style={styles.colLote}>{l.lote_codigo}</Text>
              <Text style={styles.colFecha}>{l.fecha_cosecha}</Text>
              <Text style={styles.colKg}>{fmtKg(l.peso_kg)}</Text>
              <Text style={styles.colRac}>{l.conteo_racimos}</Text>
              <Text style={styles.colTon}>{fmtKg(l.peso_kg / 1000)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totalBox}>
          <Text>
            Total: {fmtKg(data.peso_total_kg)} kg ({ton.toLocaleString("es-CO", { maximumFractionDigits: 3 })}{" "}
            t) · {data.total_racimos} racimos
          </Text>
        </View>

        <Text style={styles.footer}>
          Documento de trazabilidad RSPO. La fruta declarada proviene de lotes registrados en la finca.
          No modifique este registro una vez emitida la remisión.
        </Text>
      </Page>
    </Document>
  );
}
