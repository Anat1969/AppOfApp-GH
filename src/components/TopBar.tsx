import { useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppData, Category } from '../lib/types';
import type { Route } from '../lib/route';
import { useInstall } from '../lib/install';
import { toast } from './Toasts';

export const DEV_SESSION_URL = 'https://claude.ai/code/session_01FtP6sty7hczHKPv2RmvypM';

interface Props {
  route: Route;
  apps: AppData[];
  categories: Category[];
  onHome: () => void;
  onSearch: (q: string) => void;
  onOpen: (id: string) => void;
  onView: (v: Route['view']) => void;
}

export default function TopBar({ route, apps, categories, onHome, onSearch, onOpen, onView }: Props) {
  const { canInstall, install } = useInstall();
  const [focus, setFocus] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const q = route.q.trim().toLowerCase();

  const suggestions = useMemo(() => {
    if (q.length < 2) return [];
    return apps
      .filter((a) => [a.name, a.title, a.desc, a.purpose, ...(a.tags ?? [])].filter(Boolean).some((f) => String(f).toLowerCase().includes(q)))
      .slice(0, 7);
  }, [apps, q]);

  const catLabel = (v?: string | null) => categories.find((c) => c.value === v)?.label ?? '';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      toast('הקישור למצב הנוכחי הועתק');
    } catch {
      toast('לא ניתן להעתיק בדפדפן הזה', 'error');
    }
  };

  return (
    <header className="topbar">
      <div className="topbar-inner">
        <a
          className="brand"
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onHome();
          }}
          aria-label="דף הבית"
        >
          <img src="/icon.svg" alt="" className="brand-mark" />
          <span className="brand-name">Apps</span>
          <span className="brand-sub">תיק עבודות</span>
        </a>

        <div className="search">
          <input
            ref={input}
            type="search"
            value={route.q}
            placeholder="חיפוש אפליקציה, נושא או בעיה"
            aria-label="חיפוש"
            onChange={(e) => onSearch(e.target.value)}
            onFocus={() => setFocus(true)}
            onBlur={() => setTimeout(() => setFocus(false), 150)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                onSearch('');
                input.current?.blur();
              }
            }}
          />
          <AnimatePresence>
            {focus && suggestions.length > 0 && (
              <motion.ul
                className="suggest"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                {suggestions.map((a) => (
                  <li key={a.id}>
                    <button
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onOpen(a.id);
                        input.current?.blur();
                      }}
                    >
                      <span>{a.name}</span>
                      <span className="mono dim">{catLabel(a.category)}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <nav className="actions" aria-label="פעולות">
          <button className={`tab ${route.view === 'home' ? 'on' : ''}`} onClick={() => onView('home')}>
            מפה
          </button>
          <button className={`tab ${route.view === 'table' ? 'on' : ''}`} onClick={() => onView('table')}>
            טבלה
          </button>
          <span className="sep" aria-hidden />
          <button className="ghost" onClick={copy}>העתקת קישור</button>
          <a className="ghost" href={DEV_SESSION_URL} target="_blank" rel="noopener noreferrer">
            שיחת הפיתוח
          </a>
          {canInstall && (
            <button className="solid" onClick={install}>
              התקנת האפליקציה
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}
