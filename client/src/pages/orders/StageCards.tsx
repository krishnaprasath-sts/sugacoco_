/** Order-page cards for Packaging, Documentation, closure, tracking link, cancel and credit use. */
import { useState, type FormEvent, type ReactNode } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlined from '@mui/icons-material/DeleteOutlined';
import CheckCircle from '@mui/icons-material/CheckCircle';
import RadioButtonUnchecked from '@mui/icons-material/RadioButtonUnchecked';
import ContentCopyOutlined from '@mui/icons-material/ContentCopyOutlined';
import LinkOutlined from '@mui/icons-material/LinkOutlined';
import AutorenewOutlined from '@mui/icons-material/AutorenewOutlined';
import LinkOffOutlined from '@mui/icons-material/LinkOffOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import type { OrderDetail } from '../../api/orders';
import {
  ISSUE_LABEL,
  useApplyCredit,
  useCancelOrder,
  useCloseOrder,
  useCompleteDocumentation,
  useConfirmNoPayment,
  useDeleteContainer,
  useSaveContainer,
  useSavePackaging,
  useSaveRelease,
  useTrackingAction,
  useTrackingLink,
  type BillRelease,
  type Container,
  type ContainerInput,
  type PackagingUpdate,
} from '../../api/stages';
import { useCustomer } from '../../api/customers';
import { PACKAGING_STATUS_LABEL } from '../../workflow/statuses';
import { CATEGORY_LABEL } from '../../workflow/documents';
import { fieldErrors, formError } from '../../lib/formErrors';
import { formatDate, formatDateTime, formatMoney } from '../../lib/format';
import { parseNum } from '../../lib/money';
import { useToast } from '../../components/useToast';

const actionCardSx = { border: '2px solid', borderColor: 'primary.main' } as const;
/** Stages where Documentation can still add containers or change booking/loading details. */
const BOOKING_STAGES = ['READY_FOR_DOCUMENTATION', 'DOCUMENTATION_IN_PROGRESS'];
const today = () => new Date().toLocaleDateString('en-CA');
const orNull = (v: string) => (v.trim() ? v.trim() : null);

