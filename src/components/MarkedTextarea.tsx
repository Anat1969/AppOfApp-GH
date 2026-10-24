import { useRef } from 'react';

interface Props {
  value: string;
  onChange: (v: string) => void;
  label: string;
  rows?: number;
}

/** A textarea with one action: wrap the selected words in ** so they show as emphasized. */
export default function MarkedTextarea({ value, onChange, label, rows = 4 }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const mark = () => {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: a, selectionEnd: b } = el;
    if (a === b) return;
    const sel = value.slice(a, b);
    const next = sel.startsWith('**') && sel.endsWith('**') ? sel.slice(2, -2) : `**${sel.trim()}**`;
    onChange(value.slice(0, a) + next + value.slice(b));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(a, a + next.length);
    });
  };
  return (
    <div className="marked-area">
      <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} rows={rows} />
      <div className="marked-tools">
        <button type="button" className="ghost" onMouseDown={(e) => e.preventDefault()} onClick={mark}>
          הדגשה
        </button>
        <span className="dim">מסמנים מילים ולוחצים. המשפט הראשון מוצג ככותרת התובנה.</span>
      </div>
    </div>
  );
}
