import { MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import { PAGE_SIZE_OPTIONS, usePageSize } from '../lib/pageSize';

type Props = {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** What the rows are, for the "Showing 1–25 of 132 orders" text. */
  noun?: string;
  /** Inside a card: add side padding so the text isn't on the card edge. */
  inset?: boolean;
  /** Show the "Show N entries" picker (off for small fixed lists). */
  sizeSelector?: boolean;
};

/** "Show [10] entries · Showing 1–10 of 132" + page numbers. Renders nothing for an empty list. */
export default function ListPagination({ page, pageSize, total, onChange, noun = 'items', inset = false, sizeSelector = true }: Props) {
  const [, setPageSize] = usePageSize();
  if (!total) return null;
  const pages = Math.ceil(total / pageSize);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1.5}
      sx={{ mt: inset ? 0 : 2, px: inset ? 2.5 : 0, py: inset ? 1.5 : 0, alignItems: 'center', justifyContent: 'space-between' }}
    >
      <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 1 }}>
        {sizeSelector && (
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Show
            </Typography>
            <TextField
              select
              size="small"
              fullWidth={false}
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                onChange(1);
              }}
              sx={{ width: 84, '& .MuiSelect-select': { py: '6px' } }}
              slotProps={{
                htmlInput: { 'aria-label': 'Rows per page' },
                // Sits at the page bottom: open upwards so the menu never covers the box.
                select: {
                  MenuProps: {
                    anchorOrigin: { vertical: 'top', horizontal: 'left' },
                    transformOrigin: { vertical: 'bottom', horizontal: 'left' },
                    slotProps: { paper: { sx: { mt: '-4px' } } },
                  },
                },
              }}
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <MenuItem key={n} value={n}>
                  {n}
                </MenuItem>
              ))}
            </TextField>
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              entries
            </Typography>
          </Stack>
        )}
        <Typography variant="body2" sx={{ color: 'text.secondary' }} aria-live="polite">
          Showing {from}–{to} of {total} {noun}
        </Typography>
      </Stack>
      {pages > 1 && (
        <Pagination
          count={pages}
          page={Math.min(page, pages)}
          onChange={(_, p) => {
            onChange(p);
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }}
          shape="rounded"
          color="primary"
          size="small"
        />
      )}
    </Stack>
  );
}
