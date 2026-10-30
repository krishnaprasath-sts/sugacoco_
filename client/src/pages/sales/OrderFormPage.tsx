import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Collapse,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Link,
  MenuItem,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddOutlined from '@mui/icons-material/AddOutlined';
import DeleteOutline from '@mui/icons-material/DeleteOutlined';
import { useCustomer, type Customer } from '../../api/customers';
import { uploadDocuments, useOrder, useProductSuggestions, useSaveOrder, type OrderInput } from '../../api/orders';
import { advanceFromPercent, CURRENCIES, lineTotal, parseNum, round2, sum } from '../../lib/money';
import { formatMoney } from '../../lib/format';
import { fieldErrors, formError } from '../../lib/formErrors';
import PageHeader from '../../components/PageHeader';
import FilePicker from '../../components/FilePicker';
import { useToast } from '../../components/useToast';
import CustomerPicker from './CustomerPicker';
import type { DocumentCategory } from '../../workflow/documents';

const UNITS = ['MT', 'KG', 'Bags', 'Cartons', 'Pcs', 'Litres'];

type ItemRow = {
  key: number;
  productName: string;
  specification: string;
  quantity: string;
  unit: string;
  quantityMt: string;
  unitPrice: string;
};

let nextKey = 1;
const emptyItem = (): ItemRow => ({ key: nextKey++, productName: '', specification: '', quantity: '', unit: 'MT', quantityMt: '', unitPrice: '' });
const today = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time
const numOrUndef = (v: string) => (Number.isNaN(parseNum(v)) ? undefined : parseNum(v));
const textOrNull = (v: string) => (v.trim() ? v.trim() : null);

/** Number input that accepts "1,250.50" and shows a numeric keypad on phones. */
function NumberField(props: React.ComponentProps<typeof TextField>) {
  return <TextField {...props} slotProps={{ ...props.slotProps, htmlInput: { inputMode: 'decimal', ...((props.slotProps?.htmlInput as object) ?? {}) } }} />;
}

