#!/usr/bin/env node
// Full live end-to-end suite for Goalpost on GenLayer Studionet. It is built to run in a GitHub
// Codespace (or any machine that can reach Studionet) and to leave behind a report you can commit.
//
//   npm run e2e:codespace                       serve /evidence from this machine and run everything
//   npm run e2e:suite -- --site https://YOUR-SITE.pages.dev        use a site that is already public
//
// Flags
//   --site <origin>        Public https origin serving /evidence. Validators fetch from here.
//   --serve                Serve dist/ (built on demand) on --port and, in a Codespace, use its forwarded URL.
//   --port <n>             Port for --serve (default 4173).
//   --scenario <id>        meridian (default) or halden.
//   --reports <list>       Comma list of report ids to submit and evaluate (default: faithful,silent,disclosed,withheld).
//   --integrity            Also ask validators to re-verify the pledge page.
//   --skip-negative        Skip the transactions that the contract must refuse.
//   --await-finality       Keep polling each transaction until it is FINALIZED, not only ACCEPTED (slow).
//   --address <0x...>      Contract address (default: artifacts/deployment.json, then VITE_CONTRACT_ADDRESS).
//   --out <dir>            Where the report goes (default: evidence).
//
// Two kinds of check. HARD checks are invariants of the contract and its views: they must hold no
// matter what the validators or the model say, and a broken one fails the run (exit code 1). SOFT
// expectations (for example "the silent report is judged MOVED_SILENTLY") depend on real validators and
// real models; a difference is recorded in the report but does not fail the run. Setup problems exit with 2.

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { explorerTx } from './evidence-lib.mjs';
import { ROOT, RPC_URL, loadKey, makeClient, parseArgs, readJson, readText, send, waitForDecision } from './lib.mjs';
import {
  Recorder,
  checkDriftConsistency,
  checkPublisherConsistency,
  checkReportIndex,
  checkStrikeDelta,
  excerptIsTraceable,
  renderSuiteReport,
  startEvidenceServer,
} from './suite-lib.mjs';

const { flags, values } = parseArgs(process.argv.slice(2));
const rec = new Recorder();
let server = null;

function stop(code, message) {
  if (message) console.error(`\n${message}`);
  if (server) server.close();
  process.exit(code);
}

function resolveAddress() {
  if (values.address) return values.address;
  const artifact = path.join(ROOT, 'artifacts', 'deployment.json');
  if (existsSync(artifact)) return JSON.parse(readFileSync(artifact, 'utf8')).address;
  for (const file of ['.env.local', '.env']) {
    const target = path.join(ROOT, file);
    if (!existsSync(target)) continue;
    const match = readFileSync(target, 'utf8').match(/^VITE_CONTRACT_ADDRESS=(0x[0-9a-fA-F]{40})$/m);
    if (match) return match[1];
  }
  return process.env.VITE_CONTRACT_ADDRESS || '';
}

const ADDRESS = resolveAddress();
if (!/^0x[0-9a-fA-F]{40}$/.test(ADDRESS)) stop(2, 'No contract address. Pass --address, run `npm run deploy:contract -- --write-env`, or set VITE_CONTRACT_ADDRESS.');

// ------------------------------------------------------------------------------------ the site

async function resolveSite() {
  if (!flags.has('serve')) {
    const site = (values.site || '').replace(/\/+$/, '');
    if (!/^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(site)) stop(2, 'Pass --site with the public https origin that serves /evidence, or use --serve (for example inside a Codespace).');
    return site;
  }
  const port = Number(values.port || 4173);
  if (!existsSync(path.join(ROOT, 'dist', 'evidence'))) {
    console.log('dist/ is missing; building the site first');
    const built = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, VITE_CONTRACT_ADDRESS: ADDRESS } });
    if (built.status !== 0) stop(2, 'The build failed.');
  }
  server = await startEvidenceServer(path.join(ROOT, 'dist'), port);
  const name = process.env.CODESPACE_NAME;
  const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN;
  if (!name || !domain) {
    stop(2, `Serving on port ${port}, but this is not a Codespace, so there is no public address. Expose the port yourself and pass it with --site.`);
  }
  // Best effort: a forwarded port is private by default and validators cannot read a private port.
  spawnSync('gh', ['codespace', 'ports', 'visibility', `${port}:public`, '-c', name], { stdio: 'ignore' });
  return `https://${name}-${port}.${domain}`;
}

