import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import type { AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { actionOf, related } from '../lib/facets';
import FacetTags from './FacetTags';
import AppCard from './AppCard';
import { activityOf, clean, fmtDate, platformOf, siteUrl, stripArrows, withProtocol, createdOf } from '../lib/format';
import { edit, uploadImage } from '../lib/supabase';
import CoverFrame from './CoverFrame';
import RichText from './RichText';
import MarkedTextarea from './MarkedTextarea';
import ChangeLog from './ChangeLog';
import Notes from './Notes';
import { toast } from './Toasts';

interface Props {
  app: AppData;
  sheet: string;
  apps: AppData[];
  sheets: Map<string, string>;
  facets: Facet[];
  go: (p: Partial<Route>) => void;
  prev?: AppData;
  next?: AppData;
  editing: boolean;
  onBack: () => void;
  onOpen: (id: string) => void;
  onChange: (a: AppData) => void;
  onDelete: (id: string) => void;
}

type Field = 'desc' | 'problem' | 'solution';

const LINKS: { url: keyof AppData; label: keyof AppData; fallback: string }[] = [
  { url: 'websiteUrl', label: 'websiteUrlLabel', fallback: 'אתר' },
  { url: 'editUrl', label: 'editUrlLabel', fallback: 'עריכה בפלטפורמה' },
  { url: 'githubUrl', label: 'githubUrlLabel', fallback: 'GitHub' },
  { url: 'supabaseProjectUrl', label: 'supabaseUrlLabel', fallback: 'מסד נתונים' },
];

export default function AppPage({ app, sheet, apps, sheets, facets, go, prev, next, editing, onBack, onOpen, onChange, onDelete }: Props) {
  const [gen, setGen] = useState<Field | 'all' | null>(null);
  const site = siteUrl(app);
  const act = actionOf(app.action);
  const domainLabels = (app.domains ?? []).map((d) => facets.find((f) => f.kind === 'domain' && f.value === d)?.label ?? d);
  const near = related(app, apps);
  const terms = [...(app.keywords ?? []), ...(app.concepts ?? []), ...domainLabels];
  const set = (p: Partial<AppData>) => onChange({ ...app, ...p });

  useEffect(() => {
    scrollTo({ top: 0, behavior: 'smooth' });
  }, [app.id]);

  const generate = async (field?: Field) => {
    setGen(field ?? 'all');
    try {
      const r = await edit<Record<Field, string>>('generate', {
        name: app.name,
        title: app.title,
        category: [act?.label, ...domainLabels].filter(Boolean).join(', '),
        url: site,
        current: { desc: clean(app.desc), problem: clean(app.problem), solution: clean(app.solution) },
      });
      set(field ? { [field]: r[field] } : { desc: r.desc, problem: r.problem, solution: r.solution });
      toast(field ? 'השדה נוסח מחדש' : 'התיאור, הבעיה והפתרון נוסחו מחדש');
    } catch (e) {
      toast(`הניסוח האוטומטי נכשל: ${(e as Error).message}`, 'error');
    } finally {
      setGen(null);
    }
  };

  const upload = (slot: 'cover' | 'logo') => async (f: File) => {
    try {
      const url = await uploadImage(app.id, slot, f);
      set(slot === 'cover' ? { coverImage: url } : { logoImage: url });
      toast('התמונה נשמרה');
    } catch (e) {
      toast(`העלאת התמונה נכשלה: ${(e as Error).message}`, 'error');
    }
  };

  const text = (field: Field, title: string) => (
    <section className={`panel text-panel p-${field}`}>
      <header className="panel-head">
        <h3>{title}</h3>
        {editing && (
          <button className="link" onClick={() => generate(field)} disabled={!!gen}>
            {gen === field || gen === 'all' ? 'מנסח...' : 'ניסוח אוטומטי'}
          </button>
        )}
      </header>
      {editing ? (
        <MarkedTextarea value={app[field] ?? ''} onChange={(v) => set({ [field]: v })} label={title} />
      ) : clean(app[field]) ? (
        <RichText text={app[field]} lead terms={terms} />
      ) : (
        <p className="dim">טרם נכתב.</p>
      )}
    </section>
  );

  return (
    <motion.article
      key={app.id}
      className={`app-page ${editing ? 'is-editing' : ''}`}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
    >
      <div className="crumbs">
        <button className="link" onClick={onBack}>
          כל האפליקציות
        </button>
        {act && (
          <>
            <span className="dim">/</span>
            <button className="link" onClick={() => go({ action: act.value, domain: null, ctx: null, app: null, q: '' })}>
              {act.label}
            </button>
          </>
        )}
        <span className="crumbs-nav">
          <button className="ghost" disabled={!prev} onClick={() => prev && onOpen(prev.id)} title={prev?.name}>
            הקודמת
          </button>
          <button className="ghost" disabled={!next} onClick={() => next && onOpen(next.id)} title={next?.name}>
            הבאה
          </button>
        </span>
      </div>

      <div className="app-hero">
        <div className="app-visual">
          <div className="layers" aria-hidden>
            <span />
            <span />
          </div>
          <CoverFrame src={app.coverImage} alt={app.name} href={site} editing={editing} onFile={upload('cover')} />
        </div>

        <div className="app-summary">
          <div className="titleblock mono">
            <div>
              <span>גיליון</span>
              <b>{sheet}</b>
            </div>
            <div>
              <span>פעולה</span>
              <b>{act?.short ?? '—'}</b>
            </div>
            <div>
              <span>פלטפורמה</span>
              <b>{platformOf(app.previewUrl) || '—'}</b>
            </div>
            <div>
              <span>נוצר</span>
              <b>{fmtDate(createdOf(app)) || '—'}</b>
            </div>
            <div>
              <span>עודכן</span>
              <b>{fmtDate(activityOf(app)) || '—'}</b>
            </div>
          </div>

          {editing ? (
            <div className="form">
              <label>
                <span className="mono">שם בתפריט</span>
                <input value={app.name} onChange={(e) => set({ name: e.target.value })} />
              </label>
              <label>
                <span className="mono">כותרת הדף</span>
                <input value={app.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
              </label>
            </div>
          ) : (
            <>
              {domainLabels.length > 0 && <div className="mono kicker">{domainLabels.join(' · ')}</div>}
              <h1 className="app-title">{app.name}</h1>
              {clean(app.title) && clean(app.title) !== app.name && clean(app.title) !== app.originalName && <p className="app-subtitle">{app.title}</p>}
              <FacetTags app={app} facets={facets} editing={false} onChange={onChange} go={go} />
            </>
          )}

          {editing ? (
            <label className="form-block">
              <span className="mono">
                תיאור
                <button className="link" onClick={() => generate()} disabled={!!gen}>
                  {gen === 'all' ? 'מנסח...' : 'ניסוח אוטומטי של כל השדות'}
                </button>
              </span>
              <MarkedTextarea value={app.desc ?? ''} onChange={(v) => set({ desc: v })} label="תיאור" />
            </label>
          ) : (
            clean(app.desc) && <RichText className="app-desc" text={app.desc} lead terms={terms} />
          )}

          {!editing && (
            <div className="app-links">
              {site && (
                <a className="solid big" href={site} target="_blank" rel="noopener noreferrer">
                  {stripArrows(app.primaryBtn) || 'כניסה לאפליקציה'}
                </a>
              )}
              {LINKS.filter((l) => app[l.url]).map((l) => (
                <a key={String(l.url)} className="ghost" href={withProtocol(String(app[l.url]))} target="_blank" rel="noopener noreferrer">
                  {String(app[l.label] ?? '') || l.fallback}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {editing && <FacetTags app={app} facets={facets} editing onChange={onChange} go={go} />}

      {editing && (
        <section className="panel links-form">
          <header className="panel-head">
            <h3>קישורים</h3>
          </header>
          <div className="form two">
            <label>
              <span className="mono">טקסט הכפתור הראשי</span>
              <input value={app.primaryBtn ?? ''} onChange={(e) => set({ primaryBtn: e.target.value })} placeholder="כניסה לאפליקציה" />
            </label>
            <label>
              <span className="mono">קישור לאפליקציה</span>
              <input
                dir="ltr"
                value={app.previewUrl ?? ''}
                onChange={(e) => set({ previewUrl: e.target.value, linkAddedAt: e.target.value.trim() !== (app.previewUrl ?? '').trim() ? new Date().toISOString() : app.linkAddedAt })}
                placeholder="https://"
              />
            </label>
            {LINKS.map((l) => (
              <div key={String(l.url)} className="pair">
                <label>
                  <span className="mono">שם הקישור</span>
                  <input value={String(app[l.label] ?? '')} onChange={(e) => set({ [l.label]: e.target.value })} placeholder={l.fallback} />
                </label>
                <label>
                  <span className="mono">{l.fallback}</span>
                  <input dir="ltr" value={String(app[l.url] ?? '')} onChange={(e) => set({ [l.url]: e.target.value })} placeholder="https://" />
                </label>
              </div>
            ))}
            <label>
              <span className="mono">מטרה בקצרה (לטבלה)</span>
              <input value={app.purpose ?? ''} onChange={(e) => set({ purpose: e.target.value })} />
            </label>
            <label>
              <span className="mono">לוגו</span>
              <CoverFrame className="logo" src={app.logoImage} alt="לוגו" editing onFile={upload('logo')} label="לוגו" />
            </label>
          </div>
        </section>
      )}

      <div className="analysis">
        {text('problem', 'הבעיה')}
        {text('solution', 'הפתרון')}
      </div>

      <div className="analysis">
        <ChangeLog app={app} editing={editing} onChange={onChange} />
        <Notes app={app} editing={editing} onChange={onChange} />
      </div>

      {!editing && near.length > 0 && (
        <section className="band related">
          <header className="band-head">
            <span className="mono">R</span>
            <h2>אפליקציות קשורות</h2>
            <span className="band-note">לפי תחום, פעולה, הקשר ומילות מפתח משותפים</span>
          </header>
          <div className="recent">
            {near.map((a, i) => (
              <AppCard
                key={a.id}
                app={a}
                sheet={sheets.get(a.id) ?? ''}
                category={(a.domains ?? []).map((d) => facets.find((f) => f.kind === 'domain' && f.value === d)?.label ?? d).join(' · ')}
                onOpen={() => onOpen(a.id)}
                index={i}
                compact
              />
            ))}
          </div>
        </section>
      )}

      {editing && (
        <div className="danger">
          <button
            className="ghost"
            onClick={() => {
              if (confirm(`למחוק את "${app.name}"? הפעולה אינה הפיכה.`)) onDelete(app.id);
            }}
          >
            מחיקת האפליקציה
          </button>
        </div>
      )}
    </motion.article>
  );
}
