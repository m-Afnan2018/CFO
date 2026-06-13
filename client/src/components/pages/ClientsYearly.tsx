'use client';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import styles from './ClientsYearly.module.css';

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
    <div className={styles.rateBarRow}>
      <div className={styles.rateBarTrack}>
        <div className={styles.rateBarFill} style={{ width: `${p}%`, '--bar-color': color } as React.CSSProperties} />
      </div>
      <span className={styles.rateBarPct} style={{ '--bar-color': color } as React.CSSProperties}>{p}%</span>
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
    return <div className={styles.loading}>Loading…</div>;
  }

  if (!years.length) {
    return (
      <div className={styles.noData}>
        No billing records yet. Run billing for a period to see yearly data here.
      </div>
    );
  }

  const yearIdx = years.findIndex(y => y.year === activeYear);

  return (
    <div>
      {/* Year selector */}
      <div className={styles.yearNav}>
        <button className={`btn ${styles.yearNavBtn}`} disabled={yearIdx >= years.length - 1}
          onClick={() => setActiveYear(years[yearIdx + 1].year)}>
          <i className={`ti ti-chevron-left ${styles.yearNavIcon}`} />
        </button>
        <span className={styles.yearLabel}>
          {activeYear}
        </span>
        <button className={`btn ${styles.yearNavBtn}`} disabled={yearIdx <= 0}
          onClick={() => setActiveYear(years[yearIdx - 1].year)}>
          <i className={`ti ti-chevron-right ${styles.yearNavIcon}`} />
        </button>
        {years.length > 1 && (
          <div className={styles.yearJumpList}>
            {years.map(y => (
              <button key={y.year} className={`btn${y.year === activeYear ? ' btn-p' : ''} ${styles.yearJumpBtn}`}
                onClick={() => setActiveYear(y.year)}>
                {y.year}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Year KPIs */}
      {yearData && (
        <div className={`grid4 ${styles.kpiGrid}`}>
          <div className="kpi">
            <div className="kpi-label">Total Billed</div>
            <div className="kpi-value">{fmt(yearData.billed)}</div>
            <div className={`kpi-change ${styles.kpiText2}`}>
              {yearData.months.length} month{yearData.months.length !== 1 ? 's' : ''} active
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Total Received</div>
            <div className={`kpi-value ${styles.kpiEmerald}`}>{fmt(yearData.received)}</div>
            <div className="kpi-change up">{pct(yearData.received, yearData.billed)} collection rate</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Pending</div>
            <div className="kpi-value" style={{ color: yearData.pending > 0 ? 'var(--red)' : 'var(--text2)' }}>
              {yearData.pending > 0 ? fmt(yearData.pending) : '—'}
            </div>
            <div className={`kpi-change ${styles.kpiText2}`}>{yearData.pendingCount} records unpaid</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">Partial Payments</div>
            <div className="kpi-value" style={{ color: yearData.partialCount > 0 ? 'var(--amber)' : 'var(--text2)' }}>
              {yearData.partialCount > 0 ? fmt(yearData.partial) : '—'}
            </div>
            <div className={`kpi-change ${styles.kpiText2}`}>{yearData.partialCount} records partial</div>
          </div>
        </div>
      )}

      {/* Monthly breakdown */}
      <div className={`card ${styles.monthlyCard}`}>
        <div className="card-title">
          Monthly Breakdown — {activeYear}
          {yearData && <span className="card-sub">{yearData.count} billing records</span>}
        </div>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th className={styles.thRight}>Clients</th>
              <th className={styles.thRight}>Billed</th>
              <th className={styles.thRightEmerald}>Received</th>
              <th className={styles.thRightRed}>Pending</th>
              <th className={styles.thRightAmber}>Partial</th>
              <th className={styles.thRateBar}>Collection Rate</th>
            </tr>
          </thead>
          <tbody>
            {allMonths.map((m, i) => {
              if (!m) {
                return (
                  <tr key={i} className={styles.emptyMonthRow}>
                    <td className={styles.emptyMonthName}>{MONTH_NAMES[i]}</td>
                    <td colSpan={5} className={styles.emptyMonthData}>no data</td>
                    <td />
                  </tr>
                );
              }
              return (
                <tr key={i}>
                  <td className={styles.monthName}>{MONTH_NAMES[i]}</td>
                  <td className={styles.tdRightText2}>{m.count}</td>
                  <td className={styles.tdRightBold}>{fmt(m.billed)}</td>
                  <td className={styles.tdRight} style={{ fontWeight: 700, color: m.received >= m.billed ? 'var(--emerald)' : 'var(--amber)' }}>
                    {fmt(m.received)}
                  </td>
                  <td className={styles.tdRight} style={{ color: m.pending > 0 ? 'var(--red)' : 'var(--text3)' }}>
                    {m.pending > 0 ? fmt(m.pending) : '—'}
                  </td>
                  <td className={styles.tdRight} style={{ color: m.partialCount > 0 ? 'var(--amber)' : 'var(--text3)' }}>
                    {m.partialCount > 0 ? fmt(m.partial) : '—'}
                  </td>
                  <td><RateBar value={m.received} total={m.billed} /></td>
                </tr>
              );
            })}
          </tbody>
          {yearData && (
            <tfoot>
              <tr className={styles.totalFooterRow}>
                <td className={styles.totalLabel}>Total</td>
                <td className={styles.totalCount}>{yearData.count}</td>
                <td className={styles.totalBilled}>{fmt(yearData.billed)}</td>
                <td className={styles.tdRight} style={{ fontWeight: 700, color: yearData.received >= yearData.billed ? 'var(--emerald)' : 'var(--amber)' }}>
                  {fmt(yearData.received)}
                </td>
                <td className={styles.tdRight} style={{ fontWeight: 700, color: yearData.pending > 0 ? 'var(--red)' : 'var(--text3)' }}>
                  {yearData.pending > 0 ? fmt(yearData.pending) : '—'}
                </td>
                <td className={styles.tdRight} style={{ fontWeight: 700, color: yearData.partialCount > 0 ? 'var(--amber)' : 'var(--text3)' }}>
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
                <th className={styles.thRight}>Months</th>
                <th className={styles.thRight}>Total Billed</th>
                <th className={styles.thRightEmerald}>Received</th>
                <th className={styles.thRightRed}>Pending</th>
                <th className={styles.thRight}>Records</th>
                <th className={styles.thRateBar}>Collection Rate</th>
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
                        className={styles.yoyYearBtn}
                        style={{ color: y.year === activeYear ? 'var(--indigo)' : 'var(--text)' }}>
                        {y.year}
                        {y.year === activeYear && <span className={styles.yoyActiveDot} style={{ color: 'var(--indigo)' }}>●</span>}
                      </button>
                    </td>
                    <td className={styles.tdRightText2}>{y.months.length}</td>
                    <td className={styles.tdRightBold}>
                      {fmt(y.billed)}
                      {delta !== null && (
                        <span className={styles.yoyDelta} style={{ color: delta >= 0 ? 'var(--emerald)' : 'var(--red)' }}>
                          {delta >= 0 ? '▲' : '▼'} {fmt(Math.abs(delta))}
                        </span>
                      )}
                    </td>
                    <td className={styles.tdRight} style={{ fontWeight: 700, color: y.received >= y.billed ? 'var(--emerald)' : 'var(--amber)' }}>
                      {fmt(y.received)}
                    </td>
                    <td className={styles.tdRight} style={{ color: y.pending > 0 ? 'var(--red)' : 'var(--text3)' }}>
                      {y.pending > 0 ? fmt(y.pending) : '—'}
                    </td>
                    <td className={styles.tdRightText2}>{y.count}</td>
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
