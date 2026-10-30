# Database overview

MariaDB / MySQL, raw SQL (mysql2). Schema lives in `server/migrations/*.sql`, applied in order by `npm run migrate`.
Never edit an applied migration; add a new numbered file instead.

## Conventions
- Money `DECIMAL(15,2)`, quantities `DECIMAL(14,3)`. The API returns money as strings to keep exact values.
- All `DATETIME` values are **UTC** (each DB connection runs `SET time_zone = '+00:00'`). The browser shows local time.
- `DATE` columns (PI date, loading date, gate-in date) are plain calendar dates with no time zone.
- Status and type columns are `VARCHAR` + `CHECK` constraints. Codes live in `server/src/workflow/statuses.ts`.
- Nothing business-related is hard-deleted. Files use `deleted_at`; orders are cancelled, not deleted.

## Tables

| Table | Purpose | Written by |
|---|---|---|
| `roles`, `users` | Logins and departments | MD/Admin (Users screen) |
| `customers` | Reusable customer records | Sales |
| `products` | Optional product master for quick picking | Admin / Sales |
| `orders` | One row per PI/order: amounts, overall `status`, QC snapshot, closure | Sales creates; workflow updates |
| `order_items` | Product lines (name/spec copied, so old orders never change) | Sales |
| `order_documents` | Every uploaded file, with a `category` | All departments (API limits categories per role) |
| `payments` | Advance/balance payments recorded by Sales | Sales |
| `payment_verifications` | Accounts' decision for each payment (approve/reject + bank check) | Accounts |
| `customer_credits` | Ledger of withheld / applied / refunded amounts per customer | Accounts (Sales can request APPLIED) |
| `packaging_updates` | Append-only Packaging history (status, dates, packed qty, issue/rework reason) | Packaging |
| `order_tracking_links` | Customer tracking link per order: SHA-256 hash for lookup + encrypted token so Sales can copy it again; revoke/regenerate | Sales, MD/Admin |
| `qc_updates` | Append-only QC history (status, sourcing, dates, quality, date-change reason) | QC |
| `container_bookings` | One row per container: booking, loading date, gate-in date | Documentation |
| `bill_releases` | Release of loading bill / documents to customer | Documentation |
| `order_cancellations` | Reason and previous status when MD/Admin cancels | MD/Admin |
| `order_status_history` | Every status change: from, to, who, when | Workflow service |
| `audit_logs` | Every material change with before/after values | All write APIs |

## Relationships

```
customers 1──* orders 1──* order_items
                  │
                  ├──* payments 1──* payment_verifications
                  ├──* order_documents (payment vouchers link to payments)
                  ├──* qc_updates
                  ├──* packaging_updates
                  ├──* order_tracking_links (one ACTIVE at a time)
                  ├──* container_bookings
                  ├──* bill_releases
                  ├──0..1 order_cancellations
                  ├──* order_status_history
                  └──* audit_logs
customers 1──* customer_credits (source_order / applied_order → orders)
```

## Rules enforced in the API (not in SQL)
- Only the department that owns the current status may act (`canTransition` in `workflow/statuses.ts`).
- QC and Packaging never receive pricing, payment or voucher data unless `users.can_view_pricing = 1`.
- Every order goes QC → Packaging → Documentation; QC cannot send an order straight to Documentation.
- The public tracking API returns only customer-safe fields for the one order its token belongs to; tokens never appear in logs.
- Gate-in date can be set only after the balance payment is approved.
- Rejection remarks are required; a changed QC ready date requires a reason.
- Closed and cancelled orders are read-only.
- Every status change writes `order_status_history` and `audit_logs` in the same transaction.
- Every DB connection runs in strict SQL mode, so invalid dates/numbers are rejected instead of stored as 0000-00-00 or clamped.
- Available customer credit = verified WITHHELD − verified APPLIED − verified REFUND − pending APPLIED. A refund can't exceed it.
- Credit use is verified only before the advance payment is approved; advance approval is blocked while a credit request is pending. Cancelling an order releases its credit.
- Approving a payment needs the bank amount; if it differs from the amount due, a reason is required. "Received" in reports uses the bank amount.
- Accounts' remarks are never copied into status history (QC/Packaging can read it); they stay in payment_verifications.
- Orders with ₹0 advance or ₹0 balance are moved on by Accounts with "Confirm no payment" instead of a payment record.
- After the balance is recorded, Documentation can change only gate-in date, transport details and remarks on containers.
