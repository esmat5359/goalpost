// Pure helpers for the live end-to-end suite (scripts/e2e-suite.mjs). Nothing here touches the
// network, so the checks themselves can be tested offline against real contract output
// (tests/test_suite_lib.py does exactly that, and also proves each check can fail).

import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const SETTLED = 'SETTLED';
const MOVED = new Set(['MOVED_SILENT', 'MOVED_DISCLOSED']);

/** JSON with object keys sorted, so two records compare equal whatever order their keys arrived in. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'undefined';
}

/** Whole-record comparison that reports each difference as one readable line. */
function expectEqual(problems, label, actual, expected) {
  if (stable(actual) !== stable(expected)) {
    problems.push(`${label}: expected ${stable(expected)}, the contract reports ${stable(actual)}`);
  }
}

/**
 * The publisher ledger must be the exact sum of the pledges and audits recorded under that scope.
 * `bundles` is every get_pledge_bundle result whose pledge belongs to the publisher.
 */
export function checkPublisherConsistency(publisher, bundles) {
  const problems = [];
  const pledges = bundles.map((bundle) => bundle.pledge);
  const verdicts = { KEPT: 0, MOVED_DISCLOSED: 0, INCOMPLETE: 0, MOVED_SILENTLY: 0, INCONCLUSIVE: 0 };
  let settled = 0;
  for (const bundle of bundles) {
    for (const audit of bundle.audits) {
      if (audit.state !== SETTLED) continue;
      settled += 1;
      verdicts[audit.verdict] = (verdicts[audit.verdict] ?? 0) + 1;
    }
  }
  expectEqual(problems, 'publisher.pledges', publisher.pledges, pledges.length);
  expectEqual(problems, 'publisher.active', publisher.active, pledges.filter((pledge) => pledge.status === 'ACTIVE').length);
  expectEqual(problems, 'publisher.retired', publisher.retired, pledges.filter((pledge) => pledge.status === 'RETIRED').length);
  expectEqual(problems, 'publisher.strikes', publisher.strikes, pledges.reduce((sum, pledge) => sum + Number(pledge.strikes), 0));
  expectEqual(problems, 'publisher.audits_settled', publisher.audits_settled, settled);
  expectEqual(problems, 'publisher.verdicts', publisher.verdicts, verdicts);
  expectEqual(
    problems,
    'publisher.edits_detected',
    publisher.edits_detected,
    pledges.reduce((sum, pledge) => sum + Number(pledge.integrity?.edits_detected ?? 0), 0),
  );
  return problems;
}

/** An independent computation of the drift table from full audit records. */
export function expectedDrift(pledge, audits) {
  const keys = pledge.elements.map((element) => element.key);
  const ordered = [...audits].sort((a, b) => Number(a.audit_id.slice(4)) - Number(b.audit_id.slice(4)));
  const rows = [];
  const firstSilent = {};
  const everMoved = new Set();
  let current = {};
  for (const audit of ordered) {
    if (audit.state !== SETTLED || audit.elements.length === 0) continue;
    const statuses = Object.fromEntries(audit.elements.map((item) => [item.key, item.status]));
    rows.push({
      audit_id: audit.audit_id,
      period: audit.period,
      verdict: audit.verdict,
      report_url: audit.report_url,
      evaluated_at: audit.evaluated_at,
      statuses: Object.fromEntries(keys.map((key) => [key, statuses[key] ?? ''])),
    });
    for (const key of keys) {
      const status = statuses[key] ?? '';
      if (status === 'MOVED_SILENT' && !(key in firstSilent)) firstSilent[key] = audit.audit_id;
      if (MOVED.has(status)) everMoved.add(key);
    }
    if (audit.verdict !== 'INCONCLUSIVE') current = Object.fromEntries(keys.map((key) => [key, statuses[key] ?? '']));
  }
  return {
    pledge_id: pledge.pledge_id,
    elements: pledge.elements.map((element) => ({ key: element.key, dimension: element.dimension })),
    rows,
    current,
    first_silent: firstSilent,
    ever_moved: [...everMoved].sort(),
  };
}

export function checkDriftConsistency(drift, pledge, audits) {
  const problems = [];
  const expected = expectedDrift(pledge, audits);
  for (const field of Object.keys(expected)) expectEqual(problems, `drift.${field}`, drift?.[field], expected[field]);
  return problems;
}

/** A silent verdict adds exactly one strike; every other verdict adds none. */
export function checkStrikeDelta(before, after, verdict) {
  const expected = before + (verdict === 'MOVED_SILENTLY' ? 1 : 0);
  return after === expected ? [] : [`strikes: expected ${expected} after a ${verdict} audit, found ${after}`];
}

