'use client';

interface EmptyStateProps {
  message: string;
  action?: { label: string; onClick: () => void };
}

export default function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div style={{ padding: '32px 0', textAlign: 'center' }}>
      <div style={{ fontSize: '13px', color: 'var(--text3)', marginBottom: action ? '12px' : 0 }}>
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
