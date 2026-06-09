'use client';

interface ModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

export default function Modal({ title, isOpen, onClose, onSave, children }: ModalProps) {
  if (!isOpen) return null;
  return (
    <div
      className="modal-overlay"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal">
        <div className="modal-title">
          <span>{title}</span>
          <span
            style={{ cursor: 'pointer', color: 'var(--text3)', fontSize: '20px' }}
            onClick={onClose}
          >
            <i className="ti ti-x" />
          </span>
        </div>
        <div>{children}</div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
