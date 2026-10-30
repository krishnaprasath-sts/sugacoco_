import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import UploadFileOutlined from '@mui/icons-material/UploadFileOutlined';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import ImageOutlined from '@mui/icons-material/ImageOutlined';
import InsertDriveFileOutlined from '@mui/icons-material/InsertDriveFileOutlined';
import DownloadOutlined from '@mui/icons-material/DownloadOutlined';
import OpenInNew from '@mui/icons-material/OpenInNew';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import FolderOpenOutlined from '@mui/icons-material/FolderOpenOutlined';
import { useRemoveDocument, useUploadDocuments, type OrderDetail } from '../../api/orders';
import { CATEGORY_LABEL, type DocumentCategory } from '../../workflow/documents';
import { formatDateTime } from '../../lib/format';
import { formError } from '../../lib/formErrors';
import { useMe } from '../../auth/useAuth';
import FilePicker from '../../components/FilePicker';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/useToast';

function fileIcon(mime: string) {
  if (mime === 'application/pdf') return <PictureAsPdfOutlined />;
  if (mime.startsWith('image/')) return <ImageOutlined />;
  return <InsertDriveFileOutlined />;
}

const formatSize = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1)} MB`);

export default function DocumentsCard({ detail }: { detail: OrderDetail }) {
  const { data: me } = useMe();
  const toast = useToast();
  const remove = useRemoveDocument(detail.order.id);
  const [uploading, setUploading] = useState(false);
  const categories = detail.permissions.uploadCategories;

  // Group by category in a stable order
  const groups = Object.entries(
    detail.documents.reduce<Record<string, typeof detail.documents>>((acc, d) => {
      (acc[d.category] ??= []).push(d);
      return acc;
    }, {}),
  ).sort(([a], [b]) => Object.keys(CATEGORY_LABEL).indexOf(a) - Object.keys(CATEGORY_LABEL).indexOf(b));

  return (
    <Card id="documents" sx={{ scrollMarginTop: 80 }}>
      <CardContent>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="subtitle1">Documents ({detail.documents.length})</Typography>
          {categories.length > 0 && (
            <Button startIcon={<UploadFileOutlined />} onClick={() => setUploading(true)}>
              Upload
            </Button>
          )}
        </Stack>

        {detail.documents.length === 0 ? (
          <EmptyState icon={<FolderOpenOutlined />} title="No documents yet" />
        ) : (
          groups.map(([category, docs]) => (
            <Box key={category} sx={{ mt: 1.5 }}>
              <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                {CATEGORY_LABEL[category as DocumentCategory]}
              </Typography>
              <List dense disablePadding>
                {docs.map((d) => {
                  const viewable = d.mimeType === 'application/pdf' || d.mimeType.startsWith('image/');
                  return (
                    <ListItem
                      key={d.id}
                      disableGutters
                      secondaryAction={
                        <Stack direction="row">
                          {viewable && (
                            <Tooltip title="Open">
                              <IconButton component="a" href={`/api/documents/${d.id}/download?inline=1`} target="_blank" rel="noopener" aria-label={`Open ${d.originalName}`}>
                                <OpenInNew fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip title="Download">
                            <IconButton component="a" href={`/api/documents/${d.id}/download`} aria-label={`Download ${d.originalName}`}>
                              <DownloadOutlined fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          {d.uploadedBy === me?.id && categories.length > 0 && (
                            <Tooltip title="Remove">
                              <IconButton
                                aria-label={`Remove ${d.originalName}`}
                                onClick={() => {
                                  if (!window.confirm(`Remove "${d.originalName}"? It stays in the audit history.`)) return;
                                  remove.mutate(d.id, {
                                    onSuccess: () => toast('Document removed'),
                                    onError: (err) => toast(formError(err) ?? 'Could not remove', 'error'),
                                  });
                                }}
                              >
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Stack>
                      }
                      sx={{ pr: 15 }}
                    >
                      <ListItemIcon sx={{ minWidth: 36, color: 'text.secondary' }}>{fileIcon(d.mimeType)}</ListItemIcon>
                      <ListItemText
                        primary={d.originalName}
                        secondary={`${formatSize(d.sizeBytes)} · ${d.uploadedByName} · ${formatDateTime(d.createdAt)}${d.referenceNo ? ` · Ref ${d.referenceNo}` : ''}`}
                        slotProps={{ primary: { noWrap: true, title: d.originalName }, secondary: { noWrap: true } }}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Box>
          ))
        )}
      </CardContent>
      {uploading && <UploadDialog detail={detail} onClose={() => setUploading(false)} />}
    </Card>
  );
}

function UploadDialog({ detail, onClose }: { detail: OrderDetail; onClose: () => void }) {
  const categories = detail.permissions.uploadCategories;
  const [category, setCategory] = useState<DocumentCategory>(categories[0]);
  const [referenceNo, setReferenceNo] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const upload = useUploadDocuments(detail.order.id);
  const toast = useToast();

  // Link a voucher to the latest payment of the same type, so Accounts sees them together.
  const voucherType = category === 'ADVANCE_VOUCHER' ? 'ADVANCE' : category === 'BALANCE_VOUCHER' ? 'BALANCE' : null;
  const paymentId = voucherType ? detail.payments.find((p) => p.paymentType === voucherType && p.status !== 'REJECTED')?.id : undefined;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    upload.mutate(
      { files, category, referenceNo: referenceNo.trim() || undefined, paymentId },
      {
        onSuccess: () => {
          toast(`${files.length} file${files.length > 1 ? 's' : ''} uploaded`);
          onClose();
        },
      },
    );
  }

  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="xs" slotProps={{ paper: { component: 'form', onSubmit, noValidate: true } as object }}>
      <DialogTitle>Upload documents</DialogTitle>
      <DialogContent>
        {upload.error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {formError(upload.error) ?? 'Upload failed'}
          </Alert>
        )}
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          <TextField select label="Document type" value={category} onChange={(e) => setCategory(e.target.value as DocumentCategory)}>
            {categories.map((c) => (
              <MenuItem key={c} value={c}>
                {CATEGORY_LABEL[c]}
              </MenuItem>
            ))}
          </TextField>
          {voucherType && !paymentId && (
            <Alert severity="info">No {voucherType.toLowerCase()} payment is recorded yet. Record the payment first so the voucher is linked to it.</Alert>
          )}
          <TextField label="Reference no. (optional)" value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
          <FilePicker label="Choose files" hint="Up to 10 files, 15 MB each" files={files} onChange={setFiles} onError={(m) => toast(m, 'error')} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button type="submit" variant="contained" disabled={!files.length} loading={upload.isPending}>
          Upload
        </Button>
      </DialogActions>
    </Dialog>
  );
}
