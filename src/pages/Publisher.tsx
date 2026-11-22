import { Link, useParams } from 'react-router-dom';

import { Loading, Notice } from '../components/Bits';
import { StandingChip, Strikes } from '../components/Chips';
import { VerdictBar } from '../components/VerdictBar';
import { reads } from '../lib/api';
import { KIND_LABEL, formatDate, formatDateTime, hostOf, plural } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { silentShare } from './Publishers';

export function PublisherPage() {
  const params = useParams();
  const scope = decodeURIComponent(params['*'] ?? '').replace(/\/+$/, '');
  useDocumentTitle(scope);
  const bundle = useAsync(() => reads.publisher(scope), [scope], 45000);

  if (bundle.loading && bundle.data === null) return <Loading />;
  if (bundle.error && bundle.data === null) {
    return (
      <Notice tone="error" title="Could not load this publisher">
        <p>{bundle.error}</p>
        <button type="button" className="btn btn--small" onClick={bundle.reload}>
          Try again
        </button>
      </Notice>
    );
  }
  if (bundle.data === null) {
    return (
      <>
        <p className="crumbs">
          <Link to="/publishers">Publishers</Link> <span aria-hidden="true">›</span> {scope}
        </p>
        <div className="empty">
          <h3>No pledge has been registered under {scope}.</h3>
          <p>Publisher scopes are lowercase hosts, or a host plus namespace such as github.com/acme.</p>
          <Link className="btn" to="/publishers">
            All publishers
          </Link>
        </div>
      </>
    );
  }

  const { publisher, pledges, pledge_count: pledgeCount } = bundle.data;
  const conclusive = publisher.audits_settled - (publisher.verdicts.INCONCLUSIVE ?? 0);

  return (
    <>
      <p className="crumbs">
        <Link to="/">Ledger</Link> <span aria-hidden="true">›</span> <Link to="/publishers">Publishers</Link> <span aria-hidden="true">›</span> {publisher.scope}
      </p>
      <h1 className="display display--page mono" style={{ wordBreak: 'break-all' }}>
        {publisher.scope}
      </h1>
      <p className="lede">
        {publisher.strikes === 0
          ? `No silent move has been found in ${plural(conclusive, 'conclusive audit')} of this publisher's pledges.`
          : `${silentShare(publisher)}% of the ${plural(conclusive, 'conclusive audit')} of this publisher's pledges found a commitment that changed without a disclosure.`}
      </p>

      <dl className="facts">
        <div>
          <dt>Pledges</dt>
          <dd>
            {publisher.pledges} ({publisher.active} active, {publisher.retired} retired)
          </dd>
        </div>
        <div>
          <dt>Silent moves (permanent strikes)</dt>
          <dd>{publisher.strikes}</dd>
        </div>
        <div>
          <dt>Page edits detected</dt>
          <dd>{publisher.edits_detected}</dd>
        </div>
        <div>
          <dt>First seen</dt>
          <dd>{formatDateTime(publisher.first_seen)}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{formatDateTime(publisher.last_activity)}</dd>
        </div>
      </dl>

      <section className="section" aria-labelledby="verdicts-title">
        <div className="section__head">
          <h2 id="verdicts-title">What the audits found</h2>
          <span className="muted">{plural(publisher.audits_settled, 'settled audit')}</span>
        </div>
        <VerdictBar counts={publisher.verdicts} legend />
      </section>

      <section className="section" aria-labelledby="pledges-title">
        <div className="section__head">
          <h2 id="pledges-title">Pledges</h2>
          {pledgeCount < publisher.pledges && <span className="muted">Showing the newest {pledgeCount}</span>}
        </div>
        <div className="ledger" role="table" aria-label="Pledges by this publisher">
          <div className="ledger__head" role="row">
            <span role="columnheader">Pledge</span>
            <span role="columnheader">Standing</span>
            <span role="columnheader">Silent moves</span>
            <span role="columnheader">Audits</span>
            <span role="columnheader">Registered</span>
          </div>
          {pledges.map((pledge) => (
            <Link key={pledge.pledge_id} className="ledger__row" to={`/pledges/${pledge.pledge_id}`} role="row">
              <span className="ledger__title" role="cell">
                <strong>{pledge.title}</strong>
                <span className="muted">
                  {pledge.pledge_id}, {KIND_LABEL[pledge.kind]}, {hostOf(pledge.pledge_url)}
                  {pledge.status === 'RETIRED' ? ', retired' : ''}
                </span>
              </span>
              <span role="cell">
                <StandingChip standing={pledge.standing} />
              </span>
              <span role="cell">
                <Strikes count={pledge.strikes} />
              </span>
              <span role="cell" className="muted">
                {plural(pledge.audits, 'audit')}
              </span>
              <span role="cell" className="muted">
                {formatDate(pledge.registered_at)}
              </span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
