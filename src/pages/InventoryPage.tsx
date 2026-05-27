// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { Warehouse, Search, Plus, Minus, AlertTriangle, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function InventoryPage() {
  const { storeId, user } = useAuthStore()
  const [inventory, setInventory] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const [adjModal, setAdjModal] = useState<any>(null)
  const [adjQty, setAdjQty] = useState('')
  const [adjType, setAdjType] = useState<'add' | 'remove' | 'set'>('add')
  const [adjNote, setAdjNote] = useState('')
  const [saving, setSaving] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('inventory')
      .select('*, products(id, name, name_ar, barcode, unit, min_stock, track_inventory, is_active, categories(name, color))')
      .eq('store_id', storeId)
      .eq('products.is_active', true)
      .order('quantity', { ascending: true })
    setInventory((data || []).filter(i => i.products))
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const filtered = inventory.filter(i => {
    const p = i.products
    const matchSearch = !search || p.name?.includes(search) || p.barcode?.includes(search)
    const stock = i.quantity || 0
    const matchFilter = filter === 'all' || (filter === 'low' && stock <= p.min_stock && p.track_inventory) || (filter === 'out' && stock <= 0 && p.track_inventory)
    return matchSearch && matchFilter
  })

  const adjust = async () => {
    if (!adjModal || !adjQty) return toast.error('أدخل الكمية')
    const qty = Number(adjQty)
    if (isNaN(qty) || qty < 0) return toast.error('كمية غير صحيحة')
    setSaving(true)
    try {
      const current = adjModal.quantity || 0
      let newQty = current
      if (adjType === 'add') newQty = current + qty
      else if (adjType === 'remove') newQty = Math.max(0, current - qty)
      else newQty = qty

      const { error } = await supabase.from('inventory')
        .update({ quantity: newQty, updated_at: new Date().toISOString() })
        .eq('id', adjModal.id)
      if (error) throw error

      // Log movement
      await supabase.from('inventory_movements').insert({
        product_id: adjModal.products.id, type: 'adjustment',
        quantity: adjType === 'remove' ? -qty : newQty - current,
        before_quantity: current, after_quantity: newQty,
        notes: adjNote || null, user_id: user!.id, store_id: storeId,
      })

      toast.success('تم تحديث المخزون')
      setAdjModal(null); setAdjQty(''); setAdjNote(''); load()
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const getStockColor = (qty: number, min: number) => {
    if (qty <= 0) return 'var(--brand-danger)'
    if (qty <= min) return 'var(--brand-warning)'
    return 'var(--brand-success)'
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><Warehouse size={18} /></div>
          <div>
            <h1>المخزون</h1>
            <p className="text-xs text-muted">
              {inventory.filter(i => i.quantity <= i.products?.min_stock && i.products?.track_inventory).length} منتج تحت الحد الأدنى
            </p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input placeholder="بحث بالاسم أو الباركود..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
          </div>
          {[{ k: 'all', l: 'الكل' }, { k: 'low', l: 'تحت الحد' }, { k: 'out', l: 'نفد' }].map(f => (
            <button key={f.k} onClick={() => setFilter(f.k)}
              className={`btn btn-sm ${filter === f.k ? 'btn-primary' : 'btn-secondary'}`}>{f.l}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex-center" style={{ height: '200px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Warehouse size={28} /></div>
            <h3>لا توجد منتجات</h3>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الفئة</th>
                  <th>الكمية الحالية</th>
                  <th>الحد الأدنى</th>
                  <th>الوحدة</th>
                  <th>الحالة</th>
                  {isAdmin && <th style={{ width: '80px' }}>تعديل</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const p = item.products
                  const qty = item.quantity || 0
                  const isLow = p.track_inventory && qty <= p.min_stock
                  const isOut = p.track_inventory && qty <= 0
                  return (
                    <tr key={item.id} style={{ background: isOut ? 'rgba(239,68,68,0.03)' : isLow ? 'rgba(245,158,11,0.03)' : undefined }}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {isLow && <AlertTriangle size={13} style={{ color: isOut ? 'var(--brand-danger)' : 'var(--brand-warning)', flexShrink: 0 }} />}
                          <div>
                            <div style={{ fontWeight: 600 }}>{p.name}</div>
                            {p.barcode && <div className="text-xs text-muted font-mono">{p.barcode}</div>}
                          </div>
                        </div>
                      </td>
                      <td>
                        {p.categories ? (
                          <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: p.categories.color }} />
                            <span className="text-sm">{p.categories.name}</span>
                          </span>
                        ) : <span className="text-muted">—</span>}
                      </td>
                      <td>
                        <span className="font-mono font-bold" style={{ color: getStockColor(qty, p.min_stock), fontSize: '1.05rem' }}>
                          {qty}
                        </span>
                      </td>
                      <td className="font-mono text-secondary">{p.min_stock}</td>
                      <td className="text-sm text-secondary">{p.unit}</td>
                      <td>
                        {!p.track_inventory ? <span className="badge badge-neutral">غير مُتابع</span>
                          : isOut ? <span className="badge badge-danger">نفد</span>
                          : isLow ? <span className="badge badge-warning">منخفض</span>
                          : <span className="badge badge-success">متوفر</span>}
                      </td>
                      {isAdmin && (
                        <td>
                          <button onClick={() => setAdjModal(item)} className="btn btn-secondary btn-sm">
                            <Plus size={13} /> تعديل
                          </button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Adjustment Modal */}
      {adjModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setAdjModal(null)}>
          <div className="modal" style={{ maxWidth: '380px' }}>
            <div className="modal-header">
              <h3>تعديل المخزون</h3>
              <button onClick={() => setAdjModal(null)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '0.85rem' }}>
                <div style={{ fontWeight: 600 }}>{adjModal.products.name}</div>
                <div className="text-sm text-muted">الكمية الحالية: <span className="font-mono font-bold" style={{ color: 'var(--brand-primary)' }}>{adjModal.quantity}</span> {adjModal.products.unit}</div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '0.5rem' }}>
                {[{ k: 'add', l: 'إضافة', icon: <Plus size={14} /> }, { k: 'remove', l: 'خصم', icon: <Minus size={14} /> }, { k: 'set', l: 'تحديد', icon: null }].map(t => (
                  <button key={t.k} onClick={() => setAdjType(t.k as any)}
                    style={{ padding: '0.5rem', borderRadius: 'var(--radius)', border: `1px solid ${adjType === t.k ? 'var(--brand-primary)' : 'var(--border)'}`, background: adjType === t.k ? 'var(--brand-primary-light)' : 'var(--bg-input)', color: adjType === t.k ? 'var(--brand-primary)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem', transition: 'all var(--transition)' }}>
                    {t.icon}{t.l}
                  </button>
                ))}
              </div>

              <div className="input-group">
                <label className="input-label">الكمية</label>
                <input className="input font-mono" type="number" min="0" step="0.001" placeholder="0" value={adjQty} onChange={e => setAdjQty(e.target.value)} autoFocus style={{ fontSize: '1.1rem', textAlign: 'center' }} />
              </div>

              <div className="input-group">
                <label className="input-label">سبب التعديل (اختياري)</label>
                <input className="input" placeholder="مثال: استلام بضاعة جديدة" value={adjNote} onChange={e => setAdjNote(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setAdjModal(null)} className="btn btn-secondary">إلغاء</button>
                <button onClick={adjust} className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : 'تأكيد التعديل'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