async function fetchPage(url) {
  const response = await fetch(url, { redirect: 'manual' });
  return { ok: response.status === 200, status: response.status, type: response.headers.get('content-type') ?? '', text: response.status === 200 ? await response.text() : '' };
}

// ------------------------------------------------------------------------------------ main

const { key, generated } = loadKey();
// Test seam: tests/test_e2e_suite_offline.py swaps in a client that talks to the Python simulator,
// so this whole script runs against the real contract code without a network.
const makeSuiteClient = process.env.GOALPOST_E2E_CLIENT ? (await import(pathToFileURL(process.env.GOALPOST_E2E_CLIENT).href)).makeClient : makeClient;
const { client, account } = makeSuiteClient(key);
const scenarios = JSON.parse(readText('src/data/scenarios.json')).scenarios;
const scenario = scenarios.find((item) => item.id === (values.scenario || 'meridian'));
if (!scenario) stop(2, `Unknown scenario. Choose one of: ${scenarios.map((item) => item.id).join(', ')}`);
const reportIds = (values.reports || 'faithful,silent,disclosed,withheld').split(',').map((id) => id.trim()).filter(Boolean);
const reports = reportIds.map((id) => scenario.reports.find((item) => item.id === id));
if (reports.some((report) => !report)) stop(2, `Unknown report id. Choose from: ${scenario.reports.map((item) => item.id).join(', ')}`);

const startedAt = new Date().toISOString();
const read = (name, args = []) => readJson(client, ADDRESS, name, args);
const options = { waitForFinality: flags.has('await-finality') };

async function write(label, name, args) {
  const result = await send(client, ADDRESS, name, args, label, options);
  rec.tx(label, result.hash, result.statusName, result.execution, result.finality);
  return result;
}

/** A transaction the contract must refuse. Hard: it did not succeed and nothing changed. Soft: it said why. */
async function mustRefuse(name, functionName, args, phrase) {
  const label = `${functionName}, must be refused: ${name}`;
  const before = JSON.stringify(await read('stats'));
  let message = null;
  try {
    console.log(`  -> ${label}`);
    const hash = String(
      await client.writeContract({ address: ADDRESS, functionName, args: args.map((value) => (typeof value === 'number' ? BigInt(value) : value)), value: 0n }),
    );
    const outcome = await waitForDecision(client, hash, { onStatus: (status) => console.log(`     status: ${status}`), ...options });
    rec.tx(`${functionName} (refused): ${name}`, hash, outcome.statusName, outcome.execution, outcome.finality);
    message = outcome.failure; // null means the contract accepted what it should have refused
  } catch (error) {
    message = error instanceof Error ? error.message : String(error);
  }
  const after = JSON.stringify(await read('stats'));
  rec.add('hard', `refused: ${name}`, message !== null && before === after, message === null ? 'the transaction was accepted' : before === after ? '' : 'the ledger totals changed');
  if (message !== null) rec.add('info', `reason given for: ${name}`, phrase.test(message), message.slice(0, 160));
}

