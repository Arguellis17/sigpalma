"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getLotesPorFinca } from "@/app/actions/queries";

type FincaMini = { id: string };
type LoteMini = { id: string; codigo: string };

export function useFincaLoteOptions(
  fincas: FincaMini[],
  defaultFincaId?: string | null,
  initialLotes?: LoteMini[]
) {
  const initial = useMemo(() => {
    if (fincas.length === 0) return "";
    if (defaultFincaId && fincas.some((f) => f.id === defaultFincaId)) {
      return defaultFincaId;
    }
    return fincas[0]?.id ?? "";
  }, [fincas, defaultFincaId]);

  const prefetchedFincaId = useRef<string | null>(
    initialLotes?.length && defaultFincaId ? defaultFincaId : null
  );

  const [fincaId, setFincaId] = useState(initial);
  const [lotes, setLotes] = useState<LoteMini[]>(initialLotes ?? []);
  const [loteId, setLoteId] = useState(() => initialLotes?.[0]?.id ?? "");
  const [loadingLotes, setLoadingLotes] = useState(
    () => !(initialLotes?.length && defaultFincaId)
  );

  useEffect(() => {
    if (!fincaId) {
      return;
    }

    if (prefetchedFincaId.current === fincaId && initialLotes?.length) {
      setLotes(initialLotes);
      setLoteId((prev) =>
        initialLotes.some((l) => l.id === prev) ? prev : (initialLotes[0]?.id ?? "")
      );
      setLoadingLotes(false);
      return;
    }

    let cancelled = false;
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
  }, [fincaId, initialLotes]);

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
