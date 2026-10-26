import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import type { AppData } from '../lib/types';
import { activityOf, fmtDate, siteUrl, thumbOf } from '../lib/format';
import { actionOf } from '../lib/facets';
import { insightOf } from './RichText';
import { clean } from '../lib/format';

interface Props {
  app: AppData;
  sheet: string;
  category: string;
  onOpen: () => void;
  index?: number;
  compact?: boolean;
  why?: string;
}

/** A sheet in the portfolio: framed cover with a slight perspective tilt that follows the pointer. */
export default function AppCard({ app, sheet, category, onOpen, index = 0, compact, why }: Props) {
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const rx = useSpring(useTransform(my, [0, 1], [5, -5]), { stiffness: 200, damping: 20 });
  const ry = useSpring(useTransform(mx, [0, 1], [-7, 7]), { stiffness: 200, damping: 20 });
  const thumb = thumbOf(app);
  const site = siteUrl(app);
  const recent = Date.now() - activityOf(app) < 30 * 86_400_000;

  return (
    <motion.article
      className={`card ${compact ? 'compact' : ''}`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03, duration: 0.45, ease: [0.2, 0.7, 0.2, 1] }}
      layout="position"
    >
      <motion.button
        className="card-frame"
        style={{ rotateX: rx, rotateY: ry }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          mx.set((e.clientX - r.left) / r.width);
          my.set((e.clientY - r.top) / r.height);
        }}
        onPointerLeave={() => {
          mx.set(0.5);
          my.set(0.5);
        }}
        onClick={onOpen}
        aria-label={`דף האפליקציה ${app.name}`}
      >
        <span className="card-plate">
          {thumb ? <img src={thumb} alt="" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = 'hidden')} /> : <span className="card-initial">{app.name.slice(0, 1)}</span>}
        </span>
        <span className="card-sheet mono">{sheet}</span>
        {recent && <span className="card-new mono">חדש</span>}
      </motion.button>
      <div className="card-body">
        {actionOf(app.action) && <div className="card-action mono">{actionOf(app.action)!.short}</div>}
        <button className="card-name" onClick={onOpen}>
          {app.name}
        </button>
        {why && <div className="card-why">נמצא דרך: {why}</div>}
        {(clean(app.problem) || clean(app.solution)) && (
          <div className="card-read">
            {clean(app.problem) && <p className="cr-problem">{insightOf(app.problem)}</p>}
            {clean(app.solution) && <p className="cr-solution">{insightOf(app.solution)}</p>}
          </div>
        )}
        <div className="card-meta mono">
          <span>{category || 'ללא תחום'}</span>
          <span>{fmtDate(activityOf(app), true)}</span>
        </div>
        {site && !compact && (
          <a className="card-site" href={site} target="_blank" rel="noopener noreferrer">
            פתיחת האפליקציה
          </a>
        )}
      </div>
    </motion.article>
  );
}
