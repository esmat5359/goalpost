import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { HashValue, Loading, Notice } from '../components/Bits';
import { reads } from '../lib/api';
import { attestationOf, attestationPayload, canonicalJson } from '../lib/attestation';
import { useAsync, useDocumentTitle } from '../lib/hooks';

type Check = { state: 'idle' } | { state: 'running' } | { state: 'match' } | { state: 'mismatch'; got: string } | { state: 'error'; message: string };

function Row({ state, title, children }: { state: 'ok' | 'bad' | 'wait' | 'info'; title: string; children: React.ReactNode }) {
  const mark = state === 'ok' ? '✓' : state === 'bad' ? '✕' : state === 'info' ? 'i' : '…';
  return (
    <li className={`vcheck vcheck--${state}`}>
      <span className="vcheck__mark" aria-hidden="true">
        {mark}
      </span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </li>
  );
}

export function VerifyPage() {
  useDocumentTitle('Verify an audit');
  const { auditId = '' } = useParams();
  const navigate = useNavigate();
  const [draft, setDraft] = useState(auditId);
  const [node, setNode] = useState<Check>({ state: 'idle' });

  const bundle = useAsync(async () => (auditId === '' ? null : await reads.audit(auditId)), [auditId], 0);
  const local = useAsync(
    async () => {
      const data = bundle.data;
      if (data === null || data.audit.state !== 'SETTLED') return null;
      const payload = attestationPayload(data.audit, data.pledge.commitment);
      return { digest: await attestationOf(data.audit, data.pledge.commitment), canonical: canonicalJson(payload) };
    },
    [bundle.data],
    0,
  );

  const askNode = async (): Promise<void> => {
    setNode({ state: 'running' });
    try {
      const got = await reads.recomputedAttestation(auditId);
      setNode(got === bundle.data?.audit.attestation ? { state: 'match' } : { state: 'mismatch', got });
    } catch (error) {
      setNode({ state: 'error', message: error instanceof Error ? error.message : String(error) });
    }
  };

  const audit = bundle.data?.audit;
  const stored = audit?.attestation ?? '';

  return (
    <>
      <p className="crumbs">
        <Link to="/">Ledger</Link> <span aria-hidden="true">›</span> Verify
      </p>
      <h1 className="display display--page">Check an audit without trusting anyone</h1>
      <p className="lede">
        Every settled audit carries an attestation: a SHA-256 over the pledge commitment, the report address, the period, the verdict and every
        excerpt the validators accepted. This page rebuilds that hash <strong>in your browser</strong> from the public record and compares it with
        the one stored on the contract.
      </p>

      <form
        className="form form--inline"
        style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-end', flexWrap: 'wrap' }}
        onSubmit={(event) => {
          event.preventDefault();
          const id = draft.trim().toUpperCase();
          if (id !== '') void navigate(`/verify/${id}`);
        }}
      >
        <label className="field" style={{ flex: '1 1 16rem' }}>
          <span className="field__label">Audit id</span>
          <input className="input" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="AUD-0001" autoComplete="off" spellCheck={false} />
        </label>
        <button type="submit" className="btn btn--primary">
          Verify
        </button>
      </form>

      {auditId === '' && <p className="muted">Enter the id shown on any audit page.</p>}
      {bundle.loading && bundle.data === null && auditId !== '' && <Loading />}
      {bundle.error && (
        <Notice tone="error" title="Could not read the audit">
          <p>{bundle.error}</p>
        </Notice>
      )}
      {auditId !== '' && !bundle.loading && !bundle.error && bundle.data === null && (
        <Notice tone="warn" title={`No audit with the id ${auditId}`}>
          <p>Ids look like AUD-0001.</p>
        </Notice>
      )}

      {audit && bundle.data && (
        <>
          <ul className="vchecks" aria-live="polite">
            <Row state={audit.state === 'SETTLED' ? 'ok' : 'bad'} title="The audit is settled">
              {audit.state === 'SETTLED' ? (
                <>
                  Verdict <code>{audit.verdict}</code> for {audit.period}. See the <Link to={`/audits/${audit.audit_id}`}>audit page</Link>.
                </>
              ) : (
                'This audit has not been evaluated yet, so it has no attestation to check.'
              )}
            </Row>

            {audit.state === 'SETTLED' && (
              <>
                <Row state={local.data === null ? 'wait' : local.data.digest === stored ? 'ok' : 'bad'} title="Recomputed here, in this browser">
                  {local.data === null ? (
                    'Computing…'
                  ) : local.data.digest === stored ? (
                    <>
                      The hash built from the public record is identical to the stored attestation: <HashValue value={stored} head={14} tail={10} />
                    </>
                  ) : (
                    <>
                      Different. This browser computed <code>{local.data.digest}</code> but the contract stores <code>{stored}</code>. Do not rely on
                      this audit.
                    </>
                  )}
                </Row>
                <Row state={node.state === 'match' ? 'ok' : node.state === 'mismatch' || node.state === 'error' ? 'bad' : 'wait'} title="Recomputed by the contract">
                  {node.state === 'idle' && (
                    <>
                      Optional second opinion from the node you are connected to.{' '}
                      <button type="button" className="btn btn--small" onClick={() => void askNode()}>
                        Ask the contract
                      </button>
                    </>
                  )}
                  {node.state === 'running' && 'Asking the contract…'}
                  {node.state === 'match' && 'The contract recomputes the same value.'}
                  {node.state === 'mismatch' && <>The contract answered <code>{node.got}</code>.</>}
                  {node.state === 'error' && node.message}
                </Row>
                <Row state="info" title="Anchored to a pledge">
                  The pledge commitment folded into the hash is <HashValue value={bundle.data.pledge.commitment} head={14} tail={10} /> (
                  <Link to={`/pledges/${audit.pledge_id}`}>{audit.pledge_id}</Link>).
                </Row>
              </>
            )}
          </ul>

          {local.data && (
            <section className="section" aria-labelledby="payload-title">
              <div className="section__head">
                <h2 id="payload-title">What was hashed</h2>
                <span className="muted">Canonical JSON: sorted keys, no spaces, ASCII only</span>
              </div>
              <pre className="payload" tabIndex={0}>
                {local.data.canonical}
              </pre>
              <p className="muted">
                Paste this text into any SHA-256 tool, with no trailing newline, and you should get the stored attestation without the <code>0x</code>{' '}
                prefix.
              </p>
            </section>
          )}
        </>
      )}
    </>
  );
}
