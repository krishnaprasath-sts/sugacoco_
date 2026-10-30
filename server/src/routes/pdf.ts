/** Download an order as a Proforma Invoice or Quotation PDF. Only for people who can see pricing. */
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import PDFDocument from 'pdfkit';
import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { audit } from '../services/audit.js';
import { LOGO_PATH, hasLogo } from '../services/exportFiles.js';

export const pdfRouter = Router();

const PLUM = '#6B2170';
const GREY = '#6B7280';
const LINE = '#E3DFEA';

// Built-in PDF fonts have no ₹ glyph, so amounts print as "INR 1,20,000.00".
const inr = (v: unknown) => Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const money = (v: unknown, cur = 'INR') => `${cur} ${inr(v)}`;
const qty = (v: unknown) => Number(v).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const date = (d: string | null) => (d ? new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—');

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function under1000(n: number): string {
  const h = Math.floor(n / 100);
  const r = n % 100;
  const rest = r < 20 ? ONES[r] : `${TENS[Math.floor(r / 10)]}${r % 10 ? ` ${ONES[r % 10]}` : ''}`;
  return [h ? `${ONES[h]} Hundred` : '', rest].filter(Boolean).join(' ');
}
/** Indian numbering: crore, lakh, thousand. */
function inWords(amount: number): string {
  let n = Math.floor(amount);
  const paise = Math.round((amount - n) * 100);
  if (n === 0 && paise === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  for (const [size, name] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']] as const) {
    const q = Math.floor(n / size);
    if (q) parts.push(`${q >= 1000 ? inWords(q).replace(/ Rupees Only$/, '') : under1000(q)} ${name}`);
    n %= size;
  }
  if (n) parts.push(under1000(n));
  return `${parts.join(' ') || 'Zero'} Rupees${paise ? ` and ${under1000(paise)} Paise` : ''} Only`;
}

pdfRouter.get('/orders/:id/pdf/:type', requireAuth, async (req, res) => {
  if (!req.user!.canViewPricing) throw new HttpError(403, 'You do not have access to pricing documents');
  const type = String(req.params.type).toLowerCase();
  if (type !== 'pi' && type !== 'quotation') throw new HttpError(404, 'Unknown document type');
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'Order not found');

  const [[o]] = await pool.query<RowDataPacket[]>(
    `SELECT o.*, c.company_name, c.contact_person, c.email AS c_email, c.phone AS c_phone, c.address_line1, c.address_line2,
            c.city, c.state, c.country, c.postal_code, u.name AS sales_name
     FROM orders o JOIN customers c ON c.id = o.customer_id JOIN users u ON u.id = o.created_by WHERE o.id = ?`,
    [id],
  );
  if (!o) throw new HttpError(404, 'Order not found');
  const [items] = await pool.query<RowDataPacket[]>(
    'SELECT product_name, specification, quantity, unit, unit_price, line_total FROM order_items WHERE order_id = ? ORDER BY sort_order, id',
    [id],
  );

  const isPi = type === 'pi';
  const title = isPi ? 'PROFORMA INVOICE' : 'QUOTATION';
  const fileName = `${isPi ? 'PI' : 'Quotation'}-${String(o.pi_number).replace(/[^\w.-]+/g, '_')}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Cache-Control', 'no-store');
  await audit(req, { action: 'PDF_DOWNLOADED', entityType: 'order', entityId: id, orderId: id, changes: { type: title } });

  const doc = new PDFDocument({ size: 'A4', margin: 40, info: { Title: `${title} ${o.pi_number}`, Author: env.company.name } });
  doc.pipe(res);
  const L = 40;
  const R = doc.page.width - 40;
  const W = R - L;

  // Header: logo + company on the left, document title on the right.
  doc.rect(0, 0, doc.page.width, 6).fill(PLUM);
  if (hasLogo) {
    doc.image(LOGO_PATH, L, 22, { height: 48 });
    doc.fillColor('#111827').font('Helvetica-Bold').fontSize(10).text(env.company.name, L, 76, { width: W / 2 });
  } else {
    doc.fillColor(PLUM).font('Helvetica-Bold').fontSize(18).text(env.company.name, L, 28, { width: W / 2 });
  }
  doc.fillColor(GREY).font('Helvetica').fontSize(8.5);
  const companyLines = [
    ...env.company.address.split('|').map((s) => s.trim()).filter(Boolean),
    [env.company.supportPhone && `Phone: ${env.company.supportPhone}`, env.company.supportEmail && `Email: ${env.company.supportEmail}`].filter(Boolean).join('  ·  '),
    env.company.gstin && `GSTIN: ${env.company.gstin}`,
  ].filter(Boolean);
  for (const line of companyLines) doc.text(line, { width: W / 2 });
  const headerBottom = doc.y;

  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(15).text(title, L + W / 2, 30, { width: W / 2, align: 'right' });
  doc.font('Helvetica').fontSize(9).fillColor(GREY);
  const meta: [string, string][] = [
    [isPi ? 'PI no' : 'Ref no', String(o.pi_number)],
    ['Date', date(o.pi_date)],
    ['Order no', String(o.order_no ?? '—')],
    ['Sales contact', String(o.sales_name)],
  ];
  let my = 52;
  for (const [k, v] of meta) {
    doc.fillColor(GREY).text(`${k}: `, L + W / 2, my, { width: W / 2 - 110, align: 'right', continued: false });
    doc.fillColor('#111827').font('Helvetica-Bold').text(v, R - 110, my, { width: 110, align: 'right' });
    doc.font('Helvetica');
    my += 13;
  }

  let y = Math.max(headerBottom, my) + 14;
  doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(1).stroke();
  y += 12;

  // Bill to
  doc.fillColor(PLUM).font('Helvetica-Bold').fontSize(9).text(isPi ? 'BILL TO' : 'PREPARED FOR', L, y);
  doc.fillColor('#111827').fontSize(11).text(String(o.company_name), L, y + 13, { width: W });
  doc.font('Helvetica').fontSize(9).fillColor('#374151');
  const addr = [
    o.contact_person && `Attn: ${o.contact_person}`,
    o.address_line1,
    o.address_line2,
    [o.city, o.state, o.postal_code].filter(Boolean).join(', '),
    o.country,
    [o.c_phone && `Phone: ${o.c_phone}`, o.c_email && `Email: ${o.c_email}`].filter(Boolean).join('  ·  '),
  ].filter(Boolean) as string[];
  for (const line of addr) doc.text(line, { width: W });
  y = doc.y + 16;

  // Items table
  const cols = [
    { k: '#', w: 24, align: 'left' as const },
    { k: 'Product / specification', w: W - 24 - 70 - 45 - 95 - 105, align: 'left' as const },
    { k: 'Qty', w: 70, align: 'right' as const },
    { k: 'Unit', w: 45, align: 'left' as const },
    { k: `Rate (${o.currency})`, w: 95, align: 'right' as const },
    { k: `Amount (${o.currency})`, w: 105, align: 'right' as const },
  ];
  const drawHead = () => {
    doc.rect(L, y, W, 22).fill(PLUM);
    let x = L;
    doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(8.5);
    for (const c of cols) {
      doc.text(c.k, x + 6, y + 7, { width: c.w - 12, align: c.align });
      x += c.w;
    }
    y += 22;
  };
  drawHead();
  items.forEach((it, i) => {
    const spec = it.specification ? String(it.specification) : '';
    doc.font('Helvetica').fontSize(9);
    const nameH = doc.heightOfString(String(it.product_name), { width: cols[1].w - 12 });
    const specH = spec ? doc.fontSize(8).heightOfString(spec, { width: cols[1].w - 12 }) + 2 : 0;
    const h = Math.max(22, nameH + specH + 12);
    if (y + h > doc.page.height - 200) {
      doc.addPage();
      y = 40;
      drawHead();
    }
    if (i % 2) doc.rect(L, y, W, h).fill('#FAF8FC');
    let x = L;
    const cells = [String(i + 1), '', qty(it.quantity), String(it.unit), inr(it.unit_price), inr(it.line_total)];
    cols.forEach((c, ci) => {
      if (ci === 1) {
        doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(String(it.product_name), x + 6, y + 6, { width: c.w - 12 });
        if (spec) doc.fillColor(GREY).font('Helvetica').fontSize(8).text(spec, x + 6, doc.y + 2, { width: c.w - 12 });
      } else {
        doc.fillColor('#111827').font('Helvetica').fontSize(9).text(cells[ci], x + 6, y + 6, { width: c.w - 12, align: c.align });
      }
      x += c.w;
    });
    y += h;
    doc.moveTo(L, y).lineTo(R, y).strokeColor(LINE).lineWidth(0.5).stroke();
  });

  // Totals on the right
  y += 10;
  const total = Number(o.total_value);
  const credit = Number(o.credit_applied_amount);
  const rows: [string, string, boolean?][] = [['Order total', money(total, o.currency), true]];
  if (isPi) {
    if (credit > 0) rows.push(['Less: credit from earlier orders', `- ${money(credit, o.currency)}`]);
    rows.push([`Advance (${Number(o.advance_percent)}%)`, money(o.advance_amount, o.currency)]);
    rows.push(['Balance before shipment', money(o.balance_amount, o.currency)]);
  }
  const tx = L + W / 2;
  for (const [k, v, bold] of rows) {
    if (bold) doc.rect(tx, y - 4, W / 2, 22).fill('#F3EEF7');
    doc.fillColor(bold ? PLUM : '#374151').font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 10.5 : 9);
    doc.text(k, tx + 8, y + 2, { width: W / 4 });
    doc.text(v, tx + W / 4, y + 2, { width: W / 4 - 8, align: 'right' });
    y += bold ? 24 : 16;
  }
  doc.fillColor(GREY).font('Helvetica-Oblique').fontSize(8.5).text(`Amount in words: ${o.currency === 'INR' ? inWords(total) : `${o.currency} ${inr(total)}`}`, L, y + 4, { width: W });
  y = doc.y + 14;

  const section = (head: string, body: string | null) => {
    if (!body) return;
    doc.fillColor(PLUM).font('Helvetica-Bold').fontSize(9).text(head, L, y);
    doc.fillColor('#374151').font('Helvetica').fontSize(9).text(body, L, doc.y + 3, { width: W });
    y = doc.y + 12;
  };
  section('PAYMENT TERMS', o.payment_terms);
  section('REMARKS', o.remarks);
  if (!isPi) section('VALIDITY', 'This quotation is valid for 15 days from the date above. Prices and availability are subject to confirmation.');

  // Signature + footer
  const sy = Math.max(y + 20, doc.page.height - 130);
  doc.fillColor('#111827').font('Helvetica-Bold').fontSize(9).text(`For ${env.company.name}`, R - 200, sy, { width: 200, align: 'right' });
  doc.moveTo(R - 160, sy + 46).lineTo(R, sy + 46).strokeColor('#9CA3AF').lineWidth(0.7).stroke();
  doc.fillColor(GREY).font('Helvetica').fontSize(8).text('Authorised signatory', R - 200, sy + 50, { width: 200, align: 'right' });
  doc.fillColor(GREY).fontSize(7.5).text('This is a computer-generated document.', L, doc.page.height - 50, { width: W, align: 'center' });
  doc.end();
});
