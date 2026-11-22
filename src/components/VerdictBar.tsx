import { VERDICT_LABEL } from '../lib/format';
import type { Verdict } from '../lib/types';

const ORDER: Array<{ verdict: Verdict; tone: string }> = [
  { verdict: 'KEPT', tone: 'held' },
  { verdict: 'MOVED_DISCLOSED', tone: 'revised' },
  { verdict: 'INCOMPLETE', tone: 'partial' },
  { verdict: 'MOVED_SILENTLY', tone: 'moved' },
  { verdict: 'INCONCLUSIVE', tone: 'neutral' },
];

/** Settled audits as one stacked bar. Colour is never the only carrier: every segment has a label and a count. */
export function VerdictBar({ counts, legend = false }: { counts: Partial<Record<Verdict, number>>; legend?: boolean }) {
  const total = ORDER.reduce((sum, entry) => sum + (counts[entry.verdict] ?? 0), 0);
  const summary =
    total === 0
      ? 'No settled audits yet'
      : ORDER.filter((entry) => (counts[entry.verdict] ?? 0) > 0)
          .map((entry) => `${counts[entry.verdict]} ${VERDICT_LABEL[entry.verdict]}`)
          .join(', ');
  return (
    <div className="vbar">
      <div className="vbar__track" role="img" aria-label={summary} title={summary}>
        {total === 0 ? (
          <span className="vbar__empty" />
        ) : (
          ORDER.map((entry) => {
            const count = counts[entry.verdict] ?? 0;
            return count > 0 ? <span key={entry.verdict} className={`vbar__seg vbar__seg--${entry.tone}`} style={{ flexGrow: count }} /> : null;
          })
        )}
      </div>
      {legend && (
        <ul className="vbar__legend">
          {ORDER.map((entry) => (
            <li key={entry.verdict}>
              <span className={`vbar__dot vbar__seg--${entry.tone}`} aria-hidden="true" />
              {VERDICT_LABEL[entry.verdict]} <strong>{counts[entry.verdict] ?? 0}</strong>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
