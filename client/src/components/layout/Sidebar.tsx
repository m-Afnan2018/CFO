'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { api } from '@/lib/api';
import type { Service } from '@/types';
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
    { href: '/cashflow', icon: 'ti-trending-up',  label: 'Cash Flow' },
    { href: '/profit',   icon: 'ti-chart-pie',    label: 'Profitability' },
    { href: '/gst',      icon: 'ti-file-text',    label: 'GST / Tax' },
    { href: '/tds',      icon: 'ti-receipt-tax',  label: 'TDS' },
  ]},
  { label: 'System',    items: [
    { href: '/alerts',  icon: 'ti-bell',   label: 'Alerts' },
    { href: '/reports', icon: 'ti-report', label: 'Reports' },
  ]},
];

const colorVars: Record<string, string> = {
  emerald: 'var(--emerald)', indigo: 'var(--indigo)', blue: 'var(--blue)',
  amber: 'var(--amber)', red: 'var(--red)',
};

async function handleLogout() {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login';
}

// ── Inline add form ────────────────────────────────────────────────────────
function AddForm({
  placeholder, onAdd, onCancel,
}: { placeholder: string; onAdd: (name: string) => Promise<void>; onCancel: () => void }) {
  const [val, setVal] = useState('');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => { ref.current?.focus(); }, []);

  async function submit() {
    if (!val.trim() || saving) return;
    setSaving(true);
    await onAdd(val.trim());
    setSaving(false);
  }

  return (
    <div className={styles.svcForm}>
      <div className={styles.svcFormInner}>
        <input
          ref={ref}
          className={styles.svcInput}
          placeholder={placeholder}
          value={val}
          onChange={e => setVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
        />
        <button className={styles.svcFormBtn} onClick={submit} disabled={!val.trim() || saving}>
          {saving ? <i className="ti ti-loader-2" /> : <i className="ti ti-check" />}
        </button>
        <button className={styles.svcFormCancel} onClick={onCancel}>
          <i className="ti ti-x" />
        </button>
      </div>
    </div>
  );
}

// ── Sidebar ────────────────────────────────────────────────────────────────
export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggle } = useTheme();
  const [services, setServices] = useState<Service[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [addingRoot, setAddingRoot] = useState(false);
  const [addingChild, setAddingChild] = useState<string | null>(null);

  function load() {
    api.getServices().then(d => setServices(d as Service[])).catch(() => {});
  }
  useEffect(load, []);

  const roots = services.filter(s => !s.parentId);
  const childrenOf = (id: string) => services.filter(s => s.parentId === id);

  async function addService(name: string, parentId?: string) {
    await api.createService({ name, parentId: parentId || null });
    if (parentId) setExpanded(prev => new Set(Array.from(prev).concat(parentId)));
    load();
  }

  async function deleteService(id: string) {
    if (!confirm('Delete this service and all its sub-services?')) return;
    await api.deleteService(id);
    load();
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(Array.from(prev));
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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
        {/* Static nav sections */}
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

        {/* Services section */}
        <div>
          <div className={styles.svcHeader}>
            <div className="nav-label" style={{ padding: 0, marginBottom: 0 }}>Services</div>
            <button
              className={styles.svcAddBtn}
              title="Add service"
              onClick={() => { setAddingRoot(true); setAddingChild(null); }}
            >
              <i className="ti ti-plus" />
            </button>
          </div>

          {addingRoot && (
            <AddForm
              placeholder="Service name…"
              onAdd={async name => { await addService(name); setAddingRoot(false); }}
              onCancel={() => setAddingRoot(false)}
            />
          )}

          {roots.map(svc => {
            const children = childrenOf(svc._id);
            const isOpen = expanded.has(svc._id);
            const dotColor = colorVars[svc.color] || 'var(--text3)';
            const isActive = pathname === `/services/${svc.slug}`;

            return (
              <div key={svc._id}>
                <div className={styles.svcItem}>
                  <Link
                    href={`/services/${svc.slug}`}
                    className={`${styles.svcLink}${isActive ? ` ${styles.svcLinkActive}` : ''}`}
                  >
                    <span className={styles.svcDot} style={{ background: dotColor }} />
                    {svc.name}
                    {children.length > 0 && (
                      <i
                        className={`ti ti-chevron-right ${styles.svcChevron}${isOpen ? ` ${styles.svcChevronOpen}` : ''}`}
                        onClick={e => { e.preventDefault(); toggleExpand(svc._id); }}
                      />
                    )}
                  </Link>
                  <div className={styles.svcActions}>
                    <button
                      className={styles.svcActionBtn}
                      title="Add sub-service"
                      onClick={() => {
                        setAddingChild(svc._id);
                        setAddingRoot(false);
                        setExpanded(prev => new Set(Array.from(prev).concat(svc._id)));
                      }}
                    >
                      <i className="ti ti-plus" />
                    </button>
                    <button
                      className={`${styles.svcActionBtn} ${styles.svcActionBtnDel}`}
                      title="Delete"
                      onClick={() => deleteService(svc._id)}
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <>
                    {children.map(child => {
                      const childActive = pathname === `/services/${child.slug}`;
                      return (
                        <div key={child._id} className={`${styles.svcItem} ${styles.svcChild}`}>
                          <Link
                            href={`/services/${child.slug}`}
                            className={`${styles.svcLink}${childActive ? ` ${styles.svcLinkActive}` : ''}`}
                          >
                            <span
                              className={styles.svcDot}
                              style={{ background: colorVars[child.color] || 'var(--text3)' }}
                            />
                            {child.name}
                          </Link>
                          <div className={styles.svcActions}>
                            <button
                              className={`${styles.svcActionBtn} ${styles.svcActionBtnDel}`}
                              title="Delete"
                              onClick={() => deleteService(child._id)}
                            >
                              <i className="ti ti-trash" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {addingChild === svc._id && (
                      <div className={styles.svcChild}>
                        <AddForm
                          placeholder="Sub-service name…"
                          onAdd={async name => { await addService(name, svc._id); setAddingChild(null); }}
                          onCancel={() => setAddingChild(null)}
                        />
                      </div>
                    )}
                  </>
                )}

                {!isOpen && addingChild === svc._id && (
                  <AddForm
                    placeholder="Sub-service name…"
                    onAdd={async name => { await addService(name, svc._id); setAddingChild(null); }}
                    onCancel={() => setAddingChild(null)}
                  />
                )}
              </div>
            );
          })}

          {services.length === 0 && !addingRoot && (
            <button
              className={styles.svcLink}
              style={{ color: 'var(--text3)', fontSize: '12px', paddingLeft: 10 }}
              onClick={() => setAddingRoot(true)}
            >
              <i className="ti ti-plus" /> Add your first service
            </button>
          )}
        </div>
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
