'use client';
import type { Page } from '@/types';

interface SidebarProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
}

interface NavItem {
  page: Page;
  icon: string;
  label: string;
  badge?: number;
}

const sections: { label: string; items: NavItem[] }[] = [
  {
    label: 'Overview',
    items: [{ page: 'overview', icon: 'ti-layout-dashboard', label: 'Dashboard' }],
  },
  {
    label: 'Finance',
    items: [
      { page: 'clients', icon: 'ti-users', label: 'Clients' },
      { page: 'invoices', icon: 'ti-file-invoice', label: 'Invoices', badge: 3 },
      { page: 'payments', icon: 'ti-credit-card', label: 'Payments' },
      { page: 'expenses', icon: 'ti-receipt', label: 'Expenses' },
      { page: 'payroll', icon: 'ti-users-group', label: 'Payroll' },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { page: 'cashflow', icon: 'ti-trending-up', label: 'Cash Flow' },
      { page: 'profit', icon: 'ti-chart-pie', label: 'Profitability' },
      { page: 'gst', icon: 'ti-file-text', label: 'GST / Tax' },
    ],
  },
  {
    label: 'System',
    items: [
      { page: 'alerts', icon: 'ti-bell', label: 'Alerts', badge: 5 },
      { page: 'reports', icon: 'ti-report', label: 'Reports' },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
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
      <div className="nav-section">
        {sections.map(section => (
          <div key={section.label}>
            <div className="nav-label">{section.label}</div>
            {section.items.map(item => (
              <div
                key={item.page}
                className={`nav-item${activePage === item.page ? ' active' : ''}`}
                onClick={() => onNavigate(item.page)}
              >
                <i className={`ti ${item.icon}`} />
                {item.label}
                {item.badge && <span className="nav-badge">{item.badge}</span>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
