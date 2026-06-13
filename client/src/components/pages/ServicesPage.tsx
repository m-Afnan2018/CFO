'use client';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import type { Service } from '@/types';
import styles from './ServicesPage.module.css';

const COLORS = ['indigo', 'emerald', 'blue', 'amber', 'red'] as const;
const COLOR_LABELS: Record<string, string> = {
  indigo: 'Indigo', emerald: 'Green', blue: 'Blue', amber: 'Amber', red: 'Red',
};
const COLOR_VARS: Record<string, { bg: string; fg: string }> = {
  indigo:  { bg: 'var(--indigo-dim)',  fg: 'var(--indigo)' },
  emerald: { bg: 'var(--emerald-dim)', fg: 'var(--emerald)' },
  blue:    { bg: 'var(--blue-dim)',    fg: 'var(--blue)' },
  amber:   { bg: 'var(--amber-dim)',   fg: 'var(--amber)' },
  red:     { bg: 'var(--red-dim)',     fg: 'var(--red)' },
};

interface AddFormProps {
  placeholder: string;
  onAdd: (name: string, color: string) => Promise<void>;
  onCancel: () => void;
}

function AddForm({ placeholder, onAdd, onCancel }: AddFormProps) {
  const [name, setName]     = useState('');
  const [color, setColor]   = useState<string>('indigo');
  const [saving, setSaving] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);

  async function submit() {
    if (!name.trim() || saving) return;
    setSaving(true);
    await onAdd(name.trim(), color);
    setSaving(false);
  }

  return (
    <div className={styles.addForm}>
      <input
        ref={ref}
        className={styles.addInput}
        placeholder={placeholder}
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') onCancel(); }}
      />
      <div className={styles.colorPicker}>
        {COLORS.map(c => (
          <button
            key={c}
            type="button"
            className={`${styles.colorDot}${color === c ? ` ${styles.colorDotActive}` : ''}`}
            style={{ background: COLOR_VARS[c].fg }}
            title={COLOR_LABELS[c]}
            onClick={() => setColor(c)}
          />
        ))}
      </div>
      <div className={styles.addActions}>
        <button className={styles.addBtn} onClick={submit} disabled={!name.trim() || saving}>
          {saving ? <i className="ti ti-loader-2" /> : 'Add'}
        </button>
        <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loaded, setLoaded]     = useState(false);
  const [addingRoot, setAddingRoot]   = useState(false);
  const [addingChild, setAddingChild] = useState<string | null>(null);
  const [expanded, setExpanded]       = useState<Set<string>>(new Set());

  function load() {
    api.getServices()
      .then(d => { setServices(d as Service[]); setLoaded(true); })
      .catch(() => setLoaded(true));
  }
  useEffect(load, []);

  const roots      = services.filter(s => !s.parentId);
  const childrenOf = (id: string) => services.filter(s => s.parentId === id);

  async function addService(name: string, color: string, parentId?: string) {
    await api.createService({ name, color, parentId: parentId || null });
    if (parentId) setExpanded(prev => new Set(Array.from(prev).concat(parentId)));
    load();
  }

  async function deleteService(id: string, hasChildren: boolean) {
    const msg = hasChildren
      ? 'Delete this service and all its sub-services?'
      : 'Delete this service?';
    if (!confirm(msg)) return;
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
    <div>
      <div className="topbar">
        <div className="topbar-title">Services</div>
        <div className="topbar-right">
          <button className="btn btn-p" onClick={() => { setAddingRoot(true); setAddingChild(null); }}>
            <i className="ti ti-plus" /> Add Service
          </button>
        </div>
      </div>

      <div className="content">
        {addingRoot && (
          <div className={`card ${styles.newCard}`}>
            <div className={styles.formTitle}>New Service</div>
            <AddForm
              placeholder="e.g. Ads, SEO, Web Development…"
              onAdd={async (name, color) => { await addService(name, color); setAddingRoot(false); }}
              onCancel={() => setAddingRoot(false)}
            />
          </div>
        )}

        {!loaded && (
          <div className={styles.loading}><i className="ti ti-loader-2" /> Loading…</div>
        )}

        {loaded && roots.length === 0 && !addingRoot && (
          <div className={styles.empty}>
            <i className="ti ti-briefcase" />
            <div className={styles.emptyTitle}>No services yet</div>
            <div className={styles.emptySub}>
              Create services like &ldquo;Ads&rdquo;, &ldquo;SEO&rdquo;, or &ldquo;Web Development&rdquo; —
              then add sub-services under them.
            </div>
            <button className="btn btn-p" onClick={() => setAddingRoot(true)}>
              <i className="ti ti-plus" /> Add First Service
            </button>
          </div>
        )}

        <div className={styles.grid}>
          {roots.map(svc => {
            const children   = childrenOf(svc._id);
            const isExpanded = expanded.has(svc._id) || children.length > 0;
            const c          = COLOR_VARS[svc.color] || COLOR_VARS.indigo;

            return (
              <div key={svc._id} className={styles.svcCard}>
                {/* Service header */}
                <div className={styles.svcHeader}>
                  <div className={styles.svcLeft}>
                    <div className={styles.svcIcon} style={{ background: c.bg, color: c.fg }}>
                      <i className="ti ti-briefcase" />
                    </div>
                    <div>
                      <div className={styles.svcName}>{svc.name}</div>
                      <div className={styles.svcMeta}>
                        {children.length} sub-service{children.length !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                  <div className={styles.svcActions}>
                    <button
                      className={styles.actionBtn}
                      onClick={() => {
                        setAddingChild(addingChild === svc._id ? null : svc._id);
                        setExpanded(prev => new Set(Array.from(prev).concat(svc._id)));
                      }}
                    >
                      <i className="ti ti-plus" /> Sub-service
                    </button>
                    {children.length > 0 && (
                      <button className={styles.iconBtn} onClick={() => toggleExpand(svc._id)}>
                        <i className={`ti ti-chevron-${isExpanded ? 'up' : 'down'}`} />
                      </button>
                    )}
                    <button
                      className={`${styles.iconBtn} ${styles.deleteBtn}`}
                      onClick={() => deleteService(svc._id, children.length > 0)}
                    >
                      <i className="ti ti-trash" />
                    </button>
                  </div>
                </div>

                {/* Children list */}
                {(children.length > 0 || addingChild === svc._id) && (
                  <div className={styles.children}>
                    {children.map(child => {
                      const cc = COLOR_VARS[child.color] || COLOR_VARS.indigo;
                      return (
                        <div key={child._id} className={styles.child}>
                          <div className={styles.childLeft}>
                            <span className={styles.childDot} style={{ background: cc.fg }} />
                            <span className={styles.childName}>{child.name}</span>
                            <span className={styles.childBadge} style={{ background: cc.bg, color: cc.fg }}>
                              {COLOR_LABELS[child.color] || child.color}
                            </span>
                          </div>
                          <button
                            className={`${styles.iconBtn} ${styles.deleteBtn}`}
                            onClick={() => deleteService(child._id, false)}
                          >
                            <i className="ti ti-trash" />
                          </button>
                        </div>
                      );
                    })}

                    {addingChild === svc._id && (
                      <div className={styles.childForm}>
                        <div className={styles.childFormLabel}>
                          Sub-service under <strong>{svc.name}</strong>
                        </div>
                        <AddForm
                          placeholder="e.g. Meta Ads, Google Ads…"
                          onAdd={async (name, color) => { await addService(name, color, svc._id); setAddingChild(null); }}
                          onCancel={() => setAddingChild(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
