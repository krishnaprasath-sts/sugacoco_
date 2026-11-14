import { useMemo, useState } from 'react';
import { Box, Button, Card, IconButton, InputAdornment, Stack, Switch, TextField, Tooltip, Typography } from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined';
import EditOutlined from '@mui/icons-material/EditOutlined';
import DeleteOutlineOutlined from '@mui/icons-material/DeleteOutlineOutlined';
import SearchOutlined from '@mui/icons-material/SearchOutlined';
import CategoryOutlined from '@mui/icons-material/CategoryOutlined';
import PageHeader from '../../components/PageHeader';
import ResponsiveTable from '../../components/ResponsiveTable';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { useConfirm, useToast } from '../../components/useToast';
import { formError } from '../../lib/formErrors';
import { useDeleteProduct, useProducts, useUpdateProduct, type Product } from './productsApi';
import ProductFormDialog from './ProductFormDialog';

/** MD/Admin keeps the product list. Sales can only pick active products on an order. */
export default function ProductsPage() {
  const { data: products = [], isPending, error, refetch } = useProducts();
  const update = useUpdateProduct();
  const remove = useDeleteProduct();
  const toast = useToast();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<{ product: Product | null } | null>(null);
  const [search, setSearch] = useState('');

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? products.filter((p) => p.name.toLowerCase().includes(q) || p.hsCode?.toLowerCase().includes(q)) : products;
  }, [products, search]);
  const activeCount = products.filter((p) => p.isActive).length;

  async function deleteProduct(p: Product) {
    const ok = await confirm({
      title: `Delete ${p.name}?`,
      message: 'This product will be removed permanently. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    remove.mutate(p.id, {
      onSuccess: () => toast(`${p.name} deleted`),
      onError: (err) => toast(formError(err) ?? 'Could not delete product', 'error'),
    });
  }

  async function toggle(p: Product) {
    if (p.isActive) {
      const ok = await confirm({
        title: `Hide ${p.name}?`,
        message: 'Sales can no longer pick it on new orders. Old orders are not changed.',
        confirmLabel: 'Hide',
        danger: true,
      });
      if (!ok) return;
    }
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
                label: 'Actions',
                align: 'right',
                nowrap: true,
                mobile: 'end',
                hideMobileLabel: true,
                render: (p) => (
                  <Box sx={{ whiteSpace: 'nowrap' }}>
                    <Tooltip title="Edit">
                      <IconButton
                        aria-label={`Edit ${p.name}`}
                        onClick={() => setDialog({ product: p })}
                        sx={{ bgcolor: '#E8F0FE', color: '#2563EB', mr: 1, '&:hover': { bgcolor: '#D6E4FD' } }}
                      >
                        <EditOutlined />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={p.orderCount > 0 ? 'Used on orders — hide it instead' : 'Delete'}>
                      <span>
                        <IconButton
                          aria-label={`Delete ${p.name}`}
                          onClick={() => deleteProduct(p)}
                          disabled={p.orderCount > 0 || remove.isPending}
                          sx={{ bgcolor: '#FDECEC', color: '#DC2626', '&:hover': { bgcolor: '#FBDADA' }, '&.Mui-disabled': { bgcolor: '#F3F4F6' } }}
                        >
                          <DeleteOutlineOutlined />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
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
