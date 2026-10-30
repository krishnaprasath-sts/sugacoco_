/**
 * End-to-end API check of the whole order lifecycle, using the dev seed users.
 *   1. npm run seed:dev   (once)
 *   2. npm run dev        (API on :5050)
 *   3. node scripts/e2e-flow.mjs [http://localhost:5050]
 * Creates its own customer and orders (names start with "E2E"). Exits 1 on the first failure.
 */
const BASE = (process.argv[2] ?? 'http://localhost:5050') + '/api';
const PASSWORD = 'Sugacoco@123';
let passed = 0;

function check(cond, label, extra) {
  if (!cond) {
    console.error(`✗ ${label}`, extra ?? '');
    process.exit(1);
  }
  passed++;
  console.log(`✓ ${label}`);
}

async function login(email) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  check(res.ok, `login ${email}`);
  const cookie = res.headers.get('set-cookie').split(';')[0];
  return async (method, path, body) => {
    const r = await fetch(`${BASE}${path}`, {
      method,
      headers: { Cookie: cookie, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await r.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    return { status: r.status, data };
  };
}

const sales = await login('sales@sugacoco.test');
const accounts = await login('accounts@sugacoco.test');
const qc = await login('qc@sugacoco.test');
const packaging = await login('packaging@sugacoco.test');
const docs = await login('docs@sugacoco.test');
const admin = await login('admin@sugacoco.test');

const stamp = Date.now().toString().slice(-6);
const status = async (id) => (await admin('GET', `/orders/${id}`)).data.order.status;

// ── Sales: customer + order
let r = await sales('POST', '/customers', { companyName: `E2E Coco Traders ${stamp}`, country: 'Singapore' });
check(r.status === 201, 'sales creates customer');
const customerId = r.data.customer.id;

const orderBody = (pi) => ({
  customerId,
  piNumber: pi,
  piDate: new Date().toISOString().slice(0, 10),
  currency: 'INR',
  advancePercent: 30,
  items: [{ productName: 'Desiccated Coconut', quantity: 10, unit: 'MT', unitPrice: 2000 }],
});
r = await sales('POST', '/orders', { ...orderBody(`E2E-PI-${stamp}`), advancePayment: { amount: 6000, bankReference: 'E2E-UTR' } });
check(r.status === 201, 'sales creates order with advance payment');
const orderId = r.data.id;
check((await status(orderId)) === 'AWAITING_ADVANCE_VERIFICATION', 'order waits for advance verification');
r = await sales('POST', '/orders', { ...orderBody(`E2E-BAD-${stamp}`), piDate: '2026-02-31' });
check(r.status === 400 && r.data.details.fields.piDate, 'impossible date rejected');
r = await sales('POST', '/orders', { ...orderBody(`E2E-BIG-${stamp}`), items: [{ productName: 'X', quantity: 1, unit: 'MT', unitPrice: 1e14 }] });
check(r.status === 400, 'absurd amount rejected');

// ── QC cannot see prices
r = await qc('GET', `/orders/${orderId}`);
check(r.data.order.totalValue === undefined && r.data.items[0].unitPrice === undefined, 'QC sees no pricing');

// ── Accounts approves advance
r = await accounts('GET', `/orders/${orderId}`);
const advId = r.data.permissions.verifyPaymentId;
r = await accounts('POST', `/payments/${advId}/verify`, { decision: 'APPROVED' });
check(r.status === 400 && r.data.details.fields.amountReceived, 'approval needs the bank amount');
r = await accounts('POST', `/payments/${advId}/verify`, { decision: 'APPROVED', amountReceived: 5000 });
check(r.status === 400 && r.data.details.fields.remarks, 'bank amount different from amount due needs a reason');
r = await accounts('POST', `/payments/${advId}/verify`, { decision: 'APPROVED', amountReceived: 6000 });
check(r.status === 200 && (await status(orderId)) === 'AWAITING_QC', 'accounts approves advance → QC');

// ── QC
r = await qc('POST', `/qc/orders/${orderId}/updates`, { qcStatus: 'READY', sourcingStatus: 'IN_PROGRESS' });
check(r.status === 400, 'QC cannot mark ready before sourcing + quality');
r = await qc('POST', `/qc/orders/${orderId}/updates`, {
  qcStatus: 'READY', sourcingStatus: 'SOURCED', qualityCheckStatus: 'PASSED', expectedReadyDate: '2030-01-15',
});
check(r.status === 201 && (await status(orderId)) === 'AWAITING_PACKAGING', 'QC marks ready → Packaging');

// ── Packaging
r = await packaging('POST', `/packaging/orders/${orderId}/updates`, { packagingStatus: 'COMPLETED', startDate: '2030-01-16', completionDate: '2030-01-17', quantityPacked: 10 });
check(r.status === 400, 'packaging cannot complete before In progress');
r = await packaging('POST', `/packaging/orders/${orderId}/updates`, { packagingStatus: 'ISSUE', issueType: 'DAMAGE' });
check(r.status === 400, 'packaging issue needs a reason');
r = await packaging('POST', `/packaging/orders/${orderId}/updates`, { packagingStatus: 'IN_PROGRESS', startDate: '2030-01-16' });
check(r.status === 201 && (await status(orderId)) === 'PACKAGING_IN_PROGRESS', 'packaging in progress');
r = await packaging('POST', `/packaging/orders/${orderId}/updates`, {
  packagingStatus: 'COMPLETED', startDate: '2030-01-16', completionDate: '2030-01-17', quantityPacked: 10, quantityUnit: 'MT',
});
check(r.status === 201 && (await status(orderId)) === 'READY_FOR_DOCUMENTATION', 'packaging completed → Documentation');

// ── Documentation: container + loading, gate-in blocked before balance
r = await docs('POST', `/documentation/orders/${orderId}/containers`, { containerNo: 'MSKU1234567', bookingNo: 'BK-1', gateInDate: '2030-01-20', loadingDate: '2030-01-19' });
check(r.status === 400, 'gate-in blocked before balance payment');
r = await sales('POST', `/orders/${orderId}/payments`, { paymentType: 'BALANCE', amount: 14000 });
check(r.status === 409, 'balance cannot be recorded before loading');
r = await docs('POST', `/documentation/orders/${orderId}/containers`, { containerNo: 'MSKU1234567', bookingNo: 'BK-1', loadingDate: '2030-01-19' });
check(r.status === 201 && (await status(orderId)) === 'DOCUMENTATION_IN_PROGRESS', 'container + loading recorded');

// ── Sales balance → Accounts reject → re-submit → approve
r = await sales('POST', `/orders/${orderId}/payments`, { paymentType: 'BALANCE', amount: 14000, bankReference: 'E2E-BAL' });
check(r.status === 201 && (await status(orderId)) === 'AWAITING_BALANCE_VERIFICATION', 'sales records balance');
let pid = (await accounts('GET', `/orders/${orderId}`)).data.permissions.verifyPaymentId;
r = await accounts('POST', `/payments/${pid}/verify`, { decision: 'REJECTED', remarks: 'Not in bank yet' });
check(r.status === 200 && (await status(orderId)) === 'BALANCE_REJECTED', 'balance rejected → held');
r = await qc('GET', `/orders/${orderId}`);
check(r.data.history.every((h) => !h.remarks || !h.remarks.includes('Not in bank')), 'QC cannot read Accounts remarks');
r = await docs('POST', `/documentation/orders/${orderId}/containers`, { containerNo: 'LATE1234567', loadingDate: '2030-01-19' });
check(r.status === 409, 'no new containers after balance is recorded');
r = await sales('POST', `/orders/${orderId}/payments`, { paymentType: 'BALANCE', amount: 14000, bankReference: 'E2E-BAL-2' });
check(r.status === 201 && (await status(orderId)) === 'AWAITING_BALANCE_VERIFICATION', 'sales re-submits balance');
pid = (await accounts('GET', `/orders/${orderId}`)).data.permissions.verifyPaymentId;
r = await accounts('POST', `/payments/${pid}/verify`, { decision: 'APPROVED', amountReceived: 14000 });
check(r.status === 200 && (await status(orderId)) === 'AWAITING_DOCUMENT_RELEASE', 'balance approved → document release');

// ── Gate-in + bill release + complete
r = await docs('POST', `/documentation/orders/${orderId}/complete`, {});
check(r.status === 409, 'cannot complete without gate-in and release');
const containerId = (await docs('GET', `/orders/${orderId}`)).data.containers[0].id;
r = await docs('PATCH', `/documentation/containers/${containerId}`, { containerNo: 'MSKU1234567', bookingNo: 'BK-1', loadingDate: '2030-01-19', gateInDate: '2030-01-20' });
check(r.status === 200, 'gate-in recorded after balance');
r = await docs('POST', `/documentation/orders/${orderId}/bill-releases`, { documentType: 'Bill of Lading', documentReference: 'BL-1', releaseStatus: 'RELEASED' });
check(r.status === 400, 'release needs a date');
r = await docs('POST', `/documentation/orders/${orderId}/bill-releases`, { documentType: 'Bill of Lading', documentReference: 'BL-1', releaseStatus: 'RELEASED', releaseDate: '2030-01-22' });
check(r.status === 201, 'bill release recorded');
r = await docs('POST', `/documentation/orders/${orderId}/complete`, {});
check(r.status === 200 && (await status(orderId)) === 'AWAITING_FINAL_VERIFICATION', 'documentation complete → final verification');

// ── Tracking link (public)
r = await sales('POST', `/orders/${orderId}/tracking-link`);
check(r.status === 201 && r.data.link.url.includes('/track/'), 'sales creates tracking link');
const token = r.data.link.url.split('/track/')[1];
let pub = await fetch(`${BASE}/public/track/${token}`);
let pubData = await pub.json();
check(pub.ok && pubData.order.orderNo && JSON.stringify(pubData).indexOf('totalValue') < 0 && JSON.stringify(pubData).indexOf('2000') < 0, 'public page shows order without prices');
pub = await fetch(`${BASE}/public/track/${token.slice(0, -2)}xx`);
check(pub.status === 404, 'tampered token → not found');
r = await sales('POST', `/orders/${orderId}/tracking-link/regenerate`);
const token2 = r.data.link.url.split('/track/')[1];
check((await fetch(`${BASE}/public/track/${token}`)).status === 404 && (await fetch(`${BASE}/public/track/${token2}`)).ok, 'regenerate revokes the old link');

// ── Close
r = await accounts('POST', `/accounts/orders/${orderId}/close`, { remarks: 'All good' });
check(r.status === 200 && (await status(orderId)) === 'CLOSED', 'accounts closes order');
r = await sales('POST', `/orders/${orderId}/tracking-link/regenerate`);
check(r.status === 409, 'no new tracking link on a closed order');
r = await sales('POST', `/orders/${orderId}/payments`, { paymentType: 'BALANCE', amount: 1 });
check(r.status === 409, 'closed order is read-only');
pubData = await (await fetch(`${BASE}/public/track/${token2}`)).json();
check(pubData.order.closed && pubData.order.milestones.every((m) => m.state === 'done'), 'public page shows completed');

// ── Credit: withheld, then used on a new order, verified by Accounts
r = await accounts('POST', '/accounts/credits', { customerId, entryType: 'WITHHELD', amount: 500, currency: 'INR', sourceOrderId: orderId, remarks: 'Short shipment adjustment' });
check(r.status === 201, 'accounts records withheld amount');
r = await sales('POST', '/orders', orderBody(`E2E-PI2-${stamp}`));
const order2 = r.data.id;
r = await sales('POST', `/orders/${order2}/credit-applications`, { amount: 900 });
check(r.status === 400, 'cannot use more credit than available');
r = await sales('POST', `/orders/${order2}/credit-applications`, { amount: 500 });
check(r.status === 201, 'sales requests credit use');
const creditId = (await accounts('GET', `/accounts/credits?customerId=${customerId}&status=PENDING`)).data.entries[0].id;
r = await accounts('POST', `/accounts/credits/${creditId}/verify`, { decision: 'VERIFIED' });
const o2 = (await accounts('GET', `/orders/${order2}`)).data.order;
check(r.status === 200 && o2.creditAppliedAmount === '500.00' && o2.balanceAmount === '13500.00', 'credit verified → balance reduced');
r = await accounts('POST', '/accounts/credits', { customerId, entryType: 'REFUND', amount: 1, currency: 'INR', remarks: 'Refund test' });
check(r.status === 400, 'refund cannot exceed available credit');
r = await accounts('POST', '/accounts/credits', { customerId, entryType: 'WITHHELD', amount: 300, currency: 'INR', remarks: 'Second withheld' });
r = await accounts('POST', '/accounts/credits', { customerId, entryType: 'REFUND', amount: 300, currency: 'INR', remarks: 'Paid back' });
check(r.status === 201, 'refund within available credit');
r = await sales('GET', `/customers/${customerId}`);
check(r.data.credit.length === 0, 'refund reduces available credit to zero');
r = await sales('POST', '/orders', { ...orderBody(`E2E-ZERO-${stamp}`), advancePercent: 0 });
const order3 = r.data.id;
r = await accounts('GET', `/orders/${order3}`);
check(r.data.permissions.confirmNoPaymentType === 'ADVANCE', 'zero advance offers "no payment" confirmation');
r = await accounts('POST', `/accounts/orders/${order3}/confirm-no-payment`, { type: 'ADVANCE' });
check(r.status === 200 && (await status(order3)) === 'AWAITING_QC', 'zero-advance order moves to QC');

// ── Admin cancel
r = await sales('POST', `/orders/${order2}/cancel`, { reason: 'test' });
check(r.status === 403, 'sales cannot cancel');
r = await admin('POST', `/orders/${order2}/cancel`, { reason: 'Customer withdrew the PI' });
check(r.status === 200 && (await status(order2)) === 'CANCELLED', 'MD/Admin cancels order');
r = await qc('POST', `/qc/orders/${order2}/updates`, { qcStatus: 'ONGOING' });
check(r.status === 409, 'cancelled order is read-only');

// ── Admin + reports
r = await admin('GET', '/admin/summary');
check(r.status === 200 && r.data.counts.CLOSED >= 1, 'admin summary');
r = await admin('GET', '/admin/cancellations');
check(r.data.cancellations.some((c) => c.orderId === order2), 'cancellation listed');
r = await accounts('GET', '/reports/orders?format=csv');
check(r.status === 200 && String(r.data).includes('Order no'), 'orders report CSV');
r = await admin('GET', `/reports/audit?orderNo=SC-`);
check(r.status === 200 && r.data.total > 0, 'audit log');
r = await sales('GET', '/reports/orders');
check(r.status === 403, 'sales cannot open reports');

console.log(`\nAll ${passed} checks passed.`);
