import type { ReactNode } from 'react';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import PeopleOutlined from '@mui/icons-material/PeopleOutlined';
import AddCircleOutline from '@mui/icons-material/AddCircleOutlineOutlined';
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined';
import PaymentsOutlined from '@mui/icons-material/PaymentsOutlined';
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import SavingsOutlined from '@mui/icons-material/SavingsOutlined';
import TaskAltOutlined from '@mui/icons-material/TaskAltOutlined';
import ArchiveOutlined from '@mui/icons-material/ArchiveOutlined';
import PrecisionManufacturingOutlined from '@mui/icons-material/PrecisionManufacturingOutlined';
import LocalShippingOutlined from '@mui/icons-material/LocalShippingOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import PendingActionsOutlined from '@mui/icons-material/PendingActionsOutlined';
import ListAltOutlined from '@mui/icons-material/ListAltOutlined';
import BlockOutlined from '@mui/icons-material/BlockOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';
import CategoryOutlined from '@mui/icons-material/CategoryOutlined';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import AdminPanelSettingsOutlined from '@mui/icons-material/AdminPanelSettingsOutlined';
import BadgeOutlined from '@mui/icons-material/BadgeOutlined';
import TableChartOutlined from '@mui/icons-material/TableChartOutlined';
import { can, type Permission, type User } from '../auth/roles';

export type NavSection =
  | 'Sales'
  | 'Accounts'
  | 'QC / Production'
  | 'Packaging'
  | 'Documentation'
  | 'Management'
  | 'Inventory'
  | 'Analytics'
  | 'Administration';

/** Sections that always keep their own heading. The others show as "Home" when the user has only one of them. */
export const SHARED_SECTIONS: NavSection[] = ['Inventory', 'Analytics', 'Administration'];

/** A collapsible group of menu items inside a section (e.g. Reports ▸ Sales-wise, Product-wise). */
export type NavMenu = { key: string; label: string; icon: ReactNode };
export const REPORTS_MENU: NavMenu = { key: 'reports', label: 'Reports', icon: <AssessmentOutlined /> };

export type NavItem = {
  path: string;
  label: string;
  icon: ReactNode;
  /** Short description shown on the screen until it is built. */
  description: string;
  phase: number;
  /** Other path prefixes that should highlight this item (e.g. order detail pages). */
  also?: string[];
  section: NavSection;
  /** The user's role needs this permission to see the item and open the page. */
  perm: Permission;
  /** Hide the item when the user has this permission (a fuller version of the same screen is shown instead). */
  hiddenIf?: Permission;
  /** Show inside this dropdown. Items of one dropdown must be next to each other. */
  menu?: NavMenu;
};

const S: NavSection = 'Sales';
const A: NavSection = 'Accounts';
const Q: NavSection = 'QC / Production';
const P: NavSection = 'Packaging';
const D: NavSection = 'Documentation';
const M: NavSection = 'Management';
const I: NavSection = 'Inventory';
// Holds the Reports dropdown and the audit log (heading differs from the dropdown's own label).
const R: NavSection = 'Analytics';
const AD: NavSection = 'Administration';

