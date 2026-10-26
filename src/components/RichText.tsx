import { Fragment, type ReactNode } from 'react';

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Words the app is known by, found in the text: up to `max`, longest first, with Hebrew prefixes allowed. */
function autoMark(text: string, terms: string[], max: number): ReactNode[] {
  const list = [...new Set(terms.map((t) => t.trim()).filter((t) => t.length >= 3 && !/^[a-z]/i.test(t)))].sort((a, b) => b.length - a.length);
  if (!list.length) return [text];
  const re = new RegExp(`((?:^|[\\s,.;:()"'״])[הובלמשכ]{0,2})(${list.map(escape).join('|')})(?=$|[\\s,.;:()"'״])`, 'g');
  const out: ReactNode[] = [];
  const used = new Set<string>();
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) && used.size < max) {
    const word = m[2];
    if (used.has(word)) continue;
    used.add(word);
    const start = m.index + m[1].length;
    out.push(text.slice(last, start), <mark key={start} className="hl auto">{word}</mark>);
    last = start + word.length;
  }
  out.push(text.slice(last));
  return out;
}

export type Tone = 'desc' | 'problem' | 'solution';

/** The insight line of a text, without markers: for cards and summaries. */
export function insightOf(text?: string): string {
  const first = (text ?? '').split(/(?<=[.])\s+|\n/)[0] ?? '';
  return first.replace(/\*\*/g, '').trim();
}

/** Numbers and percentages become a small figure, so parameters stand out from the prose. */
function figures(text: string, key: string | number): ReactNode[] {
  return text.split(/(\d[\d,.]*%?)/g).map((t, i) => (/^\d/.test(t) ? <span key={`${key}-${i}`} className="num">{t}</span> : t));
}

interface Props {
  text?: string;
  className?: string;
  /** Reading colour: desc is a yellow marker, problem red, solution green. */
  tone?: Tone;
  /** The first sentence becomes an insight line, larger than the rest. */
  lead?: boolean;
  /** Keywords and concepts to emphasize when the text has no ** markers of its own. */
  terms?: string[];
}

/**
 * **marked** words become a highlighter mark. Without markers, the app's own keywords and concepts that
 * appear in the text are emphasized (up to three). Each sentence or clause sits on its own line.
 */
export default function RichText({ text, className = '', lead, terms = [], tone = 'desc' }: Props) {
  if (!text) return null;
  const marked = /\*\*[^*]+\*\*/.test(text);
  let budget = 3;
  // A text written as a list (lines that start with "-" or "1.") keeps its numbering.
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const listed = lines.length > 1 && lines.slice(1).every((l) => /^(-|\d+[.)])\s/.test(l));
  const segments = (listed ? lines[0] : text)
    .split(/(?<=[.,،])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const inline = (seg: string, k: number) => {
    // "label: rest" puts a short heading at the start of the line
    const m = seg.match(/^([^:*]{2,26}):\s+(.*)$/);
    const body = m ? m[2] : seg;
    return (
      <>
        {m && <b className="lbl">{m[1]}</b>}
        {body.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
          if (part.startsWith('**') && part.endsWith('**')) return <mark key={j} className="hl">{part.slice(2, -2)}</mark>;
          if (marked || budget <= 0 || !terms.length) return <Fragment key={j}>{figures(part, `${k}-${j}`)}</Fragment>;
          const nodes = autoMark(part, terms, budget);
          budget -= nodes.filter((n) => typeof n === 'object').length;
          return <Fragment key={j}>{nodes.map((n, x) => (typeof n === 'string' ? <Fragment key={x}>{figures(n, `${k}-${j}-${x}`)}</Fragment> : n))}</Fragment>;
        })}
      </>
    );
  };

  return (
    <div className={`rich tone-${tone} ${lead ? 'has-lead' : ''} ${className}`}>
      {segments.map((seg, i) => (
        <p key={i} className={lead && i === 0 ? 'lead-line' : undefined}>
          {inline(seg, i)}
        </p>
      ))}
      {listed && (
        <ol className="steps">
          {lines.slice(1).map((l, i) => (
            <li key={i}>{inline(l.replace(/^(-|\d+[.)])\s+/, ''), 100 + i)}</li>
          ))}
        </ol>
      )}
    </div>
  );
}