function ConfirmDialog(props: { open: boolean; title: string; children: ReactNode; confirm: string; color?: 'primary' | 'error'; loading?: boolean; disabled?: boolean; onClose: () => void; onConfirm: () => void }) {
  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{props.title}</DialogTitle>
      <DialogContent>{props.children}</DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={props.onClose}>
          Cancel
        </Button>
        <Button variant="contained" color={props.color ?? 'primary'} loading={props.loading} disabled={props.disabled} onClick={props.onConfirm}>
          {props.confirm}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ═════════════ Packaging ═════════════

type PkgStatus = 'IN_PROGRESS' | 'ON_HOLD' | 'ISSUE';
export function PackagingUpdateCard({ detail }: { detail: OrderDetail }) {
  const { order, packagingUpdates, items } = detail;
  const last = packagingUpdates[0];
  const defaultUnit = items[0]?.unit ?? 'MT';
  const [v, setV] = useState({
    packagingStatus: (last && last.packagingStatus !== 'COMPLETED' ? last.packagingStatus : 'IN_PROGRESS') as PkgStatus,
    startDate: last?.startDate ?? today(),
    completionDate: last?.completionDate ?? '',
    quantityPacked: last?.quantityPacked ? String(Number(last.quantityPacked)) : '',
    quantityUnit: last?.quantityUnit ?? defaultUnit,
    issueType: last?.issueType ?? '',
    issueReason: '',
    remarks: '',
  });
  const [confirm, setConfirm] = useState(false);
  const save = useSavePackaging(order.id);
  const toast = useToast();
  const errors = fieldErrors(save.error);
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });
  const inProgress = order.status === 'PACKAGING_IN_PROGRESS';
  const needsReason = v.packagingStatus === 'ON_HOLD' || v.packagingStatus === 'ISSUE';

  function submit(complete: boolean) {
    const qty = parseNum(v.quantityPacked);
    save.mutate(
      {
        packagingStatus: complete ? 'COMPLETED' : v.packagingStatus,
        startDate: v.startDate || null,
        completionDate: complete ? v.completionDate || today() : v.completionDate || null,
        quantityPacked: Number.isNaN(qty) ? null : qty,
        quantityUnit: orNull(v.quantityUnit),
        issueType: v.packagingStatus === 'ISSUE' ? v.issueType || null : null,
        issueReason: orNull(v.issueReason),
        remarks: orNull(v.remarks),
      },
      {
        onSuccess: () => {
          setConfirm(false);
          setV((x) => ({ ...x, issueReason: '', remarks: '' }));
          toast(complete ? 'Packaging completed. Order sent to Documentation.' : 'Packaging update saved');
        },
        onError: () => setConfirm(false),
      },
    );
  }

  return (
    <Card sx={actionCardSx}>
      <CardContent>
        <Typography variant="subtitle1">Packaging update</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 2 }}>
          Upload packaging photos in Documents.
        </Typography>
        {formError(save.error) && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError(save.error)}
          </Alert>
        )}
        <Stack spacing={2}>
          <TextField select label="Packaging status" value={v.packagingStatus} onChange={set('packagingStatus')} error={!!errors.packagingStatus} helperText={errors.packagingStatus}>
            <MenuItem value="IN_PROGRESS">In progress</MenuItem>
            <MenuItem value="ON_HOLD">On hold</MenuItem>
            <MenuItem value="ISSUE">Issue / rework required</MenuItem>
          </TextField>
          {v.packagingStatus === 'ISSUE' && (
            <TextField
              select
              label="Issue type"
              required
              value={v.issueType}
              onChange={set('issueType')}
              error={!!errors.issueType}
              helperText={errors.issueType}
              slotProps={{
                select: {
                  renderValue: (val) =>
                    val ? ISSUE_LABEL[val as keyof typeof ISSUE_LABEL] : <Box component="span" sx={{ color: 'text.disabled' }}>Choose the issue</Box>,
                },
              }}
            >
              {Object.entries(ISSUE_LABEL).map(([k, l]) => (
                <MenuItem key={k} value={k}>
                  {l}
                </MenuItem>
              ))}
            </TextField>
          )}
          {needsReason && (
            <TextField label="Reason" required multiline minRows={2} value={v.issueReason} onChange={set('issueReason')} error={!!errors.issueReason} helperText={errors.issueReason ?? 'Shortage, damage, rework or reason for delay'} />
          )}
          <TextField label="Start date" type="date" value={v.startDate} onChange={set('startDate')} error={!!errors.startDate} helperText={errors.startDate} />
          <Stack direction="row" spacing={1.5}>
            <TextField label="Quantity packed" value={v.quantityPacked} onChange={set('quantityPacked')} error={!!errors.quantityPacked} helperText={errors.quantityPacked} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
            <TextField label="Unit" value={v.quantityUnit} onChange={set('quantityUnit')} sx={{ maxWidth: 110 }} />
          </Stack>
          <TextField label="Completion date" type="date" value={v.completionDate} onChange={set('completionDate')} error={!!errors.completionDate} helperText={errors.completionDate} />
          <TextField label="Remarks" multiline minRows={2} value={v.remarks} onChange={set('remarks')} />
        </Stack>
        <Stack spacing={1.25} sx={{ mt: 2.5 }}>
          <Button variant="outlined" onClick={() => submit(false)} loading={save.isPending && !confirm} disabled={save.isPending}>
            Save update
          </Button>
          <Button variant="contained" onClick={() => setConfirm(true)} disabled={!inProgress || save.isPending}>
            Mark packaging completed
          </Button>
          {!inProgress && (
            <Typography variant="body2" sx={{ color: 'text.secondary', textAlign: 'center' }}>
              Save as In progress first, then complete.
            </Typography>
          )}
        </Stack>
      </CardContent>
      <ConfirmDialog open={confirm} title="Complete packaging?" confirm="Yes, complete" loading={save.isPending} onClose={() => setConfirm(false)} onConfirm={() => submit(true)}>
        <Typography>
          {v.quantityPacked || '?'} {v.quantityUnit} packed. The order moves to Documentation for container booking.
        </Typography>
      </ConfirmDialog>
    </Card>
  );
}

