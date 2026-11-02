import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

type Tone = 'info' | 'error';
interface Action { label: string; run: () => unknown }
interface Item { id: number; text: string; tone: Tone; action?: Action }

let push: (t: Item) => void = () => {};
let seq = 0;

export function toast(text: string, tone: Tone = 'info', action?: Action) {
  push({ id: ++seq, text, tone, action });
}

export default function Toasts() {
  const [items, setItems] = useState<Item[]>([]);
  useEffect(() => {
    push = (t) => {
      setItems((prev) => [...prev.slice(-2), t]);
      setTimeout(() => setItems((prev) => prev.filter((x) => x.id !== t.id)), t.action ? 12000 : t.tone === 'error' ? 7000 : 3200);
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
            {t.action && (
              <button
                className="toast-act"
                onClick={() => {
                  setItems((prev) => prev.filter((x) => x.id !== t.id));
                  t.action!.run();
                }}
              >
                {t.action.label}
              </button>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
