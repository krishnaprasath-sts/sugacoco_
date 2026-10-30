import { useEffect, useMemo, useState } from 'react';
import { usePageSize } from './pageSize';

/**
 * Browser-side paging for lists the API returns in full (department work queues).
 * Page size: the shared "Show N entries" choice, unless a fixed size is given.
 * Goes back to page 1 when `resetKey` or the page size changes.
 */
export function usePaged<T>(items: T[] | undefined, fixedSize?: number, resetKey: unknown = null) {
  const [chosen] = usePageSize();
  const pageSize = fixedSize ?? chosen;
  const [page, setPage] = useState(1);
  const list = useMemo(() => items ?? [], [items]);
  const pages = Math.max(1, Math.ceil(list.length / pageSize));

  useEffect(() => setPage(1), [resetKey, pageSize]);
  // If the list shrinks (an order moved on), don't stay on an empty page.
  useEffect(() => {
    if (page > pages) setPage(pages);
  }, [page, pages]);

  const pageItems = useMemo(() => list.slice((page - 1) * pageSize, page * pageSize), [list, page, pageSize]);
  return { pageItems, page, setPage, total: list.length, pageSize };
}
