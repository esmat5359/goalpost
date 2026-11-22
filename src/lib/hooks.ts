import { useEffect, useRef, useState } from 'react';

import { invalidateReads } from './chain';

export interface AsyncState<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Load data and optionally refresh it on an interval. A failed refresh keeps the last good
 * data on screen and only surfaces the error, so a flaky RPC never blanks a page.
 */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[], refreshMs = 0): AsyncState<T> {
  const [state, setState] = useState<{ data: T | null; error: string | null; loading: boolean }>({
    data: null,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const loader = useRef(load);
  loader.current = load;

  useEffect(() => {
    let cancelled = false;
    const run = async (first: boolean): Promise<void> => {
      if (first) setState((previous) => ({ ...previous, loading: true }));
      try {
        const data = await loader.current();
        if (!cancelled) setState({ data, error: null, loading: false });
      } catch (error) {
        if (!cancelled) {
          const message = error instanceof Error ? error.message : String(error);
          setState((previous) => ({ data: previous.data, error: message, loading: false }));
        }
      }
    };
    void run(true);
    // A hidden tab does not poll (it only costs the public RPC its rate limit); it refreshes once
    // when the tab comes back if a refresh was skipped.
    let skipped = false;
    const tick = (): void => {
      if (document.hidden) {
        skipped = true;
        return;
      }
      void run(false);
    };
    const timer = refreshMs > 0 ? window.setInterval(tick, refreshMs) : null;
    const onVisible = (): void => {
      if (!document.hidden && skipped) {
        skipped = false;
        void run(false);
      }
    };
    if (refreshMs > 0) document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, refreshMs]);

  return {
    ...state,
    reload: () => {
      invalidateReads();
      setNonce((value) => value + 1);
    },
  };
}

/** A value that follows `value` after it has stopped changing for `delayMs`. */
export function useDebounced<T>(value: T, delayMs: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return settled;
}

export function useDocumentTitle(title: string): void {
  useEffect(() => {
    const previous = document.title;
    document.title = title ? `${title} - Goalpost` : 'Goalpost - did the promise keep its meaning?';
    return () => {
      document.title = previous;
    };
  }, [title]);
}
