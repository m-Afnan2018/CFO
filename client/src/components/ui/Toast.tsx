'use client';
import { useState, useCallback } from 'react';
import styles from './Toast.module.css';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

const ICONS: Record<ToastType, string> = {
  success: 'ti-circle-check',
  error:   'ti-circle-x',
  warning: 'ti-alert-triangle',
  info:    'ti-info-circle',
};

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const add = useCallback((type: ToastType, message: string) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg: string) => add('success', msg),
    error:   (msg: string) => add('error', msg),
    warning: (msg: string) => add('warning', msg),
    info:    (msg: string) => add('info', msg),
  };

  return { toasts, dismiss, toast };
}

interface ToasterProps {
  toasts: ToastItem[];
  dismiss: (id: number) => void;
}

export function Toaster({ toasts, dismiss }: ToasterProps) {
  if (!toasts.length) return null;
  return (
    <div className={styles.container}>
      {toasts.map(t => (
        <div key={t.id} className={`${styles.toast} ${styles[t.type]}`}>
          <i className={`ti ${ICONS[t.type]} ${styles.icon}`} />
          <span className={styles.msg}>{t.message}</span>
          <button className={styles.close} onClick={() => dismiss(t.id)}>
            <i className="ti ti-x" />
          </button>
        </div>
      ))}
    </div>
  );
}
