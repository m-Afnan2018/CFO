'use client';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className={styles.root}>
      <div className={action ? styles.messageWithAction : styles.message}>
        {message}
      </div>
      {action && (
        <button className="btn btn-p" onClick={action.onClick}>
          <i className="ti ti-plus" />{action.label}
        </button>
      )}
    </div>
  );
}
