# Goalpost

**An on-chain audit for silently moved goalposts.**

A public promise can keep every number and still walk away from its meaning: measure a different
thing, against a different baseline, over a different scope, by a different date. Goalpost freezes
the *definition* of a pledge on [GenLayer](https://docs.genlayer.com) and checks every later report
against it. Validators fetch the evidence themselves and must agree on whether the goalposts moved.

> It does **not** judge whether a target was achieved. It judges whether the definition of success
> stayed the same.

```
Pledged   We will cut our absolute Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2030,
          measured against our 2019 baseline.
Reported  We will cut our emissions intensity of Scope 1 and Scope 2 greenhouse gas emissions by 40%
          by 2035, measured against our 2022 baseline.

          -> moved: "absolute" -> "emissions intensity of", 2030 -> 2035, 2019 -> 2022.   unchanged: 40%
```

Target network: **GenLayer Studionet** (chain ID 61999). The web console is a static site built for
**Cloudflare Pages**.

- **Live site:** <https://goalpost-8wf.pages.dev/>
- **Source:** <https://github.com/reza9133/goalpost>
- **Contract:** `0xF508F08DE201772a6B957De81347f30EFddd2caA` on Studionet is contract 1.4.0. Its live end-to-end run (51 of 51 invariant checks passed) is recorded in [`evidence/`](evidence/README.md). The previous contract 1.3.0 (`0xe0167DeFD7b55bd4C120092Ee340078077186c3f`) is kept only as historical evidence (see [CHANGELOG.md](CHANGELOG.md))

## What is new in 1.4.0

- **Publisher ledger** (`/publishers`): every pledge is bound to a publisher scope; the contract keeps one record per
  scope with the verdicts, silent-move strikes and page edits of all its pledges.
- **Drift matrix** (`/pledges/<id>/drift`): how each frozen element moved, audit by audit, and where it first moved silently.
- **Verify in the browser** (`/verify/<audit id>`): rebuilds the audit attestation from the public record, so a result can be
  checked without trusting the node.
- **Two reproduced bugs fixed:** a silent-move accusation could rest on an unrelated sentence (filler words counted as
  shared content), and an unrelated sentence containing "new" could turn a silent move into a disclosed one.
- **New guards:** a "kept" claim cannot carry a hedge or negation the pledge did not have; invisible and direction-changing
  characters and non-ASCII addresses are refused; report text cannot fake the end of the untrusted block in the prompt.
- **Search, in-app documentation, 3D scene, lighter first load**, 77 more tests, and a **live end-to-end suite** that runs
  from a GitHub Codespace and writes a report you can commit ([docs/e2e.md](docs/e2e.md)).

## How it works

1. **Freeze.** Someone names a public page and quotes the sentences that define a commitment. Every
   validator fetches the page and confirms each quote is present verbatim. Only then are the quotes
   frozen. The registrant never supplies the baseline text, and text hidden in scripts, styles or
   comments does not count.
2. **Submit.** Anyone submits a report URL. It must live under the reporting prefix chosen at
   registration. That prefix is only accepted if it lies in the pledge's own **publisher scope** (the same
   host and, on hosts that serve many publishers such as GitHub or Gist, the same publisher namespace) **and**
   the pledge page itself declares it. A hostname alone is not a publisher, so an unrelated tenant of a
   shared host cannot supply reports against someone else's pledge. Anything else is refused on-chain
   without touching the network.
3. **Evaluate.** Anyone asks the validators to read the report. Each classifies every frozen element
   and quotes the report as evidence. The contract checks every quote against the page text itself.
4. **Agree.** Validators repeat the whole fetch and judgement independently and must agree on the
   verdict, on exactly which elements moved silently **and on the status of every frozen element**. No
   agreement, nothing is written.

Anyone can also ask validators to re-fetch the pledge page; if a frozen quote, or the page's declaration of
its reporting prefix, has vanished, the silent edit is recorded permanently.

