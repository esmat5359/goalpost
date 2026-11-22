import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Loading, Notice } from '../components/Bits';
import { TiltCard } from '../components/TiltCard';
import { VerdictBar } from '../components/VerdictBar';
import { reads } from '../lib/api';
import { IS_CONFIGURED } from '../lib/config';
import { formatDate, plural } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import type { PublisherPage, PublisherSort, PublisherSummary } from '../lib/types';

const PAGE_SIZE = 12;
const SORTS: Array<{ id: PublisherSort; label: string }> = [
  { id: 'strikes', label: 'Most silent moves' },
  { id: 'pledges', label: 'Most pledges' },
  { id: 'recent', label: 'Newest' },
];

export function publisherHref(scope: string): string {
  return `/publishers/${scope.split('/').map(encodeURIComponent).join('/')}`;
}

/** Share of conclusive audits that found a silent move, as a whole percentage. */
export function silentShare(record: PublisherSummary): number {
  const conclusive = record.audits_settled - (record.verdicts.INCONCLUSIVE ?? 0);
  return conclusive <= 0 ? 0 : Math.round((record.verdicts.MOVED_SILENTLY / conclusive) * 100);
}

export function PublishersPage() {
  useDocumentTitle('Publishers');
  const [sort, setSort] = useState<PublisherSort>('strikes');
  const [offset, setOffset] = useState(0);
  const list = useAsync(async (): Promise<PublisherPage | null> => (IS_CONFIGURED ? await reads.publishers(offset, PAGE_SIZE, sort) : null), [offset, sort], 45000);
  const items = list.data?.items ?? [];
  const total = list.data?.total ?? 0;

  return (
    <>
      <p className="crumbs">
        <Link to="/">Ledger</Link> <span aria-hidden="true">›</span> Publishers
      </p>
      <h1 className="display display--page">Who keeps their promises&rsquo; meaning?</h1>
      <p className="lede">
        Every pledge is bound to the publisher that wrote it: a host, or a namespace on a shared host such as <code>github.com/acme</code>. This
        page adds up what the validators found across all of a publisher&rsquo;s pledges. A silent move is a permanent strike; a disclosed change
        is not.
      </p>

      <div className="row" style={{ justifyContent: 'space-between', margin: '1.25rem 0 0.25rem' }}>
        <div className="tabs" role="group" aria-label="Sort publishers">
          {SORTS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              aria-pressed={sort === entry.id}
              onClick={() => {
                setSort(entry.id);
                setOffset(0);
              }}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {list.data && <span className="muted">{plural(total, 'publisher')}</span>}
      </div>

      {list.error && (
        <Notice tone="error" title="Could not load the publishers">
          <p>{list.error}</p>
          <button type="button" className="btn btn--small" onClick={list.reload}>
            Try again
          </button>
        </Notice>
      )}
      {list.loading && list.data === null && IS_CONFIGURED && <Loading />}
      {IS_CONFIGURED && !list.loading && !list.error && items.length === 0 && (
        <div className="empty">
          <h3>No publisher has been recorded yet.</h3>
          <p>A publisher appears here as soon as the first pledge is registered on its pages.</p>
          <Link className="btn btn--primary" to="/new">
            Register a pledge
          </Link>
        </div>
      )}

      <div className="pubgrid">
        {items.map((record) => (
          <TiltCard key={record.scope}>
            <article className="pubcard">
              <h2 className="pubcard__scope">
                <Link to={publisherHref(record.scope)}>{record.scope}</Link>
              </h2>
              <dl className="pubcard__nums">
                <div>
                  <dt>Pledges</dt>
                  <dd>{record.pledges}</dd>
                </div>
                <div className={record.strikes > 0 ? 'is-moved' : ''}>
                  <dt>Strikes</dt>
                  <dd>{record.strikes}</dd>
                </div>
                <div>
                  <dt>Audits</dt>
                  <dd>{record.audits_settled}</dd>
                </div>
              </dl>
              <VerdictBar counts={record.verdicts} />
              <p className="pubcard__foot">
                <span>{record.strikes > 0 ? `${silentShare(record)}% of conclusive audits moved silently` : 'No silent move found'}</span>
                <span>since {formatDate(record.first_seen)}</span>
              </p>
            </article>
          </TiltCard>
        ))}
      </div>

      {total > PAGE_SIZE && (
        <div className="pager">
          <button type="button" className="btn btn--small" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
            ← Previous
          </button>
          <span className="muted">
            {offset + 1} to {Math.min(offset + PAGE_SIZE, total)} of {total}
          </span>
          <button type="button" className="btn btn--small" disabled={offset + PAGE_SIZE >= total} onClick={() => setOffset(offset + PAGE_SIZE)}>
            Next →
          </button>
        </div>
      )}
    </>
  );
}
