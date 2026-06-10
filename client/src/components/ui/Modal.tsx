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
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-header">
          <span className="modal-title">{title}</span>
          <button className="modal-close" onClick={onClose}>
            <i className="ti ti-x" />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-p" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
