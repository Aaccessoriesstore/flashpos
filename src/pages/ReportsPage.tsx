import { useEffect, useState } from 'react'
import { BarChart3, Download, Calendar, TrendingUp, ShoppingCart, Package } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { format, subDays, startOfDay, endOfDay, startOfMonth, endOfMonth } from 'date-fns'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import toast from 'react-hot-toast'

type Range = 'today' | 'week' | 'month' | 'custom'

export default function ReportsPage() {
  const { storeId } = useAuthStore()
  const [range, setRange] = useState<Range>('week')
  const [from, setFrom] = useState(format(subDays(new Date(), 7), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState({ total: 0, profit: 0, invoices: 0, avg: 0 })
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  const getRange = () => {
    const now = new Date()
    if (range === 'today') return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() }
    if (range === 'week') return { from: startOfDay(subDays(now, 6)).toISOString(), to: endOfDay(now).toISOString() }
    if (range === 'month') return { from: startOfMonth(now).toISOString(), to: endOfMonth(now).toISOString() }
    return { from: startOfDay(new Date(from)).toISOString(), to: endOfDay(new Date(to)).toISOString() }
  }

  const loadReport = async () => {
    setLoading(true)
    const { from: f, to: t } = getRange()
    try {
      const { data: sales } = await supabase.from('sales')
        .select('id, total, created_at, status, sale_items(quantity, unit_price, cost_price, total, products(name))')
        .eq('store_id', storeId).eq('status', 'completed')
        .gte('created_at', f).lte('created_at', t)
        .order('created_at')

      if (!sales) return

      // Group by day
      const dayMap: Record<string, { total: number; profit: number; count: number }> = {}
      let totRevenue = 0, totCost = 0, totCount = 0
      const productMap: Record<string, { qty: number; total: number }> = {}

      sales.forEach((s: any) => {
        const day = format(new Date(s.created_at), 'MM/dd')
        if (!dayMap[day]) dayMap[day] = { total: 0, profit: 0, count: 0 }
        dayMap[day].total += s.total
        dayMap[day].count += 1
        totRevenue += s.total
        totCount += 1

        s.sale_items?.forEach((item: any) => {
          const cost = (item.cost_price || 0) * item.quantity
          totCost += cost
          const name = item.products?.name || 'غير معروف'
          if (!productMap[name]) productMap[name] = { qty: 0, total: 0 }
          productMap[name].qty += item.quantity
          productMap[name].total += item.total
        })
      })

      sales.forEach((s: any) => {
        const day = format(new Date(s.created_at), 'MM/dd')
        const itemsCost = s.sale_items?.reduce((sum: number, i: any) => sum + (i.cost_price || 0) * i.quantity, 0) || 0
        dayMap[day].profit += s.total - itemsCost
      })

      setData(Object.entries(dayMap).map(([date, d]) => ({ date, ...d })))
      setSummary({ total: totRevenue, profit: totRevenue - totCost, invoices: totCount, avg: totCount > 0 ? totRevenue / totCount : 0 })
      setTopProducts(Object.entries(productMap).map(([name, d]) => ({ name, ...d })).sort((a, b) => b.total - a.total).slice(0, 10))
    } finally { setLoading(false) }
  }

  useEffect(() => { loadReport() }, [range, from, to])

  const exportCSV = () => {
    const rows = [
      ['التاريخ', 'المبيعات', 'الربح', 'عدد الفواتير'],
      ...data.map(d => [d.date, d.total.toFixed(2), d.profit.toFixed(2), d.count]),
    ]
    const csv = rows.map(r => r.join(',')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `flashpos-report-${format(new Date(), 'yyyy-MM-dd')}.csv`; a.click()
    toast.success('تم تصدير التقرير')
  }

  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><BarChart3 size={18} /></div>
          <div><h1>التقارير</h1><p className="text-xs text-muted">تحليل المبيعات والأرباح</p></div>
        </div>
        <div className="page-actions">
          <button onClick={exportCSV} className="btn btn-secondary btn-sm"><Download size={14} /> تصدير CSV</button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Range selector */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {[{ k: 'today', l: 'اليوم' }, { k: 'week', l: 'آخر 7 أيام' }, { k: 'month', l: 'هذا الشهر' }, { k: 'custom', l: 'مخصص' }].map(r => (
            <button key={r.k} onClick={() => setRange(r.k as Range)}
              className={`btn btn-sm ${range === r.k ? 'btn-primary' : 'btn-secondary'}`}>{r.l}</button>
          ))}
          {range === 'custom' && (
            <>
              <input type="date" className="input" style={{ width: 'auto' }} value={from} onChange={e => setFrom(e.target.value)} />
              <span className="text-muted text-sm">إلى</span>
              <input type="date" className="input" style={{ width: 'auto' }} value={to} onChange={e => setTo(e.target.value)} />
            </>
          )}
        </div>

        {/* Summary */}
        <div className="stats-grid">
          {[
            { label: 'إجمالي المبيعات', value: `${fmt(summary.total)} ج`, color: '#00C896' },
            { label: 'صافي الربح', value: `${fmt(summary.profit)} ج`, color: '#0EA5E9' },
            { label: 'عدد الفواتير', value: summary.invoices, color: '#F59E0B' },
            { label: 'متوسط الفاتورة', value: `${fmt(summary.avg)} ج`, color: '#8B5CF6' },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ '--accent-color': s.color } as any}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Chart */}
        <div className="card">
          <h3 style={{ marginBottom: '1.25rem', fontSize: '0.95rem' }}>المبيعات والأرباح</h3>
          {loading ? (
            <div className="flex-center" style={{ height: '220px' }}><div className="spinner" style={{ width: '28px', height: '28px' }} /></div>
          ) : data.length === 0 ? (
            <div className="empty-state" style={{ padding: '3rem' }}>
              <div className="empty-state-icon"><BarChart3 size={28} /></div>
              <h3>لا توجد بيانات في هذه الفترة</h3>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="date" tick={{ fill: '#7B93B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#7B93B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: '#111D35', border: '1px solid #1A2E50', borderRadius: '8px', fontSize: '12px' }} formatter={(v: any, name) => [`${Number(v).toLocaleString()} ج`, name === 'total' ? 'المبيعات' : 'الربح']} />
                <Legend formatter={v => v === 'total' ? 'المبيعات' : 'الربح'} />
                <Bar dataKey="total" fill="#00C896" radius={[4, 4, 0, 0]} opacity={0.85} />
                <Bar dataKey="profit" fill="#0EA5E9" radius={[4, 4, 0, 0]} opacity={0.85} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Products */}
        {topProducts.length > 0 && (
          <div className="card">
            <h3 style={{ marginBottom: '1rem', fontSize: '0.95rem' }}>أعلى المنتجات مبيعاً</h3>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>#</th><th>المنتج</th><th>الكمية المباعة</th><th>إجمالي المبيعات</th></tr></thead>
                <tbody>
                  {topProducts.map((p, i) => (
                    <tr key={i}>
                      <td className="font-mono text-muted">{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td className="font-mono">{p.qty}</td>
                      <td className="font-mono" style={{ color: 'var(--brand-primary)', fontWeight: 700 }}>{fmt(p.total)} ج</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
