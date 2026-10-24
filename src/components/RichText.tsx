import { Fragment } from 'react';

/** **bold** markers become strong; each sentence or clause sits on its own line. */
export default function RichText({ text, className = '' }: { text?: string; className?: string }) {
  if (!text) return null;
  const segments = text
    .split(/(?<=[.,،])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  return (
    <div className={`rich ${className}`}>
      {segments.map((seg, i) => (
        <p key={i}>
          {seg.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith('**') && part.endsWith('**') ? <strong key={j}>{part.slice(2, -2)}</strong> : <Fragment key={j}>{part}</Fragment>,
          )}
        </p>
      ))}
    </div>
  );
}
