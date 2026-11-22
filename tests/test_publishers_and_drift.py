"""Publisher ledger, drift matrix, pledge search and the per-pledge report index (contract 1.4.0)."""

import json
import unittest
from unittest import mock

from ideal import answer_for
from support import ALICE, BASE, BOB, World, evidence_web, expect_user_error, fixed_llm, item, model_answer, url

OTHER = 'https://other.example'


def two_host_web():
    web = dict(evidence_web())
    for key, (status, body) in list(evidence_web().items()):
        web[key.replace(BASE, OTHER)] = (status, body.replace(BASE, OTHER))
    return web


def register_on_other(w, scenario='meridian'):
    return w.register(
        scenario,
        pledge_url=OTHER + '/evidence/%s/pledge.html' % scenario,
        report_prefix=OTHER + '/evidence/%s/reports/' % scenario,
    )


def evaluate(w, pledge_id, scenario, report, host=BASE):
    path = next(r['path'] for r in __import__('support').scenarios()[scenario]['reports'] if r['id'] == report)
    period = next(r['period'] for r in __import__('support').scenarios()[scenario]['reports'] if r['id'] == report)
    audit_id = w.tx('submit_report', pledge_id, host + path, period, sender=BOB)
    verdict = w.tx('evaluate_report', audit_id, llm=fixed_llm(answer_for(scenario, report)))
    return audit_id, verdict


class PublisherLedgerTests(unittest.TestCase):
    def test_registering_creates_the_publisher_record(self):
        w = World()
        w.register()
        page = w.jview('list_publishers', 0, 10, 'recent')
        self.assertEqual(page['total'], 1)
        record = page['items'][0]
        self.assertEqual(record['scope'], 'goalpost.example')
        self.assertEqual((record['pledges'], record['active'], record['retired'], record['strikes']), (1, 1, 0, 0))
        self.assertNotIn('pledge_ids', record)
        self.assertEqual(w.jview('stats')['publishers'], 1)

    def test_a_second_pledge_on_the_same_scope_adds_to_the_same_record(self):
        w = World()
        w.register('meridian')
        w.register('halden')
        page = w.jview('list_publishers', 0, 10, 'recent')
        self.assertEqual(page['total'], 1)
        self.assertEqual(page['items'][0]['pledges'], 2)

    def test_verdicts_and_strikes_are_counted_per_settled_audit(self):
        w = World()
        pledge_id = w.register()
        evaluate(w, pledge_id, 'meridian', 'faithful')
        evaluate(w, pledge_id, 'meridian', 'silent')
        evaluate(w, pledge_id, 'meridian', 'disclosed')
        evaluate(w, pledge_id, 'meridian', 'partial')
        record = w.jview('get_publisher', 'goalpost.example')['publisher']
        self.assertEqual(record['audits_settled'], 4)
        self.assertEqual(record['strikes'], 1)
        self.assertEqual(
            record['verdicts'],
            {'KEPT': 1, 'MOVED_DISCLOSED': 1, 'MOVED_SILENTLY': 1, 'INCOMPLETE': 1, 'INCONCLUSIVE': 0},
        )

    def test_an_unreadable_report_counts_as_inconclusive_not_as_a_strike(self):
        w = World()
        pledge_id = w.register()
        _, verdict = evaluate(w, pledge_id, 'meridian', 'withheld')
        self.assertEqual(verdict, 'INCONCLUSIVE')
        record = w.jview('get_publisher', 'goalpost.example')['publisher']
        self.assertEqual((record['verdicts']['INCONCLUSIVE'], record['strikes']), (1, 0))

    def test_the_publisher_record_always_agrees_with_the_pledge_and_global_counters(self):
        w = World()
        pledge_id = w.register()
        evaluate(w, pledge_id, 'meridian', 'silent')
        pledge = w.jview('get_pledge_bundle', pledge_id)['pledge']
        record = w.jview('get_publisher', 'goalpost.example')['publisher']
        stats = w.jview('stats')
        self.assertEqual(record['strikes'], pledge['strikes'])
        self.assertEqual(record['strikes'], stats['silent_moves'])
        self.assertEqual(record['audits_settled'], stats['settled'])

    def test_a_page_edit_is_counted_once_per_episode(self):
        w = World()
        pledge_id = w.register()
        edited = dict(w.web)
        key = url('/evidence/meridian/pledge.html')
        status, body = edited[key]
        edited[key] = (status, body.replace('independent third-party', 'internal'))
        w.tx('check_pledge_integrity', pledge_id, web=edited)
        w.tx('check_pledge_integrity', pledge_id, web=edited)
        self.assertEqual(w.jview('get_publisher', 'goalpost.example')['publisher']['edits_detected'], 1)
        self.assertEqual(w.jview('stats')['edits_detected'], 1)

    def test_retiring_moves_a_pledge_from_active_to_retired(self):
        w = World()
        pledge_id = w.register()
        w.tx('retire_pledge', pledge_id, sender=ALICE)
        record = w.jview('get_publisher', 'goalpost.example')['publisher']
        self.assertEqual((record['active'], record['retired'], record['pledges']), (0, 1, 1))

    def test_different_hosts_are_different_publishers_and_sorting_works(self):
        w = World(web=two_host_web())
        first = w.register('meridian')
        w.register('halden')
        second = register_on_other(w)
        evaluate(w, second, 'meridian', 'silent', host=OTHER)
        evaluate(w, first, 'meridian', 'faithful')
        recent = [r['scope'] for r in w.jview('list_publishers', 0, 10, 'recent')['items']]
        by_pledges = [r['scope'] for r in w.jview('list_publishers', 0, 10, 'pledges')['items']]
        by_strikes = [r['scope'] for r in w.jview('list_publishers', 0, 10, 'strikes')['items']]
        self.assertEqual(recent, ['other.example', 'goalpost.example'])
        self.assertEqual(by_pledges, ['goalpost.example', 'other.example'])
        self.assertEqual(by_strikes, ['other.example', 'goalpost.example'])

    def test_unknown_sort_falls_back_to_recent_and_paging_is_bounded(self):
        w = World(web=two_host_web())
        w.register('meridian')
        register_on_other(w)
        page = w.jview('list_publishers', 0, 1, 'nonsense')
        self.assertEqual((page['sort'], len(page['items']), page['total']), ('recent', 1, 2))
        self.assertEqual(w.jview('list_publishers', 5, 10, 'recent')['items'], [])
        self.assertEqual(len(w.jview('list_publishers', -3, 9999, 'recent')['items']), 2)

    def test_get_publisher_normalises_the_scope_and_lists_pledges_newest_first(self):
        w = World()
        w.register('meridian')
        w.register('halden')
        bundle = w.jview('get_publisher', '  GoalPost.Example ')
        self.assertEqual([p['pledge_id'] for p in bundle['pledges']], ['PLG-0002', 'PLG-0001'])
        self.assertEqual(bundle['pledge_count'], 2)
        self.assertEqual(bundle['pledges'][0]['scope'], 'goalpost.example')
        self.assertEqual(w.view('get_publisher', 'nobody.example'), 'null')

    def test_a_failed_transaction_leaves_no_trace_in_the_ledger(self):
        w = World()
        with expect_user_error(self, 'not found verbatim'):
            w.register(elements_json=json.dumps([{'key': 'x1', 'dimension': 'target', 'quote': 'A sentence that is not on the page at all.', 'anchors': ['sentence']}]))
        self.assertEqual(w.jview('list_publishers', 0, 10, 'recent')['total'], 0)
        self.assertEqual(w.jview('stats')['publishers'], 0)


