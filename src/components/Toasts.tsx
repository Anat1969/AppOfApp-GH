import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type Tone = 'info' | 'error';
interface Item { id: number; text: string; tone: Tone }

let push: (t: Item) => void = () => {};
let seq = 0;

export function toast(text: string, tone: Tone = 'info') {
  push({ id: ++seq, text, tone });
}

export default function Toasts() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    push = (t) => {
      setItems((prev) => [...prev.slice(-2), t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.tone === 'error' ? 7000 : 3200);
    };
  }, []);
  return (
    <div className="toasts" role="status" aria-live="polite">
      <AnimatePresence>
        {items.map((t) => (
          <motion.div
            key={t.id}
            className={`toast ${t.tone}`}
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
