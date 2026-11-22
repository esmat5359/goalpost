# Contract API (1.4.0)

Every view returns JSON text unless noted. `null` means "no such record". Write methods raise a refusal
that the network reports as a failed execution; nothing is stored when they do.

## Writes

| Method | Arguments | Returns | Notes |
|---|---|---|---|
| `register_pledge` | `title, kind, pledge_url, report_prefix, elements_json` | pledge id | Validators fetch the page, check every quote verbatim and the prefix declaration. Registers the pledge under its publisher scope. |
| `submit_report` | `pledge_id, report_url, period` | audit id | Anyone may call. The address must lie under the frozen prefix. Spelling variants of one report are one report. Uses the pledge's report index; reads no earlier audit. |
| `evaluate_report` | `audit_id` | verdict | Validators fetch the report and a model classifies each element. The contract accepts only claims it can check against the text. |
| `check_pledge_integrity` | `pledge_id` | integrity state | Re-fetches the pledge page. A new edit episode is counted once, on the pledge and on its publisher. |
| `retire_pledge` | `pledge_id` | status | Registrant only. History and strikes stay. |

`kind` is one of `contract_info().kinds`; each element is `{key, dimension, quote, anchors}` with `dimension`
from `contract_info().dimensions`.

## Views

| Method | Arguments | Returns |
|---|---|---|
| `contract_info` | none | name, version, runner, kinds, dimensions, sorts, features, authority tables, limits |
| `stats` | none | `{pledges, audits, settled, silent_moves, edits_detected, publishers}` |
| `list_pledges` | `offset, limit` | `{total, offset, items: PledgeSummary[]}`, newest first, `limit` at most 50 |
| `get_pledge_bundle` | `pledge_id` | `{pledge, audits}` or `null` |
| `get_audit_bundle` | `audit_id` | `{audit, pledge}` or `null` |
| `list_publishers` | `offset, limit, sort` | `{total, offset, sort, items: PublisherSummary[]}` |
| `get_publisher` | `scope` | `{publisher, pledge_count, pledges}` or `null` |
| `search_pledges` | `query, limit` | `{query, items: PledgeSummary[]}` |
| `get_drift` | `pledge_id` | drift table or `null` |
| `standing_of` | `pledge_id` | `UNAUDITED`, `HELD`, `REVISED`, `PARTIAL` or `MOVED` (text) |
| `strikes_of` | `pledge_id` | integer |
| `recompute_attestation` | `audit_id` | hash (text) |

### PublisherSummary

```json
{
  "scope": "github.com/acme", "publisher_id": "PUB-0001",
  "first_seen": 1790000000, "last_activity": 1790003600,
  "pledges": 3, "active": 2, "retired": 1,
  "audits_settled": 5,
  "verdicts": {"KEPT": 1, "MOVED_DISCLOSED": 1, "INCOMPLETE": 0, "MOVED_SILENTLY": 2, "INCONCLUSIVE": 1},
  "strikes": 2, "edits_detected": 0
}
```

The record is the exact sum of the pledges and audits under the scope. `strikes` equals the sum of the
pledges' strikes; the live suite checks this after every audit. `sort` is `recent` (newest scope first),
`strikes` or `pledges`; anything else is treated as `recent`. At most the newest 500 scopes are ranked.

### Drift table

```json
{
  "pledge_id": "PLG-0001",
  "elements": [{"key": "emissions_target", "dimension": "target"}],
  "rows": [{"audit_id": "AUD-0002", "period": "FY2026", "verdict": "MOVED_SILENTLY",
            "report_url": "https://...", "evaluated_at": 1790000000,
            "statuses": {"emissions_target": "MOVED_SILENT"}}],
  "current": {"emissions_target": "MOVED_SILENT"},
  "first_silent": {"emissions_target": "AUD-0002"},
  "ever_moved": ["emissions_target"]
}
```

Rows are settled audits that recorded element statuses, oldest first. A row whose verdict is `INCONCLUSIVE` is
shown but never becomes `current`. An unreadable report has no element statuses and so no row.

### Search

Case-insensitive substring match on title, pledge id, pledge address, publisher scope and registrant address.
Queries shorter than 2 or longer than 80 characters return no items. Only the newest 500 pledges are scanned.

## Pledge record additions in 1.4.0

`reports` is the compact report index: `[audit_id, fingerprint, state, verdict]` per audit. It exists so a
submission does not have to read every earlier audit, and the live suite checks that it mirrors the audits.

## Refusals

The messages are stable enough to match on, but the code is the reference. Examples a caller should expect:
`must not contain control, invisible or direction-changing characters`, `must be plain ASCII`,
`has no publisher a namespace` (a flat shared host), `not found verbatim`, `already registered`,
`already queued as AUD-...`, `already audited as AUD-...; publish corrections at a new URL`,
`this pledge has reached its audit limit`.

## Evaluation flags

| Flag | Meaning |
|---|---|
| `excerpt_unrelated_to_pledge` | A move claim cited text that shares no content with the pledged sentence. |
| `disclosure_not_about_a_change` | The cited disclosure has no change wording. |
| `disclosure_not_about_the_commitment` | The cited disclosure is not about this commitment (1.4.0). |
| `kept_excerpt_hedges_or_negates` | A KEPT claim's excerpt adds a hedge or negation (1.4.0). |
| `anchor_missing_from_kept_excerpt` | A KEPT claim's excerpt lacks a frozen anchor. |
| `report_truncated_absence_unproven` | Absence cannot be proven from a truncated report. |

See `src/lib/format.ts` for the full list and the wording shown in the console.
