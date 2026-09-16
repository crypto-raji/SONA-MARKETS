import { useEffect, useRef } from 'react';

/**
 * Calls `fn` every `delayMs` milliseconds.
 * Pass `null` for delayMs to pause the interval.
 */
export function useInterval(fn, delayMs) {
  const savedFn = useRef(fn);
  useEffect(() => { savedFn.current = fn; }, [fn]);

  useEffect(() => {
    if (delayMs == null) return;
    const id = setInterval(() => savedFn.current(), delayMs);
    return () => clearInterval(id);
  }, [delayMs]);
}
