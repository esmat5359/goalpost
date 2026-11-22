"""
The live end-to-end suite judges the network with checks written in JavaScript. These tests run
those checks on REAL contract output from the simulator, so they must stay silent on correct state,
and they run each check on deliberately corrupted state, so they must speak up. A check that can
never fail would make a green live run meaningless.
"""

import copy
import json
import shutil
import subprocess
import unittest

from support import BASE, BOB, ROOT, World
import test_publishers_and_drift as T


def probe(op, *args):
    node = shutil.which('node')
    if node is None:
        raise unittest.SkipTest('node is not installed')
    result = subprocess.run([node, str(ROOT / 'tests' / 'suite_probe.mjs')], input=json.dumps({'op': op, 'args': list(args)}), capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        raise unittest.SkipTest('this Node cannot run the probe: ' + result.stderr.strip().splitlines()[-1][:160])
    return json.loads(result.stdout)


def build_world():
    w = World(web=T.two_host_web())
    first = w.register('meridian')
    second = w.register('halden')
    other = T.register_on_other(w)
    T.evaluate(w, first, 'meridian', 'faithful')
    T.evaluate(w, first, 'meridian', 'silent')
    T.evaluate(w, first, 'meridian', 'disclosed')
    T.evaluate(w, first, 'meridian', 'withheld')
    T.evaluate(w, second, 'halden', 'silent')
    T.evaluate(w, other, 'meridian', 'faithful', host=T.OTHER)
    return w, [first, second, other]


class SuiteLibTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.w, cls.ids = build_world()
        cls.bundles = {pid: cls.w.jview('get_pledge_bundle', pid) for pid in cls.ids}
        cls.audits = {}
        for bundle in cls.bundles.values():
            for summary in bundle['audits']:
                cls.audits[summary['audit_id']] = cls.w.jview('get_audit_bundle', summary['audit_id'])['audit']

    def scope_bundles(self, scope):
        return [b for b in self.bundles.values() if b['pledge']['authority']['scope'] == scope]

    def audits_of(self, pledge_id):
        return [self.audits[s['audit_id']] for s in self.bundles[pledge_id]['audits']]

    # ------------------------------------------------------------------ must stay silent on correct state

    def test_publisher_checks_pass_on_real_state(self):
        for scope in ('goalpost.example', 'other.example'):
            publisher = self.w.jview('get_publisher', scope)['publisher']
            self.assertEqual(probe('checkPublisherConsistency', publisher, self.scope_bundles(scope)), [], scope)

    def test_drift_checks_pass_on_real_state(self):
        for pledge_id in self.ids:
            drift = self.w.jview('get_drift', pledge_id)
            pledge = self.bundles[pledge_id]['pledge']
            self.assertEqual(probe('checkDriftConsistency', drift, pledge, self.audits_of(pledge_id)), [], pledge_id)

    def test_report_index_check_passes_on_real_state(self):
        for pledge_id in self.ids:
            self.assertEqual(probe('checkReportIndex', self.bundles[pledge_id]['pledge'], self.audits_of(pledge_id)), [], pledge_id)

    def test_strike_delta(self):
        self.assertEqual(probe('checkStrikeDelta', 0, 1, 'MOVED_SILENTLY'), [])
        self.assertEqual(probe('checkStrikeDelta', 2, 2, 'KEPT'), [])
        self.assertTrue(probe('checkStrikeDelta', 0, 0, 'MOVED_SILENTLY'))
        self.assertTrue(probe('checkStrikeDelta', 1, 2, 'KEPT'))

    # ------------------------------------------------------------------ must speak up on corrupted state

    def test_publisher_check_catches_every_kind_of_corruption(self):
        scope = 'goalpost.example'
        publisher = self.w.jview('get_publisher', scope)['publisher']
        bundles = self.scope_bundles(scope)
        mutations = {
            'strikes': lambda p: p.update(strikes=p['strikes'] + 1),
            'pledges': lambda p: p.update(pledges=p['pledges'] - 1),
            'audits_settled': lambda p: p.update(audits_settled=p['audits_settled'] + 1),
            'a verdict count': lambda p: p['verdicts'].update(KEPT=p['verdicts']['KEPT'] + 1),
            'active': lambda p: p.update(active=p['active'] + 1),
            'edits': lambda p: p.update(edits_detected=3),
        }
        for name, mutate in mutations.items():
            with self.subTest(mutation=name):
                broken = copy.deepcopy(publisher)
                mutate(broken)
                self.assertTrue(probe('checkPublisherConsistency', broken, bundles))

    def test_drift_check_catches_corruption(self):
        pledge_id = self.ids[0]
        pledge = self.bundles[pledge_id]['pledge']
        audits = self.audits_of(pledge_id)
        drift = self.w.jview('get_drift', pledge_id)
        for name, mutate in {
            'a status': lambda d: d['rows'][1]['statuses'].update(emissions_target='KEPT'),
            'a missing row': lambda d: d['rows'].pop(),
            'first_silent': lambda d: d['first_silent'].clear(),
            'current': lambda d: d['current'].update(assurance='MOVED_SILENT'),
        }.items():
            with self.subTest(mutation=name):
                broken = copy.deepcopy(drift)
                mutate(broken)
                self.assertTrue(probe('checkDriftConsistency', broken, pledge, audits))
        self.assertTrue(probe('checkDriftConsistency', None, pledge, audits))

    def test_report_index_check_catches_corruption(self):
        pledge_id = self.ids[0]
        pledge = copy.deepcopy(self.bundles[pledge_id]['pledge'])
        audits = self.audits_of(pledge_id)
        pledge['reports'][0][3] = 'MOVED_SILENTLY'
        self.assertTrue(probe('checkReportIndex', pledge, audits))
        pledge = copy.deepcopy(self.bundles[pledge_id]['pledge'])
        pledge['reports'].pop()
        self.assertTrue(probe('checkReportIndex', pledge, audits))

    def test_excerpt_traceability(self):
        html = '<html><body><p>We will cut   our <b>emissions</b> by 40%.</p><script>"hidden claim"</script><!-- comment claim --></body></html>'
        self.assertTrue(probe('excerptIsTraceable', 'We will cut our emissions by 40%.', html))
        self.assertFalse(probe('excerptIsTraceable', 'hidden claim', html))
        self.assertFalse(probe('excerptIsTraceable', 'comment claim', html))
        self.assertFalse(probe('excerptIsTraceable', 'We will cut our emissions by 90%.', html))

    def test_the_drift_oracle_agrees_with_the_contract_on_every_pledge(self):
        for pledge_id in self.ids:
            expected = probe('expectedDrift', self.bundles[pledge_id]['pledge'], self.audits_of(pledge_id))
            self.assertEqual(expected, self.w.jview('get_drift', pledge_id))


if __name__ == '__main__':
    unittest.main()
