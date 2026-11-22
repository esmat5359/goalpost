# Live end-to-end runs

`scripts/e2e-suite.mjs` exercises a deployed contract on GenLayer Studionet and leaves a report you can commit.
Validators fetch the evidence pages themselves, so those pages must be reachable from the public internet.

## From a GitHub Codespace (no hosting needed)

1. Open the repository in a Codespace. The dev container installs Node 22, the GitHub CLI and the dependencies.
2. Deploy the contract (a throwaway key is generated if you do not set `GOALPOST_PRIVATE_KEY`; Studionet needs no funds):

   ```bash
   npm run deploy:contract -- --write-env
   ```

3. Run the suite. It builds the site if needed, serves `dist/` (including `/evidence` and the adversarial
   `/evidence/flapping` endpoint) on port 4173, and uses the Codespace's forwarded address as the evidence host:

   ```bash
   npm run e2e:codespace
   ```

4. A forwarded port is **private by default**, and validators cannot read a private port. The script tries
   `gh codespace ports visibility 4173:public`. If your token cannot do that, open the **Ports** tab, right-click
   port 4173 and choose **Port Visibility, Public**. The preflight check tells you when the page is not
   reachable, and sends no transaction until it is.
5. When it finishes, commit the report:

   ```bash
   git add evidence/e2e-suite-*.md evidence/e2e-suite-*.json && git commit -m "Record live e2e run" && git push
   ```

## Against a site that is already public

```bash
npm run e2e:suite -- --site https://YOUR-SITE.pages.dev
npm run e2e:suite -- --site https://YOUR-SITE.pages.dev --reports silent,disclosed --integrity --await-finality
```

## From GitHub Actions

`.github/workflows/live-e2e.yml` (manual trigger) takes the public site, an optional contract address and the
report list. Add the secret `GOALPOST_PRIVATE_KEY` (optional) and the repository variable `CONTRACT_ADDRESS`.
The report is written to the job summary and uploaded as the `goalpost-live-e2e-report` artifact.

## What it does

| Phase | What happens |
|---|---|
| 1. Preflight | The pledge and report pages are reachable by plain HTTP and the contract is 1.4 or newer. A failure stops the run before any transaction. |
| 2. Refusals | Transactions the contract must refuse: a direction override in a title, a non-ASCII address, a flat shared host, a quote that is not on the page. |
| 3. Freeze | Registers the pledge (reuses it if it already exists) and checks every element froze and the publisher scope is set. |
| 4. More refusals and views | Registering twice, reports outside the prefix, dot segments, non-ASCII addresses, userinfo tricks; `search_pledges` and `get_drift` answer. |
| 5. Audits | For each report: submit, refuse a duplicate, evaluate, then check the result (below). |
| 6. Integrity (`--integrity`) | Asks validators to re-verify the pledge page. |
| 7. Totals | Pledge, audit and publisher counters moved by the right amounts. |

After every audit the suite re-reads the publisher record, the drift table and the pledge's report index and
compares each with an independent recomputation from the full audit records.

### Two kinds of check

- **Hard** checks are invariants. A refused input that was accepted, a ledger that does not add up, an
  attestation that does not recompute, a silent verdict that did not add exactly one strike. One failure makes
  the run exit with code 1.
- **Soft** checks depend on real validators and real models: "the silent report is judged `MOVED_SILENTLY`",
  "every accepted excerpt can be found in the page". A difference is a `DIFF` row in the report, not a failure.
  Models are not deterministic; read the excerpts.

Exit codes: 0 passed, 1 an invariant failed, 2 setup problem (no address, evidence unreachable, outdated contract).

### Attestation checked three ways

The contract recomputes the stored attestation; the TypeScript routine the web console uses
(`src/lib/attestation.ts`) recomputes it from the public record; both must equal the stored value. If Node
cannot load TypeScript directly, the second check is reported as skipped.

## The report

`evidence/e2e-suite-<version>-<timestamp>.md` and `.json`: result, every check with its kind and detail, every
transaction with its explorer link, decision, execution result and finality. Transactions are recorded when
`ACCEPTED`; use `--await-finality` to wait for `FINALIZED`. Nothing is written for a transaction that did not
run, and nothing in the file is typed by hand.

## Without a network

`python3 -m unittest test_e2e_suite_offline` (from `tests/`) runs this very script against the contract
simulator through a fake client, and against simulators that lie. It cannot tell you what the real validators
do, but it proves the script's logic and that its checks can fail.
