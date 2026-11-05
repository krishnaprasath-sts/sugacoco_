import { useMemo, useState } from 'react';
import { Box, Button, Card, IconButton, InputAdornment, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import CategoryOutlined from '@mui/icons-material/CategoryOutlined';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable from '../../components/ResponsiveTable';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { useToast } from '../../components/useToast';
import { formError } from '../../lib/formErrors';
import { useProducts, useUpdateProduct, type Product } from './productsApi';
import ProductFormDialog from './ProductFormDialog';

/** MD/Admin keeps the product list. Sales can only pick active products on an order. */
export default function ProductsPage() {
  const { data: products = [], isPending, error, refetch } = useProducts();
  const update = useUpdateProduct();
  const toast = useToast();
  const [dialog, setDialog] = useState<{ product: Product | null } | null>(null);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.hsCode?.toLowerCase().includes(q)) : products;
  }, [products, search]);
  const activeCount = products.filter((p) => p.isActive).length;

  function toggle(p: Product) {
    if (p.isActive && !window.confirm(`Hide ${p.name}? Sales can no longer pick it on new orders. Old orders are not changed.`)) return;
    update.mutate(
      { id: p.id, isActive: !p.isActive },
      {
        onSuccess: () => toast(`${p.name} ${p.isActive ? 'hidden from new orders' : 'available again'}`),
        onError: (err) => toast(formError(err) ?? 'Could not update product', 'error'),
      },
    );
  }

  return (
    <Box>
      <PageHeader
        overline="Administration"
        title="Products"
        subtitle={`The list Sales picks from when creating an order. ${activeCount} active.`}
        actions={
          <Button variant="contained" startIcon={<AddCircleOutline />} onClick={() => setDialog({ product: null })}>
            Add product
          </Button>
        }
      />
      <TextField
        size="small"
        placeholder="Search product or HS code"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, maxWidth: { md: 360 } }}
        slotProps={{
          htmlInput: { 'aria-label': 'Search products' },
          input: { startAdornment: <InputAdornment position="start"><SearchOutlined fontSize="small" /></InputAdornment> },
        }}
      />
      {error && <ErrorState error={error} onRetry={() => refetch()} />}
      {!error && (
        <Card>
          <ResponsiveTable
            ariaLabel="Products"
            loading={isPending}
            rows={rows}
            rowKey={(p) => p.id}
            columns={[
              {
                label: 'Product',
                mobile: 'title',
                render: (p) => (
                  <>
                    <Typography sx={{ fontWeight: 600, fontSize: 14, opacity: p.isActive ? 1 : 0.6 }}>{p.name}</Typography>
                    {p.description && (
                      <Typography variant="body2" sx={{ color: 'text.secondary', maxWidth: 360 }}>
                        {p.description}
                      </Typography>
                    )}
                  </>
                ),
              },
              { label: 'Default unit', render: (p) => p.defaultUnit, nowrap: true },
              { label: 'HS code', render: (p) => p.hsCode ?? '—', nowrap: true },
              { label: 'Used on', render: (p) => `${p.orderCount} order${p.orderCount === 1 ? '' : 's'}`, nowrap: true },
              {
                label: 'Available',
                render: (p) => (
                  <Stack direction="row" sx={{ alignItems: 'center' }}>
                    <Switch
                      checked={p.isActive}
                      disabled={update.isPending}
                      onChange={() => toggle(p)}
                      slotProps={{ input: { 'aria-label': `${p.isActive ? 'Hide' : 'Show'} ${p.name}` } }}
                    />
                    <Typography component="span" variant="body2" sx={{ color: 'text.secondary' }}>
                      {p.isActive ? 'Active' : 'Hidden'}
                    </Typography>
                  </Stack>
                ),
              },
              {
                label: 'Edit',
                align: 'right',
                mobile: 'end',
                hideMobileLabel: true,
                render: (p) => (
                  <Tooltip title="Edit">
                    <IconButton
                      aria-label={`Edit ${p.name}`}
                      onClick={() => setDialog({ product: p })}
                      sx={{ bgcolor: '#E8F0FE', color: '#2563EB', '&:hover': { bgcolor: '#D6E4FD' } }}
                    >
                      <EditOutlined />
                    </IconButton>
                  </Tooltip>
                ),
              },
            ]}
          />
          {!isPending && !rows.length && (
            <EmptyState
              icon={<CategoryOutlined />}
              title={search ? 'No matching products' : 'No products yet'}
              text={search ? 'Try another name or HS code.' : 'Add the products you sell so Sales can pick them on orders.'}
            />
          )}
        </Card>
      )}
      {dialog && (
        <ProductFormDialog
          product={dialog.product}
          onClose={() => setDialog(null)}
          onSaved={(m) => {
            setDialog(null);
            toast(m);
          }}
        />
      )}
    </Box>
  );
}
