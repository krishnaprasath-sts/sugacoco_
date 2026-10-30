/** Customers. Sales create/edit; Sales, Accounts and MD/Admin can view. */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';
import { audit, diff } from '../services/audit.js';
import { AVAILABLE_SQL } from '../services/credit.js';

export const customersRouter = Router();
customersRouter.use(requireAuth, requireRole('SALES', 'ACCOUNTS', 'ADMIN'));

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const customerSchema = z.object({
  companyName: z.string({ error: 'Enter the company name' }).trim().min(2, 'Enter the company name').max(200),
  contactPerson: optional(120),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(190)
    .optional()
    .nullable()
    .refine((v) => !v || z.email().safeParse(v).success, 'Enter a valid email')
    .transform((v) => (v ? v : null)),
  phone: optional(40),
  altPhone: optional(40),
  addressLine1: optional(255),
  addressLine2: optional(255),
  city: optional(100),
  state: optional(100),
  country: optional(100),
  postalCode: optional(20),
  notes: optional(5000),
});

const listQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const COLUMNS = `
  c.id, c.company_name AS companyName, c.contact_person AS contactPerson, c.email, c.phone,
  c.alt_phone AS altPhone, c.address_line1 AS addressLine1, c.address_line2 AS addressLine2,
  c.city, c.state, c.country, c.postal_code AS postalCode, c.notes, c.created_at AS createdAt`;

const FIELD_TO_COLUMN: Record<string, string> = {
  companyName: 'company_name',
  contactPerson: 'contact_person',
  email: 'email',
  phone: 'phone',
  altPhone: 'alt_phone',
  addressLine1: 'address_line1',
  addressLine2: 'address_line2',
  city: 'city',
  state: 'state',
  country: 'country',
  postalCode: 'postal_code',
  notes: 'notes',
};

/** Available credit = verified WITHHELD − verified APPLIED (per currency). */
export async function customerCredit(customerId: number) {
  // Withheld − used − refunded, also minus credit use still waiting for Accounts.
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT cc.currency, ${AVAILABLE_SQL('cc', true)} AS available
     FROM customer_credits cc
     WHERE cc.customer_id = ?
     GROUP BY cc.currency
     HAVING available > 0`,
    [customerId],
  );
  return rows.map((r) => ({ currency: r.currency as string, available: String(r.available) }));
}

customersRouter.get('/', async (req, res) => {
  const { q, page, pageSize } = parse(listQuery, req.query);
  const where: string[] = ['c.is_active = 1'];
  const params: unknown[] = [];
  if (q) {
    where.push('(c.company_name LIKE ? OR c.contact_person LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.country LIKE ?)');
    const like = `%${q}%`;
    params.push(like, like, like, like, like);
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;
  const [[count]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM customers c ${whereSql}`, params);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT ${COLUMNS},
            (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orderCount,
            (SELECT MAX(o.pi_date) FROM orders o WHERE o.customer_id = c.id) AS lastOrderDate
     FROM customers c ${whereSql}
     ORDER BY c.company_name
     LIMIT ? OFFSET ?`,
    [...params, pageSize, (page - 1) * pageSize],
  );
  res.json({ customers: rows, total: count.total, page, pageSize });
});

customersRouter.get('/:id', async (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const [[customer]] = await pool.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM customers c WHERE c.id = ?`, [id]);
  if (!customer) throw new HttpError(404, 'Customer not found');

  const [orders] = await pool.query<RowDataPacket[]>(
    `SELECT id, order_no AS orderNo, pi_number AS piNumber, pi_date AS piDate, currency,
            total_value AS totalValue, status, created_at AS createdAt
     FROM orders WHERE customer_id = ? ORDER BY pi_date DESC, id DESC`,
    [id],
  );
  res.json({ customer, orders, credit: await customerCredit(id) });
});

customersRouter.post('/', requireRole('SALES'), async (req, res) => {
  const body = parse(customerSchema, req.body);
  const id = await withTransaction(async (conn) => {
    const cols = Object.keys(FIELD_TO_COLUMN);
    const [result] = await conn.query<ResultSetHeader>(
      `INSERT INTO customers (${cols.map((c) => FIELD_TO_COLUMN[c]).join(', ')}, created_by)
       VALUES (${cols.map(() => '?').join(', ')}, ?)`,
      [...cols.map((c) => body[c as keyof typeof body]), req.user!.id],
    );
    await audit(req, { action: 'CUSTOMER_CREATED', entityType: 'customer', entityId: result.insertId, changes: body }, conn);
    return result.insertId;
  });
  const [[customer]] = await pool.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM customers c WHERE c.id = ?`, [id]);
  res.status(201).json({ customer });
});

customersRouter.patch('/:id', requireRole('SALES'), async (req, res) => {
  const id = parse(z.coerce.number().int().positive(), req.params.id);
  const body = parse(customerSchema.partial(), req.body);
  const [[existing]] = await pool.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM customers c WHERE c.id = ?`, [id]);
  if (!existing) throw new HttpError(404, 'Customer not found');

  const changes = diff(existing, body);
  if (Object.keys(changes).length) {
    await withTransaction(async (conn) => {
      const keys = Object.keys(changes);
      await conn.query(
        `UPDATE customers SET ${keys.map((k) => `${FIELD_TO_COLUMN[k]} = ?`).join(', ')}, updated_by = ? WHERE id = ?`,
        [...keys.map((k) => body[k as keyof typeof body]), req.user!.id, id],
      );
      await audit(req, { action: 'CUSTOMER_UPDATED', entityType: 'customer', entityId: id, changes }, conn);
    });
  }
  const [[customer]] = await pool.query<RowDataPacket[]>(`SELECT ${COLUMNS} FROM customers c WHERE c.id = ?`, [id]);
  res.json({ customer });
});
