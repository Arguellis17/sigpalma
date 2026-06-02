export type RemisionPdfLinea = {
  lote_codigo: string;
  fecha_cosecha: string;
  peso_kg: number;
  conteo_racimos: number;
};

export type RemisionPdfData = {
  numero_remision: string;
  finca_nombre: string;
  fecha_despacho: string;
  hora_salida: string;
  placa_vehiculo: string;
  conductor_identificacion: string;
  conductor_nombre: string | null;
  peso_total_kg: number;
  total_racimos: number;
  destino: string | null;
  latitud: number | null;
  longitud: number | null;
  lineas: RemisionPdfLinea[];
};