async function main() {
  const site = await resolveSite();
  console.log('Goalpost live end-to-end suite');
  console.log(`  contract  ${ADDRESS}`);
  console.log(`  rpc       ${RPC_URL}`);
  console.log(`  signer    ${account.address}${generated ? '  (throwaway key)' : ''}`);
  console.log(`  evidence  ${site}/evidence   (${scenario.id}: ${reportIds.join(', ')})`);

  console.log('\n1. Preflight');
  const pledgePage = await fetchPage(site + scenario.pledge_path);
  if (!pledgePage.ok || !/text\/html/.test(pledgePage.type)) {
    stop(2, `${site + scenario.pledge_path} answered ${pledgePage.status}${pledgePage.status >= 300 ? ' (a redirect usually means a private Codespaces port: make port visibility Public)' : ''}. Validators need to read it too.`);
  }
  const pages = {};
  for (const report of reports) {
    const page = await fetchPage(site + report.path);
    pages[report.id] = page.text;
    rec.add('hard', `evidence reachable: ${report.id}`, page.ok, `HTTP ${page.status}`);
  }
  const info = await read('contract_info');
  rec.add('hard', 'contract is version 1.4 or newer', /^1\.(4|[5-9])\.|^[2-9]\./.test(info.version), `version ${info.version}`);
  const features = ['publisher_ledger', 'drift_matrix', 'pledge_search', 'softening_guard', 'disclosure_relevance'];
  rec.add('hard', 'contract reports the 1.4 features', features.every((feature) => (info.features ?? []).includes(feature)), (info.features ?? []).join(', '));
  if (rec.failures.length > 0) {
    // Never send transactions to a contract that is not the one under test, or to evidence nobody can read.
    for (const failure of rec.failures) console.error(`  FAIL  ${failure.name}  ${failure.detail}`);
    stop(2, 'Preflight failed, so no transaction was sent. Fix the items above and run again.');
  }
  const statsBefore = await read('stats');

  let localAttestation = null;
  try {
    localAttestation = (await import(path.join(ROOT, 'src/lib/attestation.ts'))).attestationOf;
  } catch {
    console.log('  (this Node cannot load TypeScript directly; the browser-side attestation check is skipped)');
  }

  const pledgeUrl = site + scenario.pledge_path;
  const prefix = site + scenario.report_prefix_path;
  const elements = JSON.stringify(scenario.elements);

  if (!flags.has('skip-negative')) {
    console.log('\n2. Inputs the contract must refuse');
    await mustRefuse('a title with a direction override', 'register_pledge', ['Meridian \u202e pledge', scenario.kind, pledgeUrl, prefix, elements], /invisible|direction/i);
    await mustRefuse('a pledge address with non-ASCII characters', 'register_pledge', [scenario.title, scenario.kind, site + '/evidence/meridian/p\u00e9dge.html', prefix, elements], /ASCII/i);
    await mustRefuse('a pledge on a host that has no publisher namespace', 'register_pledge', [scenario.title, scenario.kind, 'https://bit.ly/goalpost-demo', 'https://bit.ly/goalpost-demo/', elements], /namespace|shared/i);
    const invented = JSON.stringify([{ key: 'invented', dimension: 'target', quote: 'We promise to be absolutely perfect in every conceivable way forever.', anchors: ['perfect'] }]);
    await mustRefuse('a quote that is not on the pledge page', 'register_pledge', [scenario.title, scenario.kind, pledgeUrl, prefix, invented], /verbatim|not found/i);
  }

  console.log('\n3. Freeze the pledge');
  let reused = false;
  try {
    await write('register_pledge', 'register_pledge', [scenario.title, scenario.kind, pledgeUrl, prefix, elements]);
  } catch (error) {
    if (!/already registered/i.test(String(error.message))) throw error;
    reused = true;
    console.log('  this exact pledge already exists; reusing it');
  }
  const list = await read('list_pledges', [0, 50]);
  const mine = list.items.find((item) => item.pledge_url === pledgeUrl && item.report_prefix === prefix) ?? list.items.find((item) => item.pledge_url === pledgeUrl);
  if (!mine) stop(1, 'The pledge was not found in the ledger after registration.');
  const pledgeId = mine.pledge_id;
  const scope = mine.scope;
  let bundle = await read('get_pledge_bundle', [pledgeId]);
  rec.add('hard', `${pledgeId} froze every element`, bundle.pledge.elements.length === scenario.elements.length, `${bundle.pledge.elements.length} elements`);
  rec.add('hard', 'every frozen quote was verified on the live page', bundle.pledge.integrity.state === 'VERIFIED', bundle.pledge.integrity.state);
  rec.add('hard', 'the pledge carries a publisher scope', typeof scope === 'string' && scope !== '', String(scope));

  if (!flags.has('skip-negative')) {
    await mustRefuse('registering the same pledge twice', 'register_pledge', [scenario.title, scenario.kind, pledgeUrl, prefix, elements], /already registered/i);
    const other = scenarios.find((item) => item.id !== scenario.id);
    const outside = other ? site + other.report_prefix_path + other.reports[0].path.split('/').pop() : site + '/evidence/other/x.html';
    await mustRefuse('a report outside the frozen prefix', 'submit_report', [pledgeId, outside, 'FY2026'], /prefix|outside|under/i);
    await mustRefuse('a report address with a dot segment', 'submit_report', [pledgeId, prefix + '../pledge.html', 'FY2026'], /dot|segment|prefix/i);
    await mustRefuse('a report address with non-ASCII characters', 'submit_report', [pledgeId, prefix + 'caf\u00e9.html', 'FY2026'], /ASCII/i);
    await mustRefuse('a report address that hides another host in its userinfo', 'submit_report', [pledgeId, site.replace('https://', 'https://trusted.example@') + scenario.reports[0].path, 'FY2026'], /credential|userinfo|@|host|prefix/i);
  }

  console.log('\n4. Views that must agree with the record');
  const searchFragment = scenario.title.split(' ')[0];
  const found = await read('search_pledges', [searchFragment, 10]);
  rec.add('hard', 'search_pledges finds the pledge', found.items.some((item) => item.pledge_id === pledgeId), `query "${searchFragment}"`);
  const emptyDrift = await read('get_drift', [pledgeId]);
  rec.add('hard', 'get_drift answers for the pledge', emptyDrift !== null && Array.isArray(emptyDrift.rows), `${emptyDrift?.rows?.length ?? '?'} rows so far`);

  async function crossChecks(when) {
    const fresh = await read('get_pledge_bundle', [pledgeId]);
    const audits = [];
    for (const summary of fresh.audits) audits.push((await read('get_audit_bundle', [summary.audit_id])).audit);
    const publisherBundle = await read('get_publisher', [scope]);
    const everyone = await read('list_pledges', [0, 50]);
    const sameScope = everyone.items.filter((item) => item.scope === scope);
    const bundles = [];
    for (const item of sameScope) bundles.push(item.pledge_id === pledgeId ? fresh : await read('get_pledge_bundle', [item.pledge_id]));
    const problems = [
      ...(publisherBundle === null ? ['get_publisher returned null'] : checkPublisherConsistency(publisherBundle.publisher, bundles)),
      ...checkDriftConsistency(await read('get_drift', [pledgeId]), fresh.pledge, audits),
      ...checkReportIndex(fresh.pledge, audits),
    ];
    rec.add('hard', `publisher ledger, drift table and report index agree with the audits (${when})`, problems.length === 0, problems.join('; '));
    return { fresh, audits };
  }
  await crossChecks('before any audit');

  console.log('\n5. Submit and evaluate reports');
  let strikes = bundle.pledge.strikes;
  for (const report of reports) {
    console.log(`\n  -- ${report.id} (${report.label})`);
    const reportUrl = site + report.path;
    const current = await read('get_pledge_bundle', [pledgeId]);
    let auditId = current.audits.find((audit) => audit.report_url === reportUrl && audit.state === 'PENDING')?.audit_id ?? null;
    if (!auditId) {
      await write(`submit_report ${report.id}`, 'submit_report', [pledgeId, reportUrl, report.period]);
      const refreshed = await read('get_pledge_bundle', [pledgeId]);
      auditId = [...refreshed.audits].reverse().find((audit) => audit.report_url === reportUrl && audit.state === 'PENDING')?.audit_id ?? null;
    }
    if (!auditId) {
      rec.add('hard', `${report.id}: the submitted report is queued`, false, 'no pending audit found');
      continue;
    }
    if (!flags.has('skip-negative')) await mustRefuse(`${report.id}: queuing the same report twice`, 'submit_report', [pledgeId, reportUrl, report.period], /already queued|already audited/i);

    await write(`evaluate_report ${report.id} (validators read the report; this can take minutes)`, 'evaluate_report', [auditId]);
    const { audit, pledge } = await read('get_audit_bundle', [auditId]);
    rec.add('hard', `${report.id}: ${auditId} is settled`, audit.state === 'SETTLED', `verdict ${audit.verdict}`);
    rec.add('soft', `${report.id}: verdict is ${report.expected}`, audit.verdict === report.expected, `the network said ${audit.verdict}${audit.failure_reason ? ` (${audit.failure_reason})` : ''}`);
    rec.add('hard', `${report.id}: strikes moved by the right amount`, checkStrikeDelta(strikes, pledge.strikes, audit.verdict).length === 0, checkStrikeDelta(strikes, pledge.strikes, audit.verdict).join('; '));
    strikes = pledge.strikes;

    const byContract = String(await client.readContract({ address: ADDRESS, functionName: 'recompute_attestation', args: [auditId] }));
    rec.add('hard', `${report.id}: the contract recomputes the stored attestation`, byContract === audit.attestation, audit.attestation);
    if (localAttestation) {
      const byBrowserCode = await localAttestation(audit, pledge.commitment);
      rec.add('hard', `${report.id}: the browser-side code recomputes the stored attestation`, byBrowserCode === audit.attestation, byBrowserCode);
    } else rec.add('info', `${report.id}: browser-side attestation`, null, 'Node cannot load TypeScript here');

    const page = pages[report.id];
    const untraceable = audit.elements.flatMap((element) => [element.report_excerpt, element.disclosure_excerpt]).filter((text) => text && !excerptIsTraceable(text, page));
    rec.add('soft', `${report.id}: every accepted excerpt can be found in the report page`, untraceable.length === 0, untraceable.map((text) => `"${text.slice(0, 60)}"`).join(', '));
    for (const element of audit.elements) console.log(`     [${element.status}] ${element.key}${element.flag ? `  (${element.flag})` : ''}`);
    console.log(`     verdict ${audit.verdict}; standing ${pledge.standing}; strikes ${pledge.strikes}`);

    await crossChecks(`after ${report.id}`);
    if (!flags.has('skip-negative') && audit.verdict !== 'INCONCLUSIVE') {
      await mustRefuse(`${report.id}: auditing a settled report again`, 'submit_report', [pledgeId, reportUrl, report.period], /already audited|already queued/i);
    }
  }

  if (flags.has('integrity')) {
    console.log('\n6. Re-verify the pledge page');
    await write('check_pledge_integrity', 'check_pledge_integrity', [pledgeId]);
    const after = await read('get_pledge_bundle', [pledgeId]);
    rec.add('soft', 'the live page still matches what was frozen', after.pledge.integrity.state === 'VERIFIED', after.pledge.integrity.state);
    await crossChecks('after the integrity check');
  }

  console.log('\n7. Totals');
  const statsAfter = await read('stats');
  const added = reused ? 0 : 1;
  rec.add('hard', 'the ledger counted every new pledge', statsAfter.pledges - statsBefore.pledges === added, `+${statsAfter.pledges - statsBefore.pledges}`);
  rec.add('hard', 'settled audits never exceed audits', statsAfter.settled <= statsAfter.audits, `${statsAfter.settled} of ${statsAfter.audits}`);
  rec.add('hard', 'the publisher count covers every scope', statsAfter.publishers >= 1, String(statsAfter.publishers));

  const finishedAt = new Date().toISOString();
  const markdown = renderSuiteReport({
    contract: ADDRESS,
    version: info.version,
    site,
    signer: account.address,
    startedAt,
    finishedAt,
    recorder: rec,
    explorer: explorerTx,
    notes: [
      `Pledge ${pledgeId} under publisher scope ${scope}${reused ? ' (reused from an earlier run)' : ''}.`,
      'Transactions were recorded when ACCEPTED' + (flags.has('await-finality') ? ' and again when FINALIZED.' : ' and not yet FINALIZED; run with --await-finality to wait.'),
      'Verdicts come from real validators and real models and are not deterministic. A DIFF row is a recorded observation, not a defect.',
    ],
  });

  const outDir = path.resolve(ROOT, values.out || 'evidence');
  mkdirSync(outDir, { recursive: true });
  const stamp = finishedAt.slice(0, 19).replace(/[:T]/g, '-');
  const base = path.join(outDir, `e2e-suite-${info.version}-${stamp}`);
  writeFileSync(`${base}.md`, markdown + '\n');
  writeFileSync(`${base}.json`, JSON.stringify({ contract: ADDRESS, version: info.version, site, startedAt, finishedAt, steps: rec.steps, transactions: rec.transactions }, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown + '\n');

  console.log(`\n${rec.failures.length === 0 ? 'PASSED' : 'FAILED'}: ${rec.steps.filter((s) => s.status === 'PASS').length} passed, ${rec.failures.length} failed, ${rec.diffs.length} live differences.`);
  for (const failure of rec.failures) console.log(`  FAIL  ${failure.name}  ${failure.detail}`);
  console.log(`Report: ${path.relative(ROOT, base)}.md`);
  if (server) server.close();
  process.exit(rec.failures.length === 0 ? 0 : 1);
}

main().catch((error) => stop(1, error instanceof Error ? error.stack ?? error.message : String(error)));
