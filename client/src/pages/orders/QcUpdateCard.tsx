import { useState } from 'react';
import {
  Alert,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SaveOutlined from '@mui/icons-material/SaveOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import type { OrderDetail } from '../../api/orders';
import {
  QUALITY_LABEL,
  SOURCING_LABEL,
  useSaveQcUpdate,
  type QcUpdateInput,
  type QualityStatus,
  type SourcingStatus,
} from '../../api/qc';
import { fieldErrors, formError } from '../../lib/formErrors';
import { formatDate } from '../../lib/format';
import { useToast } from '../../components/useToast';

type WorkingStatus = 'ONGOING' | 'WAITING' | 'ON_HOLD';
const STATUS_OPTIONS: { value: WorkingStatus; label: string }[] = [
  { value: 'ONGOING', label: 'Ongoing' },
  { value: 'WAITING', label: 'Waiting (materials)' },
  { value: 'ON_HOLD', label: 'On Hold' },
];

/** QC records sourcing, timeline and quality, then marks the order ready for Packaging. */
export default function QcUpdateCard({ detail }: { detail: OrderDetail }) {
  const { order, qcUpdates } = detail;
  const last = qcUpdates[0];
  const [values, setValues] = useState({
    qcStatus: (last && last.qcStatus !== 'READY' ? last.qcStatus : 'ONGOING') as WorkingStatus,
    sourcingStatus: (last?.sourcingStatus ?? 'NOT_STARTED') as SourcingStatus,
    expectedReadyDate: order.expectedReadyDate ?? '',
    processingTimeline: last?.processingTimeline ?? '',
    qualityCheckStatus: (last?.qualityCheckStatus ?? 'NOT_STARTED') as QualityStatus,
    qualityCheckResult: last?.qualityCheckResult ?? '',
    dateChangeReason: '',
    remarks: '',
  });
  const [confirmReady, setConfirmReady] = useState(false);
  const save = useSaveQcUpdate(order.id);
  const toast = useToast();
  const errors = fieldErrors(save.error);
  const general = formError(save.error);

  const dateChanged = !!order.expectedReadyDate && values.expectedReadyDate !== order.expectedReadyDate;
  const canMarkReady = values.sourcingStatus === 'SOURCED' && values.qualityCheckStatus === 'PASSED';
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues({ ...values, [k]: e.target.value });

  function submit(ready: boolean) {
    const body: QcUpdateInput = {
      qcStatus: ready ? 'READY' : values.qcStatus,
      sourcingStatus: values.sourcingStatus,
      expectedReadyDate: values.expectedReadyDate || null,
      processingTimeline: values.processingTimeline.trim() || null,
      qualityCheckStatus: values.qualityCheckStatus,
      qualityCheckResult: values.qualityCheckResult.trim() || null,
      dateChangeReason: dateChanged ? values.dateChangeReason.trim() || null : null,
      remarks: values.remarks.trim() || null,
    };
    save.mutate(body, {
      onSuccess: () => {
        setConfirmReady(false);
        setValues((v) => ({ ...v, dateChangeReason: '', remarks: '' }));
        toast(ready ? 'Marked ready. Order sent to Packaging.' : 'QC update saved');
      },
      onError: () => setConfirmReady(false),
    });
  }

  return (
    <Card sx={{ border: '2px solid', borderColor: 'primary.main' }}>
      <CardContent>
        <Typography variant="subtitle1">QC / Production update</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Each save is kept in the QC history.
        </Typography>

        {general && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {general}
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid size={12}>
            <TextField select label="QC status" value={values.qcStatus} onChange={set('qcStatus')} error={!!errors.qcStatus} helperText={errors.qcStatus}>
              {STATUS_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField select label="Material sourcing" value={values.sourcingStatus} onChange={set('sourcingStatus')} error={!!errors.sourcingStatus} helperText={errors.sourcingStatus}>
              {(Object.keys(SOURCING_LABEL) as SourcingStatus[]).map((k) => (
                <MenuItem key={k} value={k}>
                  {SOURCING_LABEL[k]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField
              label="Expected ready date"
              type="date"
              value={values.expectedReadyDate}
              onChange={set('expectedReadyDate')}
              error={!!errors.expectedReadyDate}
              helperText={errors.expectedReadyDate ?? (order.expectedReadyDate ? `Currently ${formatDate(order.expectedReadyDate)}` : undefined)}
            />
          </Grid>
          {dateChanged && (
            <Grid size={12}>
              <TextField
                label="Reason for date change"
                required
                multiline
                minRows={2}
                value={values.dateChangeReason}
                onChange={set('dateChangeReason')}
                error={!!errors.dateChangeReason}
                helperText={errors.dateChangeReason ?? 'Shown to Sales and MD in the order history'}
              />
            </Grid>
          )}
          <Grid size={12}>
            <TextField label="Processing timeline" value={values.processingTimeline} onChange={set('processingTimeline')} placeholder="e.g. 10 working days" />
          </Grid>
          <Grid size={12}>
            <TextField select label="Quality check" value={values.qualityCheckStatus} onChange={set('qualityCheckStatus')} error={!!errors.qualityCheckStatus} helperText={errors.qualityCheckStatus}>
              {(Object.keys(QUALITY_LABEL) as QualityStatus[]).map((k) => (
                <MenuItem key={k} value={k}>
                  {QUALITY_LABEL[k]}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={12}>
            <TextField
              label="Quality check result"
              multiline
              minRows={2}
              value={values.qualityCheckResult}
              onChange={set('qualityCheckResult')}
              error={!!errors.qualityCheckResult}
              helperText={errors.qualityCheckResult ?? 'Moisture, fat %, grade, etc.'}
            />
          </Grid>
          <Grid size={12}>
            <TextField
              label="Remarks"
              multiline
              minRows={2}
              value={values.remarks}
              onChange={set('remarks')}
              error={!!errors.remarks}
              helperText={errors.remarks ?? (values.qcStatus === 'ON_HOLD' ? 'Required: why is it on hold?' : undefined)}
            />
          </Grid>
        </Grid>

        <Stack spacing={1.25} sx={{ mt: 2.5 }}>
          <Button variant="outlined" startIcon={<SaveOutlined />} onClick={() => submit(false)} loading={save.isPending && !confirmReady} disabled={save.isPending} sx={{ minHeight: 38 }}>
            Save update
          </Button>
          <Button
            variant="contained"
            startIcon={<Inventory2Outlined />}
            onClick={() => setConfirmReady(true)}
            disabled={!canMarkReady || save.isPending}
            sx={{ minHeight: 38 }}
          >
            Mark ready for packaging
          </Button>
          {!canMarkReady && (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Needs materials Sourced and quality check Passed.
            </Typography>
          )}
        </Stack>
      </CardContent>

      <Dialog open={confirmReady} onClose={() => setConfirmReady(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Send to Packaging?</DialogTitle>
        <DialogContent>
          <Typography>
            QC is complete for {order.orderNo}. The order moves to Packaging and QC can no longer change it. You can still upload
            container and loading images later.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setConfirmReady(false)}>
            Cancel
          </Button>
          <Button variant="contained" loading={save.isPending} onClick={() => submit(true)}>
            Yes, mark ready
          </Button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}
