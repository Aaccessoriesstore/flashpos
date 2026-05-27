import { Toaster } from 'react-hot-toast'
import { useAuthStore } from './stores/authStore'
import LoginPage from './pages/LoginPage'
import Sidebar from './components/layout/Sidebar'
import DashboardPage from './pages/DashboardPage'
import POSPage from './pages/POSPage'
import ProductsPage from './pages/ProductsPage'
import CustomersPage from './pages/CustomersPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import ShiftsPage from './pages/ShiftsPage'
import InvoicesPage from './pages/InvoicesPage'
import InventoryPage from './pages/InventoryPage'
import { useState } from 'react'

const PlaceholderPage = ({ title, icon }: { title: string; icon: string }) => (
  <div className="animate-fade-in">
    <div className="page-header">
      <div className="page-title">
        <div className="icon-wrap" style={{ fontSize: '1.1rem' }}>{icon}</div>
        <h1>{title}</h1>
      </div>
    </div>
    <div className="page-body">
      <div className="empty-state" style={{ paddingTop: '5rem' }}>
        <div className="empty-state-icon" style={{ fontSize: '2rem', width: '72px', height: '72px' }}>{icon}</div>
        <h3>قيد التطوير</h3>
        <p>هذه الصفحة ستكون متاحة قريباً</p>
      </div>
    </div>
  </div>
)

const PAGES: Record<string, React.ReactNode> = {
  pos: <POSPage />,
  dashboard: <DashboardPage />,
  products: <ProductsPage />,
  inventory: <InventoryPage />,
  customers: <CustomersPage />,
  invoices: <InvoicesPage />,
  shifts: <ShiftsPage />,
  reports: <ReportsPage />,
  settings: <SettingsPage />,
  suppliers: <PlaceholderPage title="الموردين" icon="🚚" />,
  purchases: <PlaceholderPage title="المشتريات" icon="🛍️" />,
  returns: <PlaceholderPage title="المرتجعات" icon="↩️" />,
  vouchers: <PlaceholderPage title="السندات" icon="📄" />,
  ai: <PlaceholderPage title="المساعد الذكي" icon="🤖" />,
}

export default function App() {
  const { isAuthenticated } = useAuthStore()
  const [activePage, setActivePage] = useState('pos')

  const toastStyle = {
    style: {
      background: 'var(--bg-elevated)', color: 'var(--text-primary)',
      border: '1px solid var(--border)', fontFamily: "'Cairo', sans-serif",
      direction: 'rtl' as const, fontSize: '0.88rem', boxShadow: 'var(--shadow-lg)',
    },
    duration: 3000,
    success: { iconTheme: { primary: '#00C896', secondary: 'white' } },
    error: { iconTheme: { primary: '#EF4444', secondary: 'white' } },
  }

  if (!isAuthenticated) return (
    <>
      <LoginPage />
      <Toaster position="top-center" toastOptions={toastStyle} />
    </>
  )

  return (
    <>
      <div className="app-layout">
        <div className="main-content" key={activePage}>
          {PAGES[activePage] || <DashboardPage />}
        </div>
        <Sidebar activePage={activePage} onNavigate={setActivePage} />
      </div>
      <Toaster position="top-center" toastOptions={toastStyle} />
    </>
  )
}
