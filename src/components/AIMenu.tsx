import { useEffect, useRef } from 'react';
import type { SaveState } from '../lib/types';

export const DEV_SESSION_URL = 'https://claude.ai/code/session_01FtP6sty7hczHKPv2RmvypM';

export interface MenuItem {
  label: string;
  hint?: string;
  pressed?: boolean;
  disabled?: boolean;
  onSelect: () => unknown;
}

interface MenuElement extends HTMLElement {
  items: MenuItem[];
  status: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'ai-menu': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & { chat?: string; research?: string };
    }
  }
}

const STATUS: Record<SaveState, string> = { idle: 'עריכה פעילה, שמירה אוטומטית', saving: 'שומר אוטומטית...', saved: 'נשמר', error: 'לא נשמר, מנסה שוב' };
const hhmm = (t: number) => new Date(t).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });

interface Props {
  editing: boolean;
  saveState: SaveState;
  lastSaved?: number | null;
  setEditing: (v: boolean) => void;
  onAdd: () => void;
  onBulk: () => void;
}

/** The A&I logo button (public/ai-menu.js). Every editing and development action lives inside it. */
export default function AIMenu({ editing, saveState, lastSaved, setEditing, onAdd, onBulk }: Props) {
  const ref = useRef<MenuElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Editing is open on every device: no link to copy, no device to connect (Anat, 2026-10-29).
    el.items = [
      { label: editing ? 'סיום עריכה' : 'מצב עריכה', hint: editing ? 'פעיל' : 'כבוי', pressed: editing, onSelect: () => setEditing(!editing) },
      { label: 'אפליקציה חדשה', onSelect: onAdd },
      { label: 'ניסוח תוכן לכל האפליקציות', onSelect: onBulk },
    ];
    el.status = editing ? (saveState === 'saved' && lastSaved ? `נשמר ${hhmm(lastSaved)}` : STATUS[saveState]) : saveState === 'error' ? STATUS.error : '';
  }, [editing, saveState, lastSaved, setEditing, onAdd, onBulk]);

  return <ai-menu ref={ref} chat={DEV_SESSION_URL} />;
}
