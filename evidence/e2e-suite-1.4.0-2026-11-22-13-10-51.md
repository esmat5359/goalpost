# Goalpost live end-to-end report

- Result: **PASSED** (51 of 51 invariant checks passed, 0 live expectation differences)
- Contract: `0xF508F08DE201772a6B957De81347f30EFddd2caA` (version 1.4.0)
- Evidence served from: https://ominous-space-rotary-phone-96qj54v74r57fpx6x-4173.app.github.dev
- Signer: `0x281D96C48Cb22417F66C9b795BEE9e87c0394b45`
- Started (UTC): 2026-11-22T13:05:17.669Z
- Finished (UTC): 2026-11-22T13:10:51.010Z

Invariant checks must always hold. Live expectations depend on real validators and real models, so a difference is recorded, not treated as a failure.

## Checks

| Result | Kind | Check | Detail |
|---|---|---|---|
| PASS | hard | evidence reachable: faithful | HTTP 200 |
| PASS | hard | evidence reachable: silent | HTTP 200 |
| PASS | hard | evidence reachable: disclosed | HTTP 200 |
| PASS | hard | evidence reachable: withheld | HTTP 200 |
| PASS | hard | contract is version 1.4 or newer | version 1.4.0 |
| PASS | hard | contract reports the 1.4 features | publisher_ledger, drift_matrix, pledge_search, softening_guard, disclosure_relevance |
| PASS | hard | refused: a title with a direction override |  |
| PASS | info | reason given for: a title with a direction override | title must not contain control, invisible or direction-changing characters |
| PASS | hard | refused: a pledge address with non-ASCII characters |  |
| PASS | info | reason given for: a pledge address with non-ASCII characters | pledge_url must be plain ASCII (percent-encode any other character) |
| PASS | hard | refused: a pledge on a host that has no publisher namespace |  |
| PASS | info | reason given for: a pledge on a host that has no publisher namespace | pledge_url is on bit.ly, which gives no publisher a namespace of its own, so reports cannot be bound to a publisher there |
| PASS | hard | refused: a quote that is not on the pledge page |  |
| PASS | info | reason given for: a quote that is not on the pledge page | the quote for element "invented" was not found verbatim on the pledge page |
| PASS | hard | PLG-0001 froze every element | 3 elements |
| PASS | hard | every frozen quote was verified on the live page | VERIFIED |
| PASS | hard | the pledge carries a publisher scope | ominous-space-rotary-phone-96qj54v74r57fpx6x-4173.app.github.dev |
| PASS | hard | refused: registering the same pledge twice |  |
| PASS | info | reason given for: registering the same pledge twice | this pledge is already registered as PLG-0001 |
| PASS | hard | refused: a report outside the frozen prefix |  |
| PASS | info | reason given for: a report outside the frozen prefix | report_url is outside the reporting prefix frozen with this pledge |
| PASS | hard | refused: a report address with a dot segment |  |
| PASS | info | reason given for: a report address with a dot segment | report_url must not contain dot segments |
| PASS | hard | refused: a report address with non-ASCII characters |  |
| PASS | info | reason given for: a report address with non-ASCII characters | report_url must be plain ASCII (percent-encode any other character) |
| PASS | hard | refused: a report address that hides another host in its userinfo |  |
| PASS | info | reason given for: a report address that hides another host in its userinfo | report_url must not contain credentials |
| PASS | hard | search_pledges finds the pledge | query "Meridian" |
| PASS | hard | get_drift answers for the pledge | 0 rows so far |
| PASS | hard | publisher ledger, drift table and report index agree with the audits (before any audit) |  |
| PASS | hard | refused: faithful: queuing the same report twice |  |
| PASS | info | reason given for: faithful: queuing the same report twice | this report is already queued as AUD-0001 |
| PASS | hard | faithful: AUD-0001 is settled | verdict KEPT |
| PASS | soft | faithful: verdict is KEPT | the network said KEPT |
| PASS | hard | faithful: strikes moved by the right amount |  |
| PASS | hard | faithful: the contract recomputes the stored attestation | 0xbf087c7772bc6d953395d6281d967685d262aa2de2101e7c8b36e667442a8215 |
| PASS | hard | faithful: the browser-side code recomputes the stored attestation | 0xbf087c7772bc6d953395d6281d967685d262aa2de2101e7c8b36e667442a8215 |
| PASS | soft | faithful: every accepted excerpt can be found in the report page |  |
| PASS | hard | publisher ledger, drift table and report index agree with the audits (after faithful) |  |
| PASS | hard | refused: faithful: auditing a settled report again |  |
| PASS | info | reason given for: faithful: auditing a settled report again | this report was already audited as AUD-0001; publish corrections at a new URL |
| PASS | hard | refused: silent: queuing the same report twice |  |
| PASS | info | reason given for: silent: queuing the same report twice | this report is already queued as AUD-0002 |
| PASS | hard | silent: AUD-0002 is settled | verdict MOVED_SILENTLY |
| PASS | soft | silent: verdict is MOVED_SILENTLY | the network said MOVED_SILENTLY |
| PASS | hard | silent: strikes moved by the right amount |  |
| PASS | hard | silent: the contract recomputes the stored attestation | 0x2b1929f82d47fad0bf8562c5914cd964b77ebee2f7ce37af9ebc2e01c8415a53 |
| PASS | hard | silent: the browser-side code recomputes the stored attestation | 0x2b1929f82d47fad0bf8562c5914cd964b77ebee2f7ce37af9ebc2e01c8415a53 |
| PASS | soft | silent: every accepted excerpt can be found in the report page |  |
| PASS | hard | publisher ledger, drift table and report index agree with the audits (after silent) |  |
| PASS | hard | refused: silent: auditing a settled report again |  |
| PASS | info | reason given for: silent: auditing a settled report again | this report was already audited as AUD-0002; publish corrections at a new URL |
| PASS | hard | refused: disclosed: queuing the same report twice |  |
| PASS | info | reason given for: disclosed: queuing the same report twice | this report is already queued as AUD-0003 |
| PASS | hard | disclosed: AUD-0003 is settled | verdict MOVED_DISCLOSED |
| PASS | soft | disclosed: verdict is MOVED_DISCLOSED | the network said MOVED_DISCLOSED |
| PASS | hard | disclosed: strikes moved by the right amount |  |
| PASS | hard | disclosed: the contract recomputes the stored attestation | 0x5af3f2b02dd062190e71bd24d6fda58ce9239dea689bea3ce7dae5bc415e58f2 |
| PASS | hard | disclosed: the browser-side code recomputes the stored attestation | 0x5af3f2b02dd062190e71bd24d6fda58ce9239dea689bea3ce7dae5bc415e58f2 |
| PASS | soft | disclosed: every accepted excerpt can be found in the report page |  |
| PASS | hard | publisher ledger, drift table and report index agree with the audits (after disclosed) |  |
| PASS | hard | refused: disclosed: auditing a settled report again |  |
| PASS | info | reason given for: disclosed: auditing a settled report again | this report was already audited as AUD-0003; publish corrections at a new URL |
| PASS | hard | refused: withheld: queuing the same report twice |  |
| PASS | info | reason given for: withheld: queuing the same report twice | this report is already queued as AUD-0004 |
| PASS | hard | withheld: AUD-0004 is settled | verdict INCONCLUSIVE |
| PASS | soft | withheld: verdict is INCONCLUSIVE | the network said INCONCLUSIVE (EMPTY) |
| PASS | hard | withheld: strikes moved by the right amount |  |
| PASS | hard | withheld: the contract recomputes the stored attestation | 0xe3a427554a9ff5e07ad1a57aecb14d237aa018cf416d9a7d3232ef272f5f0f13 |
| PASS | hard | withheld: the browser-side code recomputes the stored attestation | 0xe3a427554a9ff5e07ad1a57aecb14d237aa018cf416d9a7d3232ef272f5f0f13 |
| PASS | soft | withheld: every accepted excerpt can be found in the report page |  |
| PASS | hard | publisher ledger, drift table and report index agree with the audits (after withheld) |  |
| PASS | hard | the ledger counted every new pledge | +1 |
| PASS | hard | settled audits never exceed audits | 4 of 4 |
| PASS | hard | the publisher count covers every scope | 1 |

