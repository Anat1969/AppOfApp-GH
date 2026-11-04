import { Fragment } from 'react';
import type { AppData } from '../lib/types';
import type { Route } from '../lib/route';
import { siteUrl } from '../lib/format';
import { IDEA_KIND_LABEL, type Idea } from '../data/ideas';
import type { AddPrefill } from './Matrix';
import { toast } from './Toasts';

/** `**words**` as a highlighter mark, the portfolio's emphasis. */
export function Marked({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) => (i % 2 ? <mark key={i} className="hl">{part}</mark> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

const KIND_WORD: Record<Idea['kind'], string> = {
  new: 'אפליקציה חדשה, שלא דומה לשום דבר שכבר יש בתיק',
  merge: 'מיזוג של אפליקציות קיימות לכלי אחד שמפיק משהו שאף אחת מהן לא מפיקה לבד',
  cut: 'חיתוך: מה שחי רק במקום שבו שתי אפליקציות או שני תחומים נפגשים',
  distill: 'זיקוק של אפליקציות קיימות לעיקר: כלל, מדד או כלי של עמוד אחד',
};

/** The ready prompt for Claude Code: what to build, from which apps, and how a new app is born in Anat's system. */
export function buildPrompt(idea: Idea, actionLabel: string, domainLabel: string, apps: AppData[], near: AppData[] = []) {
  const plain = (s: string) => s.replace(/\*\*/g, '');
  const src = (idea.from ?? []).map((id) => apps.find((a) => a.id === id)).filter(Boolean) as AppData[];
  const line = (a: AppData) => `- ${a.name}${siteUrl(a) ? `: ${siteUrl(a)}` : ''}${a.githubUrl ? ` (קוד: ${a.githubUrl})` : ''}`;
  const refs = [...src, ...near.filter((a) => !src.some((s) => s.id === a.id))];
  return `אני בונה אפליקציה חדשה: ${idea.title}.
סוג הרעיון: ${KIND_WORD[idea.kind]}.
${plain(idea.idea)}${idea.yields ? `\nמה היא מפיקה: ${idea.yields}.` : ''}
פעולה: ${actionLabel}. תחום: ${domainLabel}.
${src.length ? `\nהאפליקציות שהיא נבנית מהן (קרא את הקוד והנתונים שלהן, ושמור על קישור חזרה אליהן):\n${src.map(line).join('\n')}\n` : ''}${refs.length > src.length ? `\nאפליקציות קרובות בתיק שאפשר להישען עליהן:\n${refs.slice(src.length).map(line).join('\n')}\n` : ''}
איך נולדת אפליקציה חדשה אצלי:
1. אפיון קצר בתוך התשובה: למי, מה נכנס, מה יוצא, שלוש התשובות הראשונות שהמשתמש רואה.
2. מאגר GitHub חדש בשם <NAME>-GH, Vite + React + TypeScript, עברית ו-RTL, בלי אייקונים.
3. כפתור הלוגו A&I (https://appofapp-gh.vercel.app/ai-menu.js) וכל פעולות העריכה בתוכו; התקנה מ-Chrome.
4. עיצוב ברמת MOKED106: שאלות המשתמש הן המבנה, מספרים גדולים, תובנה מחושבת מתחת לכל גרף, סרגל כפתורים קבוע.
5. AI בתוך האפליקציה: Gemini החינמי דרך פונקציית Edge, Claude רק כגיבוי, לפי תקן הזיקוק (https://github.com/Anat1969/AppOfApp-GH/blob/main/docs/ai-text-standard.md).
6. בדיקות Playwright, פריסה ל-Vercel, מיזוג ל-main ובדיקת הכתובת החיה.
7. בסוף: הוספה לתיק העבודות https://appofapp-gh.vercel.app עם פעולה "${actionLabel}", תחום "${domainLabel}", מילות מפתח ומילים נרדפות לחיפוש.
עבוד לפי הסקיל anat-app-builder. לפני הבנייה: uipro init --ai claude`;
}

interface Props {
  ideas: Idea[];
  apps: AppData[];
  near?: AppData[];
  actionLabel: string;
  domainLabel: string;
  prefill: AddPrefill;
  go: (p: Partial<Route>) => void;
  onAdd: (p: AddPrefill) => void;
}

/** Ideas for a cell or for the whole portfolio: new apps, merges, intersections and distillations. */
export default function IdeaList({ ideas, apps, near = [], actionLabel, domainLabel, prefill, go, onAdd }: Props) {
  const name = (id: string) => apps.find((a) => a.id === id)?.name;
  return (
    <ul className="idea-list">
      {ideas.map((idea) => (
        <li key={idea.title} className={`pop-idea idea-${idea.kind}`}>
          <span className={`idea-kind mono k-${idea.kind}`}>{IDEA_KIND_LABEL[idea.kind]}</span>
          <h4>{idea.title}</h4>
          <p>
            <Marked text={idea.idea} />
          </p>
          {idea.yields && <p className="idea-yields">מפיק: {idea.yields}</p>}
          {!!idea.from?.length && (
            <p className="idea-from">
              <span className="mono dim">מתוך</span>
              {idea.from.filter(name).map((id) => (
                <button key={id} className="link" onClick={() => go({ app: id })}>
                  {name(id)}
                </button>
              ))}
            </p>
          )}
          <div className="pop-actions">
            <button className="solid" onClick={() => onAdd({ ...prefill, name: idea.title, desc: idea.idea })}>
              הוספה לתיק מהרעיון
            </button>
            <button
              className="ghost"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(buildPrompt(idea, actionLabel, domainLabel, apps, near));
                  toast('הפרומפט הועתק. פותחים שיחה חדשה ב-Claude Code ומדביקים');
                } catch {
                  toast('לא ניתן להעתיק בדפדפן הזה', 'error');
                }
              }}
            >
              העתקת פרומפט ל-Claude Code
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** How an idea becomes an app, in four steps (Anat, 2026-11-04: "צריך הסבר ליצירה של אפליקציה חדשה"). */
export function HowToBuild() {
  return (
    <details className="how-build">
      <summary>איך רעיון הופך לאפליקציה</summary>
      <ol>
        <li>
          <b>בוחרים רעיון</b> ולוחצים "העתקת פרומפט ל-Claude Code".
        </li>
        <li>
          <b>פותחים שיחה חדשה</b> ב-Claude Code (claude.ai/code) ומדביקים. הפרומפט כולל את האפליקציות שהרעיון נבנה מהן.
        </li>
        <li>
          <b>Claude מאפיין ובונה</b> מקצה לקצה: מאגר, עיצוב, כפתור הלוגו, בדיקות ופריסה.
        </li>
        <li>
          <b>האפליקציה נכנסת לתיק</b> במשבצת שלה. "הוספה לתיק מהרעיון" שומרת אותה כבר עכשיו כטיוטה עם השם והתיאור.
        </li>
      </ol>
    </details>
  );
}
