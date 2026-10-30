/** Small dependency-free charts for dashboards: a donut with legend and a horizontal bar list. */
import { useState } from 'react';
import { Box, Skeleton, Stack, Tooltip, Typography } from '@mui/material';

/** Fixed categorical order (validated palette). Assign by position, never cycle. */
export const SERIES = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#6250d6'];

export type Slice = { label: string; value: number; color: string };

/** Donut with the total in the middle and a legend listing every slice with its count and share. */
export function DonutChart({ data, loading, centerLabel = 'Total' }: { data: Slice[]; loading?: boolean; centerLabel?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const total = data.reduce((n, d) => n + d.value, 0);
  const size = 180;
  const r = 70;
  const stroke = 24;
  const C = 2 * Math.PI * r;
  const gap = data.filter((d) => d.value > 0).length > 1 ? 2 : 0; // 2px surface gap between segments

  if (loading) return <Skeleton variant="circular" width={size} height={size} sx={{ mx: 'auto' }} />;

  let offset = 0;
  const active = hover !== null ? data[hover] : null;
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ alignItems: 'center' }}>
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(', ')}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F1F0F6" strokeWidth={stroke} />
          {total > 0 &&
            data.map((d, i) => {
              const len = (d.value / total) * C;
              const dash = Math.max(0, len - gap);
              const el = d.value > 0 && (
                <circle
                  key={d.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={hover === i ? stroke + 4 : stroke}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  style={{ cursor: 'pointer', transition: 'stroke-width 120ms ease', opacity: hover === null || hover === i ? 1 : 0.45 }}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              );
              offset += len;
              return el;
            })}
        </svg>
        <Box sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', pointerEvents: 'none' }}>
          <Box>
            <Typography sx={{ fontSize: 26, fontWeight: 800, lineHeight: 1.1 }}>{active ? active.value : total}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 100 }}>{active ? active.label : centerLabel}</Typography>
          </Box>
        </Box>
      </Box>
      <Stack spacing={1} sx={{ flex: 1, width: '100%' }}>
        {data.map((d, i) => (
          <Stack
            key={d.label}
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'center', px: 1, py: 0.5, borderRadius: 1, bgcolor: hover === i ? '#F6F4FA' : 'transparent', cursor: 'default' }}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <Box sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: d.color, flexShrink: 0 }} />
            <Typography sx={{ flex: 1 }}>{d.label}</Typography>
            <Typography sx={{ fontWeight: 700 }}>{d.value}</Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', width: 40, textAlign: 'right' }}>
              {total ? Math.round((d.value / total) * 100) : 0}%
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

export type Bar = { label: string; value: number; display?: string; hint?: string };

/** Horizontal single-series bars, value labelled at the end. Hover shows the hint. */
export function BarList({ data, loading, color = '#6B2170' }: { data: Bar[]; loading?: boolean; color?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  if (loading) return <Stack spacing={1.5}>{data.map((d) => <Skeleton key={d.label} height={28} />)}</Stack>;
  return (
    <Stack spacing={1.5}>
      {data.map((d) => (
        <Tooltip key={d.label} title={d.hint ?? ''} placement="top" disableHoverListener={!d.hint} arrow>
          <Box sx={{ '&:hover .bar': { filter: 'brightness(1.12)' } }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', mb: 0.5, gap: 1 }}>
              <Typography variant="body2">{d.label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{d.display ?? d.value}</Typography>
            </Stack>
            <Box sx={{ height: 12, borderRadius: '6px', bgcolor: '#F1F0F6', overflow: 'hidden' }} role="img" aria-label={`${d.label}: ${d.display ?? d.value}`}>
              <Box className="bar" sx={{ height: '100%', width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 6 : 0, bgcolor: color, borderRadius: '0 4px 4px 0', transition: 'width 300ms ease' }} />
            </Box>
          </Box>
        </Tooltip>
      ))}
    </Stack>
  );
}
