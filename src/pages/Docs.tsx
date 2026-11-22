import { Link } from 'react-router-dom';

import { reads } from '../lib/api';
import { IS_CONFIGURED, GITHUB_URL } from '../lib/config';
import { FLAG_EXPLANATION, STATUS_LABEL, VERDICT_EXPLANATION, VERDICT_LABEL } from '../lib/format';
import { useAsync, useDocumentTitle } from '../lib/hooks';
import { DEFAULT_LIMITS } from '../lib/validate';
import type { ElementStatus, Verdict } from '../lib/types';

interface Method {
  name: string;
  write: boolean;
  args: string;
  returns: string;
  what: string;
}

const METHODS: Method[] = [
  { name: 'register_pledge', write: true, args: 'title, kind, pledge_url, report_prefix, elements_json', returns: 'pledge id', what: 'Freeze a pledge. Validators fetch the page, check every quote verbatim, and check that the page itself declares the reporting prefix.' },
  { name: 'submit_report', write: true, args: 'pledge_id, report_url, period', returns: 'audit id', what: 'Queue a report under the frozen prefix. Anyone may call it. Spelling variants of one report count as one.' },
  { name: 'evaluate_report', write: true, args: 'audit_id', returns: 'verdict', what: 'Validators fetch the report, a model classifies each element, and the contract accepts only claims it can check against the text.' },
  { name: 'check_pledge_integrity', write: true, args: 'pledge_id', returns: 'integrity state', what: 'Re-fetch the pledge page and log whether the frozen quotes and the prefix declaration are still there.' },
  { name: 'retire_pledge', write: true, args: 'pledge_id', returns: 'status', what: 'Owner only. Marks the pledge retired. History and strikes stay.' },
  { name: 'contract_info', write: false, args: '', returns: 'JSON', what: 'Version, enumerations, publisher tables, features and every limit.' },
  { name: 'stats', write: false, args: '', returns: 'JSON', what: 'Totals: pledges, audits, settled, silent moves, edits detected, publishers.' },
  { name: 'list_pledges', write: false, args: 'offset, limit', returns: 'JSON', what: 'Pledge summaries, newest first.' },
  { name: 'get_pledge_bundle', write: false, args: 'pledge_id', returns: 'JSON or null', what: 'The full pledge record with its audit summaries.' },
  { name: 'get_audit_bundle', write: false, args: 'audit_id', returns: 'JSON or null', what: 'The audit with the pledge it belongs to.' },
  { name: 'list_publishers', write: false, args: 'offset, limit, sort', returns: 'JSON', what: 'Publisher records. sort is recent, strikes or pledges. Ranks the newest 500 scopes.' },
  { name: 'get_publisher', write: false, args: 'scope', returns: 'JSON or null', what: 'One publisher record with its newest pledges.' },
  { name: 'search_pledges', write: false, args: 'query, limit', returns: 'JSON', what: 'Case-insensitive match on title, id, address, scope and registrant, over the newest 500 pledges.' },
  { name: 'get_drift', write: false, args: 'pledge_id', returns: 'JSON or null', what: 'Period-by-element status table, the first silent move of each element, and the current status.' },
  { name: 'standing_of', write: false, args: 'pledge_id', returns: 'standing', what: 'UNAUDITED, HELD, REVISED, PARTIAL or MOVED.' },
  { name: 'strikes_of', write: false, args: 'pledge_id', returns: 'number', what: 'Permanent silent-move strikes. It never decreases.' },
  { name: 'recompute_attestation', write: false, args: 'audit_id', returns: 'hash', what: 'The attestation recomputed from stored state. Compare it with the stored one, or recompute it yourself on the verify page.' },
];

const SECTIONS = [
  ['start', 'Start here'],
  ['verdicts', 'Verdicts and statuses'],
  ['rules', 'What the contract refuses'],
  ['api', 'Contract reference'],
  ['limits', 'Limits'],
  ['verify', 'Verifying a result'],
  ['more', 'More documentation'],
] as const;

