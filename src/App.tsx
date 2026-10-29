import { useEffect, useMemo, useState } from 'react';
import { useStore } from './lib/store';
import { useRoute } from './lib/route';
import { useSearch } from './lib/search';
import { activityOf, createdOf, sheetNo, siteUrl } from './lib/format';
import TopBar from './components/TopBar';
import Home from './components/Home';
import AppPage from './components/AppPage';
import TableView from './components/TableView';
import AIMenu from './components/AIMenu';
import AddAppDialog from './components/AddAppDialog';
import type { AddPrefill } from './components/Matrix';
import BulkDialog from './components/BulkDialog';
import Toasts from './components/Toasts';

const SORT_KEY = 'aoa-sort';

export default function App() {
  const store = useStore();
  const { route, go } = useRoute();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState<AddPrefill | null>(null);
  const [addSeq, setAddSeq] = useState(0);
  const openAdd = (p: AddPrefill = {}) => {
    setAddSeq((n) => n + 1);
    setAdding(p);
  };
  const [bulk, setBulk] = useState(false);
  const [sort, setSortState] = useState<'date' | 'alpha'>(() => {
    try {
      return localStorage.getItem(SORT_KEY) === 'alpha' ? 'alpha' : 'date';
    } catch {
      return 'date';
    }
  });
  const setSort = (s: 'date' | 'alpha') => {
    setSortState(s);
    try {
      localStorage.setItem(SORT_KEY, s);
    } catch {
      /* not persisted */
    }
  };

  const { apps, facets } = store;

  // Sheet numbers follow creation order, so A-001 is the first app ever added.
  const sheets = useMemo(() => {
    const m = new Map<string, string>();
    [...apps].sort((a, b) => createdOf(a) - createdOf(b)).forEach((a, i) => m.set(a.id, sheetNo(i + 1)));
    return m;
  }, [apps]);

  const search = useSearch(apps, facets);
  const { items: searched, vocab, reasons, near } = useMemo(() => search(route.q), [search, route.q]);

  const results = useMemo(() => {
    const q = route.q.trim();
    let list = [...searched];
    if (route.action) list = list.filter((a) => a.action === route.action);
    if (route.domain) list = list.filter((a) => a.domains?.includes(route.domain!));
    if (route.ctx) list = list.filter((a) => a.contexts?.includes(route.ctx!));
    if (route.links) list = list.filter((a) => !!siteUrl(a));
    if (q.length < 2) list.sort(sort === 'alpha' ? (a, b) => a.name.localeCompare(b.name, 'he') : (a, b) => activityOf(b) - activityOf(a));
    return list;
  }, [searched, route.q, route.action, route.domain, route.ctx, route.links, sort]);

  const active = route.app ? apps.find((a) => a.id === route.app) : undefined;
  const idx = active ? results.findIndex((a) => a.id === active.id) : -1;
  const order = idx >= 0 ? results : apps;
  const pos = active ? order.findIndex((a) => a.id === active.id) : -1;

  useEffect(() => {
    document.title = active ? `${active.name} · Apps` : 'Apps · תיק עבודות';
  }, [active]);

  return (
    <div className={`shell ${editing ? 'editing' : ''}`}>
      {/* Where am I (Anat, 2026-10-27, "ב + ג"): the portfolio is framed like a drawing sheet with a title stamp,
          under a dark blue bar, so it never looks like one of the apps it lists. */}
      <div className="sheet-frame" aria-hidden>
        <div className="sheet-stamp">
          <b>תיק האפליקציות</b>
          <span>{active ? `גיליון ${sheets.get(active.id) ?? ''}` : route.view === 'table' ? 'טבלה' : 'מפה'}</span>
          <span className="mono">A&amp;I · אד׳ ענת שטיבלמן</span>
        </div>
      </div>
      {editing && (
        <div className={`edit-light save-${store.saveState}`} aria-live="polite">
          <span className="edit-light-tag mono">
            מצב עריכה · {store.saveState === 'error' ? 'לא נשמר, מנסה שוב' : store.saveState === 'saving' ? 'שומר...' : 'כל שינוי נשמר אוטומטית'}
          </span>
        </div>
      )}
      <TopBar
        route={route}
        apps={apps}
        facets={facets}
        search={search}
        go={go}
        onHome={() => go({ app: null, action: null, domain: null, ctx: null, q: '', view: 'home', links: false })}
        onSearch={(q) => go({ q, app: null, view: 'home' }, true)}
        onOpen={(id) => go({ app: id, view: 'home' })}
        onView={(view) => go({ view, app: null })}
        menu={
          <AIMenu
            editing={editing}
            saveState={store.saveState}
            lastSaved={store.lastSaved}
            setEditing={setEditing}
            onAdd={() => openAdd({ action: route.action ?? undefined, domain: route.domain ?? undefined })}
            onBulk={() => setBulk(true)}
          />
        }
      />

      <main className="stage">
        {store.loading ? (
          <div className="state">
            <div className="loader" aria-hidden>
              <span />
              <span />
              <span />
            </div>
            <p className="mono">טוען את תיק העבודות</p>
          </div>
        ) : store.loadError ? (
          <div className="state">
            <p>{store.loadError}</p>
            <button className="solid" onClick={store.reload}>
              ניסיון נוסף
            </button>
          </div>
        ) : route.app && !active ? (
          <div className="state">
            <p>האפליקציה לא נמצאה. אולי נמחקה.</p>
            <button className="solid" onClick={() => go({ app: null })}>
              חזרה לכל האפליקציות
            </button>
          </div>
        ) : (
          active ? (
              <AppPage
                key={active.id}
                app={active}
                sheet={sheets.get(active.id) ?? ''}
                apps={apps}
                sheets={sheets}
                facets={facets}
                go={go}
                prev={pos > 0 ? order[pos - 1] : undefined}
                next={pos >= 0 && pos < order.length - 1 ? order[pos + 1] : undefined}
                editing={editing}
                onBack={() => go({ app: null })}
                onOpen={(id) => go({ app: id })}
                onChange={store.updateApp}
                onDelete={async (id) => {
                  if (await store.deleteApp(id)) go({ app: null });
                }}
              />
            ) : route.view === 'table' ? (
              <TableView key="table" apps={apps} facets={facets} sheets={sheets} editing={editing} onOpen={(id) => go({ app: id, view: 'home' })} onChange={store.updateApp} />
            ) : (
              <Home
                key="home"
                apps={apps}
                results={results}
                searched={searched}
                facets={facets}
                vocab={vocab}
                reasons={reasons}
                near={near}
                onAdd={openAdd}
                sheets={sheets}
                route={route}
                go={go}
                sort={sort}
                setSort={setSort}
                editing={editing}
                saveFacet={store.saveFacet}
                deleteFacet={store.deleteFacet}
              />
            )
        )}
      </main>

      <footer className="foot mono">
        <span>APPOFAPP · {apps.length} גיליונות</span>
        <span>עריכה פתוחה בכל מכשיר</span>
      </footer>

      <AddAppDialog
        key={addSeq}
        open={!!adding}
        onClose={() => setAdding(null)}
        apps={apps}
        facets={facets}
        prefill={adding ?? {}}
        onCreate={async (a) => {
          const ok = await store.addApp(a);
          if (ok) {
            setEditing(true);
            go({ app: a.id, view: 'home' });
          }
          return ok;
        }}
      />
      <BulkDialog open={bulk} onClose={() => setBulk(false)} apps={apps} facets={facets} onChange={store.updateApp} />
      <Toasts />
    </div>
  );
}