const PKG_CHIP = { AWAITING: 'default', IN_PROGRESS: 'info', ON_HOLD: 'warning', ISSUE: 'error', COMPLETED: 'success' } as const;
export function PackagingHistoryCard({ updates }: { updates: PackagingUpdate[] }) {
  if (!updates.length) return null;
  return (
    <Card>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Packaging history
        </Typography>
        <Stack spacing={1.5}>
          {updates.map((u) => (
            <Box key={u.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '14px', p: 1.75 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}>
                <Chip size="small" label={PACKAGING_STATUS_LABEL[u.packagingStatus]} color={PKG_CHIP[u.packagingStatus]} variant={u.packagingStatus === 'COMPLETED' ? 'filled' : 'outlined'} />
                {u.issueType && <Chip size="small" color="error" variant="outlined" label={ISSUE_LABEL[u.issueType]} />}
                <Typography variant="body2" sx={{ color: 'text.secondary', ml: 'auto !important' }}>
                  {u.createdByName} · {formatDateTime(u.createdAt)}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {[u.startDate && `Started ${formatDate(u.startDate)}`, u.completionDate && `Completed ${formatDate(u.completionDate)}`, u.quantityPacked && `Packed ${Number(u.quantityPacked)} ${u.quantityUnit ?? ''}`]
                  .filter(Boolean)
                  .join(' · ') || '—'}
              </Typography>
              {u.issueReason && <Typography variant="body2" sx={{ mt: 0.5, color: 'error.main' }}>Reason: {u.issueReason}</Typography>}
              {u.remarks && <Typography variant="body2" sx={{ mt: 0.5 }}>Remarks: {u.remarks}</Typography>}
            </Box>
          ))}
        </Stack>
      </CardContent>
    </Card>
  );
}

// ═════════════ Documentation: containers ═════════════

const EMPTY_CONTAINER: ContainerInput = {
  bookingNo: null, shippingLine: null, vesselName: null, voyageNo: null, containerNo: null, containerSize: null, sealNo: null,
  portOfLoading: null, portOfDischarge: null, loadingDate: null, gateInDate: null, transportDetails: null, remarks: null,
};

function ContainerDialog({ detail, container, onClose }: { detail: OrderDetail; container: Container | null; onClose: () => void }) {
  const [v, setV] = useState<Record<keyof ContainerInput, string>>(() => {
    const src = container ?? EMPTY_CONTAINER;
    return Object.fromEntries(Object.keys(EMPTY_CONTAINER).map((k) => [k, (src as Record<string, string | null>)[k] ?? ''])) as Record<keyof ContainerInput, string>;
  });
  const save = useSaveContainer(detail.order.id);
  const toast = useToast();
  const errors = fieldErrors(save.error);
  const canGateIn = detail.permissions.canGateIn;
  // Booking/loading details are fixed once the balance is recorded; then only gate-in, transport and remarks change.
  const bookingOpen = BOOKING_STAGES.includes(detail.order.status);
  const LATE_FIELDS: (keyof ContainerInput)[] = ['gateInDate', 'transportDetails', 'remarks'];
  const f = (k: keyof ContainerInput, label: string, extra: Partial<React.ComponentProps<typeof TextField>> = {}) => (
    <TextField
      label={label}
      value={v[k]}
      onChange={(e) => setV({ ...v, [k]: e.target.value })}
      error={!!errors[k]}
      helperText={errors[k] ?? extra.helperText}
      {...extra}
      disabled={extra.disabled || (!bookingOpen && !LATE_FIELDS.includes(k))}
    />
  );

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Send only what may change at this stage (server merges partial updates).
    const keys = bookingOpen ? Object.keys(v) : LATE_FIELDS;
    const body = Object.fromEntries(keys.map((k) => [k, orNull(v[k as keyof ContainerInput])])) as unknown as ContainerInput;
    save.mutate({ ...body, id: container?.id }, { onSuccess: () => { toast(container ? 'Container updated' : 'Container added'); onClose(); } });
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="md" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>{container ? `Container ${container.containerNo ?? ''}` : 'Add container'}</DialogTitle>
      <DialogContent>
        {formError(save.error) && <Alert severity="error" sx={{ mb: 2 }}>{formError(save.error)}</Alert>}
        {!bookingOpen && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Booking and loading details are locked after the balance payment is recorded. You can update gate-in, transport and remarks.
          </Alert>
        )}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, sm: 4 }}>{f('bookingNo', 'Booking no.')}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{f('shippingLine', 'Shipping line')}</Grid>
          <Grid size={{ xs: 6, sm: 2 }}>{f('vesselName', 'Vessel')}</Grid>
          <Grid size={{ xs: 6, sm: 2 }}>{f('voyageNo', 'Voyage')}</Grid>
          <Grid size={{ xs: 12, sm: 4 }}>{f('containerNo', 'Container no.')}</Grid>
          <Grid size={{ xs: 6, sm: 4 }}>{f('containerSize', 'Size', { placeholder: '20FT / 40FT / 40HC' })}</Grid>
          <Grid size={{ xs: 6, sm: 4 }}>{f('sealNo', 'Seal no.')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('portOfLoading', 'Port of loading')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('portOfDischarge', 'Port of discharge')}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>{f('loadingDate', 'Loading date', { type: 'date' })}</Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            {f('gateInDate', 'Port / gate-in date', {
              type: 'date',
              disabled: !canGateIn,
              helperText: canGateIn ? undefined : 'Available after Accounts approves the balance payment',
            })}
          </Grid>
          <Grid size={12}>{f('transportDetails', 'Transport / logistics details', { multiline: true, minRows: 2 })}</Grid>
          <Grid size={12}>{f('remarks', 'Remarks', { multiline: true, minRows: 2 })}</Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" loading={save.isPending}>{container ? 'Save changes' : 'Add container'}</Button>
      </DialogActions>
    </Dialog>
  );
}

