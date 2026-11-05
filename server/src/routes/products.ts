/** Product list. MD/Admin adds, edits and hides products; Sales picks from the active ones on orders. */
import { Router } from 'express';
import { z } from 'zod';
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool, withTransaction } from '../db/pool.js';
import { audit, diff } from '../services/audit.js';
import { requireAuth, requirePermission } from '../middleware/auth.js';
import { HttpError } from '../middleware/error.js';
import { parse } from '../middleware/validate.js';

export const productsRouter = Router();
productsRouter.use(requireAuth);

export const PRODUCT_UNITS = ['MT', 'KG', 'Bags', 'Cartons', 'Pcs', 'Litres'] as const;

const optionalText = (max: number) =>
  z.string().trim().max(max).optional().nullable().transform((v) => (v ? v : null));

const productSchema = z.object({
  name: z.string({ error: 'Enter the product name' }).trim().min(2, 'Enter the product name').max(200)
    // Collapse double spaces so "Coconut  Oil" and "Coconut Oil" are the same product.
    .transform((v) => v.replace(/\s+/g, ' ')),
  defaultUnit: z.enum(PRODUCT_UNITS, { error: 'Choose a unit' }),
  hsCode: optionalText(20),
  description: optionalText(2000),
});
const updateSchema = productSchema.extend({ isActive: z.boolean() }).partial();
const idSchema = z.coerce.number().int().positive();

type ProductRow = RowDataPacket & {
  id: number;
  name: string;
  defaultUnit: string;
  hsCode: string | null;
  description: string | null;
  isActive: number;
  orderCount: number;
  updatedAt: string;
};

const SELECT_LIST = `
  SELECT p.id, p.name, p.default_unit AS defaultUnit, p.hs_code AS hsCode, p.description,
         p.is_active AS isActive, p.updated_at AS updatedAt,
         (SELECT COUNT(DISTINCT i.order_id) FROM order_items i WHERE i.product_id = p.id) AS orderCount
  FROM products p`;
const toDto = (r: ProductRow) => ({ ...r, isActive: r.isActive === 1, orderCount: Number(r.orderCount) });

async function getProduct(id: number) {
  const [rows] = await pool.query<ProductRow[]>(`${SELECT_LIST} WHERE p.id = ?`, [id]);
  if (!rows[0]) throw new HttpError(404, 'Product not found');
  return toDto(rows[0]);
}

const isDuplicate = (err: unknown) => (err as { code?: string })?.code === 'ER_DUP_ENTRY';
const duplicateError = () =>
  new HttpError(409, 'This product is already in the list', { fields: { name: 'This product is already in the list' } });

/** Active products for the order form. */
productsRouter.get('/suggestions', requirePermission('orders.create', 'products.manage'), async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    'SELECT id, name, default_unit AS unit FROM products WHERE is_active = 1 ORDER BY name',
  );
  res.json({ products: rows });
});

productsRouter.get('/', requirePermission('products.manage'), async (_req, res) => {
  const [rows] = await pool.query<ProductRow[]>(`${SELECT_LIST} ORDER BY p.is_active DESC, p.name`);
  res.json({ products: rows.map(toDto) });
});

productsRouter.post('/', requirePermission('products.manage'), async (req, res) => {
  const body = parse(productSchema, req.body);
  try {
    const id = await withTransaction(async (conn) => {
      const [result] = await conn.query<ResultSetHeader>(
        'INSERT INTO products (name, default_unit, hs_code, description) VALUES (?, ?, ?, ?)',
        [body.name, body.defaultUnit, body.hsCode, body.description],
      );
      await audit(req, { action: 'PRODUCT_CREATED', entityType: 'product', entityId: result.insertId, changes: body }, conn);
      return result.insertId;
    });
    res.status(201).json({ product: await getProduct(id) });
  } catch (err) {
    if (isDuplicate(err)) throw duplicateError();
    throw err;
  }
});

productsRouter.patch('/:id', requirePermission('products.manage'), async (req, res) => {
  const id = parse(idSchema, req.params.id);
  const body = parse(updateSchema, req.body);
  const existing = await getProduct(id);

  const sets: string[] = [];
  const values: unknown[] = [];
  if (body.name !== undefined) sets.push('name = ?'), values.push(body.name);
  if (body.defaultUnit !== undefined) sets.push('default_unit = ?'), values.push(body.defaultUnit);
  if (body.hsCode !== undefined) sets.push('hs_code = ?'), values.push(body.hsCode);
  if (body.description !== undefined) sets.push('description = ?'), values.push(body.description);
  if (body.isActive !== undefined) sets.push('is_active = ?'), values.push(body.isActive ? 1 : 0);

  const changes = diff(existing, body);
  if (sets.length && Object.keys(changes).length) {
    try {
      await withTransaction(async (conn) => {
        await conn.query(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, [...values, id]);
        await audit(req, { action: 'PRODUCT_UPDATED', entityType: 'product', entityId: id, changes }, conn);
      });
    } catch (err) {
      if (isDuplicate(err)) throw duplicateError();
      throw err;
    }
  }
  res.json({ product: await getProduct(id) });
});
