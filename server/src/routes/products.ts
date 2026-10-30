/** Product name suggestions for the order form: product master + names already used on orders. */
import { Router } from 'express';
import type { RowDataPacket } from 'mysql2';
import { pool } from '../db/pool.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const productsRouter = Router();
productsRouter.use(requireAuth, requireRole('SALES'));

productsRouter.get('/suggestions', async (_req, res) => {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT name, default_unit AS unit FROM products WHERE is_active = 1
     UNION
     SELECT product_name AS name, MAX(unit) AS unit FROM order_items GROUP BY product_name
     ORDER BY name LIMIT 500`,
  );
  // UNION can return the same name twice with different units; keep the first.
  const seen = new Set<string>();
  res.json({ products: rows.filter((r) => !seen.has(r.name) && seen.add(r.name)) });
});
