// ============================================================
// FlashPOS — Type Definitions
// ============================================================

export type UserRole = 'admin' | 'manager' | 'cashier'
export type PaymentMethod = 'cash' | 'card' | 'wallet' | 'credit'
export type SaleStatus = 'completed' | 'refunded' | 'partial_refund'
export type ShiftStatus = 'open' | 'closed'
export type CustomerType = 'retail' | 'wholesale' | 'vip'

export interface Store {
  id: number
  name: string
  address?: string
  phone?: string
  email?: string
  tax_number?: string
  currency: string
  tax_rate: number
  receipt_header?: string
  receipt_footer?: string
  logo_url?: string
}

export interface User {
  id: string
  username: string
  full_name: string
  role: UserRole
  email?: string
  phone?: string
  pin_code?: string
  is_active: boolean
  store_id: number
  last_login?: string
  created_at: string
}

export interface Category {
  id: number
  name: string
  name_ar?: string
  color: string
  icon: string
  sort_order: number
  is_active: boolean
  store_id: number
}

export interface Product {
  id: number
  barcode?: string
  sku?: string
  name: string
  name_ar?: string
  category_id?: number
  category?: Category
  cost_price: number
  selling_price: number
  wholesale_price?: number
  discount_percent: number
  tax_exempt: boolean
  unit: string
  min_stock: number
  current_stock: number
  track_inventory: boolean
  allow_negative_stock: boolean
  image_url?: string
  is_active: boolean
  store_id: number
}

export interface Customer {
  id: number
  name: string
  phone?: string
  email?: string
  address?: string
  customer_type: CustomerType
  credit_limit: number
  current_balance: number
  loyalty_points: number
  total_purchases: number
  is_active: boolean
  store_id: number
  created_at: string
}

export interface Shift {
  id: number
  user_id: string
  user?: User
  opening_cash: number
  closing_cash?: number
  expected_cash?: number
  cash_difference?: number
  total_sales: number
  total_refunds: number
  total_transactions: number
  status: ShiftStatus
  opened_at: string
  closed_at?: string
  notes?: string
  store_id: number
}

export interface SaleItem {
  id?: number
  product_id: number
  product?: Product
  quantity: number
  unit_price: number
  cost_price: number
  discount_percent: number
  discount_amount: number
  tax_percent: number
  tax_amount: number
  total: number
}

export interface Sale {
  id: number
  invoice_number: string
  customer_id?: number
  customer?: Customer
  user_id: string
  shift_id?: number
  subtotal: number
  discount_amount: number
  discount_percent: number
  tax_amount: number
  total: number
  paid_amount: number
  change_amount: number
  payment_method: PaymentMethod
  status: SaleStatus
  notes?: string
  loyalty_points_earned: number
  loyalty_points_used: number
  items?: SaleItem[]
  store_id: number
  created_at: string
}

export interface CartItem {
  product: Product
  quantity: number
  unit_price: number
  discount_percent: number
  discount_amount: number
  tax_amount: number
  total: number
}

export interface DashboardStats {
  today_sales: number
  today_invoices: number
  today_profit: number
  profit_margin: number
  avg_invoice: number
  low_stock_count: number
  weekly_sales: { date: string; total: number; profit: number }[]
  payment_methods: { method: string; total: number; count: number }[]
  top_products: { name: string; quantity: number; total: number }[]
  recent_sales: Sale[]
}
