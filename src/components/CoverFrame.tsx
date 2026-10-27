import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';

interface Props {
  src?: string;
  alt: string;
  href?: string;
  editing: boolean;
  onFile: (f: File) => Promise<void>;
  className?: string;
  label?: string;
  /** Take an image pasted anywhere on the page, not only when the frame has focus (the cover, not the logo). */
  pasteAnywhere?: boolean;
  /** An image address that was pasted instead of an image. */
  onUrl?: (url: string) => void;
}

/** The image in a paste: Windows screenshots and copied images arrive as files or as clipboard items. */
function pastedImage(data: DataTransfer | null): File | null {
  if (!data) return null;
  const direct = [...(data.files ?? [])].find((f) => f.type.startsWith('image/'));
  if (direct) return direct;
  for (const item of [...(data.items ?? [])]) {
    if (item.kind === 'file' && item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return new File([f], f.name || `paste-${Date.now()}.${item.type.split('/')[1] || 'png'}`, { type: item.type });
    }
  }
  return null;
}
const imageUrl = (t: string) => (/^https?:\/\/\S+\.(png|jpe?g|webp|gif|avif)(\?\S*)?$/i.test(t.trim()) ? t.trim() : '');

/** Cover image that links to the app; in edit mode it accepts drop, paste or a file. */
export default function CoverFrame({ src, alt, href, editing, onFile, className = '', label = 'תמונת שער', pasteAnywhere, onUrl }: Props) {
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const [error, setError] = useState('');
  const [preview, setPreview] = useState('');
  const inFlight = useRef(false);
  // The pasted image shows at once; one upload at a time, so pasting again while it uploads does not add copies.
  const take = async (f?: File | null) => {
    if (!f || !f.type.startsWith('image/') || inFlight.current) return;
    inFlight.current = true;
    const local = URL.createObjectURL(f);
    setPreview(local);
    setBusy(true);
    setError('');
    try {
      await onFile(f);
    } catch (e) {
      setError((e as Error).message || 'ההעלאה נכשלה');
    } finally {
      inFlight.current = false;
      setBusy(false);
      setTimeout(() => {
        setPreview('');
        URL.revokeObjectURL(local);
      }, 1500);
    }
  };
  const takeRef = useRef(take);
  takeRef.current = take;

  // In edit mode a pasted screenshot becomes the cover wherever the cursor is, unless text is being pasted into a field.
  useEffect(() => {
    if (!editing || !pasteAnywhere) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = pastedImage(e.clipboardData);
      const text = e.clipboardData?.getData('text/plain') ?? '';
      const inField = (e.target as HTMLElement)?.closest?.('input, textarea, [contenteditable="true"]');
      if (f && !(inField && text)) {
        e.preventDefault();
        takeRef.current(f);
      } else if (!inField && onUrl && imageUrl(text)) {
        e.preventDefault();
        onUrl(imageUrl(text));
      }
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [editing, pasteAnywhere, onUrl]);

  const shown = preview || src;
  const img = shown ? <img src={shown} alt={alt} className={busy ? 'uploading' : ''} /> : <span className="cover-empty mono">{editing ? 'הדביקי כאן צילום מסך (Ctrl+V) או גררי תמונה' : alt.slice(0, 1)}</span>;

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
      onPaste={(e) => {
        if (pasteAnywhere) return; // the page-wide listener takes it
        const f = pastedImage(e.clipboardData);
        if (f) {
          e.preventDefault();
          take(f);
        }
      }}
    >
      {img}
      <span className="cover-tools">
        <span className="mono">{busy ? 'מעלה...' : error ? `לא עלה: ${error}` : `${label}: הדבקה (Ctrl+V), גרירה או`}</span>
        <button type="button" onClick={() => file.current?.click()} disabled={busy}>
          בחירת קובץ
        </button>
      </span>
      <input ref={file} type="file" accept="image/*" hidden onChange={(e) => take(e.target.files?.[0])} />
    </div>
  );
}
