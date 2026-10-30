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
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';
import HistoryOutlined from '@mui/icons-material/HistoryOutlined';
import Inventory2Outlined from '@mui/icons-material/Inventory2Outlined';
import type { Role } from '../auth/roles';

export type NavItem = {
  path: string;
  label: string;
  icon: ReactNode;
  /** Short description shown on the screen until it is built. */
  description: string;
  phase: number;
  /** Other path prefixes that should highlight this item (e.g. order detail pages). */
  also?: string[];
  /** Sidebar section heading. Default: Home. */
  section?: string;
};

// Screens from the developer document, Sections 5 and 10. One list per role.
export const NAV: Record<Role, NavItem[]> = {
  SALES: [
    { path: '/sales', label: 'Dashboard', icon: <DashboardOutlined />, description: 'Your orders and what needs attention.', phase: 4 },
    { path: '/sales/orders', label: 'My Orders', icon: <ReceiptLongOutlined />, description: 'All orders you registered, with current stage.', phase: 4, also: ['/orders'] },
    { path: '/sales/orders/new', label: 'Create Order / PI', icon: <AddCircleOutline />, description: 'Register an approved PI with products, pricing and payment terms.', phase: 4 },
    { path: '/sales/customers', label: 'Customers', icon: <PeopleOutlined />, description: 'Customer list, order history and credit / withheld balance.', phase: 4 },
    { path: '/sales/balance-payments', label: 'Balance Payments', icon: <PaymentsOutlined />, description: 'Record customer balance payment confirmations.', phase: 9 },
  ],
  ACCOUNTS: [
    { path: '/accounts', label: 'Verification Queue', icon: <FactCheckOutlined />, description: 'Advance and balance payments waiting for verification.', phase: 5, also: ['/orders'] },
    { path: '/accounts/final', label: 'Final Verification', icon: <TaskAltOutlined />, description: 'Completed orders waiting for final check and closure.', phase: 9 },
    { path: '/accounts/credits', label: 'Refunds & Withheld', icon: <SavingsOutlined />, description: 'Refunds and amounts withheld for future orders.', phase: 9 },
    { path: '/accounts/closed', label: 'Closed Orders', icon: <ArchiveOutlined />, description: 'Closed orders and financial history.', phase: 9 },
    { path: '/accounts/reports', label: 'Reports', icon: <AssessmentOutlined />, description: 'Order and customer balance reports.', phase: 12 },
  ],
  QC: [
    { path: '/qc', label: 'QC Work Queue', icon: <PrecisionManufacturingOutlined />, description: 'Payment-confirmed orders: sourcing, timeline, quality check and images.', phase: 6, also: ['/orders'] },
  ],
  PACKAGING: [
    { path: '/packaging', label: 'Packaging Queue', icon: <Inventory2Outlined />, description: 'QC-ready orders: packaging status, packed quantity, issues and photos.', phase: 7, also: ['/orders'] },
    { path: '/packaging/sent', label: 'Sent to Documentation', icon: <LocalShippingOutlined />, description: 'Orders you packed and handed to Documentation, and where they are now.', phase: 7 },
  ],
  DOCUMENTATION: [
    { path: '/documentation', label: 'Documentation Queue', icon: <LocalShippingOutlined />, description: 'Ready orders: container booking, loading and gate-in.', phase: 8, also: ['/orders'] },
    { path: '/documentation/bill-release', label: 'Bill Release', icon: <DescriptionOutlined />, description: 'Record release of the loading bill and documents.', phase: 8 },
  ],
  ADMIN: [
    { path: '/admin', label: 'Overview', icon: <DashboardOutlined />, description: 'Orders by stage, payments and outstanding summary.', phase: 11 },
    { path: '/admin/orders', label: 'All Orders', icon: <ListAltOutlined />, description: 'Every order, read-only, with full history.', phase: 11, also: ['/orders'] },
    { path: '/admin/pending', label: 'Pending Actions', icon: <PendingActionsOutlined />, description: 'What each department still has to do.', phase: 11 },
    { path: '/admin/customers', label: 'Customers', icon: <PeopleOutlined />, description: 'Customer and order history.', phase: 11 },
    { path: '/admin/cancellations', label: 'Cancellations', icon: <BlockOutlined />, description: 'Cancelled orders / PIs and reasons.', phase: 11 },
    { path: '/admin/reports', label: 'Reports', icon: <AssessmentOutlined />, description: 'Order and customer balance reports.', phase: 12, section: 'Administration' },
    { path: '/admin/audit', label: 'Audit Log', icon: <HistoryOutlined />, description: 'Every change with who and when.', phase: 12, section: 'Administration' },
    { path: '/admin/users', label: 'Users', icon: <ManageAccountsOutlined />, description: 'Add staff, set roles and reset passwords.', phase: 2, section: 'Administration' },
  ],
};
