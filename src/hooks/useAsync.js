import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Generic async-loader hook giving components a consistent
 * loading / error / empty / success state shape.
 *
 * When `initialData` is provided the hook starts with that data immediately
 * and does not show a loading spinner on first render, enabling instant
 * display of cached / stale content while the fresh fetch runs in background.
 *
 * On error the hook preserves the last good `data` value so the UI never
 * goes blank because of a transient network failure.
 */
export function useAsync(asyncFn, deps = [], initialData = null) {
  const hasInitial = initialData !== null;
  const [state, setState] = useState({
    data: initialData,
    loading: !hasInitial,
    error: null,
  });
  const mounted = useRef(true);

  const run = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await asyncFn();
      if (mounted.current) setState({ data, loading: false, error: null });
    } catch (error) {
      // Keep the last good data so the UI doesn't go blank on a transient error
      if (mounted.current) setState((s) => ({ ...s, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(() => {
    mounted.current = true;
    run();
    return () => {
      mounted.current = false;
    };
  }, [run]);

  return { ...state, reload: run };
}
