-- Product list is now managed by MD/Admin. Copy every product name already used on orders
-- into the list (so nothing disappears from the order form) and link old order lines to it.
INSERT IGNORE INTO products (name, default_unit)
SELECT TRIM(product_name), MAX(unit) FROM order_items
WHERE TRIM(product_name) <> ''
GROUP BY TRIM(product_name);

UPDATE order_items i JOIN products p ON p.name = TRIM(i.product_name)
SET i.product_id = p.id
WHERE i.product_id IS NULL;
