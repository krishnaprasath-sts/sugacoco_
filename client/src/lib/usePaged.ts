import { useEffect, useMemo, useRef } from 'react';
import { usePageSize } from './pageSize';
import { useUrlState } from './useUrlState';

/** Runs `fn` only when `value` really changes, not on first render (so a page restored from the URL is kept). */
export function useOnChange(value: unknown, fn: () => void) {
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    fn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
}

/**
 * Browser-side paging for lists the API returns in full (department work queues).
 * The page number lives in the URL (?page=2), so opening an order and pressing Back returns to the same page.
 * Page size: the shared "Show N entries" choice, unless a fixed size is given.
 * Goes back to page 1 when `resetKey` or the page size changes.
 * `urlKey`: use a different name when one screen has more than one paged list.
 */
export function usePaged<T>(items: T[] | undefined, fixedSize?: number, resetKey: unknown = null, urlKey = 'page') {
  const [chosen] = usePageSize();
  const pageSize = fixedSize ?? chosen;
  const [raw, setRaw] = useUrlState(urlKey, '1');
  const page = Math.max(1, Number(raw) || 1);
  const setPage = (p: number) => setRaw(String(p));
  const list = useMemo(() => items ?? [], [items]);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));

  useOnChange(`${String(resetKey)}|${pageSize}`, () => setRaw('1'));
  // If the list shrinks (an order moved on), don't stay on an empty page. Skip while loading (empty list).
  useEffect(() => {
    if (list.length && page > pages) setRaw(String(pages));
  }, [list.length, page, pages, setRaw]);

  const shown = Math.min(page, pages);
  const pageItems = useMemo(() => list.slice((shown - 1) * pageSize, shown * pageSize), [list, shown, pageSize]);
  return { pageItems, page: shown, setPage, total: list.length, pageSize };
}
