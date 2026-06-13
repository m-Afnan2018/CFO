'use client';
import styles from './DeleteConfirm.module.css';

interface DeleteConfirmProps {
  title?: string;
  message?: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
  confirmLabel?: string;
}

export default function DeleteConfirm({
  title = 'Delete',
  message = 'This will permanently delete this item. This cannot be undone.',
  onConfirm,
  onCancel,
  loading = false,
  confirmLabel = 'Delete',
}: DeleteConfirmProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className={`modal ${styles.modal}`} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onCancel}><i className="ti ti-x" /></button>
        </div>
        <div className="modal-body">
          <p className={styles.message}>{message}</p>
        </div>
        <div className="modal-footer">
          <button className="btn" onClick={onCancel}>Cancel</button>
          <button
            className={`btn ${styles.deleteBtn}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
