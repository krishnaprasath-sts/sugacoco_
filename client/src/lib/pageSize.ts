import { useSyncExternalStore } from 'react';

/** "Show N entries" choice, shared by every list and remembered in this browser. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
const KEY = 'sugacoco.pageSize';
const DEFAULT = 10;

function read(): number {
  try {
    const v = Number(localStorage.getItem(KEY));
    return (PAGE_SIZE_OPTIONS as readonly number[]).includes(v) ? v : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

let current = read();
const listeners = new Set<() => void>();

export function setPageSize(size: number) {
  current = size;
  try {
    localStorage.setItem(KEY, String(size));
  } catch {
    /* storage blocked: keep it for this visit only */
  }
  listeners.forEach((l) => l());
}

export function usePageSize(): [number, (size: number) => void] {
  const size = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
  );
  return [size, setPageSize];
}
