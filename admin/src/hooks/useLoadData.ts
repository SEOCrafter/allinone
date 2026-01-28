import { useEffect, useRef, useState, useCallback } from 'react';

export function useLoadData<T>(
  loadFn: (signal: AbortSignal) => Promise<T>,
  defaultValue: T
): { data: T; loading: boolean; refresh: () => void } {
  const [data, setData] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const loadedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const load = useCallback(async (signal: AbortSignal) => {
    try {
      const result = await loadFn(signal);
      if (!signal.aborted) {
        setData(result);
      }
    } catch (e) {
      if ((e as Error).name === 'CanceledError' || signal.aborted) return;
      console.error('Load error:', e);
    } finally {
      if (!signal.aborted) {
        setLoading(false);
      }
    }
  }, [loadFn]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;

    abortRef.current = new AbortController();
    load(abortRef.current.signal);

    return () => {
      abortRef.current?.abort();
      loadedRef.current = false;
    };
  }, [load]);

  const refresh = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoading(true);
    load(abortRef.current.signal);
  }, [load]);

  return { data, loading, refresh };
}