class SearchTests(unittest.TestCase):
    def setUp(self):
        self.w = World(web=two_host_web())
        self.w.register('meridian')
        self.w.register('halden')
        register_on_other(self.w)

    def ids(self, query, limit=10):
        return [p['pledge_id'] for p in self.w.jview('search_pledges', query, limit)['items']]

    def test_matches_title_case_insensitively_newest_first(self):
        self.assertEqual(self.ids('MERIDIAN'), ['PLG-0003', 'PLG-0001'])

    def test_matches_id_host_and_owner(self):
        self.assertEqual(self.ids('plg-0002'), ['PLG-0002'])
        self.assertEqual(self.ids('other.example'), ['PLG-0003'])
        self.assertEqual(self.ids(ALICE.as_hex[2:10]), ['PLG-0003', 'PLG-0002', 'PLG-0001'])

    def test_short_or_overlong_queries_return_nothing(self):
        self.assertEqual(self.ids('m'), [])
        self.assertEqual(self.ids('m' * 81), [])
        self.assertEqual(self.ids('   '), [])

    def test_limit_is_respected(self):
        self.assertEqual(len(self.ids('example', 2)), 2)


class DriftTests(unittest.TestCase):
    def test_rows_current_and_first_silent(self):
        w = World()
        pledge_id = w.register()
        evaluate(w, pledge_id, 'meridian', 'faithful')
        silent_id, _ = evaluate(w, pledge_id, 'meridian', 'silent')
        evaluate(w, pledge_id, 'meridian', 'disclosed')
        drift = w.jview('get_drift', pledge_id)
        self.assertEqual([r['verdict'] for r in drift['rows']], ['KEPT', 'MOVED_SILENTLY', 'MOVED_DISCLOSED'])
        self.assertEqual([e['key'] for e in drift['elements']], ['emissions_target', 'target_scope', 'assurance'])
        self.assertEqual(drift['rows'][0]['statuses'], {'emissions_target': 'KEPT', 'target_scope': 'KEPT', 'assurance': 'KEPT'})
        self.assertEqual(drift['first_silent'], {'emissions_target': silent_id, 'target_scope': silent_id})
        self.assertEqual(drift['current']['emissions_target'], 'MOVED_DISCLOSED')
        self.assertEqual(drift['ever_moved'], ['emissions_target', 'target_scope'])

    def test_an_unreadable_report_leaves_no_row(self):
        w = World()
        pledge_id = w.register()
        evaluate(w, pledge_id, 'meridian', 'faithful')
        evaluate(w, pledge_id, 'meridian', 'withheld')
        drift = w.jview('get_drift', pledge_id)
        self.assertEqual(len(drift['rows']), 1)

    def test_an_inconclusive_audit_with_statuses_is_shown_but_is_not_current(self):
        w = World()
        pledge_id = w.register()
        evaluate(w, pledge_id, 'meridian', 'faithful')
        bad = model_answer([item('emissions_target', 'KEPT', 'Not an excerpt that exists anywhere in this report.')] + answer_for('meridian', 'silent')['elements'][1:])
        audit_id = w.tx('submit_report', pledge_id, url('/evidence/meridian/reports/2026-partial.html'), 'FY2026', sender=BOB)
        self.assertEqual(w.tx('evaluate_report', audit_id, llm=fixed_llm(bad)), 'INCONCLUSIVE')
        drift = w.jview('get_drift', pledge_id)
        self.assertEqual(drift['rows'][-1]['verdict'], 'INCONCLUSIVE')
        self.assertEqual(drift['current']['emissions_target'], 'KEPT')

    def test_a_pledge_without_audits_has_an_empty_table(self):
        w = World()
        pledge_id = w.register()
        drift = w.jview('get_drift', pledge_id)
        self.assertEqual((drift['rows'], drift['current'], drift['first_silent'], drift['ever_moved']), ([], {}, {}, []))

    def test_unknown_pledge_is_null(self):
        self.assertEqual(World().view('get_drift', 'PLG-9999'), 'null')


