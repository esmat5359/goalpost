import { Link, useParams } from 'react-router-dom';

import { Loading, Notice } from '../components/Bits';
import { reads } from '../lib/api';
import { DIMENSION_LABEL, STATUS_LABEL, STATUS_TONE, VERDICT_LABEL } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import type { ElementStatus } from '../lib/types';

const GLYPH: Record<ElementStatus, string> = {
  KEPT: '✓',
  MOVED_DISCLOSED: '↻',
  MOVED_SILENT: '▲',
  NOT_ADDRESSED: '◐',
  UNSUPPORTED: '?',
};

function Cell({ status, index, first, dim }: { status: ElementStatus | ''; index: number; first?: boolean; dim?: boolean }) {
  const style = { '--i': index } as React.CSSProperties;
  if (status === '') {
    return <span className="dcell dcell--empty" style={style} role="img" aria-label="Not recorded" />;
  }
  const label = STATUS_LABEL[status] + (first ? ', first found here' : '');
  return (
    <span
      className={`dcell dcell--${STATUS_TONE[status]}${first ? ' dcell--first' : ''}${dim ? ' dcell--dim' : ''}`}
      style={style}
      role="img"
      aria-label={label}
      title={label}
    >
      {GLYPH[status]}
    </span>
  );
}

export function DriftPage() {
  const { pledgeId = '' } = useParams();
  useDocumentTitle(`Drift of ${pledgeId}`);
  const drift = useAsync(() => reads.drift(pledgeId), [pledgeId], 60000);
  const pledge = useAsync(() => reads.pledge(pledgeId), [pledgeId], 0);

  if ((drift.loading && drift.data === null) || (pledge.loading && pledge.data === null)) return <Loading />;
  if (drift.error && drift.data === null) {
    return (
      <Notice tone="error" title="Could not load the drift table">
        <p>{drift.error}</p>
        <button type="button" className="btn btn--small" onClick={drift.reload}>
          Try again
        </button>
      </Notice>
    );
  }
  if (drift.data === null) {
    return (
      <div className="empty">
        <h3>No pledge with the id {pledgeId}.</h3>
        <Link className="btn" to="/">
          Back to the ledger
        </Link>
      </div>
    );
  }

  const { rows, elements, current, first_silent: firstSilent, ever_moved: everMoved } = drift.data;
  const title = pledge.data?.pledge.title ?? pledgeId;

  return (
    <>
      <p className="crumbs">
        <Link to="/">Ledger</Link> <span aria-hidden="true">›</span> <Link to={`/pledges/${pledgeId}`}>{pledgeId}</Link> <span aria-hidden="true">›</span> Drift
      </p>
      <h1 className="display display--page">How the definition drifted</h1>
      <p className="lede">
        {title}. One column per audit, oldest first; one row per frozen element. A dot marks the audit that first found an element moved
        silently.
      </p>

      {rows.length === 0 ? (
        <div className="empty">
          <h3>Nothing to compare yet.</h3>
          <p>The table fills in as audits settle. Submit a report to the pledge to start it.</p>
          <Link className="btn" to={`/pledges/${pledgeId}`}>
            Go to the pledge
          </Link>
        </div>
      ) : (
        <>
          <div className="drift">
            <table className="drift__table">
              <caption className="sr-only">Status of each frozen element in each audited report</caption>
              <thead>
                <tr>
                  <th scope="col">Element</th>
                  {rows.map((row) => (
                    <th key={row.audit_id} scope="col">
                      <Link to={`/audits/${row.audit_id}`} title={VERDICT_LABEL[row.verdict]}>
                        <span>{row.period}</span>
                        <small>{row.audit_id}</small>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {elements.map((element, rowIndex) => (
                  <tr key={element.key}>
                    <th scope="row">
                      <strong>{element.key}</strong>
                      {DIMENSION_LABEL[element.dimension]}
                    </th>
                    {rows.map((row, columnIndex) => (
                      <td key={row.audit_id}>
                        <Cell
                          status={row.statuses[element.key] ?? ''}
                          index={rowIndex + columnIndex}
                          first={firstSilent[element.key] === row.audit_id}
                          dim={row.verdict === 'INCONCLUSIVE'}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="legend" aria-label="Legend">
            {(Object.keys(GLYPH) as ElementStatus[]).map((status) => (
              <li key={status}>
                <span className={`dcell dcell--${STATUS_TONE[status]}`} aria-hidden="true">
                  {GLYPH[status]}
                </span>
                {STATUS_LABEL[status]}
              </li>
            ))}
            <li>
              <span className="dcell dcell--empty" aria-hidden="true" /> Not recorded
            </li>
          </ul>

          <section className="section" aria-labelledby="current-title">
            <div className="section__head">
              <h2 id="current-title">Where each element stands now</h2>
              <span className="muted">From the latest audit that reached a verdict</span>
            </div>
            {Object.keys(current).length === 0 ? (
              <p className="muted">No audit has reached a verdict yet.</p>
            ) : (
              <div className="currentgrid">
                {elements.map((element) => {
                  const status = current[element.key] ?? '';
                  return (
                    <div key={element.key}>
                      <code>{element.key}</code>
                      <span>{status === '' ? 'Not recorded' : STATUS_LABEL[status]}</span>
                      <span className="muted">
                        {firstSilent[element.key]
                          ? `First moved silently in ${firstSilent[element.key]}`
                          : everMoved.includes(element.key)
                            ? 'Changed, with disclosure'
                            : 'Never moved'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </>
  );
}
