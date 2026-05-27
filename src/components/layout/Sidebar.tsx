import { useState } from 'react'
import {
  Zap, ShoppingCart, LayoutDashboard, Package, Warehouse,
  Users, Truck, BarChart3, Clock, FileText, Bot,
  Settings, LogOut, ChevronRight, ShoppingBag, RotateCcw,
} from 'lucide-react'
import { useAuthStore } from '../../stores/authStore'
import toast from 'react-hot-toast'

interface NavItem {
  key: string
  label: string
  icon: React.ReactNode
  section?: string
  adminOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'pos',       label: 'نقطة البيع',     icon: <ShoppingCart size={18} />, section: 'الكاشير' },
  { key: 'invoices',  label: 'الفواتير',        icon: <FileText size={18} /> },
  { key: 'returns',   label: 'المرتجعات',       icon: <RotateCcw size={18} /> },
  { key: 'dashboard', label: 'لوحة التحكم',    icon: <LayoutDashboard size={18} />, section: 'الإدارة' },
  { key: 'products',  label: 'المنتجات',        icon: <Package size={18} /> },
  { key: 'inventory', label: 'المخزون',         icon: <Warehouse size={18} /> },
  { key: 'customers', label: 'العملاء',         icon: <Users size={18} /> },
  { key: 'suppliers', label: 'الموردين',        icon: <Truck size={18} /> },
  { key: 'purchases', label: 'المشتريات',       icon: <ShoppingBag size={18} /> },
  { key: 'reports',   label: 'التقارير',        icon: <BarChart3 size={18} />, section: 'التقارير والأدوات' },
  { key: 'shifts',    label: 'الورديات',        icon: <Clock size={18} /> },
  { key: 'vouchers',  label: 'السندات',         icon: <FileText size={18} /> },
  { key: 'ai',        label: 'المساعد الذكي',   icon: <Bot size={18} /> },
  { key: 'settings',  label: 'الإعدادات',       icon: <Settings size={18} />, adminOnly: true },
]

interface SidebarProps {
  activePage: string
  onNavigate: (page: string) => void
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, logout } = useAuthStore()

  const handleLogout = () => {
    logout()
    toast.success('تم تسجيل الخروج')
  }

  const visibleItems = NAV_ITEMS.filter(item =>
    !item.adminOnly || user?.role === 'admin' || user?.role === 'manager'
  )

  let lastSection = ''

  return (
    <aside style={{
      width: collapsed ? '64px' : '220px',
      minWidth: collapsed ? '64px' : '220px',
      background: 'var(--bg-surface)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      transition: 'width var(--transition-slow), min-width var(--transition-slow)',
      zIndex: 100,
      position: 'relative',
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? '1rem 0' : '1.1rem 1.1rem',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: '0.5rem',
        minHeight: '60px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', overflow: 'hidden' }}>
          <div style={{
            width: '32px', height: '32px', flexShrink: 0,
            background: 'linear-gradient(135deg, #00C896, #0EA5E9)',
            borderRadius: '8px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0,200,150,0.3)',
          }}>
            <Zap size={17} color="white" fill="white" />
          </div>
          {!collapsed && (
            <span style={{ fontWeight: 900, fontSize: '1.05rem', whiteSpace: 'nowrap', letterSpacing: '-0.3px' }}>
              Flash<span style={{ color: 'var(--brand-primary)' }}>POS</span>
            </span>
          )}
        </div>
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            className="btn btn-ghost btn-icon btn-sm"
            title="طي القائمة"
          >
            <ChevronRight size={15} />
          </button>
        )}
      </div>

      {/* Collapse expand button */}
      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          className="btn btn-ghost btn-icon btn-sm"
          style={{ margin: '0.5rem auto' }}
          title="توسيع القائمة"
        >
          <ChevronRight size={15} style={{ transform: 'rotate(180deg)' }} />
        </button>
      )}

      {/* Nav Items */}
      <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0.5rem 0' }}>
        {visibleItems.map((item) => {
          const showSection = item.section && item.section !== lastSection
          if (item.section) lastSection = item.section
          const isActive = activePage === item.key

          return (
            <div key={item.key}>
              {showSection && !collapsed && (
                <div style={{
                  padding: '0.75rem 1rem 0.3rem',
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  color: 'var(--text-muted)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  {item.section}
                </div>
              )}
              <button
                onClick={() => onNavigate(item.key)}
                title={collapsed ? item.label : undefined}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: collapsed ? '0.65rem' : '0.6rem 1rem',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  background: isActive ? 'var(--brand-primary-light)' : 'transparent',
                  border: 'none',
                  borderRight: isActive && !collapsed ? '3px solid var(--brand-primary)' : '3px solid transparent',
                  color: isActive ? 'var(--brand-primary)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  fontFamily: "'Cairo', sans-serif",
                  fontSize: '0.85rem',
                  fontWeight: isActive ? 700 : 500,
                  transition: 'all var(--transition)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = isActive ? 'var(--brand-primary)' : 'var(--text-secondary)' }}
              >
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {!collapsed && <span className="truncate">{item.label}</span>}
              </button>
            </div>
          )
        })}
      </nav>

      {/* User Info */}
      <div style={{
        borderTop: '1px solid var(--border)',
        padding: collapsed ? '0.75rem 0' : '0.85rem 1rem',
      }}>
        {!collapsed && (
          <div style={{ marginBottom: '0.6rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{
                width: '30px', height: '30px',
                background: 'linear-gradient(135deg, var(--brand-primary), var(--brand-secondary))',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 800, color: 'white', flexShrink: 0,
              }}>
                {user?.full_name?.charAt(0) || 'U'}
              </div>
              <div style={{ overflow: 'hidden' }}>
                <div className="truncate" style={{ fontSize: '0.82rem', fontWeight: 700 }}>{user?.full_name}</div>
                <div className="text-xs text-muted">{user?.role === 'admin' ? 'مدير' : user?.role === 'manager' ? 'مشرف' : 'كاشير'}</div>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="btn btn-ghost btn-sm btn-full"
          style={{
            justifyContent: collapsed ? 'center' : 'flex-start',
            color: 'var(--brand-danger)',
            gap: '0.5rem',
          }}
        >
          <LogOut size={15} />
          {!collapsed && 'تسجيل الخروج'}
        </button>
      </div>
    </aside>
  )
}