/** The pledge's report index, kept by the contract for cheap duplicate checks, must mirror its audits. */
export function checkReportIndex(pledge, audits) {
  const problems = [];
  const index = pledge.reports ?? [];
  expectEqual(problems, 'report index ids', index.map((entry) => entry[0]), audits.map((audit) => audit.audit_id));
  for (const entry of index) {
    const audit = audits.find((candidate) => candidate.audit_id === entry[0]);
    if (!audit) continue;
    expectEqual(problems, `report index state of ${entry[0]}`, entry[2], audit.state);
    expectEqual(problems, `report index verdict of ${entry[0]}`, entry[3], audit.verdict);
  }
  return problems;
}

/** Lower-case, whitespace-collapsed text, to find an excerpt in a fetched page without parsing it. */
export function looseText(html) {
  return html
    .replace(/<(script|style|noscript|template)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function excerptIsTraceable(excerpt, pageHtml) {
  const needle = looseText(excerpt);
  return needle === '' || looseText(pageHtml).includes(needle);
}

// -------------------------------------------------------------------------- report

export class Recorder {
  constructor() {
    this.steps = [];
    this.transactions = [];
  }
  /** kind: hard (a broken invariant fails the run), soft (depends on live validators and models), info. */
  add(kind, name, ok, detail = '') {
    const status = ok === null ? 'SKIP' : ok ? 'PASS' : kind === 'hard' ? 'FAIL' : 'DIFF';
    this.steps.push({ kind, name, status, detail });
    return ok;
  }
  tx(label, hash, statusName, execution, finality) {
    this.transactions.push({ label, hash, statusName, execution, finality });
  }
  get failures() {
    return this.steps.filter((step) => step.status === 'FAIL');
  }
  get diffs() {
    return this.steps.filter((step) => step.status === 'DIFF');
  }
}

const cell = (text) => String(text ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

export function renderSuiteReport({ contract, version, site, signer, startedAt, finishedAt, recorder, explorer, notes = [] }) {
  const out = [];
  const hard = recorder.steps.filter((step) => step.kind === 'hard');
  const passed = hard.filter((step) => step.status === 'PASS').length;
  out.push('# Goalpost live end-to-end report', '');
  out.push(`- Result: **${recorder.failures.length === 0 ? 'PASSED' : 'FAILED'}** (${passed} of ${hard.length} invariant checks passed, ${recorder.diffs.length} live expectation differences)`);
  out.push(`- Contract: \`${contract}\` (version ${version})`);
  out.push(`- Evidence served from: ${site}`);
  out.push(`- Signer: \`${signer}\``);
  out.push(`- Started (UTC): ${startedAt}`, `- Finished (UTC): ${finishedAt}`, '');
  out.push('Invariant checks must always hold. Live expectations depend on real validators and real models, so a difference is recorded, not treated as a failure.', '');
  out.push('## Checks', '', '| Result | Kind | Check | Detail |', '|---|---|---|---|');
  for (const step of recorder.steps) out.push(`| ${step.status} | ${step.kind} | ${cell(step.name)} | ${cell(step.detail)} |`);
  out.push('');
  if (recorder.transactions.length > 0) {
    out.push('## Transactions', '', '| Transaction | Hash | Decision | Execution | Finality |', '|---|---|---|---|---|');
    for (const item of recorder.transactions) {
      out.push(`| ${cell(item.label)} | [\`${item.hash.slice(0, 12)}...\`](${explorer(item.hash)}) | ${item.statusName} | ${item.execution} | ${item.finality ?? 'not final'} |`);
    }
    out.push('');
  }
  if (notes.length > 0) out.push('## Notes', '', ...notes.map((note) => `- ${note}`), '');
  return out.join('\n');
}

// -------------------------------------------------------------------------- static server

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.json': 'application/json' };
const FLAPPING = ['2026-faithful', '2026-silent', '2026-disclosed'];

/**
 * Serve a built site (dist/) the way Cloudflare Pages does for the evidence pages, including the
 * adversarial /evidence/flapping/reports/* function that answers with a different document on every request.
 */
export function startEvidenceServer(root, port, host = '0.0.0.0') {
  const server = createServer((request, response) => {
    const pathname = decodeURIComponent((request.url ?? '/').split('?')[0]);
    let file = path.join(root, pathname);
    if (pathname.startsWith('/evidence/flapping/reports/')) {
      file = path.join(root, 'evidence', 'meridian', 'reports', `${FLAPPING[Math.floor(Math.random() * FLAPPING.length)]}.html`);
    } else if (pathname.endsWith('/') && existsSync(path.join(file, 'index.html'))) {
      file = path.join(file, 'index.html');
    }
    if (!file.startsWith(root) || !existsSync(file) || statSync(file).isDirectory()) {
      response.writeHead(404, { 'content-type': 'text/plain' });
      response.end('not found');
      return;
    }
    response.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'text/plain', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' });
    response.end(readFileSync(file));
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve(server));
  });
}
