import { useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  src?: string;
  alt: string;
  href?: string;
  editing: boolean;
  onFile: (f: File) => Promise<void>;
  className?: string;
  label?: string;
}

/** Cover image that links to the app; in edit mode it accepts drop, paste or a file. */
export default function CoverFrame({ src, alt, href, editing, onFile, className = '', label = 'תמונת שער' }: Props) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const take = async (f?: File | null) => {
    if (!f || !f.type.startsWith('image/')) return;
    setBusy(true);
    try {
      await onFile(f);
    } finally {
      setBusy(false);
    }
  };

  const img = src ? <img src={src} alt={alt} /> : <span className="cover-empty mono">{editing ? 'גררי לכאן תמונה' : alt.slice(0, 1)}</span>;

  if (!editing) {
    return href ? (
      <motion.a className={`cover ${className}`} href={href} target="_blank" rel="noopener noreferrer" whileHover={{ y: -4 }} title="פתיחת האפליקציה">
        {img}
        <span className="cover-cta mono">פתיחת האפליקציה</span>
      </motion.a>
    ) : (
      <div className={`cover ${className}`}>{img}</div>
    );
  }

  return (
    <div
      className={`cover editing ${over ? 'over' : ''} ${className}`}
      tabIndex={0}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        take(e.dataTransfer.files?.[0]);
      }}
      onPaste={(e) => take([...e.clipboardData.files][0])}
    >
      {img}
      <span className="cover-tools">
        <span className="mono">{busy ? 'מעלה...' : `${label}: גרירה, הדבקה או`}</span>
        <button type="button" onClick={() => file.current?.click()} disabled={busy}>
          בחירת קובץ
        </button>
      </span>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />
    </div>
  );
}
