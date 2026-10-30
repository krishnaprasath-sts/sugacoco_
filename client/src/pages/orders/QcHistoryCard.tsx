import { Box, Card, CardContent, Chip, Stack, Typography } from '@mui/material';
import { QUALITY_LABEL, SOURCING_LABEL, type QcUpdate } from '../../api/qc';
import { QC_STATUS_LABEL } from '../../workflow/statuses';
import { formatDate, formatDateTime } from '../../lib/format';

const QC_CHIP = { ONGOING: 'info', WAITING: 'warning', ON_HOLD: 'warning', READY: 'success' } as const;

/** Every QC save, newest first. Visible to all roles (no pricing). */
export default function QcHistoryCard({ updates }: { updates: QcUpdate[] }) {
  if (!updates.length) return null;
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          QC / Production history
        </Typography>
        <Stack spacing={1.5}>
          {updates.map((u) => (
            <Box key={u.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '14px', p: 1.75 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}>
                <Chip size="small" label={QC_STATUS_LABEL[u.qcStatus]} color={QC_CHIP[u.qcStatus]} variant={u.qcStatus === 'READY' ? 'filled' : 'outlined'} />
                {u.sourcingStatus && <Chip size="small" variant="outlined" label={`Sourcing: ${SOURCING_LABEL[u.sourcingStatus]}`} />}
                {u.qualityCheckStatus && (
                  <Chip
                    size="small"
                    variant="outlined"
                    color={u.qualityCheckStatus === 'FAILED' ? 'error' : u.qualityCheckStatus === 'PASSED' ? 'success' : 'default'}
                    label={`Quality: ${QUALITY_LABEL[u.qualityCheckStatus]}`}
                  />
                )}
                <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto !important' }}>
                  {u.createdByName} · {formatDateTime(u.createdAt)}
                </Typography>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 0.5, sm: 3 }} sx={{ mt: 1 }}>
                <Typography variant="body2">
                  <Box component="span" sx={{ color: 'text.secondary' }}>Expected ready: </Box>
                  {formatDate(u.expectedReadyDate)}
                </Typography>
                {u.processingTimeline && (
                  <Typography variant="body2">
                    <Box component="span" sx={{ color: 'text.secondary' }}>Timeline: </Box>
                    {u.processingTimeline}
                  </Typography>
                )}
              </Stack>
              {u.dateChangeReason && (
                <Typography variant="body2" sx={{ mt: 0.5, color: 'warning.main' }}>
                  Date changed: {u.dateChangeReason}
                </Typography>
              )}
              {u.qualityCheckResult && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <Box component="span" sx={{ color: 'text.secondary' }}>Result: </Box>
                  {u.qualityCheckResult}
                </Typography>
              )}
              {u.remarks && (
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  <Box component="span" sx={{ color: 'text.secondary' }}>Remarks: </Box>
                  {u.remarks}
                </Typography>
              )}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}
