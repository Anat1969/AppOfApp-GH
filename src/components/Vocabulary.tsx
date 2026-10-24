import type { Facet, FacetKind } from '../lib/types';
import { toast } from './Toasts';

interface Props {
  facets: Facet[];
  saveFacet: (f: Facet) => Promise<boolean>;
  deleteFacet: (f: Facet) => Promise<boolean>;
}

const KINDS: { kind: FacetKind; title: string }[] = [
  { kind: 'domain', title: 'תחומים' },
  { kind: 'context', title: 'הקשרים' },
];

/** Edit mode only: the controlled vocabulary and its search synonyms. */
export default function Vocabulary({ facets, saveFacet, deleteFacet }: Props) {
  const add = async (kind: FacetKind) => {
    const label = prompt(kind === 'domain' ? 'שם התחום החדש' : 'שם ההקשר החדש')?.trim();
    if (!label) return;
    const list = facets.filter((f) => f.kind === kind);
    if (await saveFacet({ kind, value: `f-${Date.now()}`, label, synonyms: [], position: list.length })) toast('נוסף למילון');
  };
  return (
    <section className="panel vocab">
      <header className="panel-head">
        <h3>מילון הסיווג</h3>
        <span className="dim">מילים נרדפות מרחיבות את החיפוש: מי שמחפש אחת מהן ימצא את כל האפליקציות בתחום.</span>
      </header>
      <div className="vocab-cols">
        {KINDS.map(({ kind, title }) => (
          <div key={kind}>
            <div className="mono label">{title}</div>
            <ul>
              {facets
                .filter((f) => f.kind === kind)
                .map((f) => (
                  <li key={f.value}>
                    <div>
                      <b>{f.label}</b>
                      <span className="dim syn">{f.synonyms.join(', ') || 'אין מילים נרדפות'}</span>
                    </div>
                    <span className="vocab-tools">
                      <button
                        className="link"
                        onClick={async () => {
                          const label = prompt('שם', f.label)?.trim();
                          if (label && label !== f.label) await saveFacet({ ...f, label });
                        }}
                      >
                        שם
                      </button>
                      <button
                        className="link"
                        onClick={async () => {
                          const v = prompt('מילים נרדפות, מופרדות בפסיק', f.synonyms.join(', '));
                          if (v != null) await saveFacet({ ...f, synonyms: v.split(/[,،]/).map((x) => x.trim()).filter(Boolean) });
                        }}
                      >
                        מילים נרדפות
                      </button>
                      <button
                        className="link"
                        onClick={async () => {
                          if (confirm(`למחוק את "${f.label}" מהמילון? האפליקציות לא יימחקו.`)) await deleteFacet(f);
                        }}
                      >
                        מחיקה
                      </button>
                    </span>
                  </li>
                ))}
            </ul>
            <button className="ghost" onClick={() => add(kind)}>
              {kind === 'domain' ? 'תחום חדש' : 'הקשר חדש'}
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