export function DocsPage() {
  useDocumentTitle('Documentation');
  const info = useAsync(async () => (IS_CONFIGURED ? await reads.info() : null), [], 0);
  const limits = info.data?.limits ?? DEFAULT_LIMITS;

  return (
    <>
      <h1 className="display display--page">Documentation</h1>
      <p className="lede">Everything the contract promises, and everything it refuses, in one place. The source is the final word.</p>
      <div className="docs">
        <nav className="docs__toc" aria-label="On this page">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#${id}`}>
              {label}
            </a>
          ))}
        </nav>

        <div>
          <section id="start">
            <h2>Start here</h2>
            <ol className="prose">
              <li>
                <strong>Register.</strong> Quote the sentences that define a public commitment, exactly as they appear on its page. The page must
                also declare where its reports will be published.
              </li>
              <li>
                <strong>Submit.</strong> Anyone can submit a report that lives under that prefix.
              </li>
              <li>
                <strong>Evaluate.</strong> Validators read the report themselves. A claim of change needs an excerpt that is really in the report and
                really about the commitment.
              </li>
              <li>
                <strong>Read the result.</strong> The <Link to="/publishers">publisher ledger</Link> adds up verdicts per publisher; the drift table on each
                pledge shows how every element moved over time; the <Link to="/verify">verifier</Link> proves a result without trusting anyone.
              </li>
            </ol>
          </section>

          <section id="verdicts">
            <h2>Verdicts and statuses</h2>
            <div className="tablewrap">
              <table className="apitable">
                <thead>
                  <tr>
                    <th>Verdict</th>
                    <th>Meaning</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(VERDICT_LABEL) as Verdict[]).map((verdict) => (
                    <tr key={verdict}>
                      <td>
                        <code>{verdict}</code>
                        <br />
                        {VERDICT_LABEL[verdict]}
                      </td>
                      <td>{VERDICT_EXPLANATION[verdict]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              Per element: {(Object.keys(STATUS_LABEL) as ElementStatus[]).map((status) => `${status} (${STATUS_LABEL[status].toLowerCase()})`).join(', ')}.
            </p>
          </section>

          <section id="rules">
            <h2>What the contract refuses</h2>
            <p>These checks run on the validators&rsquo; own copy of the report, so a model cannot talk its way past them.</p>
            <div className="tablewrap">
              <table className="apitable">
                <thead>
                  <tr>
                    <th>Flag</th>
                    <th>Why a claim was thrown out</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(FLAG_EXPLANATION).map(([flag, text]) => (
                    <tr key={flag}>
                      <td>
                        <code>{flag}</code>
                      </td>
                      <td>{text}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted">
              Text fields refuse control characters, zero-width spaces and direction overrides, so a title or quote cannot show differently from what
              is stored. Joiners and the left-to-right and right-to-left marks stay allowed because Persian, Arabic and Hindi need them. URLs must be
              plain ASCII.
            </p>
          </section>

          <section id="api">
            <h2>Contract reference</h2>
            <div className="tablewrap">
              <table className="apitable">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Arguments</th>
                    <th>Returns</th>
                    <th>What it does</th>
                  </tr>
                </thead>
                <tbody>
                  {METHODS.map((method) => (
                    <tr key={method.name}>
                      <td>
                        <code>{method.name}</code>
                        <br />
                        <span className={`tag${method.write ? ' tag--write' : ''}`}>{method.write ? 'write' : 'view'}</span>
                      </td>
                      <td>
                        <code>{method.args || 'none'}</code>
                      </td>
                      <td>{method.returns}</td>
                      <td>{method.what}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="limits">
            <h2>Limits</h2>
            <p className="muted">{info.data ? `Read from contract version ${info.data.version}.` : 'Defaults shown; the live values load when a contract is configured.'}</p>
            <div className="tablewrap">
              <table className="apitable">
                <tbody>
                  {Object.entries(limits).map(([name, value]) => (
                    <tr key={name}>
                      <td>
                        <code>{name}</code>
                      </td>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section id="verify">
            <h2>Verifying a result</h2>
            <p>
              The <Link to="/verify">verifier</Link> rebuilds the attestation in your browser from the public record. For a stricter check, read the
              audit with any GenLayer client, serialise the payload as JSON with sorted keys, compact separators and ASCII escapes, and hash it with
              SHA-256. The repository ships the same routine in Python and in TypeScript, and a test compares them with the contract on every run.
            </p>
          </section>

          <section id="more">
            <h2>More documentation</h2>
            <ul className="prose">
              <li>
                <a href={`${GITHUB_URL}/blob/main/docs/architecture.md`}>Architecture</a>: how the contract, the validators and the client fit together.
              </li>
              <li>
                <a href={`${GITHUB_URL}/blob/main/docs/api.md`}>Contract API</a>, <a href={`${GITHUB_URL}/blob/main/docs/testing.md`}>testing guide</a>,{' '}
                <a href={`${GITHUB_URL}/blob/main/docs/e2e.md`}>live end-to-end runs</a> and the{' '}
                <a href={`${GITHUB_URL}/blob/main/CHANGELOG.md`}>changelog</a>.
              </li>
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
