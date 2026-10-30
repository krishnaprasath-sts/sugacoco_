import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * A value kept in the page URL (?key=value), so search text, filters and page number
 * survive opening an order and pressing Back.
 */
export function useUrlState(key: string, fallback = ''): [string, (value: string, opts?: { resetPage?: boolean }) => void] {
  const [params, setParams] = useSearchParams();
  const value = params.get(key) ?? fallback;
  const set = useCallback(
    (next: string, opts: { resetPage?: boolean } = {}) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next === fallback || next === '') p.delete(key);
          else p.set(key, next);
          if (opts.resetPage) p.delete('page');
          return p;
        },
        { replace: true },
      );
    },
    [key, fallback, setParams],
  );
  return [value, set];
}

/** Page number in the URL (?page=2). */
export function useUrlPage(): [number, (page: number) => void] {
  const [raw, set] = useUrlState('page', '1');
  const page = Math.max(1, Number(raw) || 1);
  return [page, (p: number) => set(String(p))];
}
