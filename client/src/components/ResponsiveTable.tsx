/** A table on desktop; on phones each row becomes a stacked block (title + amount on top, labelled fields below).
 *  Drop-in for <TableContainer> inside an existing <Card>. */
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router';
import {
  Box,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  useMediaQuery,
  useTheme,
  type SxProps,
} from '@mui/material';

/** Order number link with the PI number under it. Used in most order tables. */
export function OrderLink({ id, no, pi, link = true }: { id: number; no: ReactNode; pi?: ReactNode; link?: boolean }) {
  return (
    <>
      <Typography
        component={link ? RouterLink : 'span'}
        to={`/orders/${id}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
        sx={{ fontWeight: 600, fontSize: 14, color: link ? 'primary.dark' : 'text.primary', whiteSpace: 'nowrap' }}
      >
        {no}
      </Typography>
      {pi && <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 400 }}>{pi}</Typography>}
    </>
  );
}

export type Column<T> = {
  label: string;
  render: (row: T) => ReactNode;
  align?: 'left' | 'right' | 'center';
  nowrap?: boolean;
  cellSx?: SxProps;
  /**
   * Where the column goes on phones:
   * title = top left (main identifier), end = top right (amount / time), sub = under the title,
   * field = label + value in a two-column grid (default), full = label + value across the width (long text), hide = not shown.
   */
  mobile?: 'title' | 'end' | 'sub' | 'field' | 'full' | 'hide';
  /** Phones: hide the small label above the value (e.g. for a button). */
  hideMobileLabel?: boolean;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  /** Desktop table min width; narrower screens scroll the table sideways. */
  minWidth?: number;
  onRowClick?: (row: T) => void;
  ariaLabel?: string;
  /** Desktop only: extra row styles, e.g. highlight. */
  rowSx?: (row: T) => SxProps | undefined;
  size?: 'small' | 'medium';
};

export default function ResponsiveTable<T>({ columns, rows, rowKey, loading, minWidth, onRowClick, ariaLabel, rowSx, size }: Props<T>) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'), { noSsr: true });

  if (!isDesktop) {
    const pick = (m: Column<T>['mobile']) => columns.filter((c) => (c.mobile ?? 'field') === m);
    const [titles, ends, subs, fields, fulls] = [pick('title'), pick('end'), pick('sub'), pick('field'), pick('full')];
    return (
      <Box role="list" aria-label={ariaLabel}>
        {loading &&
          Array.from({ length: 3 }).map((_, i) => (
            <Box key={i} sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Skeleton width="50%" />
              <Skeleton width="80%" />
            </Box>
          ))}
        {rows.map((row) => (
          <Box
            key={rowKey(row)}
            role="listitem"
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            sx={{
              px: 2,
              py: 1.75,
              borderBottom: '1px solid',
              borderColor: 'divider',
              '&:last-of-type': { borderBottom: 0 },
              cursor: onRowClick ? 'pointer' : undefined,
              '&:active': onRowClick ? { bgcolor: '#FAF7FC' } : undefined,
            }}
          >
            {(titles.length > 0 || ends.length > 0) && (
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5 }}>
                <Box sx={{ minWidth: 0, fontWeight: 600, wordBreak: 'break-word' }}>
                  {titles.map((c) => <Box key={c.label}>{c.render(row)}</Box>)}
                </Box>
                {ends.length > 0 && (
                  <Box sx={{ textAlign: 'right', flexShrink: 0, fontWeight: 600 }}>
                    {ends.map((c) => <Box key={c.label}>{c.render(row)}</Box>)}
                  </Box>
                )}
              </Stack>
            )}
            {subs.map((c) => (
              <Box key={c.label} sx={{ color: 'text.secondary', fontSize: 13, mt: 0.25, wordBreak: 'break-word' }}>{c.render(row)}</Box>
            ))}
            {fields.length > 0 && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, minmax(0, 1fr))' }, columnGap: 2, rowGap: 1, mt: 1.25 }}>
                {fields.map((c) => (
                  <Box key={c.label} sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.3 }}>{c.label}</Typography>
                    <Box sx={{ fontSize: 13.5, wordBreak: 'break-word' }}>{c.render(row)}</Box>
                  </Box>
                ))}
              </Box>
            )}
            {fulls.map((c) => (
              <Box key={c.label} sx={{ mt: 1.25 }}>
                {!c.hideMobileLabel && <Typography sx={{ fontSize: 11.5, color: 'text.secondary', lineHeight: 1.3 }}>{c.label}</Typography>}
                <Box sx={{ fontSize: 13.5, wordBreak: 'break-word' }}>{c.render(row)}</Box>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <TableContainer>
      <Table size={size} sx={{ minWidth }} aria-label={ariaLabel}>
        <TableHead>
          <TableRow>
            {columns.map((c) => (
              <TableCell key={c.label} align={c.align}>{c.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {loading &&
            Array.from({ length: 5 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell colSpan={columns.length}><Skeleton height={32} /></TableCell>
              </TableRow>
            ))}
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              hover
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              sx={{ cursor: onRowClick ? 'pointer' : undefined, ...(rowSx?.(row) as object) }}
            >
              {columns.map((c) => (
                <TableCell key={c.label} align={c.align} sx={{ ...(c.nowrap ? { whiteSpace: 'nowrap' } : {}), ...(c.cellSx as object) }}>
                  {c.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
