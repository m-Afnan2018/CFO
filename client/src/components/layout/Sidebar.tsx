'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/context/ThemeContext';
import styles from './Sidebar.module.css';

interface NavItem { href: string; icon: string; label: string }

const sections: { label: string; items: NavItem[] }[] = [
  { label: 'Overview',  items: [{ href: '/', icon: 'ti-layout-dashboard', label: 'Dashboard' }] },
  { label: 'Finance',   items: [
    { href: '/clients',  icon: 'ti-users',        label: 'Clients' },
    { href: '/invoices', icon: 'ti-file-invoice',  label: 'Invoices' },
    { href: '/payments', icon: 'ti-credit-card',   label: 'Payments' },
    { href: '/expenses', icon: 'ti-receipt',       label: 'Expenses' },
    { href: '/payroll',  icon: 'ti-users-group',   label: 'Payroll' },
  ]},
  { label: 'Analytics', items: [
    { href: '/cashflow',  icon: 'ti-trending-up', label: 'Cash Flow' },
    { href: '/profit',    icon: 'ti-chart-pie',   label: 'Profitability' },
    { href: '/gst',       icon: 'ti-file-text',   label: 'GST / Tax' },
    { href: '/tds',       icon: 'ti-receipt-tax', label: 'TDS' },
  ]},
  { label: 'Manage',    items: [
    { href: '/services', icon: 'ti-briefcase',    label: 'Services' },
    { href: '/alerts',   icon: 'ti-bell',         label: 'Alerts' },
    { href: '/reports',  icon: 'ti-report',       label: 'Reports' },
  ]},
];

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login';
}

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();

  return (
    <div className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-mark">
          <div className="logo-icon">G</div>
          <div>
            <div className="logo-text">Ganesyx</div>
            <div className="logo-sub">CFO Dashboard</div>
          </div>
        </div>
      </div>

      <div className={`nav-section ${styles.navSection}`}>
        {sections.map(section => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item${pathname === item.href ? ' active' : ''}`}
              >
                <i className={`ti ${item.icon}`} />
                {item.label}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.footer}>
        <button onClick={toggle} className={`nav-item ${styles.actionBtn} ${styles.actionBtnSpaced}`}>
          <i className={`ti ${theme === 'dark' ? 'ti-sun' : 'ti-moon'}`} />
          {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
        </button>
        <button onClick={handleLogout} className={`nav-item ${styles.actionBtn}`}>
          <i className="ti ti-logout" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
