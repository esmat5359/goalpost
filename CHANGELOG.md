# Changelog

All notable changes to Goalpost. The contract version is the `VERSION` constant in `contracts/goalpost.py`
and the `version` field of `contract_info`. Dates are UTC.

## 1.4.0 - 2026-11-21

A milestone release: new contract functionality, two reproduced bugs fixed, a broader front end, a much
larger test suite and a live end-to-end suite that can be run from a GitHub Codespace.

Deploying 1.4.0 creates a **new contract address**: the storage layout gained fields, so it is a fresh
deployment, not an in-place upgrade. Pledges registered on 1.3.0 stay on the old contract.

### Fixed (each reproduced against 1.3.0 first)

- **A silent-move accusation could rest on an unrelated sentence.** "Relatedness" compared word stems, and
  filler words counted. A report sentence such as "We will open a new office in the north." shared the stem
  "will" with the pledge "We will cut our absolute ...", so a model that cited it could earn a permanent
  strike against a publisher. Filler words and single digits no longer count as shared content
  (`_STOP_WORDS`, `_stems`).
- **A decoy could turn a silent move into a disclosed one.** A `MOVED_DISCLOSED` claim only required that the
  cited disclosure sentence contain a change word ("new", "now", "changed" ...). "We introduced a new
  reporting format this year." qualified, whatever it was about. The disclosure must now be about the
  commitment: related to the pledged sentence or to the new wording, or name the thing that changed
  ("pledge", "target", "baseline" ...). Flag: `disclosure_not_about_the_commitment`.

### Added: contract

- **Publisher ledger.** One running record per publisher scope: pledges (active and retired), settled audits
  by verdict, permanent strikes and detected page edits. It is updated by the same transactions that write
  pledges and audits. Views: `list_publishers(offset, limit, sort)` with `recent`, `strikes` or `pledges`, and
  `get_publisher(scope)`.
- **Drift matrix.** `get_drift(pledge_id)` returns the period-by-element status table, the first audit that
  found each element silently moved, the current status per element and which elements ever moved.
- **Pledge search.** `search_pledges(query, limit)` over title, id, address, scope and registrant.
- **Softening guard.** `KEPT` is refused when the cited excerpt adds a hedge or a negation the pledge did not
  have ("aim to", "subject to", "not", "no longer" ...). Softening a promise is moving the goalpost. Flag:
  `kept_excerpt_hedges_or_negates`. Fail closed, English only; see `docs/decisions.md`.
- **Invisible characters.** Titles, quotes, anchors and periods refuse control characters, zero-width space,
  bidirectional overrides and isolates, the byte order mark and the interlinear annotation characters.
  Zero-width (non-)joiners and the left-to-right and right-to-left marks stay allowed, because Persian, Arabic
  and Hindi cannot be written without them. URLs must be plain ASCII (percent-encode the rest).
- **Prompt fence.** Runs of three or more `=` inside untrusted report text are broken up before the text is put
  between the prompt's fence lines, so a report cannot fake the end of the untrusted block.
- More namespaced hosts (`x.com`, `twitter.com`, `linkedin.com`, `dev.to`, `hackmd.io`, `sourceforge.net`) and
  more flat shared hosts refused as publishers (`telegra.ph`, `bit.ly`, `imgur.com`, `mega.nz` and others).
- `contract_info` reports `sorts`, `features` and two new limits; `stats` reports `publishers`; pledge
  summaries carry `scope`.

### Changed: performance

- **Contract.** `submit_report` used to load and parse every earlier audit to detect duplicates (up to 80
  storage reads). Each pledge now keeps a compact report index (`reports`: audit id, a 20 character
  fingerprint of the report address, state, verdict), so a submission reads no earlier audit.
- **Web console.** `genlayer-js` and `viem` are loaded on first use in their own chunk. The pages other than
  the ledger are loaded when first visited. First-load JavaScript went from one 816 kB chunk to a 56 kB entry
  plus a 166 kB React chunk (73 kB gzipped together); the SDK chunks (about 560 kB, 125 kB gzipped) load in parallel when the
  first read starts. Fonts load from a `<link>` with `display=swap` and only the weights in use, instead of a
  render-blocking CSS `@import`. Polling pauses in hidden tabs and catches up when the tab returns.
- The Content-Security-Policy (still report-only) now lists the font hosts and inline `style` attributes it
  always needed, so it stops reporting its own page.

### Added: web console

- **Publishers** (`/publishers`, `/publishers/<scope>`): leaderboard and per-publisher record.
- **Drift** (`/pledges/<id>/drift`): the status matrix with a marker on the first silent move.
- **Verify** (`/verify/<audit id>`): recomputes the audit attestation in the browser from the public record
  (`src/lib/attestation.ts`), optionally asks the contract too, and shows exactly what was hashed.
- **Docs** (`/docs`): verdicts, refusal flags, the contract reference and live limits.
- **Search** on the ledger page.
- **3D.** A CSS 3D goalpost whose right post slides off the pledged line while the crossbar stretches to follow,
  and cards that lean toward the pointer. No WebGL, no dependency; both pause off screen and respect
  `prefers-reduced-motion`. Light and dark schemes.
- The client validators mirror the new contract rules (hidden characters, ASCII URLs, host tables).

### Added: tests and tooling

- 77 new tests (199 to 276): regressions for both bugs, the new views, adversarial model output, hostile
  URLs, fuzzing of URL and element parsing, hostile validators, a browser/contract attestation parity test,
  and tests of the live-suite checks themselves, including corrupted state they must catch. Of the 21
  tests in `tests/test_hardening_v14.py`, the ones that assert a new refusal fail on 1.3.0 (28 failing
  checks); the rest guard against over-blocking (a faithful restatement, "May" as a month, Persian text with a
  joiner) and pass on both versions.
- `npm run e2e:suite` and `npm run e2e:codespace`: a live end-to-end suite that registers, audits and
  cross-checks, then writes a report to `evidence/`. `.devcontainer/` and `.github/workflows/live-e2e.yml`
  run it from a Codespace or from Actions. `tests/test_e2e_suite_offline.py` runs the whole script against the
  simulator, and against simulators that lie, in every CI run.
- The GenVM linter passes on 1.4.0 (and on 1.3.0), and its CI job is no longer advisory.

### Not done

- The live suite has **not** been run against Studionet in this release; the sandbox it was written in
  cannot reach it. Everything it checks has been exercised offline against the contract's real code.
- Reads still load the SDK. A JSON-RPC read path that avoids it was considered and left out: it needs its own
  calldata and RLP encoder, which cannot be validated without the network.
- The Content-Security-Policy is still `Report-Only`.
- The model-failure behaviour is unchanged on purpose (see `docs/decisions.md`).

## 1.3.0

- Publisher authority: a reporting prefix is accepted only if the pledge page itself declares it, within the
  pledge's publisher scope (a host, or a namespace on a shared host).
- Validators compare every element's classification between leader and validator, not only the verdict.

## 1.2.0

- Evidence rules: relevance, disclosure wording, truncation, and per-element re-judging of the leader's claims.
- Standing follows the most recently submitted conclusive audit; edit episodes counted once.

## 1.0.0

- First release: freeze a pledge from a live page, audit later reports against it, attestation, web console.
