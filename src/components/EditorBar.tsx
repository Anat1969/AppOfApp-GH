import { motion } from 'framer-motion';
import type { SaveState } from '../lib/types';

interface Props {
  editing: boolean;
  setEditing: (v: boolean) => void;
  saveState: SaveState;
  onAdd: () => void;
  onBulk: () => void;
  onLeave: () => void;
}

const STATUS: Record<SaveState, string> = { idle: 'הכל שמור', saving: 'שומר...', saved: 'נשמר', error: 'שגיאה בשמירה' };

/** Floating bar, shown only on a device that holds a valid editor key. */
export default function EditorBar({ editing, setEditing, saveState, onAdd, onBulk, onLeave }: Props) {
  return (
    <motion.div className="editorbar" initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
      <span className={`status s-${saveState} mono`}>{STATUS[saveState]}</span>
      <button className={editing ? 'solid' : 'ghost'} onClick={() => setEditing(!editing)} aria-pressed={editing}>
        {editing ? 'סיום עריכה' : 'עריכה'}
      </button>
      <button className="ghost" onClick={onAdd}>
        אפליקציה חדשה
      </button>
      <button className="ghost" onClick={onBulk}>
        ניסוח תוכן לכולן
      </button>
      <button className="link" onClick={onLeave}>
        ניתוק המכשיר
      </button>
    </motion.div>
  );
}
