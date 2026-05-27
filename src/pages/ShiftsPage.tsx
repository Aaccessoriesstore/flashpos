import { useEffect, useState, useCallback } from 'react'
import { Clock, Plus, X, CheckCircle, TrendingUp, DollarSign, ShoppingCart } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import type { Shift } from '../types'
import { format } from 'date-fns'
import { ar } from 'date-fns/locale'
import toast from 'react-hot-toast'

export default function ShiftsPage() {
  const { storeId, user } = useAuthStore()
  const [shifts, setShifts] = useState<any[]>([])
  const [activeShift, setActiveShift] = useState<Shift | null>(null)
  const [loading, setLoading] = useState(true)
  const [openModal, setOpenModal] = useState(false)
  const [closeModal, setCloseModal] = useState(false)
  const [openingCash, setOpeningCash] = useState('')
  const [closingCash, setClosingCash] = useState('')
  const [closeNotes, setCloseNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: allShifts }, { data: active }] = await Promise.all([
      supabase.from('shifts').select('*, app_users(full_name)').eq('store_id', storeId).order('opened_at', { ascending: false }).limit(20),
      supabase.from('shifts').select('*').eq('store_id', storeId).eq('status', 'open').eq('user_id', user!.id).order('opened_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    setShifts(allShifts || [])
    setActiveShift(active || null)
    setLoading(false)
  }, [storeId, user])

  useEffect(() => { load() }, [load])

  const openShift = async () => {
    setSaving(true)
    try {
      const { error } = await supabase.from('shifts').insert({
        user_id: user!.id, store_id: storeId,
        opening_cash: Number(openingCash) || 0, status: 'open',
      })
      if (error) throw error
      toast.success('تم فتح الوردية')
      setOpenModal(false); setOpeningCash(''); load()
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const closeShift = async () => {
    if (!activeShift) return
    setSaving(true)
    try {
      const closing = Number(closingCash) || 0
      const expected = activeShift.opening_cash + activeShift.total_sales
      const diff = closing - expected
      const { error } = await supabase.from('shifts').update({
        status: 'closed', closing_cash: closing,
        expected_cash: expected, cash_difference: diff,
        closed_at: new Date().toISOString(), notes: closeNotes || null,
      }).eq('id', activeShift.id)
      if (error) throw error
      toast.success('تم إغلاق الوردية بنجاح')
      setCloseModal(false); setClosingCash(''); setCloseNotes(''); load()
    } catch (err: any) { toast.error(err.message) } finally { setSaving(false) }
  }

  const fmt = (n: number) => n?.toLocaleString('ar-EG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'
  const fmtDate = (d: string) => format(new Date(d), 'dd MMM yyyy - hh:mm a', { locale: ar })

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><Clock size={18} /></div>
          <div><h1>الورديات</h1><p className="text-xs text-muted">إدارة ورديات الكاشير</p></div>
        </div>
        <div className="page-actions">
          {activeShift ? (
            <button onClick={() => setCloseModal(true)} className="btn btn-danger btn-sm">
              <X size={15} /> إغلاق الوردية
            </button>
          ) : (
            <button onClick={() => setOpenModal(true)} className="btn btn-primary btn-sm">
              <Plus size={15} /> فتح وردية
            </button>
          )}
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Active Shift Card */}
        {activeShift && (
          <div className="card animate-slide-up" style={{ border: '1px solid rgba(0,200,150,0.3)', background: 'rgba(0,200,150,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--brand-primary)', animation: 'pulse 2s infinite' }} />
              <h3 style={{ color: 'var(--brand-primary)' }}>وردية مفتوحة الآن</h3>
              <span className="badge badge-primary">{fmtDate(activeShift.opened_at)}</span>
            </div>
            <div className="grid-3" style={{ gap: '0.75rem' }}>
              {[
                { label: 'إجمالي المبيعات', value: `${fmt(activeShift.total_sales)} ج`, icon: <TrendingUp size={20} />, color: '#00C896' },
                { label: 'عدد الفواتير', value: activeShift.total_transactions, icon: <ShoppingCart size={20} />, color: '#0EA5E9' },
                { label: 'رصيد الافتتاح', value: `${fmt(activeShift.opening_cash)} ج`, icon: <DollarSign size={20} />, color: '#F59E0B' },
              ].map((s, i) => (
                <div key={i} style={{ background: 'var(--bg-card)', borderRadius: 'var(--radius)', padding: '0.85rem', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem', color: s.color }}>{s.icon}<span className="text-sm text-secondary">{s.label}</span></div>
                  <div className="font-mono" style={{ fontSize: '1.25rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shifts History */}
        <div>
          <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>سجل الورديات</h3>
          {loading ? (
            <div className="flex-center" style={{ height: '150px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div>
          ) : shifts.filter(s => s.status === 'closed').length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Clock size={28} /></div>
              <h3>لا توجد ورديات مغلقة بعد</h3>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>الكاشير</th>
                    <th>تاريخ الفتح</th>
                    <th>تاريخ الإغلاق</th>
                    <th>رصيد الافتتاح</th>
                    <th>إجمالي المبيعات</th>
                    <th>الفواتير</th>
                    <th>الفرق</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.app_users?.full_name || '—'}</td>
                      <td className="text-sm text-secondary">{fmtDate(s.opened_at)}</td>
                      <td className="text-sm text-secondary">{s.closed_at ? fmtDate(s.closed_at) : '—'}</td>
                      <td className="font-mono">{fmt(s.opening_cash)} ج</td>
                      <td className="font-mono" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{fmt(s.total_sales)} ج</td>
                      <td className="font-mono">{s.total_transactions}</td>
                      <td className={`font-mono ${s.cash_difference > 0 ? 'text-success' : s.cash_difference < 0 ? 'text-danger' : 'text-muted'}`}>
                        {s.cash_difference != null ? `${s.cash_difference >= 0 ? '+' : ''}${fmt(s.cash_difference)} ج` : '—'}
                      </td>
                      <td><span className={`badge ${s.status === 'open' ? 'badge-primary' : 'badge-neutral'}`}>{s.status === 'open' ? 'مفتوحة' : 'مغلقة'}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Open Shift Modal */}
      {openModal && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: '360px' }}>
            <div className="modal-header">
              <h3>فتح وردية جديدة</h3>
              <button onClick={() => setOpenModal(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div className="input-group">
                <label className="input-label">رصيد الخزينة الافتتاحي (ج.م)</label>
                <input className="input font-mono" type="number" min="0" step="0.01" placeholder="0.00" value={openingCash} onChange={e => setOpeningCash(e.target.value)} autoFocus />
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setOpenModal(false)} className="btn btn-secondary">إلغاء</button>
                <button onClick={openShift} className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="spinner" /> : 'فتح الوردية'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Shift Modal */}
      {closeModal && activeShift && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>إغلاق الوردية</h3>
              <button onClick={() => setCloseModal(false)} className="btn btn-ghost btn-icon btn-sm"><X size={16} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Summary */}
              <div style={{ background: 'var(--bg-input)', borderRadius: 'var(--radius)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {[
                  { label: 'رصيد الافتتاح', value: `${fmt(activeShift.opening_cash)} ج` },
                  { label: 'إجمالي المبيعات', value: `${fmt(activeShift.total_sales)} ج`, color: 'var(--brand-primary)' },
                  { label: 'الرصيد المتوقع', value: `${fmt(activeShift.opening_cash + activeShift.total_sales)} ج`, color: 'var(--brand-secondary)' },
                ].map((row, i) => (
                  <div key={i} className="flex-between">
                    <span className="text-sm text-secondary">{row.label}</span>
                    <span className="font-mono text-sm" style={{ color: row.color || 'var(--text-primary)' }}>{row.value}</span>
                  </div>
                ))}
              </div>

              <div className="input-group">
                <label className="input-label">الرصيد الفعلي في الخزينة (ج.م)</label>
                <input className="input font-mono" type="number" min="0" step="0.01" placeholder="0.00" value={closingCash} onChange={e => setClosingCash(e.target.value)} autoFocus />
              </div>

              {closingCash && (
                <div style={{ padding: '0.65rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid', background: Number(closingCash) >= (activeShift.opening_cash + activeShift.total_sales) ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)', borderColor: Number(closingCash) >= (activeShift.opening_cash + activeShift.total_sales) ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)' }}>
                  <div className="flex-between">
                    <span className="text-sm">الفرق</span>
                    <span className="font-mono font-bold" style={{ color: Number(closingCash) - (activeShift.opening_cash + activeShift.total_sales) >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                      {(Number(closingCash) - (activeShift.opening_cash + activeShift.total_sales)) >= 0 ? '+' : ''}
                      {fmt(Number(closingCash) - (activeShift.opening_cash + activeShift.total_sales))} ج
                    </span>
                  </div>
                </div>
              )}

              <div className="input-group">
                <label className="input-label">ملاحظات (اختياري)</label>
                <input className="input" placeholder="أي ملاحظات على الوردية..." value={closeNotes} onChange={e => setCloseNotes(e.target.value)} />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button onClick={() => setCloseModal(false)} className="btn btn-secondary">إلغاء</button>
                <button onClick={closeShift} className="btn btn-danger" disabled={saving}>
                  {saving ? <span className="spinner" /> : <><CheckCircle size={15} /> إغلاق الوردية</>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
