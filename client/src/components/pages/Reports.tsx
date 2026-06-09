'use client';

const reports = [
  { icon: 'ti-report-money', color: 'var(--emerald)', bg: 'var(--emerald-dim)', title: 'P&L Report', sub: 'Profit & Loss Statement', desc: 'Revenue, expenses, and net profit breakdown by month and category.', hoverColor: 'var(--emerald)' },
  { icon: 'ti-cash', color: 'var(--indigo)', bg: 'var(--indigo-dim)', title: 'Cash Flow Statement', sub: 'Inflows & Outflows', desc: 'Monthly cash movement, runway analysis, and forecast projection.', hoverColor: 'var(--indigo)' },
  { icon: 'ti-users', color: 'var(--blue)', bg: 'var(--blue-dim)', title: 'Client Revenue Report', sub: 'Per-client analysis', desc: 'Revenue, LTV, and profitability breakdown per client.', hoverColor: 'var(--blue)' },
  { icon: 'ti-receipt', color: 'var(--amber)', bg: 'var(--amber-dim)', title: 'Expense Report', sub: 'Category-wise spending', desc: 'Detailed expense breakdown by category, vendor, and department.', hoverColor: 'var(--amber)' },
  { icon: 'ti-file-invoice', color: 'var(--red)', bg: 'var(--red-dim)', title: 'Outstanding Report', sub: 'Aging & dues', desc: 'Overdue invoices, aging buckets, and collection status.', hoverColor: 'var(--red)' },
  { icon: 'ti-users-group', color: 'var(--emerald)', bg: 'var(--emerald-dim)', title: 'Payroll Report', sub: 'Salary & incentives', desc: 'Monthly payroll disbursement, deductions, and team cost analysis.', hoverColor: 'var(--emerald)' },
];

export default function Reports() {
  return (
    <div>
      <div className="topbar">
        <div className="topbar-title">Financial Reports</div>
        <div className="topbar-right">
          <div className="fp">
            <select defaultValue="March 2025">
              <option>March 2025</option><option>Q4 FY2025</option><option>FY 2024-25</option>
            </select>
          </div>
        </div>
      </div>
      <div className="content">
        <div className="grid3">
          {reports.map(r => (
            <ReportCard key={r.title} {...r} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ReportCard({ icon, color, bg, title, sub, desc, hoverColor }: {
  icon: string; color: string; bg: string; title: string; sub: string; desc: string; hoverColor: string;
}) {
  return (
    <div
      className="card"
      style={{ cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseOver={e => (e.currentTarget.style.borderColor = hoverColor)}
      onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border)')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <i className={`ti ${icon}`} style={{ color, fontSize: '18px' }} />
        </div>
        <div>
          <div style={{ fontWeight: 700, color: 'var(--text)' }}>{title}</div>
          <div style={{ fontSize: '11px', color: 'var(--text2)' }}>{sub}</div>
        </div>
      </div>
      <div style={{ fontSize: '12px', color: 'var(--text3)', marginBottom: '14px' }}>{desc}</div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }}><i className="ti ti-download" style={{ fontSize: '12px' }} /> PDF</button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }}><i className="ti ti-table" style={{ fontSize: '12px' }} /> Excel</button>
      </div>
    </div>
  );
}
