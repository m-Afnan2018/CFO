'use client';
import { useState } from 'react';
import type { Page } from '@/types';
import Sidebar from '@/components/layout/Sidebar';
import Overview from '@/components/pages/Overview';
import Clients from '@/components/pages/Clients';
import Invoices from '@/components/pages/Invoices';
import Payments from '@/components/pages/Payments';
import Expenses from '@/components/pages/Expenses';
import Payroll from '@/components/pages/Payroll';
import CashFlow from '@/components/pages/CashFlow';
import Profitability from '@/components/pages/Profitability';
import GST from '@/components/pages/GST';
import Alerts from '@/components/pages/Alerts';
import Reports from '@/components/pages/Reports';

export default function Dashboard() {
  const [activePage, setActivePage] = useState<Page>('overview');

  const renderPage = () => {
    switch (activePage) {
      case 'overview': return <Overview onNavigate={setActivePage} />;
      case 'clients': return <Clients />;
      case 'invoices': return <Invoices />;
      case 'payments': return <Payments />;
      case 'expenses': return <Expenses />;
      case 'payroll': return <Payroll />;
      case 'cashflow': return <CashFlow />;
      case 'profit': return <Profitability />;
      case 'gst': return <GST />;
      case 'alerts': return <Alerts onNavigate={setActivePage} />;
      case 'reports': return <Reports />;
      default: return <Overview onNavigate={setActivePage} />;
    }
  };

  return (
    <div id="app">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />
      <div className="main">{renderPage()}</div>
    </div>
  );
}