export function ContainersCard({ detail }: { detail: OrderDetail }) {
  const { containers, permissions } = detail;
  const [editing, setEditing] = useState<Container | 'new' | null>(null);
  const remove = useDeleteContainer(detail.order.id);
  const toast = useToast();
  const loadingImages = detail.documents.filter((d) => d.category === 'LOADING_IMAGE' || d.category === 'CONTAINER_IMAGE');
  const bookingOpen = permissions.canEditContainers && BOOKING_STAGES.includes(detail.order.status);
  if (!containers.length && !permissions.canEditContainers) return null;

  return (
    <Card>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle1">Containers & loading ({containers.length})</Typography>
          {bookingOpen && (
            <Button startIcon={<AddOutlined />} onClick={() => setEditing('new')}>Add container</Button>
          )}
        </Stack>
        {!containers.length && <Typography sx={{ color: 'text.secondary' }}>No container booked yet.</Typography>}
        <Stack spacing={1.5}>
          {containers.map((c) => (
            <Box key={c.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: '14px', p: 1.75 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', rowGap: 0.75 }}>
                <Typography sx={{ fontWeight: 700 }}>{c.containerNo ?? 'Container no. pending'}</Typography>
                {c.containerSize && <Chip size="small" variant="outlined" label={c.containerSize} />}
                <Chip size="small" variant="outlined" color={c.loadingDate ? 'success' : 'default'} label={c.loadingDate ? `Loaded ${formatDate(c.loadingDate)}` : 'Not loaded'} />
                <Chip size="small" variant="outlined" color={c.gateInDate ? 'success' : 'default'} label={c.gateInDate ? `Gate-in ${formatDate(c.gateInDate)}` : 'No gate-in'} />
                {permissions.canEditContainers && (
                  <Box sx={{ ml: 'auto !important' }}>
                    <Tooltip title="Edit"><IconButton aria-label="Edit container" onClick={() => setEditing(c)}><EditOutlined fontSize="small" /></IconButton></Tooltip>
                    {bookingOpen && !c.gateInDate && (
                      <Tooltip title="Remove">
                        <IconButton
                          aria-label="Remove container"
                          onClick={() => {
                            if (window.confirm(`Remove container ${c.containerNo ?? ''}? This cannot be undone.`)) {
                              remove.mutate({ id: c.id }, { onSuccess: () => toast('Container removed'), onError: (e) => toast(formError(e) ?? 'Could not remove', 'error') });
                            }
                          }}
                        >
                          <DeleteOutlined fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                )}
              </Stack>
              <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
                {[c.bookingNo && `Booking ${c.bookingNo}`, c.shippingLine, [c.vesselName, c.voyageNo].filter(Boolean).join(' / '), c.sealNo && `Seal ${c.sealNo}`,
                  [c.portOfLoading, c.portOfDischarge].filter(Boolean).join(' → ')].filter(Boolean).join(' · ') || 'No booking details yet'}
              </Typography>
              {c.transportDetails && <Typography variant="body2" sx={{ mt: 0.5 }}>{c.transportDetails}</Typography>}
              {c.remarks && <Typography variant="body2" sx={{ mt: 0.5 }}>Remarks: {c.remarks}</Typography>}
            </Box>
          ))}
        </Stack>
        {loadingImages.length > 0 && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
            {loadingImages.length} container / loading image{loadingImages.length > 1 ? 's' : ''} from QC in Documents.
          </Typography>
        )}
      </CardContent>
      {editing && <ContainerDialog detail={detail} container={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
    </Card>
  );
}

// ═════════════ Documentation: bill release + complete ═════════════

function ReleaseDialog({ detail, release, onClose }: { detail: OrderDetail; release: BillRelease | null; onClose: () => void }) {
  const [v, setV] = useState({
    documentType: release?.documentType ?? 'Bill of Lading',
    documentReference: release?.documentReference ?? '',
    documentId: release?.documentId ? String(release.documentId) : '',
    releaseStatus: release?.releaseStatus ?? 'RELEASED',
    releaseDate: release?.releaseDate ?? today(),
    remarks: release?.remarks ?? '',
  });
  const save = useSaveRelease(detail.order.id);
  const toast = useToast();
  const errors = fieldErrors(save.error);
  const files = detail.documents.filter((d) => ['SHIPPING_DOC', 'LOADING_BILL', 'OTHER'].includes(d.category));
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement>) => setV({ ...v, [k]: e.target.value });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    save.mutate(
      {
        id: release?.id,
        documentType: v.documentType.trim(),
        documentReference: orNull(v.documentReference),
        documentId: v.documentId ? Number(v.documentId) : null,
        releaseStatus: v.releaseStatus as 'PENDING' | 'RELEASED',
        releaseDate: v.releaseDate || null,
        remarks: orNull(v.remarks),
      },
      { onSuccess: () => { toast('Release record saved'); onClose(); } },
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>{release ? 'Edit document release' : 'Record document release'}</DialogTitle>
      <DialogContent>
        {formError(save.error) && <Alert severity="error" sx={{ mb: 2 }}>{formError(save.error)}</Alert>}
        <Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Document type" required value={v.documentType} onChange={set('documentType')} error={!!errors.documentType} helperText={errors.documentType ?? 'e.g. Bill of Lading, Loading Bill, Invoice'} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Document reference" value={v.documentReference} onChange={set('documentReference')} />
          </Grid>
          <Grid size={12}>
            <TextField select label="Uploaded file" value={v.documentId} onChange={set('documentId')} error={!!errors.documentId} helperText={errors.documentId ?? (files.length ? undefined : 'Upload the document in Documents first if you want to link it')}>
              <MenuItem value="">None</MenuItem>
              {files.map((d) => (
                <MenuItem key={d.id} value={String(d.id)}>
                  {d.originalName} ({CATEGORY_LABEL[d.category]})
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField select label="Status" value={v.releaseStatus} onChange={set('releaseStatus')}>
              <MenuItem value="PENDING">Pending</MenuItem>
              <MenuItem value="RELEASED">Released to customer</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Release date" type="date" value={v.releaseDate} onChange={set('releaseDate')} error={!!errors.releaseDate} helperText={errors.releaseDate} />
          </Grid>
          <Grid size={12}>
            <TextField label="Remarks" multiline minRows={2} value={v.remarks} onChange={set('remarks')} />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button color="inherit" onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained" loading={save.isPending}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

export function BillReleaseCard({ detail }: { detail: OrderDetail }) {
  const { billReleases, permissions, containers } = detail;
  const [editing, setEditing] = useState<BillRelease | 'new' | null>(null);
  const [confirm, setConfirm] = useState(false);
  const complete = useCompleteDocumentation(detail.order.id);
  const toast = useToast();
  if (!billReleases.length && !permissions.canRelease) return null;
  const allGated = containers.length > 0 && containers.every((c) => c.containerNo && c.loadingDate && c.gateInDate);
  const released = billReleases.some((b) => b.releaseStatus === 'RELEASED');

  return (
    <Card sx={permissions.canRelease ? actionCardSx : undefined}>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
          <Typography variant="subtitle1">Document release</Typography>
        </Stack>
        {!billReleases.length && <Typography sx={{ color: 'text.secondary' }}>Nothing released yet.</Typography>}
        <Stack spacing={1.25}>
          {billReleases.map((b) => (
            <Stack key={b.id} direction="row" spacing={1} sx={{ alignItems: 'center', border: '1px solid', borderColor: 'divider', borderRadius: '14px', p: 1.5, flexWrap: 'wrap', rowGap: 0.5 }}>
              <Typography sx={{ fontWeight: 600 }}>{b.documentType}</Typography>
              {b.documentReference && <Typography variant="body2" sx={{ color: 'text.secondary' }}>Ref {b.documentReference}</Typography>}
              <Chip size="small" variant="outlined" color={b.releaseStatus === 'RELEASED' ? 'success' : 'warning'} label={b.releaseStatus === 'RELEASED' ? `Released ${formatDate(b.releaseDate)}` : 'Pending'} />
              {b.documentId && (
                <Button size="small" component="a" href={`/api/documents/${b.documentId}/download?inline=1`} target="_blank" rel="noopener" sx={{ minHeight: 30 }}>
                  View file
                </Button>
              )}
              {permissions.canRelease && (
                <IconButton aria-label="Edit release" onClick={() => setEditing(b)} sx={{ ml: 'auto !important' }}><EditOutlined fontSize="small" /></IconButton>
              )}
            </Stack>
          ))}
        </Stack>
        {permissions.canRelease && (
          <>
            <Button variant="outlined" fullWidth startIcon={<AddOutlined />} onClick={() => setEditing('new')} sx={{ mt: 1.5 }}>
              Record release
            </Button>
            <Stack spacing={0.5} sx={{ mt: 2 }}>
              <CheckRow ok={allGated} label="All containers loaded with gate-in date" />
              <CheckRow ok={released} label="At least one document released" />
            </Stack>
            <Button variant="contained" fullWidth sx={{ mt: 2 }} disabled={!allGated || !released} onClick={() => setConfirm(true)}>
              Mark documentation complete
            </Button>
          </>
        )}
      </CardContent>
      {editing && <ReleaseDialog detail={detail} release={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />}
      <ConfirmDialog
        open={confirm}
        title="Complete documentation?"
        confirm="Yes, complete"
        loading={complete.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          complete.mutate({}, {
            onSuccess: () => { setConfirm(false); toast('Sent to Accounts for final verification'); },
            onError: (e) => { setConfirm(false); toast(formError(e) ?? 'Could not complete', 'error'); },
          })
        }
      >
        <Typography>The order goes to Accounts for final verification and closure.</Typography>
      </ConfirmDialog>
    </Card>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
      {ok ? <CheckCircle color="success" fontSize="small" /> : <RadioButtonUnchecked fontSize="small" sx={{ color: 'text.disabled' }} />}
      <Typography variant="body2" sx={{ color: ok ? 'text.primary' : 'text.secondary' }}>{label}</Typography>
    </Stack>
  );
}

// ═════════════ Accounts: final verification ═════════════

export function ClosureCard({ detail }: { detail: OrderDetail }) {
  const { closureChecklist, permissions } = detail;
  const [remarks, setRemarks] = useState('');
  const [confirm, setConfirm] = useState(false);
  const close = useCloseOrder(detail.order.id);
  const toast = useToast();
  if (!closureChecklist) return null;
  const ready = closureChecklist.every((c) => c.ok);

  return (
    <Card sx={permissions.canClose ? actionCardSx : undefined}>
      <CardContent>
        <Typography variant="subtitle1" sx={{ mb: 1.5 }}>Final verification</Typography>
        <Stack spacing={0.75}>
          {closureChecklist.map((c) => <CheckRow key={c.key} ok={c.ok} label={c.label} />)}
        </Stack>
        {permissions.canClose && (
          <>
            <TextField label="Closure remarks" multiline minRows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} sx={{ mt: 2 }} />
            <Button variant="contained" fullWidth sx={{ mt: 2 }} disabled={!ready} onClick={() => setConfirm(true)}>
              Verify & close order
            </Button>
          </>
        )}
      </CardContent>
      <ConfirmDialog
        open={confirm}
        title="Close this order?"
        confirm="Yes, close"
        loading={close.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          close.mutate({ remarks: orNull(remarks) }, {
            onSuccess: () => { setConfirm(false); toast('Order closed'); },
            onError: (e) => { setConfirm(false); toast(formError(e) ?? 'Could not close', 'error'); },
          })
        }
      >
        <Typography>A closed order is read-only for everyone.</Typography>
      </ConfirmDialog>
    </Card>
  );
}

// ═════════════ Customer tracking link ═════════════

export function TrackingLinkCard({ detail }: { detail: OrderDetail }) {
  const { data: link, isPending } = useTrackingLink(detail.order.id, detail.permissions.canManageTracking);
  const action = useTrackingAction(detail.order.id);
  const toast = useToast();
  const [confirm, setConfirm] = useState<'regenerate' | 'revoke' | null>(null);
  if (!detail.permissions.canManageTracking) return null;
  const lockedOrder = detail.order.status === 'CLOSED' || detail.order.status === 'CANCELLED';

  const run = (a: 'create' | 'regenerate' | 'revoke') =>
    action.mutate(a, {
      onSuccess: () => {
        setConfirm(null);
        toast(a === 'revoke' ? 'Link revoked. The customer can no longer open it.' : a === 'create' ? 'Tracking link created' : 'New link created. The old one no longer works.');
      },
      onError: (e) => { setConfirm(null); toast(formError(e) ?? 'Could not update link', 'error'); },
    });

  async function copy() {
    if (!link?.url) return;
    try {
      await navigator.clipboard.writeText(link.url);
      toast('Link copied. Send it to the customer.');
    } catch {
      toast('Copy failed. Select the link and copy it manually.', 'warning');
    }
  }

  return (
    <Card id="tracking-link" sx={{ scrollMarginTop: 80 }}>
      <CardContent>
        <Typography variant="subtitle1">Customer tracking link</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
          Read-only status page for this order only. No prices or internal notes.
        </Typography>
        {isPending ? null : link ? (
          <>
            <TextField value={link.url ?? 'Link hidden (security key changed). Regenerate to copy.'} slotProps={{ htmlInput: { readOnly: true, 'aria-label': 'Tracking link' } }} size="small" />
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
              Created by {link.createdByName}, {formatDateTime(link.createdAt)} · Opened {link.viewCount} time{link.viewCount === 1 ? '' : 's'}
              {link.lastViewedAt ? `, last ${formatDateTime(link.lastViewedAt)}` : ''}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', rowGap: 1 }}>
              <Button variant="contained" startIcon={<ContentCopyOutlined />} onClick={copy} disabled={!link.url}>Copy link</Button>
              {!lockedOrder && <Button variant="outlined" startIcon={<AutorenewOutlined />} onClick={() => setConfirm('regenerate')}>Regenerate</Button>}
              <Button color="error" startIcon={<LinkOffOutlined />} onClick={() => setConfirm('revoke')}>Revoke</Button>
            </Stack>
          </>
        ) : lockedOrder ? (
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>No link was shared for this order.</Typography>
        ) : (
          <Button variant="outlined" startIcon={<LinkOutlined />} onClick={() => run('create')} loading={action.isPending}>
            Create tracking link
          </Button>
        )}
      </CardContent>
      <ConfirmDialog
        open={!!confirm}
        title={confirm === 'revoke' ? 'Revoke link?' : 'Create a new link?'}
        confirm={confirm === 'revoke' ? 'Revoke' : 'Regenerate'}
        color={confirm === 'revoke' ? 'error' : 'primary'}
        loading={action.isPending}
        onClose={() => setConfirm(null)}
        onConfirm={() => confirm && run(confirm)}
      >
        <Typography>The current link stops working immediately{confirm === 'regenerate' ? ' and a new one is created' : ''}.</Typography>
      </ConfirmDialog>
    </Card>
  );
}

// ═════════════ MD/Admin: cancel ═════════════

export function CancelOrderButton({ detail }: { detail: OrderDetail }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const cancel = useCancelOrder(detail.order.id);
  const toast = useToast();
  const errors = fieldErrors(cancel.error);
  if (!detail.permissions.canCancel) return null;
  return (
    <>
      <Button variant="outlined" color="error" startIcon={<BlockOutlined />} onClick={() => setOpen(true)}>
        Cancel order
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel {detail.order.orderNo}?</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>All departments will still see the order, but nobody can change it. This cannot be undone.</Typography>
          {formError(cancel.error) && <Alert severity="error" sx={{ mb: 2 }}>{formError(cancel.error)}</Alert>}
          <TextField label="Reason" required multiline minRows={3} autoFocus value={reason} onChange={(e) => setReason(e.target.value)} error={!!errors.reason} helperText={errors.reason} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setOpen(false)}>Keep order</Button>
          <Button
            variant="contained"
            color="error"
            loading={cancel.isPending}
            disabled={reason.trim().length < 3}
            onClick={() => cancel.mutate({ reason: reason.trim() }, { onSuccess: () => { setOpen(false); toast('Order cancelled', 'info'); } })}
          >
            Cancel order
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ═════════════ Sales: use customer credit ═════════════

export function ApplyCreditButton({ detail }: { detail: OrderDetail }) {
  const { order, permissions, customer } = detail;
  const { data } = useCustomer(permissions.canApplyCredit ? customer.id : null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const apply = useApplyCredit(order.id);
  const toast = useToast();
  const errors = fieldErrors(apply.error);
  const available = data?.credit.find((c) => c.currency === order.currency)?.available;
  const pending = detail.credits.some((c) => c.status === 'PENDING');
  if (!permissions.canApplyCredit || pending || !available || Number(available) <= 0) return null;

  return (
    <>
      <Button variant="outlined" fullWidth sx={{ mt: 1.5 }} onClick={() => setOpen(true)}>
        Use customer credit ({formatMoney(available, order.currency)} available)
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Use customer credit</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>Accounts must verify this. Once verified, the balance receivable is reduced.</Typography>
          {formError(apply.error) && <Alert severity="error" sx={{ mb: 2 }}>{formError(apply.error)}</Alert>}
          <TextField label="Amount (₹)" value={amount} onChange={(e) => setAmount(e.target.value)} error={!!errors.amount} helperText={errors.amount ?? `Available: ${formatMoney(available, order.currency)}`} slotProps={{ htmlInput: { inputMode: 'decimal' } }} />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            loading={apply.isPending}
            onClick={() => {
              const n = parseNum(amount);
              apply.mutate({ amount: Number.isNaN(n) ? (undefined as unknown as number) : n, remarks: null }, { onSuccess: () => { setOpen(false); setAmount(''); apply.reset(); toast('Sent to Accounts for verification'); } });
            }}
          >
            Request
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

// ═════════════ Accounts: nothing due (0 advance / 0 balance) ═════════════

export function ConfirmNoPaymentCard({ detail }: { detail: OrderDetail }) {
  const type = detail.permissions.confirmNoPaymentType;
  const [confirm, setConfirm] = useState(false);
  const run = useConfirmNoPayment(detail.order.id);
  const toast = useToast();
  if (!type) return null;
  const isAdvance = type === 'ADVANCE';
  return (
    <Card sx={actionCardSx}>
      <CardContent>
        <Typography variant="subtitle1">{isAdvance ? 'No advance due' : 'No balance due'}</Typography>
        <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
          {isAdvance
            ? 'This order has 0% advance, so there is no advance payment to verify.'
            : 'The balance receivable is ₹0 (fully covered by advance or customer credit), so there is no balance payment to verify.'}
        </Typography>
        {formError(run.error) && <Alert severity="error" sx={{ mt: 1.5 }}>{formError(run.error)}</Alert>}
        <Button variant="contained" fullWidth sx={{ mt: 2 }} onClick={() => setConfirm(true)} disabled={run.isPending}>
          Confirm and move on
        </Button>
      </CardContent>
      <ConfirmDialog
        open={confirm}
        title={isAdvance ? 'Confirm no advance?' : 'Confirm no balance?'}
        confirm="Yes, confirm"
        loading={run.isPending}
        onClose={() => setConfirm(false)}
        onConfirm={() =>
          run.mutate({ type }, {
            onSuccess: () => { setConfirm(false); toast(isAdvance ? 'Order sent to QC' : 'Order sent to document release'); },
            onError: () => setConfirm(false),
          })
        }
      >
        <Typography>{isAdvance ? 'The order moves to QC / Production.' : 'Documentation can now record gate-in and release documents.'}</Typography>
      </ConfirmDialog>
    </Card>
  );
}