### Declaring the reporting prefix

The pledge page names where its reports live, in either of two ways:

```html
<link rel="goalpost-reports" href="https://example.org/reports/">   <!-- relative hrefs work too -->
```

or by writing the address (`https://example.org/reports/`) in the page's visible text. A declared directory
authorises itself and everything below it. Ordinary navigation links do not count. Pledges on a plain-text
host (a gist, say) declare it in words.

### Verdicts

The verdict is computed by the contract from element statuses, strictest first. A model never writes it.

| Verdict | When | Pledge standing |
| --- | --- | --- |
| Moved silently | an element changed and the report does not say so, with evidence | Goalposts moved, and a permanent silent-move count increases |
| Inconclusive | something could not be verified, or the report could not be read | unchanged |
| Changed, disclosed | elements changed and each change is acknowledged | Revised openly |
| Incomplete | nothing changed, but some elements are not addressed | Partly reported |
| Kept | every element restated with the same definition | Held |

**Anchors** make the contract strict. An anchor is a word or number from a pledged sentence that
defines it (`absolute`, `2019`, `40%`). A report cannot be called *unchanged* unless the excerpt
backing that claim still carries every anchor, and it cannot be accused of a *silent change* if every
anchor survives in the very excerpt used to accuse it. Accusations need evidence on both sides, so
every frozen element needs at least one anchor. A claim that a commitment changed also needs an excerpt that shares
content with the pledged sentence, a disclosure has to read as an admission of change, and `not addressed` is refused
when the report was too long to be read in full.

## Repository layout

```
contracts/goalpost.py      The Intelligent Contract (single file, Studionet stable runner)
tests/                     Python test suite (standard library only) + Node logic tests
  gensim.py                In-process stand-in for the GenVM runtime used by the tests
  node/                    Client logic tests (diff, validation mirror, receipts, RPC proxy)
scripts/                   deploy.mjs, e2e.mjs, evidence.mjs and the live suite e2e-suite.mjs (genlayer-js)
.devcontainer/             GitHub Codespaces setup (Node 22, Python 3.12, GitHub CLI)
CHANGELOG.md               What changed in each version
src/                       Web console (Vite, React, TypeScript, plain CSS)
public/evidence/           Fictional demonstration documents the validators can fetch
functions/rpc.ts           OPTIONAL same-origin RPC proxy for Cloudflare Pages
functions/evidence/        Adversarial demonstration endpoint (a report that changes on every request)
docs/                      Architecture, API, testing, live e2e, front end, threat model, decisions, Cloudflare guide
```

## Quick start

### 1. Run the tests (no installs needed)

```bash
python3 -m unittest discover -s tests -t tests -v
```

