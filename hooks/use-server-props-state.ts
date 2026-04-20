"use client";

import { useEffect, useState, type Dispatch, type SetStateAction } from "react";

/**
 * Mirrors server-passed props into React state and reapplies when the server
 * sends new data (e.g. after router.refresh()), so tables/lists update without
 * a manual tab refresh.
 */
export function useServerPropsState<T>(serverValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [state, setState] = useState(serverValue);
  useEffect(() => {
    setState(serverValue);
  }, [serverValue]);
  return [state, setState];
}
