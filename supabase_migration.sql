-- ============================================================
-- FlashPOS — Supabase Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── App Users (app-level auth, not Supabase Auth) ──
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'cashier' CHECK (role IN ('admin','manager','cashier')),
  email TEXT,
  phone TEXT,
  pin_code TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  store_id INTEGER DEFAULT 1,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Stores ──
CREATE TABLE IF NOT EXISTS stores (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  tax_number TEXT,
  currency TEXT DEFAULT 'EGP',
  tax_rate NUMERIC(5,2) DEFAULT 14.0,
  receipt_header TEXT,
  receipt_footer TEXT,
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Categories ──
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  name_ar TEXT,
  color TEXT DEFAULT '#00C896',
  icon TEXT DEFAULT 'box',
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Products ──
CREATE TABLE IF NOT EXISTS products (
  id SERIAL PRIMARY KEY,
  barcode TEXT UNIQUE,
  sku TEXT UNIQUE,
  name TEXT NOT NULL,
  name_ar TEXT,
  category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  cost_price NUMERIC(12,2) DEFAULT 0,
  selling_price NUMERIC(12,2) NOT NULL,
  wholesale_price NUMERIC(12,2),
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_exempt BOOLEAN DEFAULT false,
  unit TEXT DEFAULT 'قطعة',
  min_stock INTEGER DEFAULT 5,
  track_inventory BOOLEAN DEFAULT true,
  allow_negative_stock BOOLEAN DEFAULT false,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inventory ──
CREATE TABLE IF NOT EXISTS inventory (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity NUMERIC(12,3) DEFAULT 0,
  store_id INTEGER DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Inventory Movements ──
CREATE TABLE IF NOT EXISTS inventory_movements (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('in','out','adjustment','sale','purchase','return')),
  quantity NUMERIC(12,3) NOT NULL,
  before_quantity NUMERIC(12,3),
  after_quantity NUMERIC(12,3),
  reference_type TEXT,
  reference_id INTEGER,
  notes TEXT,
  user_id UUID REFERENCES app_users(id),
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Customers ──
CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  customer_type TEXT DEFAULT 'retail' CHECK (customer_type IN ('retail','wholesale','vip')),
  credit_limit NUMERIC(12,2) DEFAULT 0,
  current_balance NUMERIC(12,2) DEFAULT 0,
  loyalty_points INTEGER DEFAULT 0,
  total_purchases NUMERIC(14,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Suppliers ──
CREATE TABLE IF NOT EXISTS suppliers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  company TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  tax_number TEXT,
  payment_terms INTEGER DEFAULT 30,
  current_balance NUMERIC(12,2) DEFAULT 0,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Shifts ──
CREATE TABLE IF NOT EXISTS shifts (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES app_users(id),
  opening_cash NUMERIC(12,2) DEFAULT 0,
  closing_cash NUMERIC(12,2),
  expected_cash NUMERIC(12,2),
  cash_difference NUMERIC(12,2),
  total_sales NUMERIC(14,2) DEFAULT 0,
  total_refunds NUMERIC(12,2) DEFAULT 0,
  total_transactions INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open' CHECK (status IN ('open','closed')),
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  notes TEXT,
  store_id INTEGER DEFAULT 1
);

-- ── Sales ──
CREATE TABLE IF NOT EXISTS sales (
  id SERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES app_users(id),
  shift_id INTEGER REFERENCES shifts(id) ON DELETE SET NULL,
  subtotal NUMERIC(14,2) NOT NULL,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  change_amount NUMERIC(12,2) DEFAULT 0,
  payment_method TEXT DEFAULT 'cash' CHECK (payment_method IN ('cash','card','wallet','credit')),
  status TEXT DEFAULT 'completed' CHECK (status IN ('completed','refunded','partial_refund')),
  notes TEXT,
  loyalty_points_earned INTEGER DEFAULT 0,
  loyalty_points_used INTEGER DEFAULT 0,
  sale_type TEXT DEFAULT 'retail',
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Sale Items ──
CREATE TABLE IF NOT EXISTS sale_items (
  id SERIAL PRIMARY KEY,
  sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  cost_price NUMERIC(12,2) DEFAULT 0,
  discount_percent NUMERIC(5,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_percent NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(14,2) NOT NULL
);

-- ── Purchases ──
CREATE TABLE IF NOT EXISTS purchases (
  id SERIAL PRIMARY KEY,
  po_number TEXT UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  user_id UUID NOT NULL REFERENCES app_users(id),
  subtotal NUMERIC(14,2) NOT NULL,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(14,2) NOT NULL,
  paid_amount NUMERIC(14,2) DEFAULT 0,
  status TEXT DEFAULT 'received' CHECK (status IN ('draft','ordered','received','cancelled')),
  payment_method TEXT DEFAULT 'cash',
  notes TEXT,
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Purchase Items ──
CREATE TABLE IF NOT EXISTS purchase_items (
  id SERIAL PRIMARY KEY,
  purchase_id INTEGER NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity NUMERIC(12,3) NOT NULL,
  unit_cost NUMERIC(12,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  received_quantity NUMERIC(12,3) DEFAULT 0
);

-- ── Returns ──
CREATE TABLE IF NOT EXISTS returns (
  id SERIAL PRIMARY KEY,
  return_number TEXT UNIQUE NOT NULL,
  sale_id INTEGER NOT NULL REFERENCES sales(id),
  user_id UUID NOT NULL REFERENCES app_users(id),
  reason TEXT,
  refund_method TEXT DEFAULT 'cash',
  total_refund NUMERIC(12,2) NOT NULL,
  status TEXT DEFAULT 'completed',
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Return Items ──
CREATE TABLE IF NOT EXISTS return_items (
  id SERIAL PRIMARY KEY,
  return_id INTEGER NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  sale_item_id INTEGER NOT NULL REFERENCES sale_items(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity NUMERIC(12,3) NOT NULL,
  unit_price NUMERIC(12,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL
);

-- ── Promotions ──
CREATE TABLE IF NOT EXISTS promotions (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('percent','fixed')),
  value NUMERIC(10,2) NOT NULL,
  min_purchase NUMERIC(12,2) DEFAULT 0,
  max_discount NUMERIC(12,2),
  coupon_code TEXT UNIQUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  usage_limit INTEGER,
  used_count INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Vouchers ──
CREATE TABLE IF NOT EXISTS vouchers (
  id SERIAL PRIMARY KEY,
  voucher_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('receipt','payment','expense')),
  amount NUMERIC(12,2) NOT NULL,
  description TEXT,
  category TEXT,
  payment_method TEXT DEFAULT 'cash',
  user_id UUID REFERENCES app_users(id),
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Loyalty Transactions ──
CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  sale_id INTEGER REFERENCES sales(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('earn','redeem','adjust')),
  points INTEGER NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Settings ──
CREATE TABLE IF NOT EXISTS store_settings (
  id SERIAL PRIMARY KEY,
  store_id INTEGER DEFAULT 1,
  key TEXT NOT NULL,
  value TEXT,
  type TEXT DEFAULT 'string',
  UNIQUE(store_id, key)
);

-- ── Activity Logs ──
CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES app_users(id),
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id INTEGER,
  details JSONB,
  store_id INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ── Invoice Counter (atomic) ──
CREATE TABLE IF NOT EXISTS invoice_counters (
  store_id INTEGER NOT NULL,
  date_key TEXT NOT NULL,
  counter INTEGER DEFAULT 0,
  PRIMARY KEY (store_id, date_key)
);

-- ════════════════════════════════════════
-- INDEXES
-- ════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id, store_id);
CREATE INDEX IF NOT EXISTS idx_sales_store_date ON sales(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sales_invoice ON sales(invoice_number);
CREATE INDEX IF NOT EXISTS idx_sales_customer ON sales(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_product ON sale_items(product_id);
CREATE INDEX IF NOT EXISTS idx_customers_store ON customers(store_id, is_active);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shifts_user ON shifts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_shifts_store ON shifts(store_id, status);
CREATE INDEX IF NOT EXISTS idx_purchases_store ON purchases(store_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_store ON activity_logs(store_id, created_at DESC);

-- ════════════════════════════════════════
-- RLS (permissive for app-level auth)
-- ════════════════════════════════════════
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE return_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;

-- Permissive policies (app handles auth)
CREATE POLICY "allow_all" ON app_users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON stores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON inventory_movements FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON customers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON suppliers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON shifts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON sale_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON purchases FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON purchase_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON returns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON return_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON promotions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON vouchers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON loyalty_transactions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON store_settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON activity_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all" ON invoice_counters FOR ALL USING (true) WITH CHECK (true);

-- ════════════════════════════════════════
-- SEED DATA
-- ════════════════════════════════════════
INSERT INTO stores (id, name, currency, tax_rate, receipt_header, receipt_footer)
VALUES (1, 'متجر FlashPOS', 'EGP', 14.0, 'أهلاً بكم في متجرنا', 'شكراً لتسوقكم معنا')
ON CONFLICT DO NOTHING;

INSERT INTO categories (name, name_ar, color, icon, sort_order, store_id) VALUES
('مأكولات ومشروبات', 'مأكولات ومشروبات', '#EF4444', 'coffee', 1, 1),
('إلكترونيات', 'إلكترونيات', '#3B82F6', 'cpu', 2, 1),
('ملابس', 'ملابس', '#8B5CF6', 'shirt', 3, 1),
('صيدلية', 'صيدلية', '#10B981', 'pill', 4, 1),
('قرطاسية', 'قرطاسية', '#F59E0B', 'pen-tool', 5, 1),
('منزليات', 'منزليات', '#06B6D4', 'home', 6, 1)
ON CONFLICT DO NOTHING;

INSERT INTO customers (id, name, customer_type, loyalty_points, store_id)
VALUES (1, 'عميل نقدي', 'retail', 0, 1)
ON CONFLICT DO NOTHING;

INSERT INTO store_settings (store_id, key, value, type) VALUES
(1, 'loyalty_points_rate', '1', 'number'),
(1, 'loyalty_redeem_rate', '10', 'number'),
(1, 'receipt_auto_print', 'false', 'boolean'),
(1, 'low_stock_alert', 'true', 'boolean'),
(1, 'require_shift', 'true', 'boolean'),
(1, 'allow_credit_sales', 'true', 'boolean')
ON CONFLICT DO NOTHING;

-- ════════════════════════════════════════
-- FUNCTIONS
-- ════════════════════════════════════════

-- Atomic invoice number generator
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_store_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  v_date TEXT;
  v_counter INTEGER;
BEGIN
  v_date := TO_CHAR(NOW(), 'YYMMDD');
  INSERT INTO invoice_counters (store_id, date_key, counter)
  VALUES (p_store_id, v_date, 1)
  ON CONFLICT (store_id, date_key)
  DO UPDATE SET counter = invoice_counters.counter + 1
  RETURNING counter INTO v_counter;
  RETURN 'INV' || v_date || LPAD(v_counter::TEXT, 4, '0');
END;
$$ LANGUAGE plpgsql;

-- Update inventory after sale
CREATE OR REPLACE FUNCTION update_inventory_after_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_current NUMERIC;
BEGIN
  SELECT quantity INTO v_current FROM inventory WHERE product_id = NEW.product_id AND store_id = (SELECT store_id FROM sales WHERE id = NEW.sale_id);
  UPDATE inventory SET quantity = quantity - NEW.quantity, updated_at = NOW()
  WHERE product_id = NEW.product_id;
  INSERT INTO inventory_movements (product_id, type, quantity, before_quantity, after_quantity, reference_type, reference_id, store_id)
  VALUES (NEW.product_id, 'sale', NEW.quantity, v_current, v_current - NEW.quantity, 'sale', NEW.sale_id, (SELECT store_id FROM sales WHERE id = NEW.sale_id));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trigger_inventory_after_sale
AFTER INSERT ON sale_items FOR EACH ROW EXECUTE FUNCTION update_inventory_after_sale();