This runs the real contract file on a simulated runtime plus the client logic under Node
(22.18+ for the built-in TypeScript type stripping; those tests are skipped with a reason on
older Node). See [Verification status](#verification-status) for what this does and does not prove.

### 2. Lint the contract

```bash
pip install genvm-linter
npm run lint:contract
```

### 3. Deploy the contract to Studionet

Pick one.

**Studio UI (simplest).** Open [studio.genlayer.com](https://studio.genlayer.com), create a contract,
paste `contracts/goalpost.py`, and press Deploy. There are no constructor arguments. Copy the
contract address.

**Script.**

```bash
npm install
npm run deploy:contract -- --write-env
```

It deploys from a throwaway key (Studionet needs no funds; set `GOALPOST_PRIVATE_KEY` to use your
own), verifies the deployed contract, writes `artifacts/deployment.json` and, with `--write-env`,
`.env.local`.

**GenLayer CLI.**

```bash
npm install -g genlayer
genlayer network set studionet
genlayer deploy --contract contracts/goalpost.py
```

**Live deployment.** The Studionet contract at `0xF508F08DE201772a6B957De81347f30EFddd2caA` is version 1.4.0. The site must be built with
`VITE_CONTRACT_ADDRESS` set to this address. The live suite run against it (kept, silent move, disclosed change and
inconclusive) is in [`evidence/`](evidence/README.md); the earlier 1.3.0 runs, including the adversarial validator
disagreement, were recorded on the previous contract (`0xe0167DeFD7b55bd4C120092Ee340078077186c3f`). To deploy your own copy, run
`npm run deploy:contract -- --write-env`, redeploy the site so the demonstration pledge pages carry their declaration,
then run `npm run e2e:codespace` (or `npm run evidence`) to record every outcome.

### 4. Run the web console locally

```bash
cp .env.example .env.local        # then set VITE_CONTRACT_ADDRESS
npm install
npm run dev
```

Reading the ledger needs no identity. To write, create a **session key** from the identity menu (a
throwaway key kept in your browser; Studionet is free) or connect a browser wallet.

> The bundled demonstration documents are served from `/evidence`. Validators fetch pages from the
> public internet, so they cannot read `localhost`. Use the console locally to browse and read, and
> deploy it (next section) to freeze the demonstration pledges.

**Test tokens.** The identity menu has a **Get 100 GEN of test tokens** button, so nobody has to
visit the Studio site for a faucet. It calls the Studionet `sim_fundAccount` method on the public
RPC. That call never goes through the optional `/rpc` proxy, which refuses every `sim_` method on
purpose. The tokens have no value and the network can be reset.

### 5. Deploy the site to Cloudflare Pages

Short version: connect the repository, build command `npm run build`, output directory `dist`, and set
`VITE_CONTRACT_ADDRESS` as a build variable. Full guide, including the two Cloudflare settings that can
silently stop validators from reading `/evidence`, in [docs/deploy-cloudflare.md](docs/deploy-cloudflare.md).

### 6. Exercise the whole lifecycle on the live network

```bash
npm run e2e -- --site https://YOUR-SITE.pages.dev
npm run e2e -- --site https://YOUR-SITE.pages.dev --scenario halden --report silent --integrity
```

To record **live evidence for every outcome** (silent move, disclosed change, inconclusive, adversarial validator
disagreement, and the kept proof) as Markdown files in `evidence/`:

```bash
npm run evidence -- --site https://YOUR-SITE.pages.dev
npm run evidence -- --site https://YOUR-SITE.pages.dev --only silent,adversarial --await-finality
```

Each file lists every transaction with its network decision (`ACCEPTED` or `FINALIZED`), the contract call's
execution result, and the validators' votes when the network reports them. Nothing is written unless a
transaction really ran. `--await-finality` keeps polling until `FINALIZED`.

**Full suite (1.4.0).** `npm run e2e:codespace` serves the evidence from a Codespace and runs every check in
[docs/e2e.md](docs/e2e.md): inputs the contract must refuse, registration, audits, and cross-checks of the publisher
ledger, the drift table, the report index and the attestation. It writes a Markdown and JSON report to `evidence/`.

`npm run e2e` checks the evidence is reachable, freezes a pledge, submits and evaluates a report, prints each
element's status and cited excerpts, and confirms the attestation recomputes on chain. A verdict that
differs from the expectation is reported, not treated as an error: real validators and real models are
not deterministic. Broken contract invariants are errors.

## Verification status

Read this before you rely on anything. It states what was actually exercised and how.

| Part | What was done | What was **not** done |
| --- | --- | --- |
| Contract | 276 tests (Python and Node) run the real `goalpost.py` on a simulated runtime (`tests/gensim.py`) that enforces GenVM's rules: no `gl.nondet` outside a block, no storage inside a block, validator majority, rollback on error. They include adversarial model output, hostile pages and addresses, fuzzing, and regressions for two bugs that were reproduced on 1.3.0 first. `genvm-lint` passes on 1.4.0. Earlier mutation testing (21 rule removals, then the 8 of 1.3.0) was done on 1.3.0; it was **not** repeated for the 1.4.0 rules. | **1.4.0 has not run on Studionet.** The simulator is not GenVM; it verifies logic, not runtime behaviour. The 1.3.0 runs in `evidence/` are for 1.3.0. |
| Evidence pages | Every frozen quote and every excerpt is checked against the page text by the contract's own extractor; every demo report yields its expected verdict under an ideal model. | Real LLMs were not asked. Real model output will vary. |
| Web console | 1.4.0: type-checked, built with Vite, and every new page rendered in headless Chromium (light, dark, mobile) against fixtures generated from the contract simulator; the browser-side attestation recomputation matched the stored attestation of every demonstration audit. The logic modules (`receipt`, `chain`, `validate`, `format`, `config`) are type-checked under `strict` with stubs for `genlayer-js`; the receipt, outcome (accepted versus finalized, explicit execution success) and validation logic is unit-tested under Node and parity-tested against the contract. Earlier versions were also bundled with esbuild and exercised in headless Chromium against a fake chain. | The 1.3.0 React changes (`TxPanel`, `tx.tsx`, register, pledge and how pages) were not type-checked or rendered: the npm registry was not reachable when they were written. Not built with Vite, not checked against the real `@types/react`, `react-router-dom` or `genlayer-js` types. The real `genlayer-js` 1.1.8 calls were never executed here. The browser-wallet path (`provider`) is unverified; the session-key path is the default. |
| Scripts | The live suite (`e2e-suite.mjs`) is run against the contract simulator in every test run, and against simulators that deliberately lie, which it must fail. Syntax-checked; their receipt parser is parity-tested against the client's; the evidence renderer and vote parser are unit-tested. | `e2e-suite.mjs` has **not** run against Studionet. `evidence.mjs` has run against Studionet; the records in `evidence/` were written while transactions were `ACCEPTED`, not yet `FINALIZED`. |
| Cloudflare proxy | Unit-tested with a mocked upstream: method allow-list, origin check, batch and size caps. | Not deployed. |

The first real deployment is the real test. If something fails, [docs/decisions.md](docs/decisions.md)
lists every runtime assumption the code makes and where it lives, so you can find it quickly.

## Troubleshooting

| Symptom | Likely cause |
| --- | --- |
| Registration fails with `quote ... not found verbatim` | The quote differs from the page text, or the page needs JavaScript to show it. Copy the sentence exactly from the page source. |
| Registration fails with `could not be retrieved (HTTP_4XX)` | Validators cannot read the URL. On Cloudflare, check Bot Fight Mode and WAF rules for `/evidence/*`. |
| The form says a URL "must name a public DNS host" | Validators cannot read `localhost`, IP addresses or private names; use a deployed URL. |
| A transaction ends with "did not reach agreement" | Validators disagreed; nothing was written. Try again. Persistent disagreement usually means the page changes between fetches. |
| Reads fail intermittently from the browser | Studionet rate-limits and occasionally omits CORS headers under load. Build with `VITE_RPC_URL=/rpc` to use the same-origin proxy. |
| The console says it is not connected to a contract | `VITE_CONTRACT_ADDRESS` was not set at build time. Vite reads it when building, so rebuild after changing it. |

## Documentation

- [CHANGELOG](CHANGELOG.md): what changed, what was fixed, what was not done
- [Contract API](docs/api.md): every method, record shape, refusal and flag
- [Architecture](docs/architecture.md): data model, equivalence rules, client structure
- [Testing guide](docs/testing.md): the suites, the simulator, how to check that a test can fail
- [Live end-to-end runs](docs/e2e.md): Codespaces, GitHub Actions, the report
- [Front end](docs/frontend.md): pages, the 3D scene, performance, previewing without a network
- [Threat model](docs/threat-model.md): what is defended, by what, and what remains
- [Decisions](docs/decisions.md): why it is built this way, and every Studionet-specific assumption
- [Cloudflare Pages guide](docs/deploy-cloudflare.md)

## License

MIT. The demonstration documents under `public/evidence` are fictional.