// Screens from the developer document, Sections 5 and 10, in sidebar order.
export const NAV_ITEMS: NavItem[] = [
  { section: S, perm: 'orders.create', path: '/sales', label: 'Dashboard', icon: <DashboardOutlined />, description: 'Your orders and what needs attention.', phase: 4 },
  { section: S, perm: 'orders.create', path: '/sales/orders', label: 'My Orders', icon: <ReceiptLongOutlined />, description: 'All orders you registered, with current stage.', phase: 4, also: ['/orders'] },
  { section: S, perm: 'orders.create', path: '/sales/orders/new', label: 'Create Order / PI', icon: <AddCircleOutline />, description: 'Register an approved PI with products, pricing and payment terms.', phase: 4 },
  { section: S, perm: 'customers.manage', path: '/sales/customers', label: 'Customers', icon: <PeopleOutlined />, description: 'Customer list, order history and credit / withheld balance.', phase: 4 },
  { section: S, perm: 'payments.record', path: '/sales/balance-payments', label: 'Balance Payments', icon: <PaymentsOutlined />, description: 'Record customer balance payment confirmations.', phase: 9 },

  { section: A, perm: 'payments.verify', path: '/accounts', label: 'Verification Queue', icon: <FactCheckOutlined />, description: 'Advance and balance payments waiting for verification.', phase: 5, also: ['/orders'] },
  { section: A, perm: 'orders.close', path: '/accounts/final', label: 'Final Verification', icon: <TaskAltOutlined />, description: 'Completed orders waiting for final check and closure.', phase: 9 },
  { section: A, perm: 'credits.manage', path: '/accounts/credits', label: 'Refunds & Withheld', icon: <SavingsOutlined />, description: 'Refunds and amounts withheld for future orders.', phase: 9 },
  { section: A, perm: 'orders.close', path: '/accounts/closed', label: 'Closed Orders', icon: <ArchiveOutlined />, description: 'Closed orders and financial history.', phase: 9 },

  { section: Q, perm: 'qc.work', path: '/qc', label: 'Dashboard', icon: <DashboardOutlined />, description: 'Counts by stage and the next orders due.', phase: 6 },
  { section: Q, perm: 'qc.work', path: '/qc/queue', label: 'In QC / Production', icon: <PrecisionManufacturingOutlined />, description: 'Payment-confirmed orders: sourcing, timeline, quality check and images.', phase: 6, also: ['/orders'] },
  { section: Q, perm: 'qc.work', path: '/qc/sent', label: 'Sent to Packaging', icon: <TaskAltOutlined />, description: 'Orders you finished and handed to Packaging.', phase: 6 },

  { section: P, perm: 'packaging.work', path: '/packaging', label: 'Packaging Queue', icon: <Inventory2Outlined />, description: 'QC-ready orders: packaging status, packed quantity, issues and photos.', phase: 7, also: ['/orders'] },
  { section: P, perm: 'packaging.work', path: '/packaging/sent', label: 'Sent to Documentation', icon: <LocalShippingOutlined />, description: 'Orders you packed and handed to Documentation, and where they are now.', phase: 7 },

  { section: D, perm: 'documentation.work', path: '/documentation', label: 'Documentation Queue', icon: <LocalShippingOutlined />, description: 'Ready orders: container booking, loading and gate-in.', phase: 8, also: ['/orders'] },
  { section: D, perm: 'documentation.work', path: '/documentation/bill-release', label: 'Bill Release', icon: <DescriptionOutlined />, description: 'Record release of the loading bill and documents.', phase: 8 },

  { section: M, perm: 'overview.view', path: '/admin', label: 'Overview', icon: <DashboardOutlined />, description: 'Orders by stage, payments and outstanding summary.', phase: 11 },
  { section: M, perm: 'orders.view_all', path: '/admin/orders', label: 'All Orders', icon: <ListAltOutlined />, description: 'Every order, read-only, with full history.', phase: 11, also: ['/orders'] },
  { section: M, perm: 'overview.view', path: '/admin/pending', label: 'Pending Actions', icon: <PendingActionsOutlined />, description: 'What each department still has to do.', phase: 11 },
  { section: M, perm: 'customers.view', hiddenIf: 'customers.manage', path: '/admin/customers', label: 'Customers', icon: <PeopleOutlined />, description: 'Customer and order history.', phase: 11 },
  { section: M, perm: 'overview.view', path: '/admin/cancellations', label: 'Cancellations', icon: <BlockOutlined />, description: 'Cancelled orders / PIs and reasons.', phase: 11 },

  { section: I, perm: 'products.manage', path: '/admin/products', label: 'Products', icon: <CategoryOutlined />, description: 'Products Sales can pick on orders.', phase: 2 },

  { section: R, menu: REPORTS_MENU, perm: 'reports.view', path: '/reports/sales', label: 'Sales-wise Report', icon: <BadgeOutlined />, description: 'Orders, value and collections per sales person.', phase: 12 },
  { section: R, menu: REPORTS_MENU, perm: 'reports.view', path: '/reports/products', label: 'Product-wise Report', icon: <CategoryOutlined />, description: 'Quantity and value sold per product.', phase: 12 },
  { section: R, menu: REPORTS_MENU, perm: 'reports.view', path: '/reports', label: 'Orders & Balances', icon: <TableChartOutlined />, description: 'Order and customer balance reports.', phase: 12 },
  { section: R, perm: 'audit.view', path: '/admin/audit', label: 'Audit Log', icon: <HistoryOutlined />, description: 'Every change with who and when.', phase: 12 },

  { section: AD, perm: 'users.manage', path: '/admin/users', label: 'Users', icon: <ManageAccountsOutlined />, description: 'Add staff, set roles and reset passwords.', phase: 2 },
  { section: AD, perm: 'roles.manage', path: '/admin/roles', label: 'Roles & Permissions', icon: <AdminPanelSettingsOutlined />, description: 'Create roles and choose what each role can do.', phase: 2 },
];

/** Menu items this user may see, in sidebar order. */
export function navFor(user: Pick<User, 'permissions'> | null | undefined): NavItem[] {
  return NAV_ITEMS.filter((i) => can(user, i.perm) && !(i.hiddenIf && can(user, i.hiddenIf)));
}

/** Shown when a role has no screens at all. */
export const NO_ACCESS_PATH = '/no-access';

/** Where the user lands after login: their first menu item. */
export function homePath(user: Pick<User, 'permissions'> | null | undefined): string {
  if (!user) return '/login';
  return navFor(user)[0]?.path ?? NO_ACCESS_PATH;
}

/** "Back" link on an order page: the user's main order list. */
export function ordersListFor(user: Pick<User, 'permissions'> | null | undefined): { to: string; label: string } {
  const lists: [Permission, string, string][] = [
    ['orders.create', '/sales/orders', 'My orders'],
    ['payments.verify', '/accounts', 'Verification queue'],
    ['qc.work', '/qc/queue', 'In QC / Production'],
    ['packaging.work', '/packaging', 'Packaging queue'],
    ['documentation.work', '/documentation', 'Documentation queue'],
    ['orders.view_all', '/admin/orders', 'All orders'],
  ];
  const hit = lists.find(([p]) => can(user, p));
  return hit ? { to: hit[1], label: hit[2] } : { to: homePath(user), label: 'Back' };
}
