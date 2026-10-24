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

interface Props {
  text?: string;
  className?: string;
  /** The first sentence becomes an insight line, larger than the rest. */
  lead?: boolean;
  /** Keywords and concepts to emphasize when the text has no ** markers of its own. */
  terms?: string[];
}

/**
 * **marked** words become a highlighter mark. Without markers, the app's own keywords and concepts that
 * appear in the text are emphasized (up to three). Each sentence or clause sits on its own line.
 */
export default function RichText({ text, className = '', lead, terms = [] }: Props) {
  if (!text) return null;
  const marked = /\*\*[^*]+\*\*/.test(text);
  let budget = 3;
  const segments = text
    .split(/(?<=[.,،])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className={`rich ${lead ? 'has-lead' : ''} ${className}`}>
      {segments.map((seg, i) => (
        <p key={i} className={lead && i === 0 ? 'lead-line' : undefined}>
          {seg.split(/(\*\*[^*]+\*\*)/g).map((part, j) => {
            if (part.startsWith('**') && part.endsWith('**')) return <mark key={j} className="hl">{part.slice(2, -2)}</mark>;
            if (marked || budget <= 0 || !terms.length) return <Fragment key={j}>{part}</Fragment>;
            const nodes = autoMark(part, terms, budget);
            budget -= nodes.filter((n) => typeof n === 'object').length;
            return <Fragment key={j}>{nodes}</Fragment>;
          })}
        </p>
      ))}
    </div>
  );
}