## Transactions

| Transaction | Hash | Decision | Execution | Finality |
|---|---|---|---|---|
| register_pledge (refused): a title with a direction override | [`0xf0b317be04...`](https://explorer-studio.genlayer.com/tx/0xf0b317be04de708fd4efd9b07a65421858a09ed6cbf78b0d918861d91ba66ef9) | ACCEPTED | failed | not final |
| register_pledge (refused): a pledge address with non-ASCII characters | [`0x15203a78fe...`](https://explorer-studio.genlayer.com/tx/0x15203a78fe327ec1563eae709818259e0e06bca9a226bd2d24fbdab9297cf5a9) | ACCEPTED | failed | not final |
| register_pledge (refused): a pledge on a host that has no publisher namespace | [`0xdaf018773d...`](https://explorer-studio.genlayer.com/tx/0xdaf018773ddd7045a8e4fba8671cdceeb99a0b767c790308b4f8348f08547268) | ACCEPTED | failed | not final |
| register_pledge (refused): a quote that is not on the pledge page | [`0x1929c5e078...`](https://explorer-studio.genlayer.com/tx/0x1929c5e0785968308fe88377177a8932b0a56b3a781b18a26f77a39eb214e85e) | ACCEPTED | failed | not final |
| register_pledge | [`0xd58c40fb11...`](https://explorer-studio.genlayer.com/tx/0xd58c40fb11e4dd8361dee67f459f8aa62caaa1e719c1564eb1909ed54ed0d12e) | ACCEPTED | success | accepted |
| register_pledge (refused): registering the same pledge twice | [`0x3bc01488c4...`](https://explorer-studio.genlayer.com/tx/0x3bc01488c49226daf127b04b05bdf824aeefa2d04e32529e6e3a62c968321a63) | ACCEPTED | failed | not final |
| submit_report (refused): a report outside the frozen prefix | [`0xa460c1ccfe...`](https://explorer-studio.genlayer.com/tx/0xa460c1ccfea5dede5e1b2506c57000b8930bd3140b4b2c27fac749dd71155072) | ACCEPTED | failed | not final |
| submit_report (refused): a report address with a dot segment | [`0xc1f14485f6...`](https://explorer-studio.genlayer.com/tx/0xc1f14485f6d72d849b95aba3eff9994504981623497e0c88cc436066f95fde21) | ACCEPTED | failed | not final |
| submit_report (refused): a report address with non-ASCII characters | [`0xe9c7a13b6f...`](https://explorer-studio.genlayer.com/tx/0xe9c7a13b6ff800f790ed17ae997e32c96c5d22bbabbb40558c4995d2f3d82177) | ACCEPTED | failed | not final |
| submit_report (refused): a report address that hides another host in its userinfo | [`0x22684ac551...`](https://explorer-studio.genlayer.com/tx/0x22684ac551280076ffe8e1411e95a8d4b59b65a66ce2e2f19c64f74289865cbb) | ACCEPTED | failed | not final |
| submit_report faithful | [`0xd5bfd6cbc1...`](https://explorer-studio.genlayer.com/tx/0xd5bfd6cbc13136d6b058848b518e412c7022fb2ad32e1bcc01bafccf494b48d9) | ACCEPTED | success | accepted |
| submit_report (refused): faithful: queuing the same report twice | [`0xed178aa7f9...`](https://explorer-studio.genlayer.com/tx/0xed178aa7f93f966b4ce2b4395dc40a4bb772454ddb0c91ec35692d7b729d814f) | ACCEPTED | failed | not final |
| evaluate_report faithful (validators read the report; this can take minutes) | [`0xbf3a8f9bf2...`](https://explorer-studio.genlayer.com/tx/0xbf3a8f9bf290c5e6425390a1d6d6255c14264abc9458559c00f4cf0f2ed33502) | ACCEPTED | success | accepted |
| submit_report (refused): faithful: auditing a settled report again | [`0x9050e84521...`](https://explorer-studio.genlayer.com/tx/0x9050e84521e049fbbc0d5cdd02dabdd0317ded01f350e5aa78d517a5b6898494) | ACCEPTED | failed | not final |
| submit_report silent | [`0x46f266184a...`](https://explorer-studio.genlayer.com/tx/0x46f266184a4f044afd75572432aed6d9955944059a948d81e9eaf530c3c5803d) | ACCEPTED | success | accepted |
| submit_report (refused): silent: queuing the same report twice | [`0x22e8e7daa5...`](https://explorer-studio.genlayer.com/tx/0x22e8e7daa55063272f472a6947f00d868f4589b20ad1062095c9134e8365c401) | ACCEPTED | failed | not final |
| evaluate_report silent (validators read the report; this can take minutes) | [`0x87f5e2c6de...`](https://explorer-studio.genlayer.com/tx/0x87f5e2c6dec055ec7bc288a50ddbeb87562cf68f27e5bd65381d58f740869071) | ACCEPTED | success | accepted |
| submit_report (refused): silent: auditing a settled report again | [`0x5cabc930bc...`](https://explorer-studio.genlayer.com/tx/0x5cabc930bc66e23d1492e926deccfac21868a14f43a40d1347036e999a68bed6) | ACCEPTED | failed | not final |
| submit_report disclosed | [`0x0153d91b71...`](https://explorer-studio.genlayer.com/tx/0x0153d91b71ce091935c90ccd6e1ffd8972e40bb2b0e2e60d4c6731e830622b10) | ACCEPTED | success | accepted |
| submit_report (refused): disclosed: queuing the same report twice | [`0x908205ea86...`](https://explorer-studio.genlayer.com/tx/0x908205ea86c1d02da56f17fb47b08e2da3210070cd702b18d857eff73e44d07c) | ACCEPTED | failed | not final |
| evaluate_report disclosed (validators read the report; this can take minutes) | [`0x596d98c790...`](https://explorer-studio.genlayer.com/tx/0x596d98c7903cefd4e421989bd0eddf8df97cb2032b9f3955a716b0b611cc128c) | ACCEPTED | success | accepted |
| submit_report (refused): disclosed: auditing a settled report again | [`0xc6c3ea89a0...`](https://explorer-studio.genlayer.com/tx/0xc6c3ea89a0b73fb7876c29a300a3afcc29c3283ab9e3c66af9b1a888faca2bb4) | ACCEPTED | failed | not final |
| submit_report withheld | [`0x16f8f60bb4...`](https://explorer-studio.genlayer.com/tx/0x16f8f60bb4dd360976bf38dde7f64cc2e3d203de3f3999683aaa901c9382df19) | ACCEPTED | success | accepted |
| submit_report (refused): withheld: queuing the same report twice | [`0x13dbcf57ef...`](https://explorer-studio.genlayer.com/tx/0x13dbcf57efa6e931cf4c563aa1f477ec18728861f146e8a0bbe8bbed5bb6b20e) | ACCEPTED | failed | not final |
| evaluate_report withheld (validators read the report; this can take minutes) | [`0x0ac82fc4ad...`](https://explorer-studio.genlayer.com/tx/0x0ac82fc4ad068fee87b6a79ce5f7f8c435ab665e076f7b1a174af9dc13a603e4) | ACCEPTED | success | accepted |

## Notes

- Pledge PLG-0001 under publisher scope ominous-space-rotary-phone-96qj54v74r57fpx6x-4173.app.github.dev.
- Transactions were recorded when ACCEPTED and not yet FINALIZED; run with --await-finality to wait.
- Verdicts come from real validators and real models and are not deterministic. A DIFF row is a recorded observation, not a defect.

