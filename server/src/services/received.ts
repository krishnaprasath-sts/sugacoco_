/**
 * Money received per order = the bank amount Accounts confirmed when approving
 * (falls back to the reported amount for approvals recorded before amountReceived was required).
 * Stored on the order as orders.received_amount (migration 010) and added to when Accounts approves
 * a payment (routes/payments.ts), so no query has to sum the payments table.
 */
export const RECEIVED = 'o.received_amount';
