import { Fragment, type ReactNode } from 'react';
/** **bold** and ==marker==, numbers in mono. The portfolio's reading layer. */
export function Rich({ text }: { text: string }) {
  const out: ReactNode[] = [];
  text.split(/(\*\*.+?\*\*|==.+?==)/g).forEach((p, i) => {
    if (p.startsWith('**')) out.push(<strong key={i}>{p.slice(2, -2)}</strong>);
    else if (p.startsWith('==')) out.push(<mark key={i} className="insight">{p.slice(2, -2)}</mark>);
    else out.push(<Fragment key={i}>{p}</Fragment>);
  });
  return <>{out}</>;
}
export const plain = (s: string) => s.replace(/\*\*|==/g, '');
