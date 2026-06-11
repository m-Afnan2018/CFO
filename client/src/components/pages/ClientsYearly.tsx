'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';

interface MonthData {
  period: string;
  billed: number; received: number;
  paid: number; partial: number; pending: number;
  count: number; paidCount: number; partialCount: number; pendingCount: number;
}

interface YearData extends Omit<MonthData, 'period'> {
  year: string;
  months: MonthData[];
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function fmt(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
  if (n >= 100000)   return `₹${(n / 100000).toFixed(2)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function pct(num: number, den: number) {
  if (!den) return '—';
  return `${Math.round((num / den) * 100)}%`;
}

function RateBar({ value, total }: { value: number; total: number }) {
  const p = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  const color = p >= 90 ? 'var(--emerald)' : p >= 60 ? 'var(--amber)' : 'var(--red)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, height: '5px', borderRadius: '3px', background: 'var(--border)', overflow: 'hidden' }}>
        <div style={{ width: `${p}%`, height: '100%', background: color, borderRadius: '3px', transition: 'width 0.3s' }} />
      </div>
      <span style={{ fontSize: '11px', fontWeight: 700, minWidth: '32px', color }}>{p}%</span>
    </div>
  );
}

export default function ClientsYearly() {
  const [years, setYears]           = useState<YearData[]>([]);
  const [loaded, setLoaded]         = useState(false);
  const [activeYear, setActiveYear] = useState<string>('');

  useEffect(() => {
    api.getClientYearlySummary()
      .then(d => {
        const data = d as YearData[];
        setYears(data);
        if (data.length) setActiveYear(data[0].year);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  const yearData = years.find(y => y.year === activeYear);

  const allMonths: (MonthData | null)[] = Array.from({ length: 12 }, (_, i) => {
    const period = `${activeYear}-${String(i + 1).padStart(2, '0')}`;
    return yearData?.months.find(m => m.period === period) ?? null;
  });

  if (!loaded) {
    return <div style={{ padding: '32px 0', fontSize: '13px', color: 'var(--text3)' }}>Loading…</div>;
  }

  if (!years.length) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center', fontSize: '13px', color: 'var(--text3)' }}>
        No billing records yet. Run billing for a period to see yearly data here.
      </div>
    );
  }

  const yearIdx = years.findIndex(y => y.year === activeYear);

  return (
    <div>
      {/* Year selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
        <button className="btn" style={{ padding: '5px 10px' }} disabled={yearIdx >= years.length - 1}
          onClick={() => setActiveYear(years[yearIdx + 1].year)}>
          <i className="ti ti-chevron-left" style={{ fontSize: '13px' }} />
        </button>
        <span style={{ fontWeight: 700, fontSize: '16px', minWidth: '52px', textAlign: 'center', color: 'var(--text)' }}>
          {activeYear}
        </span>
        <button className="btn" style={{ padding: '5px 10px' }} disabled={yearIdx <= 0}
          onClick={() => setActiveYear(years[yearIdx - 1].year)}>
          <i className="ti ti-chevron-right" style={{ fontSize: '13px' }} />
        </button>
        {years.length > 1 && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '5px' }}>
            {years.map(y => (
              <button key={y.year} className={`btn${y.year === activeYear ? ' btn-p' : ''}`}
                style={{ padding: '4px 12px', fontSize: '12px' }} onClick={() => setActiveYear(y.year)}>
                {y.year}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Year KPIs */}
      {yearData && (
        <div className="grid4" style={{ marginBottom: '20px' }}>
          <div className="kpi">
            <div className="kpi-label">Total Billed</div>
            <div className="kpi-value">{fmt(yearData.billed)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>
              {yearData.months.length} month{yearData.months.length !== 1 ? 's' : ''} active
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Total Received</div>
            <div className="kpi-value" style={{ color: 'var(--emerald)' }}>{fmt(yearData.received)}</div>
            <div className="kpi-change up">{pct(yearData.received, yearData.billed)} collection rate</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Pending</div>
            <div className="kpi-value" style={{ color: yearData.pending > 0 ? 'var(--red)' : 'var(--text2)' }}>
              {yearData.pending > 0 ? fmt(yearData.pending) : '—'}
            </div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{yearData.pendingCount} records unpaid</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Partial Payments</div>
            <div className="kpi-value" style={{ color: yearData.partialCount > 0 ? 'var(--amber)' : 'var(--text2)' }}>
              {yearData.partialCount > 0 ? fmt(yearData.partial) : '—'}
            </div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>{yearData.partialCount} records partial</div>
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-title">
          Monthly Breakdown — {activeYear}
          {yearData && <span className="card-sub">{yearData.count} billing records</span>}
        </div>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th style={{ textAlign: 'right' }}>Clients</th>
              <th style={{ textAlign: 'right' }}>Billed</th>
              <th style={{ textAlign: 'right', color: 'var(--emerald)' }}>Received</th>
              <th style={{ textAlign: 'right', color: 'var(--red)' }}>Pending</th>
              <th style={{ textAlign: 'right', color: 'var(--amber)' }}>Partial</th>
              <th style={{ minWidth: '130px' }}>Collection Rate</th>
            </tr>
          </thead>
          <tbody>
            {allMonths.map((m, i) => {
              if (!m) {
                return (
                  <tr key={i} style={{ opacity: 0.3 }}>
                    <td style={{ color: 'var(--text2)', fontWeight: 600 }}>{MONTH_NAMES[i]}</td>
                    <td colSpan={5} style={{ textAlign: 'right', color: 'var(--text3)', fontSize: '11px' }}>no data</td>
                    <td />
                  </tr>
                );
              }
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 700, color: 'var(--text)' }}>{MONTH_NAMES[i]}</td>
                  <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{m.count}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(m.billed)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 700, color: m.received >= m.billed ? 'var(--emerald)' : 'var(--amber)' }}>
                    {fmt(m.received)}
                  </td>
                  <td style={{ textAlign: 'right', color: m.pending > 0 ? 'var(--red)' : 'var(--text3)' }}>
                    {m.pending > 0 ? fmt(m.pending) : '—'}
                  </td>
                  <td style={{ textAlign: 'right', color: m.partialCount > 0 ? 'var(--amber)' : 'var(--text3)' }}>
                    {m.partialCount > 0 ? fmt(m.partial) : '—'}
                  </td>
                  <td><RateBar value={m.received} total={m.billed} /></td>
                </tr>
              );
            })}
          </tbody>
          {yearData && (
            <tfoot>
              <tr style={{ borderTop: '2px solid var(--border)' }}>
                <td style={{ fontWeight: 800, color: 'var(--text)' }}>Total</td>
                <td style={{ textAlign: 'right', color: 'var(--text2)', fontWeight: 600 }}>{yearData.count}</td>
                <td style={{ textAlign: 'right', fontWeight: 700 }}>{fmt(yearData.billed)}</td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: yearData.received >= yearData.billed ? 'var(--emerald)' : 'var(--amber)' }}>
                  {fmt(yearData.received)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: yearData.pending > 0 ? 'var(--red)' : 'var(--text3)' }}>
                  {yearData.pending > 0 ? fmt(yearData.pending) : '—'}
                </td>
                <td style={{ textAlign: 'right', fontWeight: 700, color: yearData.partialCount > 0 ? 'var(--amber)' : 'var(--text3)' }}>
                  {yearData.partialCount > 0 ? fmt(yearData.partial) : '—'}
                </td>
                <td><RateBar value={yearData.received} total={yearData.billed} /></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* Year-over-year comparison */}
      {years.length > 1 && (
        <div className="card">
          <div className="card-title">Year-over-Year Comparison</div>
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th style={{ textAlign: 'right' }}>Months</th>
                <th style={{ textAlign: 'right' }}>Total Billed</th>
                <th style={{ textAlign: 'right', color: 'var(--emerald)' }}>Received</th>
                <th style={{ textAlign: 'right', color: 'var(--red)' }}>Pending</th>
                <th style={{ textAlign: 'right' }}>Records</th>
                <th style={{ minWidth: '130px' }}>Collection Rate</th>
              </tr>
            </thead>
            <tbody>
              {years.map((y, i) => {
                const prev = years[i + 1];
                const delta = prev ? y.billed - prev.billed : null;
                return (
                  <tr key={y.year} style={{ background: y.year === activeYear ? 'var(--surface2)' : undefined }}>
                    <td>
                      <button type="button" onClick={() => setActiveYear(y.year)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700, fontSize: '13px', color: y.year === activeYear ? 'var(--indigo)' : 'var(--text)' }}>
                        {y.year}
                        {y.year === activeYear && <span style={{ fontSize: '10px', color: 'var(--indigo)', marginLeft: '5px' }}>●</span>}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{y.months.length}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {fmt(y.billed)}
                      {delta !== null && (
                        <span style={{ fontSize: '10px', marginLeft: '5px', color: delta >= 0 ? 'var(--emerald)' : 'var(--red)' }}>
                          {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, color: y.received >= y.billed ? 'var(--emerald)' : 'var(--amber)' }}>
                      {fmt(y.received)}
                    </td>
                    <td style={{ textAlign: 'right', color: y.pending > 0 ? 'var(--red)' : 'var(--text3)' }}>
                      {y.pending > 0 ? fmt(y.pending) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', color: 'var(--text2)' }}>{y.count}</td>
                    <td><RateBar value={y.received} total={y.billed} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
