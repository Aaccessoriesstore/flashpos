// @ts-nocheck
import { useEffect, useState, useCallback } from 'react'
import { Package, Plus, Search, Edit2, Trash2, Barcode, AlertTriangle, X, ChevronDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Product, Category } from '../types'
import toast from 'react-hot-toast'

const UNITS = ['قطعة', 'كيلو', 'جرام', 'لتر', 'مل', 'متر', 'سم', 'علبة', 'كرتون', 'دزينة', 'زجاجة', 'كيس']

const DEFAULT_FORM = {
  name: '', name_ar: '', barcode: '', sku: '',
  category_id: '', cost_price: '', selling_price: '',
  wholesale_price: '', discount_percent: '0',
  unit: 'قطعة', min_stock: '5', initial_stock: '0',
  tax_exempt: false, track_inventory: true, allow_negative_stock: false,
  is_active: true,
}

export default function ProductsPage() {
  const { storeId, user } = useAuthStore()
  const [products, setProducts] = useState<(Product & { inventory: { quantity: number }[] })[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [filterStock, setFilterStock] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('products')
      .select('*, categories(*), inventory(quantity)')
      .eq('store_id', storeId)
      .order('name')
    setProducts((data || []).map(p => ({ ...p, current_stock: p.inventory?.[0]?.quantity || 0 })))
    const { data: cats } = await supabase.from('categories').select('*').eq('store_id', storeId).eq('is_active', true).order('sort_order')
    setCategories(cats || [])
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const filtered = products.filter(p => {
    const matchSearch = !search || p.name.includes(search) || p.name_ar?.includes(search) || p.barcode?.includes(search) || p.sku?.includes(search)
    const matchCat = !filterCat || p.category_id === Number(filterCat)
    const stock = p.inventory?.[0]?.quantity || 0
    const matchStock = filterStock === 'all' || (filterStock === 'low' && stock <= p.min_stock && p.track_inventory) || (filterStock === 'out' && stock <= 0 && p.track_inventory)
    return matchSearch && matchCat && matchStock
  })

  const openAdd = () => { setEditProduct(null); setForm({ ...DEFAULT_FORM }); setShowModal(true) }
  const openEdit = (p: Product) => {
    setEditProduct(p)
    setForm({
      name: p.name, name_ar: p.name_ar || '', barcode: p.barcode || '', sku: p.sku || '',
      category_id: p.category_id?.toString() || '',
      cost_price: p.cost_price.toString(), selling_price: p.selling_price.toString(),
      wholesale_price: p.wholesale_price?.toString() || '',
      discount_percent: p.discount_percent.toString(),
      unit: p.unit, min_stock: p.min_stock.toString(), initial_stock: '0',
      tax_exempt: p.tax_exempt, track_inventory: p.track_inventory,
      allow_negative_stock: p.allow_negative_stock, is_active: p.is_active,
    })
    setShowModal(true)
  }

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return toast.error('اسم المنتج مطلوب')
    if (!form.selling_price || Number(form.selling_price) <= 0) return toast.error('سعر البيع مطلوب')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(), name_ar: form.name_ar.trim() || null,
        barcode: form.barcode.trim() || null, sku: form.sku.trim() || null,
        category_id: form.category_id ? Number(form.category_id) : null,
        cost_price: Number(form.cost_price) || 0,
        selling_price: Number(form.selling_price),
        wholesale_price: form.wholesale_price ? Number(form.wholesale_price) : null,
        discount_percent: Number(form.discount_percent) || 0,
        unit: form.unit, min_stock: Number(form.min_stock) || 5,
        tax_exempt: form.tax_exempt, track_inventory: form.track_inventory,
        allow_negative_stock: form.allow_negative_stock, is_active: form.is_active,
        store_id: storeId,
      }

      if (editProduct) {
        const { error } = await supabase.from('products').update(payload).eq('id', editProduct.id)
        if (error) throw error
        toast.success('تم تحديث المنتج')
      } else {
        const { data: newProduct, error } = await supabase.from('products').insert(payload).select().single()
        if (error) throw error
        // Create inventory record
        await supabase.from('inventory').insert({ product_id: newProduct.id, quantity: Number(form.initial_stock) || 0, store_id: storeId })
        toast.success('تم إضافة المنتج')
      }
      setShowModal(false)
      load()
    } catch (err: any) {
      toast.error(err.message?.includes('duplicate') ? 'الباركود أو SKU مستخدم مسبقاً' : err.message || 'حدث خطأ')
    } finally { setSaving(false) }
  }

  const deleteProduct = async (p: Product) => {
    if (!confirm(`هل تريد حذف "${p.name}"؟`)) return
    const { error } = await supabase.from('products').delete().eq('id', p.id)
    if (error) return toast.error('لا يمكن حذف منتج مرتبط بفواتير')
    toast.success('تم الحذف')
    load()
  }

  const getStockBadge = (p: Product) => {
    const stock = p.inventory?.[0]?.quantity || 0
    if (!p.track_inventory) return <span className="badge badge-neutral">غير محدد</span>
    if (stock <= 0) return <span className="badge badge-danger">نفد</span>
    if (stock <= p.min_stock) return <span className="badge badge-warning"><AlertTriangle size={10} />{stock}</span>
    return <span className="badge badge-success">{stock}</span>
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><Package size={18} /></div>
          <div>
            <h1>المنتجات</h1>
            <p className="text-xs text-muted">{products.length} منتج مسجل</p>
          </div>
        </div>
        {isAdmin && (
          <div className="page-actions">
            <button onClick={openAdd} className="btn btn-primary btn-sm">
              <Plus size={15} /> إضافة منتج
            </button>
          </div>
        )}
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '200px' }}>
            <Search size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input placeholder="بحث بالاسم، باركود، SKU..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
          </div>

          <select className="input" style={{ width: 'auto' }} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
            <option value="">كل الفئات</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select className="input" style={{ width: 'auto' }} value={filterStock} onChange={e => setFilterStock(e.target.value)}>
            <option value="all">كل المخزون</option>
            <option value="low">تحت الحد الأدنى</option>
            <option value="out">نفد المخزون</option>
          </select>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex-center" style={{ height: '200px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Package size={28} /></div>
            <h3>{search || filterCat || filterStock !== 'all' ? 'لا نتائج للبحث' : 'لا توجد منتجات بعد'}</h3>
            <p>{!search && !filterCat && isAdmin ? 'اضغط "إضافة منتج" لإضافة أول منتج' : 'جرب تغيير معايير البحث'}</p>
            {!search && !filterCat && isAdmin && (
              <button onClick={openAdd} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}>
                <Plus size={14} /> إضافة أول منتج
              </button>
            )}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>المنتج</th>
                  <th>الفئة</th>
                  <th>سعر البيع</th>
                  <th>سعر الشراء</th>
                  <th>المخزون</th>
                  <th>الوحدة</th>
                  <th>الحالة</th>
                  {isAdmin && <th style={{ width: '80px' }}>إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.name}</div>
                      {p.name_ar && p.name_ar !== p.name && <div className="text-xs text-muted">{p.name_ar}</div>}
                      {p.barcode && <div className="text-xs text-muted flex" style={{ gap: '0.25rem', marginTop: '0.1rem' }}><Barcode size={10} />{p.barcode}</div>}
                    </td>
                    <td>
                      {p.category ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.category.color, flexShrink: 0 }} />
                          <span className="text-sm">{p.category.name}</span>
                        </span>
                      ) : <span className="text-muted text-sm">—</span>}
                    </td>
                    <td className="font-mono" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>
                      {p.selling_price.toLocaleString()} ج
                    </td>
                    <td className="font-mono text-secondary">{p.cost_price > 0 ? `${p.cost_price.toLocaleString()} ج` : '—'}</td>
                    <td>{getStockBadge(p)}</td>
                    <td className="text-sm text-secondary">{p.unit}</td>
                    <td>
                      <span className={`badge ${p.is_active ? 'badge-success' : 'badge-neutral'}`}>
                        {p.is_active ? 'نشط' : 'غير نشط'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button onClick={() => openEdit(p)} className="btn btn-ghost btn-icon btn-sm" title="تعديل"><Edit2 size={14} /></button>
                          <button onClick={() => deleteProduct(p)} className="btn btn-ghost btn-icon btn-sm" title="حذف" style={{ color: 'var(--brand-danger)' }}><Trash2 size={14} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal modal-lg">
            <div className="modal-header">
              <h3>{editProduct ? 'تعديل منتج' : 'إضافة منتج جديد'}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">اسم المنتج <span className="req">*</span></label>
                  <input className="input" placeholder="مثال: مياه معدنية" value={form.name} onChange={e => f('name', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">الاسم بالعربي</label>
                  <input className="input" placeholder="مياه معدنية" value={form.name_ar} onChange={e => f('name_ar', e.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">الباركود</label>
                  <input className="input" placeholder="6001234567890" value={form.barcode} onChange={e => f('barcode', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">كود المنتج (SKU)</label>
                  <input className="input" placeholder="PRD-001" value={form.sku} onChange={e => f('sku', e.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">الفئة</label>
                  <select className="input" value={form.category_id} onChange={e => f('category_id', e.target.value)}>
                    <option value="">بدون فئة</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">وحدة القياس</label>
                  <select className="input" value={form.unit} onChange={e => f('unit', e.target.value)}>
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>

              <div className="divider" />

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">سعر البيع (ج.م) <span className="req">*</span></label>
                  <input className="input font-mono" type="number" min="0" step="0.01" placeholder="0.00" value={form.selling_price} onChange={e => f('selling_price', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">سعر الشراء (ج.م)</label>
                  <input className="input font-mono" type="number" min="0" step="0.01" placeholder="0.00" value={form.cost_price} onChange={e => f('cost_price', e.target.value)} />
                </div>
              </div>

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">سعر الجملة (ج.م)</label>
                  <input className="input font-mono" type="number" min="0" step="0.01" placeholder="اختياري" value={form.wholesale_price} onChange={e => f('wholesale_price', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">نسبة الخصم (%)</label>
                  <input className="input font-mono" type="number" min="0" max="100" placeholder="0" value={form.discount_percent} onChange={e => f('discount_percent', e.target.value)} />
                </div>
              </div>

              <div className="divider" />

              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">الحد الأدنى للمخزون</label>
                  <input className="input font-mono" type="number" min="0" placeholder="5" value={form.min_stock} onChange={e => f('min_stock', e.target.value)} />
                </div>
                {!editProduct && (
                  <div className="input-group">
                    <label className="input-label">الكمية الأولية</label>
                    <input className="input font-mono" type="number" min="0" placeholder="0" value={form.initial_stock} onChange={e => f('initial_stock', e.target.value)} />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', padding: '0.75rem 0' }}>
                {[
                  { key: 'track_inventory', label: 'تتبع المخزون' },
                  { key: 'tax_exempt', label: 'معفى من الضريبة' },
                  { key: 'allow_negative_stock', label: 'السماح بالبيع بدون مخزون' },
                  { key: 'is_active', label: 'منتج نشط' },
                ].map(opt => (
                  <label key={opt.key} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                    <label className="toggle">
                      <input type="checkbox" checked={form[opt.key as keyof typeof form] as boolean} onChange={e => f(opt.key, e.target.checked)} />
                      <span className="toggle-slider" />
                    </label>
                    <span className="text-sm">{opt.label}</span>
                  </label>
                ))}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary">إلغاء</button>
                <button onClick={save} className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> جاري الحفظ...</> : editProduct ? 'حفظ التعديلات' : 'إضافة المنتج'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
