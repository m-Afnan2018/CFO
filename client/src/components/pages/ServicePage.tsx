'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import type { Service, Client } from '@/types';
import styles from './ServicePage.module.css';

const colorVars: Record<string, { bg: string; fg: string }> = {
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

function fmt(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

type ClientWithBreakdown = Client & { serviceBreakdown?: { name: string }[] };

export default function ServicePage({ slug }: { slug: string }) {
  const router = useRouter();
  const [services, setServices] = useState<Service[]>([]);
  const [clients, setClients]   = useState<Client[]>([]);
  const [loaded, setLoaded]     = useState(false);

  useEffect(() => {
    Promise.all([api.getServices(), api.getClients()])
      .then(([svcs, cls]) => {
        setServices(svcs as Service[]);
        setClients(cls as Client[]);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [slug]);

  const service  = services.find(s => s.slug === slug);
  const parent   = service?.parentId ? services.find(s => s._id === service.parentId) : null;
  const children = service ? services.filter(s => s.parentId === service._id) : [];

  const matchingClients = clients.filter(c =>
    service
      ? (c as ClientWithBreakdown).service === service.name ||
        (c as ClientWithBreakdown).serviceBreakdown?.some(sb => sb.name === service.name)
      : false,
  );

  const totalRevenue = matchingClients.reduce((s, c) => s + c.monthlyBilling, 0);
  const colors = colorVars[service?.color || 'indigo'];

  if (!loaded) {
    return (
      <div className="content">
        <div className={styles.loading}><i className="ti ti-loader-2" /> Loading…</div>
      </div>
    );
  }

  if (!service) {
    return (
      <div className="content">
        <div className={styles.notFound}>
          <div className={styles.notFoundTitle}>Service not found</div>
          <button className="btn btn-p" onClick={() => router.push('/')}>Back to Dashboard</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="topbar">
        <div className={styles.topbarLeft}>
          {parent && (
            <Link href={`/services/${parent.slug}`} className={styles.breadcrumb}>
              {parent.name}
              <i className="ti ti-chevron-right" />
            </Link>
          )}
          <div className={styles.serviceTitle}>
            <span className={styles.serviceDot} style={{ background: colors.fg }} />
            {service.name}
          </div>
        </div>
      </div>

      <div className="content">
        {/* KPI row */}
        <div className="grid4">
          <div className="kpi">
            <div className="kpi-label">
              Monthly Revenue
              <div className="kpi-ico" style={{ background: colors.bg }}>
                <i className="ti ti-currency-rupee" style={{ color: colors.fg }} />
              </div>
            </div>
            <div className="kpi-value" style={{ color: colors.fg }}>{fmt(totalRevenue)}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>This month</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              Active Clients
              <div className="kpi-ico" style={{ background: 'var(--indigo-dim)' }}>
                <i className="ti ti-users" style={{ color: 'var(--indigo)' }} />
              </div>
            </div>
            <div className="kpi-value">{matchingClients.filter(c => c.status === 'Active').length}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>of {matchingClients.length} total</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              Sub-services
              <div className="kpi-ico" style={{ background: 'var(--amber-dim)' }}>
                <i className="ti ti-hierarchy" style={{ color: 'var(--amber)' }} />
              </div>
            </div>
            <div className="kpi-value">{children.length}</div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>nested services</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              Avg per Client
              <div className="kpi-ico" style={{ background: 'var(--emerald-dim)' }}>
                <i className="ti ti-chart-bar" style={{ color: 'var(--emerald)' }} />
              </div>
            </div>
            <div className="kpi-value">
              {matchingClients.length > 0 ? fmt(Math.round(totalRevenue / matchingClients.length)) : '—'}
            </div>
            <div className="kpi-change" style={{ color: 'var(--text2)' }}>average billing</div>
          </div>
        </div>

        <div className={styles.grid}>
          {children.length > 0 && (
            <div className="card">
              <div className={styles.cardHeader}>
                <div className={styles.cardTitle}>Sub-services</div>
              </div>
              <div className={styles.subList}>
                {children.map(child => {
                  const cc = colorVars[child.color] || colorVars.indigo;
                  const childClients = clients.filter(c =>
                    (c as ClientWithBreakdown).service === child.name ||
                    (c as ClientWithBreakdown).serviceBreakdown?.some(sb => sb.name === child.name),
                  );
                  return (
                    <Link key={child._id} href={`/services/${child.slug}`} className={styles.subItem}>
                      <span className={styles.subDot} style={{ background: cc.fg }} />
                      <div className={styles.subName}>{child.name}</div>
                      <div className={styles.subMeta}>
                        {childClients.length} client{childClients.length !== 1 ? 's' : ''}
                      </div>
                      <i className="ti ti-chevron-right" style={{ color: 'var(--text3)', fontSize: '12px' }} />
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="card">
            <div className={styles.cardHeader}>
              <div className={styles.cardTitle}>Clients using {service.name}</div>
              <span className={styles.count}>{matchingClients.length}</span>
            </div>
            {matchingClients.length === 0 ? (
              <div className={styles.empty}>No clients linked to this service yet.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Manager</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Billing</th>
                  </tr>
                </thead>
                <tbody>
                  {matchingClients.map(c => (
                    <tr key={c._id}>
                      <td>
                        <div className={styles.clientCell}>
                          <div
                            className={styles.avatar}
                            style={{
                              background: colorVars[c.colorKey]?.bg || 'var(--surface)',
                              color: colorVars[c.colorKey]?.fg || 'var(--text)',
                            }}
                          >
                            {c.initials}
                          </div>
                          {c.name}
                        </div>
                      </td>
                      <td>{c.manager}</td>
                      <td>
                        <span className={`badge ${c.status === 'Active' ? 'bg' : c.status === 'Renewal Due' ? 'ba' : 'br'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(c.monthlyBilling)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
