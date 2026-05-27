import { useEffect, useState } from 'react'
import { Settings, Store, Users, Plus, Edit2, Trash2, X, Eye, EyeOff, Key } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const { storeId, user } = useAuthStore()
  const [tab, setTab] = useState<'store' | 'users'>('store')
  const [store, setStore] = useState<any>(null)
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showUserModal, setShowUserModal] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [showPass, setShowPass] = useState(false)
  const [userForm, setUserForm] = useState({ username: '', full_name: '', password: '', role: 'cashier', phone: '', pin_code: '', is_active: true })

  useEffect(() => {
    const load = async () => {
      const [{ data: s }, { data: u }] = await Promise.all([
        supabase.from('stores').select('*').eq('id', storeId).single(),
        supabase.from('app_users').select('id, username, full_name, role, phone, pin_code, is_active, last_login, created_at').eq('store_id', storeId).order('created_at'),
      ])
      setStore(s || {})
      setUsers(u || [])
      setLoading(false)
    }
    load()
  }, [storeId])

  const saveStore = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('stores').update({
        name: store.name, address: store.address, phone: store.phone,
        email: store.email, tax_number: store.tax_number,
        tax_rate: Number(store.tax_rate) || 14,
        receipt_header: store.receipt_header, receipt_footer: store.receipt_footer,
        updated_at: new Date().toISOString(),
      }).eq('id', storeId)
      if (error) throw error
      toast.success('تم حفظ بيانات المتجر')
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const openAddUser = () => {
    setEditUser(null)
    setUserForm({ username: '', full_name: '', password: '', role: 'cashier', phone: '', pin_code: '', is_active: true })
    setShowUserModal(true)
  }

  const openEditUser = (u: any) => {
    setEditUser(u)
    setUserForm({ username: u.username, full_name: u.full_name, password: '', role: u.role, phone: u.phone || '', pin_code: u.pin_code || '', is_active: u.is_active })
    setShowUserModal(true)
  }

  const saveUser = async () => {
    if (!userForm.username.trim() || !userForm.full_name.trim()) return toast.error('اسم المستخدم والاسم الكامل مطلوبان')
    if (!editUser && !userForm.password) return toast.error('كلمة المرور مطلوبة للمستخدم الجديد')
    if (userForm.password && userForm.password.length < 6) return toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل')
    setSaving(true)
    try {
      const payload: any = {
        username: userForm.username.trim(), full_name: userForm.full_name.trim(),
        role: userForm.role, phone: userForm.phone.trim() || null,
        pin_code: userForm.pin_code.trim() || null,
        is_active: userForm.is_active, store_id: storeId,
      }
      if (userForm.password) {
        const encoder = new TextEncoder()
        const buf = await crypto.subtle.digest('SHA-256', encoder.encode(userForm.password))
        payload.password_hash = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
      }
      if (editUser) {
        // Prevent deleting the only admin
        if (editUser.role === 'admin' && userForm.role !== 'admin') {
          const adminCount = users.filter(u => u.role === 'admin' && u.id !== editUser.id).length
          if (adminCount === 0) return toast.error('يجب أن يكون هناك مدير واحد على الأقل')
        }
        const { error } = await supabase.from('app_users').update(payload).eq('id', editUser.id)
        if (error) throw error
        toast.success('تم تحديث بيانات المستخدم')
      } else {
        const { error } = await supabase.from('app_users').insert(payload)
        if (error) throw error
        toast.success('تم إضافة المستخدم')
      }
      setShowUserModal(false)
      const { data } = await supabase.from('app_users').select('id, username, full_name, role, phone, pin_code, is_active, last_login, created_at').eq('store_id', storeId).order('created_at')
      setUsers(data || [])
    } catch (err: any) { toast.error(err.message?.includes('duplicate') ? 'اسم المستخدم أو PIN مستخدم مسبقاً' : err.message) } finally { setSaving(false) }
  }

  const deleteUser = async (u: any) => {
    if (u.id === user?.id) return toast.error('لا يمكنك حذف حسابك الخاص')
    if (u.role === 'admin' && users.filter(x => x.role === 'admin').length <= 1) return toast.error('يجب أن يكون هناك مدير واحد على الأقل')
    if (!confirm(`حذف "${u.full_name}"؟`)) return
    await supabase.from('app_users').delete().eq('id', u.id)
    setUsers(prev => prev.filter(x => x.id !== u.id))
    toast.success('تم حذف المستخدم')
  }

  const ROLE_LABELS: Record<string, string> = { admin: 'مدير', manager: 'مشرف', cashier: 'كاشير' }
  const ROLE_COLORS: Record<string, string> = { admin: 'badge-danger', manager: 'badge-warning', cashier: 'badge-neutral' }
  const uf = (k: string, v: any) => setUserForm(prev => ({ ...prev, [k]: v }))

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><Settings size={18} /></div>
          <h1>الإعدادات</h1>
        </div>
      </div>

      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', padding: '0 1.75rem', background: 'var(--bg-surface)' }}>
        {[{ k: 'store', l: 'بيانات المتجر', icon: <Store size={15} /> }, { k: 'users', l: 'المستخدمين', icon: <Users size={15} /> }].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.75rem 1.1rem', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Cairo', sans-serif", fontSize: '0.88rem', fontWeight: tab === t.k ? 700 : 500, color: tab === t.k ? 'var(--brand-primary)' : 'var(--text-secondary)', borderBottom: tab === t.k ? '2px solid var(--brand-primary)' : '2px solid transparent', transition: 'all var(--transition)' }}>
            {t.icon}{t.l}
          </button>
        ))}
      </div>

      <div className="page-body">
        {loading ? <div className="flex-center" style={{ height: '200px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div> : (

          tab === 'store' ? (
            <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">اسم المتجر <span className="req">*</span></label>
                  <input className="input" value={store?.name || ''} onChange={e => setStore((p: any) => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">رقم الهاتف</label>
                  <input className="input" value={store?.phone || ''} onChange={e => setStore((p: any) => ({ ...p, phone: e.target.value }))} />
                </div>
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">البريد الإلكتروني</label>
                  <input className="input" type="email" value={store?.email || ''} onChange={e => setStore((p: any) => ({ ...p, email: e.target.value }))} />
                </div>
                <div className="input-group">
                  <label className="input-label">الرقم الضريبي</label>
                  <input className="input" value={store?.tax_number || ''} onChange={e => setStore((p: any) => ({ ...p, tax_number: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">العنوان</label>
                <input className="input" value={store?.address || ''} onChange={e => setStore((p: any) => ({ ...p, address: e.target.value }))} />
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">نسبة ضريبة القيمة المضافة (%)</label>
                  <input className="input font-mono" type="number" min="0" max="100" value={store?.tax_rate || 14} onChange={e => setStore((p: any) => ({ ...p, tax_rate: e.target.value }))} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">رأس الفاتورة</label>
                <input className="input" placeholder="أهلاً بكم في متجرنا" value={store?.receipt_header || ''} onChange={e => setStore((p: any) => ({ ...p, receipt_header: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">ذيل الفاتورة</label>
                <input className="input" placeholder="شكراً لتسوقكم معنا" value={store?.receipt_footer || ''} onChange={e => setStore((p: any) => ({ ...p, receipt_footer: e.target.value }))} />
              </div>
              <div>
                <button onClick={saveStore} className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> جاري الحفظ...</> : 'حفظ الإعدادات'}
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.25rem' }}>
                <button onClick={openAddUser} className="btn btn-primary btn-sm"><Plus size={15} /> إضافة مستخدم</button>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>المستخدم</th><th>الدور</th><th>رقم PIN</th><th>آخر دخول</th><th>الحالة</th><th style={{ width: '80px' }}>إجراءات</th></tr></thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{u.full_name}</div>
                          <div className="text-xs text-muted">@{u.username}</div>
                        </td>
                        <td><span className={`badge ${ROLE_COLORS[u.role]}`}>{ROLE_LABELS[u.role]}</span></td>
                        <td className="font-mono text-secondary">{u.pin_code || '—'}</td>
                        <td className="text-sm text-muted">{u.last_login ? new Date(u.last_login).toLocaleDateString('ar-EG') : 'لم يسجل بعد'}</td>
                        <td><span className={`badge ${u.is_active ? 'badge-success' : 'badge-neutral'}`}>{u.is_active ? 'نشط' : 'غير نشط'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.35rem' }}>
                            <button onClick={() => openEditUser(u)} className="btn btn-ghost btn-icon btn-sm"><Edit2 size={14} /></button>
                            <button onClick={() => deleteUser(u)} className="btn btn-ghost btn-icon btn-sm" style={{ color: u.id === user?.id ? 'var(--text-muted)' : 'var(--brand-danger)' }}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )
        )}
      </div>

      {showUserModal && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowUserModal(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3>{editUser ? 'تعديل المستخدم' : 'إضافة مستخدم جديد'}</h3>
              <button onClick={() => setShowUserModal(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">اسم المستخدم <span className="req">*</span></label>
                  <input className="input" placeholder="ahmed_cashier" value={userForm.username} onChange={e => uf('username', e.target.value)} autoFocus />
                </div>
                <div className="input-group">
                  <label className="input-label">الاسم الكامل <span className="req">*</span></label>
                  <input className="input" placeholder="أحمد محمد" value={userForm.full_name} onChange={e => uf('full_name', e.target.value)} />
                </div>
              </div>
              <div className="input-group">
                <label className="input-label">{editUser ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور *'}</label>
                <div style={{ position: 'relative' }}>
                  <input className="input" type={showPass ? 'text' : 'password'} placeholder="6 أحرف على الأقل" style={{ paddingLeft: '2.5rem' }} value={userForm.password} onChange={e => uf('password', e.target.value)} />
                  <button type="button" onClick={() => setShowPass(v => !v)} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>{showPass ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                </div>
              </div>
              <div className="grid-2">
                <div className="input-group">
                  <label className="input-label">الدور الوظيفي</label>
                  <select className="input" value={userForm.role} onChange={e => uf('role', e.target.value)}>
                    <option value="cashier">كاشير</option>
                    <option value="manager">مشرف</option>
                    <option value="admin">مدير</option>
                  </select>
                </div>
                <div className="input-group">
                  <label className="input-label">رمز PIN (4 أرقام)</label>
                  <div style={{ position: 'relative' }}>
                    <input className="input font-mono" placeholder="1234" maxLength={4} style={{ paddingLeft: '2.5rem' }} value={userForm.pin_code} onChange={e => uf('pin_code', e.target.value.replace(/\D/g, '').slice(0, 4))} />
                    <Key size={13} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  </div>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', cursor: 'pointer' }}>
                <label className="toggle">
                  <input type="checkbox" checked={userForm.is_active} onChange={e => uf('is_active', e.target.checked)} />
                  <span className="toggle-slider" />
                </label>
                <span className="text-sm">مستخدم نشط</span>
              </label>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                <button onClick={() => setShowUserModal(false)} className="btn btn-secondary">إلغاء</button>
                <button onClick={saveUser} className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> جاري الحفظ...</> : editUser ? 'حفظ' : 'إضافة'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
