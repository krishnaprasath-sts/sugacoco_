import { useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Grid,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import EditOutlined from '@mui/icons-material/EditOutlined';
import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import { useCustomer } from '../../api/customers';
import { formatDate, formatMoney } from '../../lib/format';
import { formError } from '../../lib/formErrors';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable, { OrderLink } from '../../components/ResponsiveTable';
import StatusChip from '../../components/StatusChip';
import EmptyState from '../../components/EmptyState';
import { useToast } from '../../components/useToast';
import CustomerFormDialog from './CustomerFormDialog';

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Box>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {label}
      </Typography>
      <Typography sx={{ wordBreak: 'break-word' }}>{value || '—'}</Typography>
    </Box>
  );
}

export default function CustomerDetailPage({ basePath = '/sales/customers', readOnly = false }: { basePath?: string; readOnly?: boolean }) {
  const id = Number(useParams().id);
  const { data, isPending, error } = useCustomer(id);
  const [editing, setEditing] = useState(false);
  const toast = useToast();

  if (error) return <Alert severity="error">{formError(error)}</Alert>;
  if (isPending || !data) return <Skeleton variant="rounded" height={300} />;
  const { customer: c, orders, credit } = data;
  const address = [c.addressLine1, c.addressLine2, [c.city, c.state, c.postalCode].filter(Boolean).join(', '), c.country]
    .filter(Boolean)
    .join('\n');

  return (
    <Box>
      <PageHeader
        back={{ to: basePath, label: 'Customers' }}
        overline="Customer Details"
        title={c.companyName}
        subtitle={[c.contactPerson, c.country].filter(Boolean).join(' · ')}
        actions={
          readOnly ? undefined : (
          <>
            <Button variant="outlined" startIcon={<EditOutlined />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button
              variant="contained"
              startIcon={<AddCircleOutline />}
              component={RouterLink}
              to={`/sales/orders/new?customerId=${c.id}`}
            >
              New order
            </Button>
          </>
          )
        }
      />

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 2 }}>
                  Contact
                </Typography>
                <Stack spacing={1.5}>
                  <Info label="Contact person" value={c.contactPerson} />
                  <Info label="Email" value={c.email} />
                  <Info label="Phone" value={[c.phone, c.altPhone].filter(Boolean).join(' / ')} />
                  <Info label="Address" value={<span style={{ whiteSpace: 'pre-line' }}>{address}</span>} />
                  {c.notes && <Info label="Notes" value={c.notes} />}
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant="subtitle1" sx={{ mb: 1 }}>
                  Credit / withheld balance
                </Typography>
                {credit.length === 0 ? (
                  <Typography sx={{ color: 'text.secondary' }}>No available credit.</Typography>
                ) : (
                  credit.map((cr) => (
                    <Typography key={cr.currency} variant="h6">
                      {formatMoney(cr.available, cr.currency)}
                    </Typography>
                  ))
                )}
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1 }}>
                  Amounts verified by Accounts that can be used on a future order.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardContent sx={{ pb: 0 }}>
              <Typography variant="subtitle1">Order history ({orders.length})</Typography>
            </CardContent>
            {orders.length === 0 ? (
              <EmptyState icon={<ReceiptLongOutlined />} title="No orders yet" />
            ) : (
              <ResponsiveTable
                ariaLabel="Order history"
                size="small"
                minWidth={560}
                rows={orders}
                rowKey={(o) => o.id}
                columns={[
                  { label: 'Order / PI', mobile: 'title', render: (o) => <OrderLink id={o.id} no={o.orderNo} pi={o.piNumber} /> },
                  { label: 'PI date', nowrap: true, render: (o) => formatDate(o.piDate) },
                  { label: 'Value', align: 'right', nowrap: true, mobile: 'end', render: (o) => formatMoney(o.totalValue, o.currency) },
                  { label: 'Status', render: (o) => <StatusChip status={o.status} /> },
                ]}
              />
            )}
          </Card>
        </Grid>
      </Grid>

      {editing && (
        <CustomerFormDialog
          customer={c}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            toast('Customer updated');
          }}
        />
      )}
    </Box>
  );
}
