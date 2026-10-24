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

const STATUS: Record<SaveState, string> = { idle: 'עריכה פעילה', saving: 'שומר...', saved: 'נשמר', error: 'שגיאה בשמירה' };

interface Props {
  isEditor: boolean;
  editing: boolean;
  saveState: SaveState;
  setEditing: (v: boolean) => void;
  onAdd: () => void;
  onBulk: () => void;
  onConnect: (key: string) => Promise<boolean>;
  onLeave: () => void;
}

/** The A&I logo button (public/ai-menu.js). Every editing and development action lives inside it. */
export default function AIMenu({ isEditor, editing, saveState, setEditing, onAdd, onBulk, onConnect, onLeave }: Props) {
  const ref = useRef<MenuElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.items = isEditor
      ? [
          { label: editing ? 'סיום עריכה' : 'מצב עריכה', hint: editing ? 'פעיל' : 'כבוי', pressed: editing, onSelect: () => setEditing(!editing) },
          { label: 'אפליקציה חדשה', onSelect: onAdd },
          { label: 'ניסוח תוכן לכל האפליקציות', onSelect: onBulk },
          { label: 'ניתוק המכשיר מהעריכה', onSelect: onLeave },
        ]
      : [
          {
            label: 'חיבור המכשיר לעריכה',
            hint: 'קישור או מפתח',
            onSelect: async () => {
              const v = prompt('הדביקי את קישור העריכה או את המפתח')?.trim();
              const key = v?.match(/editor=([\w-]{16,})/)?.[1] ?? v;
              if (key) await onConnect(key);
            },
          },
        ];
    el.status = editing ? STATUS[saveState] : saveState === 'error' ? STATUS.error : '';
  }, [isEditor, editing, saveState, setEditing, onAdd, onBulk, onConnect, onLeave]);

  return <ai-menu ref={ref} chat={DEV_SESSION_URL} />;
}
