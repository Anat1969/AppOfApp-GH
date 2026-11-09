import { useState } from 'react';
import type { AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { NEW_AXES, SYNTHESES, type Idea } from '../data/ideas';
import IdeaList, { HowToBuild, Marked } from './IdeaList';
import type { AddPrefill } from './Matrix';
import { toast } from './Toasts';

interface Props {
  apps: AppData[];
  facets: Facet[];
  go: (p: Partial<Route>) => void;
  onAdd: (p: AddPrefill) => void;
  saveFacet: (f: Facet) => Promise<boolean>;
}

/**
 * Beyond the map (Anat, 2026-11-04): syntheses across distant domains, read again from the whole portfolio, and rows and
 * columns the map does not have yet. A proposed domain can be added to the vocabulary in one click.
 */
export default function BeyondMap({ apps, facets, go, onAdd, saveFacet }: Props) {
  const [tab, setTab] = useState<'syn' | 'axes'>('syn');
  const names = new Set(apps.map((x) => x.name.trim()));
  const syn = SYNTHESES.filter((i) => !names.has(i.title.trim()));
  const has = (label: string) => facets.some((f) => f.label === label);
  return (
    <section className="beyond" aria-label="מעבר למפה">
      <div className="beyond-tabs">
        <button className={tab === 'syn' ? 'on' : ''} aria-pressed={tab === 'syn'} onClick={() => setTab('syn')}>
          סינתזות בין תחומים <span className="mono dim">{syn.length}</span>
        </button>
        <button className={tab === 'axes' ? 'on' : ''} aria-pressed={tab === 'axes'} onClick={() => setTab('axes')}>
          שורות ועמודות שעוד אין במפה <span className="mono dim">{NEW_AXES.length}</span>
        </button>
      </div>
      {tab === 'syn' ? (
        <>
          <p className="beyond-note"><Marked text="כל סינתזה מעבירה **מנגנון** מתחום אחד לתחום רחוק, ולא רק מצרפת שתי אפליקציות. לכל אחת דוגמה אחת מוחשית, ואיך בודקים שהיא אמינה." /></p>
          <div className="beyond-grid">
            <IdeaList ideas={syn} apps={apps} actionLabel="לפי הרעיון" domainLabel="כמה תחומים" prefill={{}} go={go} onAdd={onAdd} />
          </div>
        </>
      ) : (
        <>
          <p className="beyond-note">נושאים שהתיק כבר נוגע בהם בלי שורה משלהם, ופעולות שאין להן עמודה.</p>
          <div className="axes-grid">
            {NEW_AXES.map((ax) => (
              <article key={ax.label} className="axis-card">
                <span className="mono dim">{ax.kind === 'domain' ? 'תחום חדש: שורה במפה' : 'פעולה חדשה: עמודה במפה'}</span>
                <h4>{ax.label}</h4>
                <p className="dim">{ax.why}</p>
                <IdeaList
                  ideas={ax.ideas.map((x): Idea => ({ kind: 'new', title: x.title, idea: x.idea, example: x.example, test: x.test }))}
                  apps={apps}
                  actionLabel={ax.kind === 'action' ? ax.label : 'לפי הרעיון'}
                  domainLabel={ax.kind === 'domain' ? ax.label : 'לפי הרעיון'}
                  prefill={{}}
                  go={go}
                  onAdd={onAdd}
                />
                {ax.kind === 'domain' &&
                  (has(ax.label) ? (
                    <p className="mono dim">כבר במילון</p>
                  ) : (
                    <button
                      className="link inline-edit"
                      onClick={async () => {
                        const list = facets.filter((f) => f.kind === 'domain');
                        if (await saveFacet({ kind: 'domain', value: `f-${Date.now()}`, label: ax.label, synonyms: [], position: list.length })) toast(`"${ax.label}" נוסף כשורה במפה`);
                      }}
                    >
                      הוספת "{ax.label}" כשורה במפה
                    </button>
                  ))}
              </article>
            ))}
          </div>
          <p className="beyond-note">
            <Marked text="עמודה חדשה היא שינוי בקוד (**שבע הפעולות** קבועות). אם אחת מהן נכונה, בקשי ואוסיף אותה." />
          </p>
        </>
      )}
      <HowToBuild />
    </section>
  );
}
