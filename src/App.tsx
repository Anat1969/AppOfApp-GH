import { useEffect, useMemo, useState } from 'react';
import Fuse from 'fuse.js';
import { useStore } from './lib/store';
import { useRoute } from './lib/route';
import { activityOf, createdOf, sheetNo, siteUrl } from './lib/format';
import TopBar from './components/TopBar';
import Home from './components/Home';
import AppPage from './components/AppPage';
import TableView from './components/TableView';
import AIMenu from './components/AIMenu';
import AddAppDialog from './components/AddAppDialog';
import BulkDialog from './components/BulkDialog';
import Toasts from './components/Toasts';

const SORT_KEY = 'aoa-sort';

export default function App() {
  const store = useStore();
  const { route, go } = useRoute();
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
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

  useEffect(() => {
    if (!store.isEditor) setEditing(false);
  }, [store.isEditor]);

  const { apps, categories } = store;

  // Sheet numbers follow creation order, so A-001 is the first app ever added.
  const sheets = useMemo(() => {
    const m = new Map<string, string>();
    [...apps].sort((a, b) => createdOf(a) - createdOf(b)).forEach((a, i) => m.set(a.id, sheetNo(i + 1)));
    return m;
  }, [apps]);

  const fuse = useMemo(
    () => new Fuse(apps, { keys: ['name', 'title', 'desc', 'problem', 'solution', 'purpose', 'tags'], threshold: 0.35, ignoreLocation: true, minMatchCharLength: 2 }),
    [apps],
  );

  const results = useMemo(() => {
    const q = route.q.trim();
    let list = q.length >= 2 ? fuse.search(q).map((r) => r.item) : [...apps];
    if (route.cat && !q) list = list.filter((a) => a.category === route.cat);
    if (route.links) list = list.filter((a) => !!siteUrl(a));
    if (!q) list.sort(sort === 'alpha' ? (a, b) => a.name.localeCompare(b.name, 'he') : (a, b) => activityOf(b) - activityOf(a));
    return list;
  }, [apps, fuse, route.q, route.cat, route.links, sort]);

  const active = route.app ? apps.find((a) => a.id === route.app) : undefined;
  const idx = active ? results.findIndex((a) => a.id === active.id) : -1;
  const order = idx >= 0 ? results : apps;
  const pos = active ? order.findIndex((a) => a.id === active.id) : -1;

  useEffect(() => {
    document.title = active ? `${active.name} · Apps` : 'Apps · תיק עבודות';
  }, [active]);

  return (
    <div className={`shell ${editing ? 'editing' : ''}`}>
      <TopBar
        route={route}
        apps={apps}
        categories={categories}
        onHome={() => go({ app: null, cat: null, q: '', view: 'home', links: false })}
        onSearch={(q) => go({ q, app: null, view: 'home' }, true)}
        onOpen={(id) => go({ app: id, view: 'home' })}
        onView={(view) => go({ view, app: null })}
        menu={
          <AIMenu
            isEditor={store.isEditor}
            editing={editing}
            saveState={store.saveState}
            setEditing={setEditing}
            onAdd={() => setAdding(true)}
            onBulk={() => setBulk(true)}
            onConnect={store.connect}
            onLeave={store.leaveEditor}
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
                categories={categories}
                prev={pos > 0 ? order[pos - 1] : undefined}
                next={pos >= 0 && pos < order.length - 1 ? order[pos + 1] : undefined}
                editing={editing}
                onBack={() => go({ app: null })}
                onOpen={(id) => go({ app: id })}
                onChange={store.updateApp}
                onDelete={async (id) => {
                  if (await store.deleteApp(id)) go({ app: null });
                }}
                onCategory={(cat) => go({ app: null, cat, q: '' })}
              />
            ) : route.view === 'table' ? (
              <TableView key="table" apps={apps} categories={categories} sheets={sheets} editing={editing} onOpen={(id) => go({ app: id, view: 'home' })} onChange={store.updateApp} />
            ) : (
              <Home
                key="home"
                apps={apps}
                results={results}
                categories={categories}
                sheets={sheets}
                route={route}
                go={go}
                sort={sort}
                setSort={setSort}
                editing={editing}
                saveCategory={store.saveCategory}
                deleteCategory={store.deleteCategory}
              />
            )
        )}
      </main>

      <footer className="foot mono">
        <span>APPOFAPP · {apps.length} גיליונות</span>
        <span>{store.isEditor ? 'מכשיר עריכה' : 'תצוגה ציבורית'}</span>
      </footer>

      <AddAppDialog
        open={adding}
        onClose={() => setAdding(false)}
        apps={apps}
        categories={categories}
        defaultCategory={route.cat}
        onCreate={async (a) => {
          const ok = await store.addApp(a);
          if (ok) {
            setEditing(true);
            go({ app: a.id, view: 'home' });
          }
          return ok;
        }}
      />
      <BulkDialog open={bulk} onClose={() => setBulk(false)} apps={apps} categories={categories} onChange={store.updateApp} />
      <Toasts />
    </div>
  );
}
