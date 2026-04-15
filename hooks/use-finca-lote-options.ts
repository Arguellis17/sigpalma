"use client";

import { useEffect, useMemo, useState } from "react";
import { getLotesPorFinca } from "@/app/actions/queries";

type FincaMini = { id: string };

export function useFincaLoteOptions(
  fincas: FincaMini[],
  defaultFincaId?: string | null
) {
  const initial = useMemo(() => {
    if (fincas.length === 0) return "";
    if (
      defaultFincaId &&
      fincas.some((f) => f.id === defaultFincaId)
    ) {
      return defaultFincaId;
    }
    return fincas[0]?.id ?? "";
  }, [fincas, defaultFincaId]);

  const [fincaId, setFincaId] = useState(initial);
  const [lotes, setLotes] = useState<{ id: string; codigo: string }[]>([]);
  const [loteId, setLoteId] = useState("");
  const [loadingLotes, setLoadingLotes] = useState(false);

  useEffect(() => {
    if (!fincaId) {
      return;
    }
    let cancelled = false;
    // Loading flag for the async fetch; setting here avoids stale "Cargando" when finca changes.
    queueMicrotask(() => {
      if (!cancelled) setLoadingLotes(true);
    });
    void getLotesPorFinca(fincaId).then((res) => {
      if (cancelled) return;
      setLoadingLotes(false);
      if (res.success) {
        setLotes(res.data);
        setLoteId(res.data[0]?.id ?? "");
      } else {
        setLotes([]);
        setLoteId("");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [fincaId]);

  const displayLotes = fincaId ? lotes : [];
  const displayLoteId = fincaId ? loteId : "";

  return {
    fincaId,
    setFincaId,
    loteId: displayLoteId,
    setLoteId,
    lotes: displayLotes,
    loadingLotes,
  };
}
