# Testing guide

## Run everything

```bash
python3 -m unittest discover -s tests -t tests      # about 5 seconds, standard library only
npm run typecheck && npm run build                  # the web console
genvm-lint check contracts/goalpost.py              # needs: pip install genvm-linter
```

The Python suite needs no installs. Tests that call Node (client parity, attestation parity, the live-suite
checks) skip themselves with a reason when Node is missing or too old to strip TypeScript types (22.18 or
newer, or 22 with `--experimental-strip-types`). The offline run of the live suite also needs `npm install`,
because the script imports `genlayer-js`; without it those four tests are skipped.

## The simulator

`tests/gensim.py` is an in-process stand-in for the GenVM runtime. It runs the real `contracts/goalpost.py` and
enforces the rules that matter to this contract: `gl.nondet` only inside a non-deterministic block, no storage
access inside a block, leader and validators with a majority vote, and rollback when a call raises. It is not
GenVM. It verifies logic, not runtime behaviour; the live suite exists for the rest.

`tests/support.py` builds a `World` (a deployed contract plus a fake web and a fake model) and the
demonstration pages from `public/evidence`. `tests/ideal.py` holds the answers an ideal model gives for each
demonstration report.

## What each file covers

| File | Covers |
|---|---|
| `test_helpers.py`, `test_authority.py`, `test_lifecycle.py` and the rest of the 1.3.0 suite | Pure helpers, publisher authority, the whole lifecycle, equivalence rules, consensus |
| `test_hardening_v14.py` | Regressions for the two reproduced bugs and the new refusals (softening, hidden characters, ASCII URLs, host tables) |
| `test_publishers_and_drift.py` | Publisher ledger, drift table, search, the per-pledge report index |
| `test_adversarial.py` | Hostile model output, injected instructions, a report that fakes the prompt fence, validators that disagree, hostile report addresses, fuzzing, oversized input |
| `test_client_parity.py` | The TypeScript validators, host tables, limits and flag labels agree with the contract |
| `test_attestation_parity.py` | The browser recomputes every attestation the contract stores, byte for byte, including awkward text |
| `test_suite_lib.py` | The live suite's own checks: silent on real state, loud on corrupted state |
| `test_e2e_suite_offline.py` | Runs `scripts/e2e-suite.mjs` itself against the simulator, and against simulators that lie |
| `test_hygiene.py` | GenVM rules (no floats, confined non-determinism, typed public methods) and the English-only rule |

## Adversarial tests

They assert two things: nothing crashes with an unexpected exception, and no accusation is recorded without
evidence in the report. The model and the pages are treated as hostile:

- model answers of every awkward shape (not JSON, wrong types, spoofed keys, 100 KB excerpts, unknown statuses)
- a model that obeys an instruction hidden in the report, in either direction
- a report that contains the closing fence of the untrusted block
- a leader that cites text the validators do not see; a publisher that serves different documents to different nodes
- a quote that exists only in a comment, script, style or noscript element
- report addresses that try to leave the prefix: userinfo, ports, look-alike hosts, dot segments, encoded dots,
  queries, fragments, backslashes, spaces, direction overrides
- 20,000 generated URLs and 5,000 generated element lists with a fixed seed, checking the invariants of
  everything the validators accept

A model that fails or answers with text that is not JSON is **not** treated as a finding: validators disagree,
the leader rotates and the audit stays pending. That is a deliberate design (`docs/decisions.md`), and
`test_adversarial.py` pins it.

## Checking that a test can fail

A test that cannot fail proves nothing. Two habits keep this suite honest:

1. New regression tests are run against the previous contract. `test_hardening_v14.py` was run against 1.3.0 and
   the tests that assert a new refusal fail there.
2. The live suite's checks are run on corrupted state (`test_suite_lib.py`) and the suite as a whole is run
   against a simulator with a deliberate lie (`SIM_BUG=publisher|drift|attestation` in
   `tests/sim_rpc_server.py`); it must exit with code 1.

## Not covered

Real validators, real models and the real runtime. Run `npm run e2e:codespace` for that (`docs/e2e.md`).
