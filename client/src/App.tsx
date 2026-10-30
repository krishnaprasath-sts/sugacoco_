import { lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Box, CircularProgress } from '@mui/material';
import { useMe } from './auth/useAuth';
import { ROLE_HOME, type Role } from './auth/roles';
import { NAV } from './nav/navConfig';
import RequireAuth from './components/RequireAuth';
import AppLayout from './layouts/AppLayout';
// Pages load on demand: each role downloads only its own screens, and the public tracking page stays small.
const named = <T extends Record<string, ComponentType>>(load: () => Promise<T>, name: keyof T) =>
  lazy(() => load().then((m) => ({ default: m[name] as ComponentType })));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const TrackingPage = lazy(() => import('./pages/TrackingPage'));
const PlaceholderPage = lazy(() => import('./pages/PlaceholderPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));
const UsersPage = lazy(() => import('./pages/admin/UsersPage'));
const VerificationQueuePage = lazy(() => import('./pages/accounts/VerificationQueuePage'));
const FinalVerificationPage = lazy(() => import('./pages/accounts/FinalVerificationPage'));
const CreditsPage = lazy(() => import('./pages/accounts/CreditsPage'));
const QcQueuePage = lazy(() => import('./pages/qc/QcQueuePage'));
const PackagingQueuePage = lazy(() => import('./pages/packaging/PackagingQueuePage'));
const PackagingSentPage = lazy(() => import('./pages/packaging/PackagingSentPage'));
const DocumentationQueuePage = lazy(() => import('./pages/documentation/DocumentationQueuePage'));
const SalesDashboard = lazy(() => import('./pages/sales/SalesDashboard'));
const MyOrdersPage = lazy(() => import('./pages/sales/MyOrdersPage'));
const OrderFormPage = lazy(() => import('./pages/sales/OrderFormPage'));
const CustomersPage = lazy(() => import('./pages/sales/CustomersPage'));
const CustomerDetailPage = lazy(() => import('./pages/sales/CustomerDetailPage'));
const BalancePaymentsPage = lazy(() => import('./pages/sales/BalancePaymentsPage'));
const OrderDetailPage = lazy(() => import('./pages/orders/OrderDetailPage'));
const OrdersListPage = lazy(() => import('./pages/orders/OrdersListPage'));
const AdminOverviewPage = named(() => import('./pages/admin/AdminPages'), 'AdminOverviewPage');
const CancellationsPage = named(() => import('./pages/admin/AdminPages'), 'CancellationsPage');
const PendingActionsPage = named(() => import('./pages/admin/AdminPages'), 'PendingActionsPage');
const AuditLogPage = named(() => import('./pages/reports/ReportsPages'), 'AuditLogPage');
const ReportsPage = named(() => import('./pages/reports/ReportsPages'), 'ReportsPage');


// Built screens. Any nav path not listed here shows the placeholder.
const PAGES: Record<string, ReactNode> = {
  '/sales': <SalesDashboard />,
  '/sales/orders': <MyOrdersPage />,
  '/sales/orders/new': <OrderFormPage />,
  '/sales/customers': <CustomersPage />,
  '/sales/balance-payments': <BalancePaymentsPage />,
  '/accounts': <VerificationQueuePage />,
  '/accounts/final': <FinalVerificationPage />,
  '/accounts/credits': <CreditsPage />,
  '/accounts/closed': <OrdersListPage overline="Accounts" title="Closed Orders" subtitle="Completed orders and their financial history." statuses={['CLOSED']} />,
  '/accounts/reports': <ReportsPage />,
  '/qc': <QcQueuePage />,
  '/packaging': <PackagingQueuePage />,
  '/packaging/sent': <PackagingSentPage />,
  '/documentation': <DocumentationQueuePage />,
  '/documentation/bill-release': <DocumentationQueuePage defaultTab="release" />,
  '/admin': <AdminOverviewPage />,
  '/admin/orders': <OrdersListPage overline="MD / Admin" title="All Orders" subtitle="Every order, read-only. Open one to see its full history or cancel it." />,
  '/admin/pending': <PendingActionsPage />,
  '/admin/customers': <CustomersPage basePath="/admin/customers" readOnly />,
  '/admin/cancellations': <CancellationsPage />,
  '/admin/reports': <ReportsPage />,
  '/admin/audit': <AuditLogPage />,
  '/admin/users': <UsersPage />,
};

/** Pages that aren't menu items (detail and edit screens). */
const EXTRA_ROUTES: { path: string; roles?: Role[]; element: ReactNode }[] = [
  { path: '/orders/:id', element: <OrderDetailPage /> }, // every role; API hides what they can't see
  { path: '/sales/orders/:id/edit', roles: ['SALES'], element: <OrderFormPage /> },
  { path: '/sales/customers/:id', roles: ['SALES'], element: <CustomerDetailPage /> },
  { path: '/admin/customers/:id', roles: ['ADMIN'], element: <CustomerDetailPage basePath="/admin/customers" readOnly /> },
];

function HomeRedirect() {
  const { data: user, isPending } = useMe();
  if (isPending) {
    return (
      <Box sx={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <CircularProgress aria-label="Loading" />
      </Box>
    );
  }
  return <Navigate to={user ? ROLE_HOME[user.role] : '/login'} replace />;
}

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/track/:token" element={<TrackingPage />} />
      <Route path="/" element={<HomeRedirect />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          {(Object.keys(NAV) as Role[]).map((role) => (
            // Each department's pages are only reachable by that role (the API checks again).
            <Route key={role} element={<RequireAuth roles={[role]} />}>
              {NAV[role].map((item) => (
                <Route key={item.path} path={item.path} element={PAGES[item.path] ?? <PlaceholderPage item={item} />} />
              ))}
            </Route>
          ))}
          {EXTRA_ROUTES.map((r) =>
            r.roles ? (
              <Route key={r.path} element={<RequireAuth roles={r.roles} />}>
                <Route path={r.path} element={r.element} />
              </Route>
            ) : (
              <Route key={r.path} path={r.path} element={r.element} />
            ),
          )}
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
    </Suspense>
  );
}

function PageLoader() {
  return (
    <Box sx={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}>
      <CircularProgress aria-label="Loading" />
    </Box>
  );
}
