import { useEffect, useState, useCallback } from 'react'
import { FileText, Search, Eye, X, Printer } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'

const PAYMENT_LABELS: Record<string, string> = { cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', credit: 'آجل' }
const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  completed: { label: 'مكتملة', cls: 'badge-success' },
  refunded: { label: 'مرتجع', cls: 'badge-danger' },
  partial_refund: { label: 'مرتجع جزئي', cls: 'badge-warning' },
}

export default function InvoicesPage() {
  const { storeId } = useAuthStore()
  const [sales, setSales] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterMethod, setFilterMethod] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const [saleItems, setSaleItems] = useState<any[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('sales')
      .select('*, customers(name, phone), app_users(full_name)')
      .eq('store_id', storeId)
      .order('created_at', { ascending: false })
      .limit(100)
    setSales(data || [])
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const filtered = sales.filter(s => {
    const matchSearch = !search || s.invoice_number.includes(search) || s.customers?.name?.includes(search)
    const matchMethod = !filterMethod || s.payment_method === filterMethod
    const matchStatus = !filterStatus || s.status === filterStatus
    return matchSearch && matchMethod && matchStatus
  })

  const viewSale = async (sale: any) => {
    setSelectedSale(sale)
    const { data } = await supabase.from('sale_items').select('*, products(name, unit)').eq('sale_id', sale.id)
    setSaleItems(data || [])
  }

  const fmt = (n: number) => n?.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'
  const fmtDate = (d: string) => format(new Date(d), 'dd MMM yyyy - hh:mm a', { locale: ar })

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><FileText size={18} /></div>
          <div><h1>الفواتير</h1><p className="text-xs text-muted">{filtered.length} فاتورة</p></div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input placeholder="رقم الفاتورة أو اسم العميل..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
          </div>
          <select className="input" style={{ width: 'auto' }} value={filterMethod} onChange={e => setFilterMethod(e.target.value)}>
            <option value="">كل طرق الدفع</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="input" style={{ width: 'auto' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
            <option value="">كل الحالات</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="flex-center" style={{ height: '200px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><FileText size={28} /></div>
            <h3>لا توجد فواتير</h3>
            <p>ابدأ البيع من نقطة البيع</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>رقم الفاتورة</th>
                  <th>العميل</th>
                  <th>التاريخ</th>
                  <th>الإجمالي</th>
                  <th>طريقة الدفع</th>
                  <th>الكاشير</th>
                  <th>الحالة</th>
                  <th style={{ width: '60px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(s => (
                  <tr key={s.id}>
                    <td className="font-mono" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{s.invoice_number}</td>
                    <td>{s.customers?.name || 'عميل نقدي'}</td>
                    <td className="text-sm text-secondary">{fmtDate(s.created_at)}</td>
                    <td className="font-mono font-bold">{fmt(s.total)} ج</td>
                    <td><span className="badge badge-neutral">{PAYMENT_LABELS[s.payment_method]}</span></td>
                    <td className="text-sm text-secondary">{s.app_users?.full_name || '—'}</td>
                    <td><span className={`badge ${STATUS_LABELS[s.status]?.cls}`}>{STATUS_LABELS[s.status]?.label}</span></td>
                    <td>
                      <button onClick={() => viewSale(s)} className="btn btn-ghost btn-icon btn-sm" title="عرض"><Eye size={14} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Invoice Detail Modal */}
      {selectedSale && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedSale(null)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3 className="font-mono" style={{ color: 'var(--brand-primary)' }}>{selectedSale.invoice_number}</h3>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button onClick={() => window.print()} className="btn btn-secondary btn-sm"><Printer size={14} /> طباعة</button>
                <button onClick={() => setSelectedSale(null)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2" style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '1rem', gap: '0.6rem' }}>
                {[
                  { label: 'العميل', value: selectedSale.customers?.name || 'عميل نقدي' },
                  { label: 'التاريخ', value: fmtDate(selectedSale.created_at) },
                  { label: 'الكاشير', value: selectedSale.app_users?.full_name || '—' },
                  { label: 'طريقة الدفع', value: PAYMENT_LABELS[selectedSale.payment_method] },
                ].map((row, i) => (
                  <div key={i}>
                    <div className="text-xs text-muted">{row.label}</div>
                    <div className="text-sm" style={{ fontWeight: 600, marginTop: '0.15rem' }}>{row.value}</div>
                  </div>
                ))}
              </div>

              {/* Items */}
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الخصم</th><th>الضريبة</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {saleItems.map(item => (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600 }}>{item.products?.name}<span className="text-xs text-muted" style={{ marginRight: '0.25rem' }}>{item.products?.unit}</span></td>
                        <td className="font-mono">{item.quantity}</td>
                        <td className="font-mono">{fmt(item.unit_price)} ج</td>
                        <td className="font-mono text-danger">{item.discount_amount > 0 ? `-${fmt(item.discount_amount)} ج` : '—'}</td>
                        <td className="font-mono text-secondary">{item.tax_amount > 0 ? `${fmt(item.tax_amount)} ج` : '—'}</td>
                        <td className="font-mono font-bold" style={{ color: 'var(--brand-primary)' }}>{fmt(item.total)} ج</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem', maxWidth: '300px', alignSelf: 'flex-end', width: '100%' }}>
                {[
                  { label: 'المجموع', value: `${fmt(selectedSale.subtotal)} ج` },
                  selectedSale.discount_amount > 0 && { label: 'الخصم', value: `-${fmt(selectedSale.discount_amount)} ج`, color: 'var(--brand-danger)' },
                  selectedSale.tax_amount > 0 && { label: 'ضريبة 14%', value: `${fmt(selectedSale.tax_amount)} ج` },
                ].filter(Boolean).map((row: any, i) => (
                  <div key={i} className="flex-between">
                    <span className="text-sm text-secondary">{row.label}</span>
                    <span className="font-mono text-sm" style={{ color: row.color }}>{row.value}</span>
                  </div>
                ))}
                <div className="divider" />
                <div className="flex-between">
                  <span style={{ fontWeight: 800 }}>الإجمالي</span>
                  <span className="font-mono font-bold" style={{ color: 'var(--brand-primary)', fontSize: '1.1rem' }}>{fmt(selectedSale.total)} ج</span>
                </div>
                <div className="flex-between">
                  <span className="text-sm text-secondary">المدفوع</span>
                  <span className="font-mono text-sm">{fmt(selectedSale.paid_amount)} ج</span>
                </div>
                {selectedSale.change_amount > 0 && (
                  <div className="flex-between">
                    <span className="text-sm text-secondary">الباقي</span>
                    <span className="font-mono text-sm" style={{ color: 'var(--brand-success)' }}>{fmt(selectedSale.change_amount)} ج</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
