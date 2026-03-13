// src/components/ui/Modal.tsx — Bottom sheet modal
import { useEffect } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export default function Modal({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-sheet" onClick={e => e.stopPropagation()}>
        {title && (
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'1.25rem' }}>
            <h2 style={{ fontFamily:'var(--font-title)', fontSize:'1.5rem', letterSpacing:'0.04em' }}>{title}</h2>
            <button className="btn btn-ghost btn-icon" onClick={onClose} style={{ fontSize:'1rem' }}>✕</button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
