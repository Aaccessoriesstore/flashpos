import { useEffect, useState } from 'react'
import {
  TrendingUp, ShoppingCart, Package, Users,
  AlertTriangle, DollarSign, BarChart3, Clock,
  ArrowUpRight, ArrowDownRight, RefreshCw,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../stores/authStore'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { ar } from 'date-fns/locale'

interface Stats {
  today_sales: number
  today_invoices: number
  today_profit: number
  profit_margin: number
  avg_invoice: number
  low_stock_count: number
  weekly_sales: { date: string; total: number; profit: number }[]
  payment_methods: { method: string; total: number; count: number }[]
  top_products: { name: string; quantity: number; total: number }[]
  recent_sales: any[]
}

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'نقدي', card: 'بطاقة', wallet: 'محفظة', credit: 'آجل'
}
const PAYMENT_COLORS = ['#00C896', '#0EA5E9', '#F59E0B', '#EF4444']

export default function DashboardPage() {
  const { storeId } = useAuthStore()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const loadStats = async () => {
    try {
      const todayStart = startOfDay(new Date()).toISOString()
      const todayEnd = endOfDay(new Date()).toISOString()

      // Today sales
      const { data: todaySales } = await supabase
        .from('sales')
        .select('total, subtotal, discount_amount, tax_amount, status, payment_method, created_at')
        .eq('store_id', storeId)
        .eq('status', 'completed')
        .gte('created_at', todayStart)
        .lte('created_at', todayEnd)

      const todayTotal = todaySales?.reduce((s, r) => s + r.total, 0) || 0
      const todayCount = todaySales?.length || 0
      const avgInvoice = todayCount > 0 ? todayTotal / todayCount : 0

      // Today profit (need cost from sale_items)
      const { data: todayItems } = await supabase
        .from('sale_items')
        .select('quantity, unit_price, cost_price, total, sale_id, sales!inner(store_id, status, created_at)')
        .eq('sales.store_id', storeId)
        .eq('sales.status', 'completed')
        .gte('sales.created_at', todayStart)
        .lte('sales.created_at', todayEnd)

      const todayRevenue = todayItems?.reduce((s, i) => s + i.total, 0) || 0
      const todayCost = todayItems?.reduce((s, i) => s + (i.cost_price * i.quantity), 0) || 0
      const todayProfit = todayRevenue - todayCost
      const profitMargin = todayRevenue > 0 ? (todayProfit / todayRevenue) * 100 : 0

      // Weekly sales (last 7 days)
      const weeklySales = []
      for (let i = 6; i >= 0; i--) {
        const day = subDays(new Date(), i)
        const { data: daySales } = await supabase
          .from('sales')
          .select('total')
          .eq('store_id', storeId)
          .eq('status', 'completed')
          .gte('created_at', startOfDay(day).toISOString())
          .lte('created_at', endOfDay(day).toISOString())
        const dayTotal = daySales?.reduce((s, r) => s + r.total, 0) || 0
        weeklySales.push({
          date: format(day, 'EEE', { locale: ar }),
          total: dayTotal,
          profit: dayTotal * 0.25, // approximate if no cost data
        })
      }

      // Payment methods breakdown (today)
      const paymentMap: Record<string, { total: number; count: number }> = {}
      todaySales?.forEach(s => {
        if (!paymentMap[s.payment_method]) paymentMap[s.payment_method] = { total: 0, count: 0 }
        paymentMap[s.payment_method].total += s.total
        paymentMap[s.payment_method].count += 1
      })
      const paymentMethods = Object.entries(paymentMap).map(([method, data]) => ({ method, ...data }))

      // Low stock count
      const { count: lowStockCount } = await supabase
        .from('inventory')
        .select('*, products!inner(min_stock, store_id, is_active, track_inventory)', { count: 'exact', head: true })
        .eq('products.store_id', storeId)
        .eq('products.is_active', true)
        .eq('products.track_inventory', true)
        .filter('quantity', 'lte', 'products.min_stock')

      // Top products (this month)
      const { data: topItems } = await supabase
        .from('sale_items')
        .select('quantity, total, products(name), sales!inner(store_id, status, created_at)')
        .eq('sales.store_id', storeId)
        .eq('sales.status', 'completed')
        .gte('sales.created_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString())
        .order('total', { ascending: false })
        .limit(50)

      const productMap: Record<string, { quantity: number; total: number }> = {}
      topItems?.forEach((item: any) => {
        const name = item.products?.name || 'غير معروف'
        if (!productMap[name]) productMap[name] = { quantity: 0, total: 0 }
        productMap[name].quantity += item.quantity
        productMap[name].total += item.total
      })
      const topProducts = Object.entries(productMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)

      // Recent sales
      const { data: recentSales } = await supabase
        .from('sales')
        .select('id, invoice_number, total, payment_method, status, created_at, customers(name)')
        .eq('store_id', storeId)
        .order('created_at', { ascending: false })
        .limit(8)

      setStats({
        today_sales: todayTotal,
        today_invoices: todayCount,
        today_profit: todayProfit,
        profit_margin: profitMargin,
        avg_invoice: avgInvoice,
        low_stock_count: lowStockCount || 0,
        weekly_sales: weeklySales,
        payment_methods: paymentMethods,
        top_products: topProducts,
        recent_sales: recentSales || [],
      })
    } catch (err) {
      console.error('Dashboard error:', err)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => { loadStats() }, [])

  const refresh = () => { setRefreshing(true); loadStats() }

  const fmt = (n: number) => n.toLocaleString('ar-EG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })

  if (loading) return (
    <div className="flex-center" style={{ height: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div className="spinner" style={{ width: '32px', height: '32px' }} />
      <p className="text-muted text-sm">جاري تحميل البيانات...</p>
    </div>
  )

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div className="page-title">
          <div className="icon-wrap"><BarChart3 size={18} /></div>
          <div>
            <h1>لوحة التحكم</h1>
            <p className="text-xs text-muted">{format(new Date(), 'EEEE، d MMMM yyyy', { locale: ar })}</p>
          </div>
        </div>
        <button onClick={refresh} className="btn btn-ghost btn-sm" disabled={refreshing}>
          <RefreshCw size={15} className={refreshing ? 'animate-pulse' : ''} />
          تحديث
        </button>
      </div>

      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        {/* Stats Grid */}
        <div className="stats-grid">
          {[
            {
              label: 'مبيعات اليوم', value: `${fmt(stats?.today_sales || 0)} ج`,
              sub: `${stats?.today_invoices || 0} فاتورة`,
              icon: <DollarSign size={40} />, color: '#00C896',
            },
            {
              label: 'صافي الربح اليوم', value: `${fmt(stats?.today_profit || 0)} ج`,
              sub: `هامش ${(stats?.profit_margin || 0).toFixed(1)}%`,
              icon: <TrendingUp size={40} />, color: '#0EA5E9',
            },
            {
              label: 'متوسط الفاتورة', value: `${fmt(stats?.avg_invoice || 0)} ج`,
              sub: 'متوسط قيمة الطلب',
              icon: <ShoppingCart size={40} />, color: '#F59E0B',
            },
            {
              label: 'منتجات تحت الحد', value: `${stats?.low_stock_count || 0}`,
              sub: 'تحتاج تجديد المخزون',
              icon: <AlertTriangle size={40} />, color: stats?.low_stock_count ? '#EF4444' : '#22C55E',
            },
          ].map((s, i) => (
            <div key={i} className="stat-card" style={{ '--accent-color': s.color } as any}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.value}</div>
              <div className="stat-sub">{s.sub}</div>
              <div className="stat-icon">{s.icon}</div>
            </div>
          ))}
        </div>

        {/* Charts Row */}
        <div className="grid-2" style={{ gap: '1rem' }}>
          {/* Weekly Sales Chart */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem' }}>مبيعات آخر 7 أيام</h3>
              <span className="badge badge-primary">هذا الأسبوع</span>
            </div>
            {(stats?.weekly_sales?.some(d => d.total > 0)) ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={stats?.weekly_sales} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00C896" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00C896" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" tick={{ fill: '#7B93B8', fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#7B93B8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{ background: '#111D35', border: '1px solid #1A2E50', borderRadius: '8px', fontSize: '12px' }}
                    labelStyle={{ color: '#EDF2FF' }}
                    formatter={(v: any) => [`${Number(v).toLocaleString()} ج`, 'المبيعات']}
                  />
                  <Area type="monotone" dataKey="total" stroke="#00C896" strokeWidth={2} fill="url(#salesGrad)" dot={{ fill: '#00C896', r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><BarChart3 size={24} /></div>
                <p className="text-sm">لا توجد مبيعات هذا الأسبوع بعد</p>
              </div>
            )}
          </div>

          {/* Payment Methods */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex-between" style={{ marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '0.95rem' }}>طرق الدفع اليوم</h3>
              <span className="badge badge-info">اليوم</span>
            </div>
            {(stats?.payment_methods?.length || 0) > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <ResponsiveContainer width={130} height={130}>
                  <PieChart>
                    <Pie data={stats?.payment_methods} dataKey="total" cx="50%" cy="50%" innerRadius={35} outerRadius={55} strokeWidth={0}>
                      {stats?.payment_methods?.map((_, i) => (
                        <Cell key={i} fill={PAYMENT_COLORS[i % PAYMENT_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {stats?.payment_methods?.map((pm, i) => (
                    <div key={pm.method} className="flex-between">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PAYMENT_COLORS[i % PAYMENT_COLORS.length] }} />
                        <span className="text-sm">{PAYMENT_LABELS[pm.method] || pm.method}</span>
                      </div>
                      <span className="text-sm font-mono text-secondary">{fmt(pm.total)} ج</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <div className="empty-state-icon"><DollarSign size={24} /></div>
                <p className="text-sm">لا توجد مدفوعات اليوم بعد</p>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Row */}
        <div className="grid-2" style={{ gap: '1rem' }}>
          {/* Top Products */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem' }}>أعلى المنتجات مبيعاً</h3>
              <span className="badge badge-neutral">هذا الشهر</span>
            </div>
            {(stats?.top_products?.length || 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {stats?.top_products?.map((p, i) => {
                  const maxTotal = stats.top_products[0]?.total || 1
                  const pct = (p.total / maxTotal) * 100
                  return (
                    <div key={i}>
                      <div className="flex-between" style={{ marginBottom: '0.25rem' }}>
                        <span className="text-sm truncate" style={{ maxWidth: '200px' }}>{p.name}</span>
                        <span className="text-sm font-mono text-brand">{fmt(p.total)} ج</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--bg-elevated)', borderRadius: '2px' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: `hsl(${160 - i * 20}, 70%, 50%)`, borderRadius: '2px', transition: 'width 1s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <div className="empty-state-icon"><Package size={22} /></div>
                <p className="text-sm">لا توجد مبيعات هذا الشهر بعد</p>
              </div>
            )}
          </div>

          {/* Recent Sales */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <div className="flex-between" style={{ marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '0.95rem' }}>آخر الفواتير</h3>
              <span className="badge badge-success">مباشر</span>
            </div>
            {(stats?.recent_sales?.length || 0) > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
                {stats?.recent_sales?.slice(0, 6).map((sale: any) => (
                  <div key={sale.id} className="flex-between" style={{ padding: '0.55rem 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div className="text-sm font-mono" style={{ color: 'var(--brand-primary)' }}>{sale.invoice_number}</div>
                      <div className="text-xs text-muted">{sale.customers?.name || 'عميل نقدي'}</div>
                    </div>
                    <div style={{ textAlign: 'left' }}>
                      <div className="text-sm font-bold font-mono">{fmt(sale.total)} ج</div>
                      <span className="badge badge-neutral text-xs">{PAYMENT_LABELS[sale.payment_method]}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '1.5rem' }}>
                <div className="empty-state-icon"><ShoppingCart size={22} /></div>
                <h3>لا توجد فواتير بعد</h3>
                <p className="text-xs">ابدأ بإنشاء أول فاتورة من نقطة البيع</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
