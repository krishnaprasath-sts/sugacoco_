import { useEffect, useState } from 'react';
import { useUrlPage, useUrlState } from '../../lib/useUrlState';
import { Link as RouterLink, useNavigate } from 'react-router';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import Search from '@mui/icons-material/Search';
import PersonAddAlt1Outlined from '@mui/icons-material/PersonAddAlt1Outlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import { useCustomers } from '../../api/customers';
import { useDebounced } from '../../lib/useDebounced';
import { formatDate } from '../../lib/format';
import PageHeader from '../../components/PageHeader';
import { usePageSize } from '../../lib/pageSize';
import ListPagination from '../../components/ListPagination';
import EmptyState from '../../components/EmptyState';
import ErrorState from '../../components/ErrorState';
import { useToast } from '../../components/useToast';
import CustomerFormDialog from './CustomerFormDialog';


/** Sales manage customers; MD/Admin get the same list read-only (basePath /admin/customers). */
export default function CustomersPage({ basePath = '/sales/customers', readOnly = false }: { basePath?: string; readOnly?: boolean }) {
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const toast = useToast();
  const [urlQ, setUrlQ] = useUrlState('q');
  const [q, setQ] = useState(urlQ);
  const [page, setPage] = useUrlPage();
  const [adding, setAdding] = useState(false);
  const query = useDebounced(q);
  useEffect(() => {
    if (query !== urlQ) setUrlQ(query, { resetPage: true });
  }, [query, urlQ, setUrlQ]);
  const [pageSize] = usePageSize();
  const { data, isPending, error, refetch } = useCustomers({ q: query, page, pageSize });
  const customers = data?.customers ?? [];

  const location = (c: { city: string | null; country: string | null }) => [c.city, c.country].filter(Boolean).join(', ') || '—';

  return (
    <Box>
      <PageHeader
        overline="Customer Details"
        title="Manage Customers"
        subtitle="Search existing customers before adding a new one."
        actions={
          readOnly ? undefined : (
            <Button variant="contained" startIcon={<PersonAddAlt1Outlined />} onClick={() => setAdding(true)} fullWidth={!isDesktop}>
              New customer
            </Button>
          )
        }
      />

      <TextField
        placeholder="Search by company, contact, email, phone or country"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        sx={{ mb: 2, maxWidth: { md: 480 } }}
        size="small"
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> },
          htmlInput: { 'aria-label': 'Search customers' },
        }}
      />

      {error ? (
        <ErrorState error={error} onRetry={() => refetch()} />
      ) : !isPending && customers.length === 0 ? (
        <Card>
          <EmptyState
            icon={<PeopleOutlined />}
            title={query ? 'No customers match your search' : 'No customers yet'}
            text={query ? 'Try another name, or add them as a new customer.' : 'Add your first customer to start registering orders.'}
          />
        </Card>
      ) : isDesktop ? (
        <Card>
          <TableContainer>
            <Table aria-label="Customers">
              <TableHead>
                <TableRow>
                  <TableCell>Company</TableCell>
                  <TableCell>Contact</TableCell>
                  <TableCell>Location</TableCell>
                  <TableCell align="right">Orders</TableCell>
                  <TableCell>Last PI date</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {isPending &&
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton />
                      </TableCell>
                    </TableRow>
                  ))}
                {customers.map((c) => (
                  <TableRow
                    key={c.id}
                    hover
                    onClick={() => navigate(`${basePath}/${c.id}`)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell>
                      <Typography
                        component={RouterLink}
                        to={`${basePath}/${c.id}`}
                        onClick={(e) => e.stopPropagation()}
                        sx={{ fontWeight: 600, fontSize: 14, color: 'text.primary', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                      >
                        {c.companyName}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{c.contactPerson ?? '—'}</Typography>
                      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                        {[c.email, c.phone].filter(Boolean).join(' · ')}
                      </Typography>
                    </TableCell>
                    <TableCell>{location(c)}</TableCell>
                    <TableCell align="right">{c.orderCount ?? 0}</TableCell>
                    <TableCell>{formatDate(c.lastOrderDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Card>
      ) : (
        <Stack spacing={1.5}>
          {isPending && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} variant="rounded" height={88} />)}
          {customers.map((c) => (
            <Card key={c.id}>
              <CardActionArea component={RouterLink} to={`${basePath}/${c.id}`} sx={{ p: 2 }}>
                <Typography sx={{ fontWeight: 600 }}>{c.companyName}</Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                  {[c.contactPerson, location(c)].filter((v) => v && v !== '—').join(' · ') || '—'}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
                  {c.orderCount ?? 0} orders
                </Typography>
              </CardActionArea>
            </Card>
          ))}
        </Stack>
      )}

      <ListPagination page={page} pageSize={pageSize} total={data?.total ?? 0} onChange={setPage} noun="customers" />

      {adding && (
        <CustomerFormDialog
          initialName={q}
          onClose={() => setAdding(false)}
          onSaved={(c) => {
            setAdding(false);
            toast(`${c.companyName} added`);
            navigate(`${basePath}/${c.id}`);
          }}
        />
      )}
    </Box>
  );
}
