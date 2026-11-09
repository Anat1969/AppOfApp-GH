import { useEffect } from 'react';
import type { ActionValue, AppData, Facet } from '../lib/types';
import type { Route } from '../lib/route';
import { actionOf } from '../lib/facets';
import { CELL_IDEAS } from '../data/ideas';
import AppCard from './AppCard';
import IdeaList, { HowToBuild } from './IdeaList';
import type { AddPrefill } from './Matrix';

interface Props {
  cell: string;
  apps: AppData[];
  facets: Facet[];
  sheets: Map<string, string>;
  go: (p: Partial<Route>) => void;
  onAdd: (p: AddPrefill) => void;
}

/** One map cell as its own page (Anat, 2026-11-10): the apps of that row and column as cards, with a way back to the map. */
export default function CellPage({ cell, apps, facets, sheets, go, onAdd }: Props) {
  const [domain, action] = cell.split(':') as [string, ActionValue];
  const d = facets.find((f) => f.kind === 'domain' && f.value === domain);
  const a = actionOf(action);
  const list = apps.filter((x) => x.action === action && x.domains?.includes(domain));
  const names = new Set(apps.map((x) => x.name.trim()));
  const ideas = (CELL_IDEAS[cell] ?? []).filter((i) => !names.has(i.title.trim()));
  const back = () => go({ cell: null });

  useEffect(() => {
    scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, [cell]);

  return (
    <section className="band sec-section cell-page">
      <header className="band-head">
        <button className="solid cell-back" onClick={back}>
          חזרה למפה
        </button>
        <h2>
          {d?.label ?? 'לא מסווג'} · {a?.label ?? ''}
        </h2>
        <span className="band-note">
          <span className="mono">{list.length}</span> אפליקציות במשבצת: השורה {d?.label}, העמודה {a?.label}.
        </span>
        <div className="filters">
          <button className="link" onClick={() => onAdd({ action, domain })}>
            הוספת אפליקציה כאן
          </button>
          <button className="link" onClick={() => go({ domain, action, cell: null, app: null })}>
            סינון התיק למשבצת
          </button>
        </div>
      </header>
      {list.length ? (
        <div className="grid">
          {list.map((x, i) => (
            <AppCard key={x.id} app={x} sheet={sheets.get(x.id) ?? ''} category={d?.label ?? ''} onOpen={() => go({ app: x.id })} index={i} still />
          ))}
        </div>
      ) : (
        <p className="dim">עוד אין אפליקציות במשבצת הזו.</p>
      )}
      {ideas.length > 0 && (
        <div className="cell-page-ideas">
          <h3>רעיונות להמשך במשבצת</h3>
          <IdeaList ideas={ideas} apps={apps} actionLabel={a?.label ?? ''} domainLabel={d?.label ?? ''} prefill={{ action, domain }} go={go} onAdd={onAdd} />
          <HowToBuild />
        </div>
      )}
    </section>
  );
}
