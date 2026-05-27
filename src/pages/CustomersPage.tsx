import { useEffect, useState, useCallback } from 'react'
import { Users, Plus, Search, Edit2, Trash2, X, Star, Phone, CreditCard } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Customer } from '../types'
import toast from 'react-hot-toast'

const TYPE_LABELS = { retail: 'تجزئة', wholesale: 'جملة', vip: 'VIP' }
const TYPE_COLORS = { retail: 'badge-neutral', wholesale: 'badge-info', vip: 'badge-warning' }

const DEFAULT_FORM = {
  name: '', phone: '', email: '', address: '',
  customer_type: 'retail', credit_limit: '0', notes: '', is_active: true,
}

export default function CustomersPage() {
  const { storeId, user } = useAuthStore()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null)
  const [form, setForm] = useState({ ...DEFAULT_FORM })
  const [saving, setSaving] = useState(false)
  const isAdmin = user?.role === 'admin' || user?.role === 'manager'

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('customers').select('*').eq('store_id', storeId).order('name')
    setCustomers(data || [])
    setLoading(false)
  }, [storeId])

  useEffect(() => { load() }, [load])

  const filtered = customers.filter(c =>
    c.id !== 1 && (!search || c.name.includes(search) || c.phone?.includes(search) || c.email?.includes(search))
  )

  const openAdd = () => { setEditCustomer(null); setForm({ ...DEFAULT_FORM }); setShowModal(true) }
  const openEdit = (c: Customer) => {
    setEditCustomer(c)
    setForm({ name: c.name, phone: c.phone || '', email: c.email || '', address: c.address || '', customer_type: c.customer_type, credit_limit: c.credit_limit.toString(), notes: '', is_active: c.is_active })
    setShowModal(true)
  }

  const f = (k: string, v: any) => setForm(prev => ({ ...prev, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return toast.error('اسم العميل مطلوب')
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(), phone: form.phone.trim() || null,
        email: form.email.trim() || null, address: form.address.trim() || null,
        customer_type: form.customer_type, credit_limit: Number(form.credit_limit) || 0,
        is_active: form.is_active, store_id: storeId,
      }
      if (editCustomer) {
        const { error } = await supabase.from('customers').update(payload).eq('id', editCustomer.id)
        if (error) throw error
        toast.success('تم تحديث بيانات العميل')
      } else {
        const { error } = await supabase.from('customers').insert(payload)
        if (error) throw error
        toast.success('تم إضافة العميل')
      }
      setShowModal(false)
      load()
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const deleteCustomer = async (c: Customer) => {
    if (!confirm(`حذف "${c.name}"؟`)) return
    const { error } = await supabase.from('customers').delete().eq('id', c.id)
    if (error) return toast.error('لا يمكن حذف عميل مرتبط بفواتير')
    toast.success('تم الحذف'); load()
  }

  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><Users size={18} /></div>
          <div>
            <h1>العملاء</h1>
            <p className="text-xs text-muted">{filtered.length} عميل مسجل</p>
          </div>
        </div>
        {isAdmin && (
          <button onClick={openAdd} className="btn btn-primary btn-sm">
            <Plus size={15} /> إضافة عميل
          </button>
        )}
      </div>

      <div className="page-body">
        <div style={{ marginBottom: '1.25rem' }}>
          <div className="search-bar" style={{ maxWidth: '360px' }}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input placeholder="بحث بالاسم أو الهاتف..." value={search} onChange={e => setSearch(e.target.value)} />
            {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}><X size={14} /></button>}
          </div>
        </div>

        {loading ? (
          <div className="flex-center" style={{ height: '200px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Users size={28} /></div>
            <h3>{search ? 'لا نتائج' : 'لا يوجد عملاء بعد'}</h3>
            {!search && isAdmin && <button onClick={openAdd} className="btn btn-primary btn-sm" style={{ marginTop: '1rem' }}><Plus size={14} /> إضافة عميل</button>}
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>العميل</th>
                  <th>النوع</th>
                  <th>إجمالي المشتريات</th>
                  <th>نقاط الولاء</th>
                  <th>الرصيد الآجل</th>
                  <th>الحالة</th>
                  {isAdmin && <th style={{ width: '80px' }}>إجراءات</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.name}</div>
                      {c.phone && <div className="text-xs text-muted" style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Phone size={10} />{c.phone}</div>}
                    </td>
                    <td><span className={`badge ${TYPE_COLORS[c.customer_type]}`}>{TYPE_LABELS[c.customer_type]}</span></td>
                    <td className="font-mono">{fmt(c.total_purchases)} ج</td>
                    <td>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--brand-accent)' }}>
                        <Star size={12} fill="currentColor" />
                        <span className="font-mono">{c.loyalty_points}</span>
                      </span>
                    </td>
                    <td className={`font-mono ${c.current_balance > 0 ? 'text-danger' : 'text-muted'}`}>
                      {c.current_balance > 0 ? `${fmt(c.current_balance)} ج` : '—'}
                    </td>
                    <td><span className={`badge ${c.is_active ? 'badge-success' : 'badge-neutral'}`}>{c.is_active ? 'نشط' : 'غير نشط'}</span></td>
                    {isAdmin && (
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem' }}>
                          <button onClick={() => openEdit(c)} className="btn btn-ghost btn-icon btn-sm" title="تعديل"><Edit2 size={14} /></button>
                          <button onClick={() => deleteCustomer(c)} className="btn btn-ghost btn-icon btn-sm" title="حذف" style={{ color: 'var(--brand-danger)' }}><Trash2 size={14} /></button>
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

      {showModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editCustomer ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h3>
              <button onClick={() => setShowModal(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">اسم العميل <span className="req">*</span></label>
                <input className="input" placeholder="محمد أحمد" value={form.name} onChange={e => f('name', e.target.value)} autoFocus />
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">رقم الهاتف</label>
                  <input className="input" placeholder="01000000000" value={form.phone} onChange={e => f('phone', e.target.value)} />
                </div>
                <div className="input-group">
                  <label className="input-label">البريد الإلكتروني</label>
                  <input className="input" type="email" placeholder="example@mail.com" value={form.email} onChange={e => f('email', e.target.value)} />
                </div>
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">نوع العميل</label>
                  <select className="input" value={form.customer_type} onChange={e => f('customer_type', e.target.value)}>
                    <option value="retail">تجزئة</option>
                    <option value="wholesale">جملة</option>
                    <option value="vip">VIP</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">حد الائتمان الآجل (ج.م)</label>
                  <input className="input font-mono" type="number" min="0" placeholder="0" value={form.credit_limit} onChange={e => f('credit_limit', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">العنوان</label>
                <input className="input" placeholder="القاهرة، مصر" value={form.address} onChange={e => f('address', e.target.value)} />
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <label className="toggle">
                  <input type="checkbox" checked={form.is_active} onChange={e => f('is_active', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span className="text-sm">عميل نشط</span>
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setShowModal(false)} className="btn btn-secondary">إلغاء</button>
                <button onClick={save} className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> جاري الحفظ...</> : editCustomer ? 'حفظ' : 'إضافة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
