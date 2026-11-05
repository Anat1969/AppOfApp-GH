import { useEffect, type ReactNode } from 'react';
/** Fixed explanations (why, when, how) live behind an icon button, so the view keeps the screen. */
export function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); addEventListener('keydown', k); return () => removeEventListener('keydown', k); }, [onClose]);
  return (
    <div className="dlg-back" onClick={onClose}>
      <div className="dlg rise" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="dlg-head"><h2>{title}</h2><button className="icon-btn press" aria-label="סגירה" onClick={onClose}><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M6 6l12 12M18 6L6 18" /></svg></button></div>
        <div className="dlg-body">{children}</div>
      </div>
    </div>
  );
}
export const InfoIcon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.75"><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7.5v.5" /></svg>;
