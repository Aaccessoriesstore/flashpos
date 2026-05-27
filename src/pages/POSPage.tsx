// @ts-nocheck
import { useEffect, useState, useRef, useCallback } from 'react'
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X,
  CreditCard, Wallet, Banknote, Clock, User, Percent,
  CheckCircle, Printer, Zap, AlertCircle, Package,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { useCartStore } from '../stores/cartStore'
import type { Product, Customer, Shift, PaymentMethod } from '../types'
import toast from 'react-hot-toast'

const PAYMENT_OPTS: { key: PaymentMethod; label: string; icon: React.ReactNode }[] = [
  { key: 'cash', label: 'نقدي', icon: <Banknote size={16} /> },
  { key: 'card', label: 'بطاقة', icon: <CreditCard size={16} /> },
  { key: 'wallet', label: 'محفظة', icon: <Wallet size={16} /> },
  { key: 'credit', label: 'آجل', icon: <Clock size={16} /> },
]

export default function POSPage() {
  const { storeId, user } = useAuthStore()
  const cart = useCartStore()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<any[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [paidAmount, setPaidAmount] = useState('')
  const [processing, setProcessing] = useState(false)
  const [successSale, setSuccessSale] = useState<any>(null)
  const [openShiftModal, setOpenShiftModal] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [shiftLoading, setShiftLoading] = useState(false)
  const [customerSearch, setCustomerSearch] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: prods }, { data: cats }, { data: custs }, { data: shift }] = await Promise.all([
      supabase.from('products').select('*, inventory(quantity)').eq('store_id', storeId).eq('is_active', true).order('name'),
      supabase.from('categories').select('*').eq('store_id', storeId).eq('is_active', true).order('sort_order'),
      supabase.from('customers').select('*').eq('store_id', storeId).eq('is_active', true).order('name'),
      supabase.from('shifts').select('*').eq('store_id', storeId).eq('status', 'open').eq('user_id', user!.id).order('opened_at', { ascending: false }).limit(1).single(),
    ])
    setProducts((prods || []).map(p => ({ ...p, current_stock: p.inventory?.[0]?.quantity || 0 })))
    setCategories(cats || [])
    setCustomers(custs || [])
    setActiveShift(shift || null)
    setLoading(false)
  }, [storeId, user])

  useEffect(() => { loadData() }, [loadData])

  // Barcode scanner (keyboard input detection)
  useEffect(() => {
    let barcodeBuffer = ''
    let barcodeTimer: ReturnType<typeof setTimeout>
    const handler = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT') return
      if (e.key === 'Enter' && barcodeBuffer.length > 3) {
        const prod = products.find(p => p.barcode === barcodeBuffer)
        if (prod) { addToCart(prod); toast.success(`تم إضافة ${prod.name}`) }
        else toast.error(`باركود غير موجود: ${barcodeBuffer}`)
        barcodeBuffer = ''
      } else if (e.key.length === 1) {
        barcodeBuffer += e.key
        clearTimeout(barcodeTimer)
        barcodeTimer = setTimeout(() => { barcodeBuffer = '' }, 100)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [products])

  const filteredProducts = products.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.barcode?.includes(search)
    const matchCat = !activeCategory || p.category_id === activeCategory
    return matchSearch && matchCat
  })

  const addToCart = (product: Product) => {
    const stock = product.current_stock || 0
    if (product.track_inventory && !product.allow_negative_stock && stock <= 0) {
      return toast.error('المخزون نفد')
    }
    if (product.track_inventory && !product.allow_negative_stock) {
      const inCart = cart.items.find(i => i.product.id === product.id)?.quantity || 0
      if (inCart >= stock) return toast.error(`المخزون المتاح: ${stock} فقط`)
    }
    cart.addItem(product)
  }

  const openShift = async () => {
    setShiftLoading(true)
    try {
      const { data, error } = await supabase.from('shifts').insert({
        user_id: user!.id, store_id: storeId,
        opening_cash: Number(openingCash) || 0,
        status: 'open',
      }).select().single()
      if (error) throw error
      setActiveShift(data)
      setOpenShiftModal(false)
      setOpeningCash('')
      toast.success('تم فتح الوردية بنجاح')
    } catch (err: any) {
      toast.error(err.message)
    } finally { setShiftLoading(false) }
  }

  const completeSale = async () => {
    if (cart.items.length === 0) return toast.error('السلة فارغة')
    if (!activeShift) return toast.error('يجب فتح وردية أولاً')

    const total = cart.total()
    const paid = cart.paymentMethod === 'cash' ? Number(paidAmount) : total
    if (cart.paymentMethod === 'cash' && paid < total) return toast.error('المبلغ المدفوع أقل من الإجمالي')
    if (cart.paymentMethod === 'credit' && !cart.customer) return toast.error('يجب اختيار عميل للبيع الآجل')

    setProcessing(true)
    try {
      // Get atomic invoice number
      const { data: invoiceData } = await supabase.rpc('get_next_invoice_number', { p_store_id: storeId })
      const invoiceNumber = invoiceData

      const subtotal = cart.subtotal()
      const discountAmt = cart.discountAmount()
      const taxAmt = cart.taxAmount()
      const loyaltyDiscount = cart.loyaltyDiscount()

      // Insert sale
      const { data: sale, error: saleError } = await supabase.from('sales').insert({
        invoice_number: invoiceNumber,
        customer_id: cart.customer?.id || 1,
        user_id: user!.id,
        shift_id: activeShift.id,
        subtotal,
        discount_amount: discountAmt + loyaltyDiscount,
        discount_percent: cart.discountPercent,
        tax_amount: taxAmt,
        total,
        paid_amount: paid,
        change_amount: Math.max(0, paid - total),
        payment_method: cart.paymentMethod,
        status: 'completed',
        notes: cart.notes || null,
        loyalty_points_earned: Math.floor(total),
        loyalty_points_used: cart.loyaltyPointsToUse,
        store_id: storeId,
      }).select().single()

      if (saleError) throw saleError

      // Insert sale items
      const saleItems = cart.items.map(item => ({
        sale_id: sale.id,
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.product.cost_price || 0,
        discount_percent: item.discount_percent,
        discount_amount: item.discount_amount,
        tax_percent: item.product.tax_exempt ? 0 : 14,
        tax_amount: item.tax_amount,
        total: item.total,
      }))

      const { error: itemsError } = await supabase.from('sale_items').insert(saleItems)
      if (itemsError) throw itemsError

      // Update customer balance/points
      if (cart.customer && cart.customer.id !== 1) {
        const updates: any = {
          loyalty_points: cart.customer.loyalty_points + Math.floor(total) - cart.loyaltyPointsToUse,
          total_purchases: cart.customer.total_purchases + total,
        }
        if (cart.paymentMethod === 'credit') {
          updates.current_balance = cart.customer.current_balance + total
        }
        await supabase.from('customers').update(updates).eq('id', cart.customer.id)
      }

      // Update shift totals
      await supabase.from('shifts').update({
        total_sales: activeShift.total_sales + total,
        total_transactions: activeShift.total_transactions + 1,
      }).eq('id', activeShift.id)

      setSuccessSale({ ...sale, items: cart.items, change: Math.max(0, paid - total) })
      cart.clearCart()
      setCheckoutOpen(false)
      setPaidAmount('')
      setActiveShift(prev => prev ? { ...prev, total_sales: prev.total_sales + total, total_transactions: prev.total_transactions + 1 } : prev)

    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إتمام البيع')
    } finally { setProcessing(false) }
  }

  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // No shift screen
  if (!loading && !activeShift) return (
    <div className="flex-center animate-fade-in" style={{ height: '100%', flexDirection: 'column', gap: '1.5rem', padding: '2rem' }}>
      <div style={{ width: '80px', height: '80px', background: 'var(--brand-primary-light)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Clock size={36} style={{ color: 'var(--brand-primary)' }} />
      </div>
      <div className="text-center">
        <h2 style={{ marginBottom: '0.5rem' }}>لم يتم فتح وردية بعد</h2>
        <p className="text-secondary text-sm">يجب فتح وردية قبل البدء في البيع</p>
      </div>
      <button onClick={() => setOpenShiftModal(true)} className="btn btn-primary btn-lg">
        <Clock size={18} /> فتح وردية الآن
      </button>

      {openShiftModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3>فتح وردية جديدة</h3>
              <button onClick={() => setOpenShiftModal(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">رصيد الخزينة الافتتاحي (ج.م)</label>
                <input className="input font-mono" type="number" min="0" placeholder="0.00" value={openingCash} onChange={e => setOpeningCash(e.target.value)} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setOpenShiftModal(false)} className="btn btn-secondary">إلغاء</button>
                <button onClick={openShift} className="btn btn-primary" disabled={shiftLoading}>
                  {shiftLoading ? <span className="spinner" /> : 'فتح الوردية'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div className="animate-fade-in" style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Products Panel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', borderLeft: '1px solid var(--border)' }}>
        {/* Header */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div className="search-bar" style={{ flex: 1 }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input ref={searchRef} placeholder="بحث أو مسح باركود..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={13} /></button>}
          </div>
          {activeShift && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 'var(--radius)', fontSize: '0.78rem', color: 'var(--brand-primary)', whiteSpace: 'nowrap' }}>
              <Clock size={13} /> وردية مفتوحة
            </div>
          )}
        </div>

        {/* Categories */}
        <div style={{ display: 'flex', gap: '0.5rem', padding: '0.75rem 1rem', overflowX: 'auto', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              padding: '0.35rem 0.9rem', borderRadius: '100px', border: 'none', cursor: 'pointer',
              background: !activeCategory ? 'var(--brand-primary)' : 'var(--bg-elevated)',
              color: !activeCategory ? 'var(--text-inverse)' : 'var(--text-secondary)',
              fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Cairo', sans-serif",
              transition: 'all var(--transition)', whiteSpace: 'nowrap',
            }}
          >الكل</button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(activeCategory === cat.id ? null : cat.id)}
              style={{
                padding: '0.35rem 0.9rem', borderRadius: '100px', border: 'none', cursor: 'pointer',
                background: activeCategory === cat.id ? cat.color : 'var(--bg-elevated)',
                color: activeCategory === cat.id ? '#fff' : 'var(--text-secondary)',
                fontSize: '0.8rem', fontWeight: 600, fontFamily: "'Cairo', sans-serif",
                transition: 'all var(--transition)', whiteSpace: 'nowrap',
                borderLeft: activeCategory !== cat.id ? `2px solid ${cat.color}` : 'none',
              }}
            >{cat.name}</button>
          ))}
        </div>

        {/* Products Grid */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
          {loading ? (
            <div className="flex-center" style={{ height: '200px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div>
          ) : filteredProducts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Package size={28} /></div>
              <h3>لا توجد منتجات</h3>
              <p className="text-sm">{search ? 'جرب بحثاً آخر' : 'أضف منتجات من صفحة المنتجات أولاً'}</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.65rem' }}>
              {filteredProducts.map(product => {
                const stock = product.current_stock || 0
                const outOfStock = product.track_inventory && !product.allow_negative_stock && stock <= 0
                const inCart = cart.items.find(i => i.product.id === product.id)?.quantity || 0
                return (
                  <button
                    key={product.id}
                    onClick={() => addToCart(product)}
                    disabled={outOfStock}
                    style={{
                      background: inCart > 0 ? 'rgba(0,200,150,0.08)' : 'var(--bg-card)',
                      border: `1px solid ${inCart > 0 ? 'rgba(0,200,150,0.3)' : 'var(--border)'}`,
                      borderRadius: 'var(--radius)',
                      padding: '0.75rem',
                      cursor: outOfStock ? 'not-allowed' : 'pointer',
                      opacity: outOfStock ? 0.45 : 1,
                      textAlign: 'right',
                      transition: 'all var(--transition)',
                      fontFamily: "'Cairo', sans-serif",
                      position: 'relative',
                    }}
                    onMouseEnter={e => { if (!outOfStock) e.currentTarget.style.borderColor = 'var(--brand-primary)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = inCart > 0 ? 'rgba(0,200,150,0.3)' : 'var(--border)' }}
                  >
                    {inCart > 0 && (
                      <div style={{ position: 'absolute', top: '6px', left: '6px', width: '20px', height: '20px', background: 'var(--brand-primary)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 800, color: 'var(--text-inverse)' }}>
                        {inCart}
                      </div>
                    )}
                    {product.category && (
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: product.category.color, marginBottom: '0.4rem' }} />
                    )}
                    <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', lineHeight: 1.3 }}>{product.name}</div>
                    <div style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--brand-primary)', fontFamily: "'JetBrains Mono', monospace" }}>
                      {product.selling_price.toLocaleString()} ج
                    </div>
                    {product.track_inventory && (
                      <div style={{ fontSize: '0.7rem', color: stock <= product.min_stock ? 'var(--brand-warning)' : 'var(--text-muted)', marginTop: '0.2rem' }}>
                        {outOfStock ? 'نفد' : `المخزون: ${stock}`}
                      </div>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Cart Panel */}
      <div style={{ width: '320px', minWidth: '320px', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Cart Header */}
        <div style={{ padding: '0.85rem 1rem', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <ShoppingCart size={16} style={{ color: 'var(--brand-primary)' }} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>السلة</span>
            {cart.items.length > 0 && <span className="badge badge-primary">{cart.itemCount()}</span>}
          </div>
          {cart.items.length > 0 && (
            <button onClick={cart.clearCart} className="btn btn-ghost btn-icon btn-sm" title="مسح السلة" style={{ color: 'var(--brand-danger)' }}>
              <Trash2 size={14} />
            </button>
          )}
        </div>

        {/* Customer Select */}
        <div style={{ padding: '0.6rem 1rem', borderBottom: '1px solid var(--border)' }}>
          <select
            className="input"
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}
            value={cart.customer?.id || ''}
            onChange={e => {
              const c = customers.find(cu => cu.id === Number(e.target.value))
              cart.setCustomer(c || null)
            }}
          >
            <option value="">عميل نقدي</option>
            {customers.filter(c => c.id !== 1).map(c => (
              <option key={c.id} value={c.id}>{c.name} {c.phone ? `· ${c.phone}` : ''}</option>
            ))}
          </select>
          {cart.customer && cart.customer.loyalty_points > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--brand-accent)', marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <Zap size={11} /> نقاط الولاء: {cart.customer.loyalty_points} نقطة
            </div>
          )}
        </div>

        {/* Cart Items */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0.5rem' }}>
          {cart.items.length === 0 ? (
            <div className="empty-state" style={{ padding: '2rem 1rem' }}>
              <div className="empty-state-icon"><ShoppingCart size={24} /></div>
              <p className="text-sm">اضغط على منتج لإضافته</p>
            </div>
          ) : (
            cart.items.map((item, i) => (
              <div key={item.product.id} style={{ padding: '0.65rem 0.5rem', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div className="flex-between">
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, flex: 1, paddingLeft: '0.5rem' }} className="truncate">{item.product.name}</span>
                  <button onClick={() => cart.removeItem(item.product.id)} className="btn btn-ghost btn-icon" style={{ padding: '2px', color: 'var(--text-muted)' }}><X size={13} /></button>
                </div>
                <div className="flex-between">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <button onClick={() => cart.updateQty(item.product.id, item.quantity - 1)} className="btn btn-ghost btn-icon" style={{ padding: '3px', width: '24px', height: '24px', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <Minus size={11} />
                    </button>
                    <span className="font-mono" style={{ minWidth: '28px', textAlign: 'center', fontSize: '0.88rem', fontWeight: 700 }}>{item.quantity}</span>
                    <button onClick={() => cart.updateQty(item.product.id, item.quantity + 1)} className="btn btn-ghost btn-icon" style={{ padding: '3px', width: '24px', height: '24px', border: '1px solid var(--border)', borderRadius: '6px' }}>
                      <Plus size={11} />
                    </button>
                  </div>
                  <div style={{ textAlign: 'left' }}>
                    <div className="font-mono" style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--brand-primary)' }}>{fmt(item.total)} ج</div>
                    {item.discount_percent > 0 && <div className="text-xs text-muted" style={{ textDecoration: 'line-through' }}>{fmt(item.unit_price * item.quantity)} ج</div>}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Totals */}
        {cart.items.length > 0 && (
          <div style={{ borderTop: '1px solid var(--border)', padding: '0.85rem 1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginBottom: '0.85rem' }}>
              {[
                { label: 'المجموع', value: cart.subtotal(), color: 'var(--text-primary)' },
                cart.discountAmount() > 0 && { label: 'الخصم', value: -cart.discountAmount(), color: 'var(--brand-danger)' },
                cart.taxAmount() > 0 && { label: 'ضريبة 14%', value: cart.taxAmount(), color: 'var(--text-secondary)' },
                cart.loyaltyDiscount() > 0 && { label: 'خصم نقاط الولاء', value: -cart.loyaltyDiscount(), color: 'var(--brand-accent)' },
              ].filter(Boolean).map((row: any, i) => (
                <div key={i} className="flex-between">
                  <span className="text-sm text-secondary">{row.label}</span>
                  <span className="font-mono text-sm" style={{ color: row.color }}>{row.value < 0 ? '-' : ''}{fmt(Math.abs(row.value))} ج</span>
                </div>
              ))}
              <div className="divider" style={{ margin: '0.35rem 0' }} />
              <div className="flex-between">
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>الإجمالي</span>
                <span className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--brand-primary)' }}>{fmt(cart.total())} ج</span>
              </div>
            </div>

            {/* Quick discount */}
            <div className="flex-between" style={{ marginBottom: '0.75rem', gap: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flex: 1 }}>
                <Percent size={13} style={{ color: 'var(--text-muted)' }} />
                <input
                  className="input"
                  type="number" min="0" max="100"
                  placeholder="خصم %"
                  style={{ padding: '0.35rem 0.6rem', fontSize: '0.82rem' }}
                  value={cart.discountPercent || ''}
                  onChange={e => cart.setDiscount(Number(e.target.value))}
                />
              </div>
            </div>

            <button onClick={() => setCheckoutOpen(true)} className="btn btn-primary btn-full btn-lg" style={{ fontSize: '1rem' }}>
              <ShoppingCart size={18} /> إتمام البيع
            </button>
          </div>
        )}
      </div>

      {/* Checkout Modal */}
      {checkoutOpen && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>إتمام البيع</h3>
              <button onClick={() => setCheckoutOpen(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Payment Method */}
              <div>
                <label className="input-label" style={{ marginBottom: '0.5rem', display: 'block' }}>طريقة الدفع</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
                  {PAYMENT_OPTS.map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => cart.setPaymentMethod(opt.key)}
                      style={{
                        padding: '0.6rem 0.4rem',
                        borderRadius: 'var(--radius)',
                        border: `1px solid ${cart.paymentMethod === opt.key ? 'var(--brand-primary)' : 'var(--border)'}`,
                        background: cart.paymentMethod === opt.key ? 'var(--brand-primary-light)' : 'var(--bg-input)',
                        color: cart.paymentMethod === opt.key ? 'var(--brand-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer', fontFamily: "'Cairo', sans-serif",
                        fontSize: '0.75rem', fontWeight: 700,
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem',
                        transition: 'all var(--transition)',
                      }}
                    >
                      {opt.icon}{opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Total */}
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '1rem', textAlign: 'center' }}>
                <div className="text-sm text-muted" style={{ marginBottom: '0.25rem' }}>المبلغ المطلوب</div>
                <div className="font-mono" style={{ fontSize: '2rem', fontWeight: 900, color: 'var(--brand-primary)' }}>{fmt(cart.total())} ج</div>
              </div>

              {/* Cash amount input */}
              {cart.paymentMethod === 'cash' && (
                <>
                  <div className="input-group">
                    <label className="input-label">المبلغ المدفوع (ج.م)</label>
                    <input
                      className="input font-mono"
                      type="number" min="0" step="0.01"
                      placeholder={fmt(cart.total())}
                      value={paidAmount}
                      onChange={e => setPaidAmount(e.target.value)}
                      autoFocus
                      style={{ fontSize: '1.1rem', textAlign: 'center' }}
                    />
                  </div>

                  {/* Quick amounts */}
                  <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                    {[cart.total(), Math.ceil(cart.total() / 10) * 10, Math.ceil(cart.total() / 50) * 50, Math.ceil(cart.total() / 100) * 100]
                      .filter((v, i, arr) => arr.indexOf(v) === i)
                      .slice(0, 4)
                      .map(amt => (
                        <button key={amt} onClick={() => setPaidAmount(amt.toFixed(2))}
                          className="btn btn-secondary btn-sm" style={{ flex: 1 }}>
                          {fmt(amt)}
                        </button>
                      ))}
                  </div>

                  {Number(paidAmount) > 0 && Number(paidAmount) >= cart.total() && (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', background: 'rgba(0,200,150,0.1)', border: '1px solid rgba(0,200,150,0.2)', borderRadius: 'var(--radius)' }}>
                      <span className="text-sm" style={{ color: 'var(--brand-primary)' }}>الباقي</span>
                      <span className="font-mono" style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-primary)' }}>{fmt(Number(paidAmount) - cart.total())} ج</span>
                    </div>
                  )}
                </>
              )}

              {cart.paymentMethod === 'credit' && !cart.customer && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.65rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 'var(--radius)', fontSize: '0.85rem', color: 'var(--brand-danger)' }}>
                  <AlertCircle size={15} /> يجب اختيار عميل للبيع الآجل
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setCheckoutOpen(false)} className="btn btn-secondary" style={{ flex: 1 }}>إلغاء</button>
                <button onClick={completeSale} className="btn btn-primary" style={{ flex: 2 }} disabled={processing}>
                  {processing ? <><span className="spinner" /> جاري المعالجة...</> : <><CheckCircle size={16} /> تأكيد البيع</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successSale && (
        <div className="modal-overlay">
          <div className="modal animate-slide-up" style={{ maxWidth: '360px', textAlign: 'center' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ width: '64px', height: '64px', background: 'rgba(0,200,150,0.15)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                <CheckCircle size={32} style={{ color: 'var(--brand-primary)' }} />
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '0.35rem' }}>تم البيع بنجاح!</h3>
              <p className="font-mono" style={{ color: 'var(--brand-primary)', fontSize: '0.9rem' }}>{successSale.invoice_number}</p>
            </div>

            <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <div className="flex-between">
                <span className="text-sm text-secondary">الإجمالي</span>
                <span className="font-mono font-bold">{fmt(successSale.total)} ج</span>
              </div>
              <div className="flex-between">
                <span className="text-sm text-secondary">المدفوع</span>
                <span className="font-mono">{fmt(successSale.paid_amount)} ج</span>
              </div>
              {successSale.change > 0 && (
                <div className="flex-between">
                  <span className="text-sm" style={{ color: 'var(--brand-primary)' }}>الباقي للعميل</span>
                  <span className="font-mono" style={{ color: 'var(--brand-primary)', fontWeight: 800 }}>{fmt(successSale.change)} ج</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button onClick={() => setSuccessSale(null)} className="btn btn-secondary" style={{ flex: 1 }}>
                إغلاق
              </button>
              <button onClick={() => { window.print(); setSuccessSale(null) }} className="btn btn-primary" style={{ flex: 1 }}>
                <Printer size={15} /> طباعة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
