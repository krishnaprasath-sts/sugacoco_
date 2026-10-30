-- Client request (2026-10-28): all amounts in Indian Rupees.
ALTER TABLE orders ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE payments ALTER COLUMN currency SET DEFAULT 'INR';
ALTER TABLE customer_credits ALTER COLUMN currency SET DEFAULT 'INR';

-- Existing rows (test data before go-live) move to INR.
UPDATE orders SET currency = 'INR' WHERE currency <> 'INR';
UPDATE payments SET currency = 'INR' WHERE currency <> 'INR';
UPDATE customer_credits SET currency = 'INR' WHERE currency <> 'INR';