export default function OrderFormPage() {
  const params = useParams();
  const editId = params.id ? Number(params.id) : null;
  const badId = params.id !== undefined && !(Number(params.id) > 0);
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useSaveOrder();
  const { data: suggestions = [] } = useProductSuggestions();

  const existing = useOrder(editId && editId > 0 ? editId : 0);
  const preselectId = editId ? null : Number(search.get('customerId')) || null;
  const preselect = useCustomer(preselectId);

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [piNumber, setPiNumber] = useState('');
  const [piDate, setPiDate] = useState(today());
  const [currency, setCurrency] = useState<string>(CURRENCIES[0]);
  const [items, setItems] = useState<ItemRow[]>(() => [emptyItem()]);
  const [advancePercent, setAdvancePercent] = useState('');
  const [advanceOverride, setAdvanceOverride] = useState<string | null>(null);
  const [paymentTerms, setPaymentTerms] = useState('');
  const [remarks, setRemarks] = useState('');

  // Create only: advance payment already reported + files
  const [recordAdvance, setRecordAdvance] = useState(false);
  const [adv, setAdv] = useState({ amount: '', paymentDate: today(), bankReference: '', payerBank: '', remarks: '' });
  const [files, setFiles] = useState<Record<'QUOTATION' | 'PI' | 'ADVANCE_VOUCHER', File[]>>({ QUOTATION: [], PI: [], ADVANCE_VOUCHER: [] });
  const [initialized, setInitialized] = useState(!editId);

  // Pre-fill customer from ?customerId= once. After that the user may clear or change it freely.
  const preselectApplied = useRef(false);
  useEffect(() => {
    if (preselectApplied.current || !preselect.data) return;
    preselectApplied.current = true;
    setCustomer(preselect.data.customer);
  }, [preselect.data]);
  // Credit info for whichever customer is selected now.
  const selectedCustomer = useCustomer(customer?.id ?? null);

  // Edit: copy the saved order into the form once.
  useEffect(() => {
    if (!editId || initialized || !existing.data) return;
    const { order, items: saved, customer: savedCustomer } = existing.data;
    setCustomer(savedCustomer as unknown as Customer);
    setPiNumber(order.piNumber);
    setPiDate(order.piDate);
    setCurrency(order.currency);
    setItems(
      saved.map((i) => ({
        key: nextKey++,
        productName: i.productName,
        specification: i.specification ?? '',
        quantity: String(Number(i.quantity)),
        unit: i.unit,
        quantityMt: i.quantityMt ? String(Number(i.quantityMt)) : '',
        unitPrice: String(Number(i.unitPrice)),
      })),
    );
    const pct = Number(order.advancePercent ?? 0);
    setAdvancePercent(String(pct));
    const autoAdvance = advanceFromPercent(Number(order.totalValue ?? 0), pct);
    if (Math.abs(autoAdvance - Number(order.advanceAmount ?? 0)) >= 0.005) setAdvanceOverride(String(Number(order.advanceAmount)));
    setPaymentTerms(order.paymentTerms ?? '');
    setRemarks(order.remarks ?? '');
    setInitialized(true);
  }, [editId, initialized, existing.data]);

  // Live totals (same rounding as the server)
  const totals = useMemo(() => {
    const lines = items.map((i) => {
      const q = parseNum(i.quantity);
      const p = parseNum(i.unitPrice);
      return Number.isNaN(q) || Number.isNaN(p) ? 0 : lineTotal(q, p);
    });
    const total = sum(lines);
    const pct = parseNum(advancePercent);
    const auto = Number.isNaN(pct) ? 0 : advanceFromPercent(total, pct);
    const override = advanceOverride !== null ? parseNum(advanceOverride) : NaN;
    const advance = Number.isNaN(override) ? auto : round2(override);
    return { lines, total, auto, advance, balance: round2(total - advance) };
  }, [items, advancePercent, advanceOverride]);

  const errors = fieldErrors(save.error);
  const general = formError(save.error);
  const [uploading, setUploading] = useState(false);

  const updateItem = (key: number, patch: Partial<ItemRow>) =>
    setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const body: OrderInput & { id?: number } = {
      id: editId ?? undefined,
      customerId: customer?.id ?? 0,
      piNumber: piNumber.trim(),
      piDate,
      currency,
      advancePercent: numOrUndef(advancePercent) as number,
      advanceAmount: advanceOverride !== null ? numOrUndef(advanceOverride) : undefined,
      paymentTerms: textOrNull(paymentTerms),
      remarks: textOrNull(remarks),
      items: items.map((i) => ({
        productName: i.productName.trim(),
        specification: textOrNull(i.specification),
        quantity: numOrUndef(i.quantity) as number,
        unit: i.unit,
        quantityMt: i.unit === 'MT' ? null : (numOrUndef(i.quantityMt) ?? null),
        unitPrice: numOrUndef(i.unitPrice) as number,
      })),
      advancePayment:
        !editId && recordAdvance
          ? {
              amount: numOrUndef(adv.amount) as number,
              paymentDate: adv.paymentDate || null,
              bankReference: textOrNull(adv.bankReference),
              payerBank: textOrNull(adv.payerBank),
              remarks: textOrNull(adv.remarks),
            }
          : null,
    };

    let result: Awaited<ReturnType<typeof save.mutateAsync>>;
    try {
      result = await save.mutateAsync(body);
    } catch {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    if (editId) {
      toast('Order updated');
      navigate(`/orders/${editId}`);
      return;
    }

    // Upload chosen files now that the order exists.
    const orderId = result.id!;
    const failed: string[] = [];
    setUploading(true);
    for (const category of Object.keys(files) as (keyof typeof files)[]) {
      if (!files[category].length) continue;
      try {
        await uploadDocuments(orderId, files[category], {
          category: category as DocumentCategory,
          paymentId: category === 'ADVANCE_VOUCHER' ? result.advancePaymentId : null,
        });
      } catch (err) {
        failed.push(`${category === 'PI' ? 'PI' : category.toLowerCase().replace('_', ' ')}: ${(err as Error).message}`);
      }
    }
    setUploading(false);
    if (failed.length) toast(`Order created, but some files did not upload. ${failed.join('; ')}`, 'warning');
    else toast('Order created and sent to Accounts for advance verification');
    navigate(`/orders/${orderId}`);
  }

  if (badId) return <NotFoundAlert />;
  if (editId && existing.isError) {
    return (
      <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => navigate('/sales/orders')}>My orders</Button>}>
        {formError(existing.error) ?? 'Could not load this order.'}
      </Alert>
    );
  }
  if (editId && (existing.isPending || !initialized)) return <Skeleton variant="rounded" height={420} />;
  if (editId && existing.data && !existing.data.permissions.canEdit) {
    return (
      <Alert severity="info" action={<Button color="inherit" size="small" onClick={() => navigate(`/orders/${editId}`)}>Open order</Button>}>
        This order can no longer be edited. Accounts has approved the advance payment or the order has moved on.
      </Alert>
    );
  }

  const money = (v: number) => formatMoney(v, currency);
  const submitting = save.isPending || uploading;

  return (
    <Box component="form" onSubmit={onSubmit} noValidate>
      <PageHeader
        back={editId ? { to: `/orders/${editId}`, label: 'Back to order' } : undefined}
        overline="Orders"
        title={editId ? `Edit ${existing.data?.order.orderNo}` : 'Create Order / PI'}
        subtitle={editId ? 'Changes are recorded in the order history.' : 'Register the PI approved by the customer. It goes to Accounts for advance verification.'}
      />

      {general && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {general}
        </Alert>
      )}
      {Object.keys(errors).length > 0 && (
        <Alert severity="error" sx={{ mb: 2 }}>
          Please check the highlighted fields.
        </Alert>
      )}

      <Grid container spacing={2} sx={{ alignItems: 'flex-start' }}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Stack spacing={2}>
            {/* Customer & PI */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Customer & PI
                </Typography>
                <Stack spacing={2}>
                  <CustomerPicker value={customer} onChange={setCustomer} error={errors.customerId} />
                  {customer && selectedCustomer.data?.customer.id === customer.id && selectedCustomer.data.credit.some((c) => Number(c.available) > 0) && (
                    <Alert severity="info">
                      This customer has available credit:{' '}
                      {selectedCustomer.data.credit.map((c) => formatMoney(c.available, c.currency)).join(', ')}. After you create the order, use
                      “Use customer credit” in its Payment card. Accounts verifies it.
                    </Alert>
                  )}
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: CURRENCIES.length > 1 ? 5 : 6 }}>
                      <TextField label="PI number" required value={piNumber} onChange={(e) => setPiNumber(e.target.value)} error={!!errors.piNumber} helperText={errors.piNumber} />
                    </Grid>
                    <Grid size={{ xs: 12, sm: CURRENCIES.length > 1 ? 4 : 6 }}>
                      <TextField
                        label="PI date"
                        type="date"
                        required
                        value={piDate}
                        onChange={(e) => setPiDate(e.target.value)}
                        error={!!errors.piDate}
                        helperText={errors.piDate}
                        slotProps={{ inputLabel: { shrink: true } }}
                      />
                    </Grid>
                    {CURRENCIES.length > 1 && <Grid size={{ xs: 5, sm: 3 }}>
                      <TextField select label="Currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                        {CURRENCIES.map((c) => (
                          <MenuItem key={c} value={c}>
                            {c}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Grid>}
                  </Grid>
                </Stack>
              </CardContent>
            </Card>

            {/* Products */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Products
                </Typography>
                {errors.items && (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    {errors.items}
                  </Alert>
                )}
                <Stack spacing={2} divider={<Divider flexItem />}>
                  {items.map((item, idx) => {
                    const e = (f: string) => errors[`items.${idx}.${f}`];
                    return (
                      <Box key={item.key}>
                        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
                          <Typography variant="body2" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                            Product {idx + 1}
                          </Typography>
                          <Tooltip title={items.length === 1 ? 'An order needs at least one product' : 'Remove product'}>
                            <span>
                              <IconButton
                                aria-label={`Remove product ${idx + 1}`}
                                disabled={items.length === 1}
                                onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}
                              >
                                <DeleteOutline />
                              </IconButton>
                            </span>
                          </Tooltip>
                        </Stack>
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <Autocomplete
                              freeSolo
                              options={suggestions.map((s) => s.name)}
                              inputValue={item.productName}
                              onInputChange={(_, v) => {
                                const unit = suggestions.find((s) => s.name === v)?.unit;
                                updateItem(item.key, { productName: v, ...(unit && UNITS.includes(unit) ? { unit } : {}) });
                              }}
                              renderInput={(p) => <TextField {...p} label="Product" required error={!!e('productName')} helperText={e('productName')} />}
                            />
                          </Grid>
                          <Grid size={{ xs: 6, sm: 3 }}>
                            <NumberField label="Quantity" required value={item.quantity} onChange={(ev) => updateItem(item.key, { quantity: ev.target.value })} error={!!e('quantity')} helperText={e('quantity')} />
                          </Grid>
                          <Grid size={{ xs: 6, sm: 3 }}>
                            <TextField select label="Unit" value={item.unit} onChange={(ev) => updateItem(item.key, { unit: ev.target.value })}>
                              {UNITS.map((u) => (
                                <MenuItem key={u} value={u}>
                                  {u}
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>
                          {item.unit !== 'MT' && (
                            <Grid size={{ xs: 12, sm: 6 }}>
                              <NumberField
                                label="Quantity in metric tons"
                                value={item.quantityMt}
                                onChange={(ev) => updateItem(item.key, { quantityMt: ev.target.value })}
                                helperText={e('quantityMt') ?? 'Optional, for MT reporting'}
                                error={!!e('quantityMt')}
                                slotProps={{ input: { endAdornment: <InputAdornment position="end">MT</InputAdornment> } }}
                              />
                            </Grid>
                          )}
                          <Grid size={{ xs: 12, sm: 6 }}>
                            <NumberField
                              label={`Unit price (₹ per ${item.unit})`}
                              required
                              value={item.unitPrice}
                              onChange={(ev) => updateItem(item.key, { unitPrice: ev.target.value })}
                              error={!!e('unitPrice')}
                              helperText={e('unitPrice') ?? `Line total: ${money(totals.lines[idx] ?? 0)}`}
                            />
                          </Grid>
                          <Grid size={12}>
                            <TextField label="Specification" multiline minRows={1} value={item.specification} onChange={(ev) => updateItem(item.key, { specification: ev.target.value })} placeholder="Grade, size, moisture, packing, etc." />
                          </Grid>
                        </Grid>
                      </Box>
                    );
                  })}
                </Stack>
                <Button startIcon={<AddOutlined />} onClick={() => setItems((l) => [...l, emptyItem()])} sx={{ mt: 2 }}>
                  Add product
                </Button>
              </CardContent>
            </Card>

            {/* Payment terms */}
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Payment terms
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <NumberField
                      label="Advance %"
                      required
                      value={advancePercent}
                      onChange={(e) => setAdvancePercent(e.target.value)}
                      error={!!errors.advancePercent}
                      helperText={errors.advancePercent}
                      slotProps={{ input: { endAdornment: <InputAdornment position="end">%</InputAdornment> } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <NumberField
                      label="Advance amount (₹)"
                      value={advanceOverride ?? String(totals.auto)}
                      onChange={(e) => setAdvanceOverride(e.target.value)}
                      error={!!errors.advanceAmount || !!errors.balanceAmount}
                      helperText={
                        errors.advanceAmount ?? errors.balanceAmount ?? (
                          advanceOverride === null ? (
                            'Calculated from total and advance %. Edit only to correct it.'
                          ) : (
                            <>
                              Corrected manually (auto: {money(totals.auto)}).{' '}
                              <Link component="button" type="button" onClick={() => setAdvanceOverride(null)}>
                                Use calculated amount
                              </Link>
                            </>
                          )
                        )
                      }
                    />
                  </Grid>
                  <Grid size={12}>
                    <TextField label="Payment terms" multiline minRows={2} value={paymentTerms} onChange={(e) => setPaymentTerms(e.target.value)} placeholder="e.g. 30% advance by TT, 70% balance before port gate-in" />
                  </Grid>
                  <Grid size={12}>
                    <TextField label="Remarks" multiline minRows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </Grid>
                </Grid>
              </CardContent>
            </Card>

            {!editId && (
              <>
                {/* Advance payment reported by customer */}
                <Card>
                  <CardContent>
                    <FormControlLabel
                      control={<Switch checked={recordAdvance} onChange={(e) => setRecordAdvance(e.target.checked)} />}
                      label={<Typography variant="subtitle1">Customer has already reported the advance payment</Typography>}
                    />
                    <Typography variant="body2" sx={{ color: 'text.secondary', ml: 6.5, mt: -0.5 }}>
                      You can also add this later from the order page, when the bank voucher arrives.
                    </Typography>
                    <Collapse in={recordAdvance} unmountOnExit>
                      <Grid container spacing={2} sx={{ mt: 1 }}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <NumberField
                            label="Amount received (₹)"
                            required
                            value={adv.amount}
                            onChange={(e) => setAdv({ ...adv, amount: e.target.value })}
                            helperText={`Expected advance: ${money(totals.advance)}`}
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField label="Payment date" type="date" value={adv.paymentDate} onChange={(e) => setAdv({ ...adv, paymentDate: e.target.value })} slotProps={{ inputLabel: { shrink: true } }} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField label="Bank reference / UTR / SWIFT" value={adv.bankReference} onChange={(e) => setAdv({ ...adv, bankReference: e.target.value })} />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField label="Customer's bank" value={adv.payerBank} onChange={(e) => setAdv({ ...adv, payerBank: e.target.value })} />
                        </Grid>
                        <Grid size={12}>
                          <FilePicker
                            label="Attach bank voucher"
                            hint="PDF or image"
                            files={files.ADVANCE_VOUCHER}
                            onChange={(f) => setFiles({ ...files, ADVANCE_VOUCHER: f })}
                            onError={(m) => toast(m, 'error')}
                          />
                        </Grid>
                      </Grid>
                    </Collapse>
                  </CardContent>
                </Card>

                {/* Attachments */}
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1" sx={{ mb: 2 }}>
                      Documents
                    </Typography>
                    <Stack spacing={2}>
                      <FilePicker label="Attach quotation" files={files.QUOTATION} onChange={(f) => setFiles({ ...files, QUOTATION: f })} onError={(m) => toast(m, 'error')} />
                      <FilePicker label="Attach PI" files={files.PI} onChange={(f) => setFiles({ ...files, PI: f })} onError={(m) => toast(m, 'error')} />
                    </Stack>
                    <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
                      PDF, images, Word or Excel. Up to 15 MB each.
                    </Typography>
                  </CardContent>
                </Card>
              </>
            )}
          </Stack>
        </Grid>

        {/* Summary */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ position: { md: 'sticky' }, top: { md: 88 } }}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>
                Summary
              </Typography>
              <Stack spacing={1.25}>
                <Row label={`Products (${items.length})`} value={money(totals.total)} />
                <Row label={`Advance${advancePercent ? ` (${advancePercent}%)` : ''}`} value={money(totals.advance)} />
                <Row label="Balance receivable" value={money(totals.balance)} />
                <Divider />
                <Row label="Order total" value={money(totals.total)} strong />
              </Stack>
              {totals.balance < 0 && (
                <Alert severity="error" sx={{ mt: 2 }}>
                  Advance is more than the order total.
                </Alert>
              )}
              <Button type="submit" variant="contained" size="large" fullWidth loading={submitting} sx={{ mt: 3, minHeight: 40 }}>
                {editId ? 'Save changes' : 'Create order & send to Accounts'}
              </Button>
              {!editId && (
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1.5 }}>
                  You can still edit the order until Accounts approves the advance payment.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 2 }}>
      <Typography sx={{ color: strong ? 'text.primary' : 'text.secondary', fontWeight: strong ? 600 : 400 }}>{label}</Typography>
      <Typography sx={{ fontWeight: strong ? 700 : 500, fontSize: strong ? 18 : undefined }}>{value}</Typography>
    </Stack>
  );
}

function NotFoundAlert() {
  const navigate = useNavigate();
  return (
    <Alert severity="warning" action={<Button color="inherit" size="small" onClick={() => navigate('/sales/orders')}>My orders</Button>}>
      This order link is not valid.
    </Alert>
  );
}