class ReportIndexTests(unittest.TestCase):
    def test_the_index_tracks_state_and_verdict(self):
        w = World()
        pledge_id = w.register()
        audit_id = w.submit(pledge_id, 'meridian', 'faithful')
        index = w.jview('get_pledge_bundle', pledge_id)['pledge']['reports']
        self.assertEqual([(e[0], e[2], e[3]) for e in index], [(audit_id, 'PENDING', '')])
        self.assertEqual(len(index[0][1]), 20)
        w.tx('evaluate_report', audit_id, llm=fixed_llm(answer_for('meridian', 'faithful')))
        index = w.jview('get_pledge_bundle', pledge_id)['pledge']['reports']
        self.assertEqual([(e[0], e[2], e[3]) for e in index], [(audit_id, 'SETTLED', 'KEPT')])

    def test_submitting_does_not_read_earlier_audits(self):
        w = World()
        pledge_id = w.register()
        evaluate(w, pledge_id, 'meridian', 'faithful')
        with mock.patch.object(type(w.contract), '_load_audit', side_effect=AssertionError('read an audit')):
            w.submit(pledge_id, 'meridian', 'silent')

    def test_spelling_variants_of_an_audited_report_are_still_one_report(self):
        w = World()
        pledge_id = w.register()
        evaluate(w, pledge_id, 'meridian', 'silent')
        base = url('/evidence/meridian/reports/2026-silent.html')
        for variant in (
            base.replace('2026-silent', '2026-SILENT'),
            base + ';x=1',
            base.replace('/reports/', '/reports//'),
            base.replace('2026-silent', '2026%2Dsilent'),
        ):
            with self.subTest(variant=variant):
                with expect_user_error(self, 'already audited'):
                    w.tx('submit_report', pledge_id, variant, 'FY2026', sender=BOB)

    def test_a_failed_attempt_can_be_retried_but_a_finding_cannot(self):
        w = World()
        pledge_id = w.register()
        _, verdict = evaluate(w, pledge_id, 'meridian', 'withheld')
        self.assertEqual(verdict, 'INCONCLUSIVE')
        w.submit(pledge_id, 'meridian', 'withheld')


if __name__ == '__main__':
    unittest.main()
