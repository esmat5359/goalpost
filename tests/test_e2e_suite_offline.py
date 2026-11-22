"""
Runs the real scripts/e2e-suite.mjs against the contract simulator (no network), then runs it again
against a simulator that lies, to prove the suite fails when the contract's views are wrong.
"""

import json
import os
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

from support import ROOT


def run_suite(extra_env=None, extra_args=()):
    node = shutil.which('node')
    if node is None:
        raise unittest.SkipTest('node is not installed')
    if not (ROOT / 'node_modules' / 'genlayer-js').exists():
        raise unittest.SkipTest('run `npm install` first: the live suite imports genlayer-js')
    out = tempfile.mkdtemp()
    env = dict(os.environ, GOALPOST_E2E_CLIENT=str(ROOT / 'tests' / 'fake_client.mjs'), GOALPOST_PRIVATE_KEY='0x' + '11' * 32, VITE_CONTRACT_ADDRESS='0x' + '22' * 20)
    env.update(extra_env or {})
    command = [node, '--import', str(ROOT / 'tests' / 'fake_net.mjs'), str(ROOT / 'scripts' / 'e2e-suite.mjs'), '--site', 'https://goalpost.example', '--out', out, *extra_args]
    result = subprocess.run(command, capture_output=True, text=True, timeout=240, cwd=str(ROOT), env=env)
    reports = sorted(Path(out).glob('*.json'))
    data = json.loads(reports[0].read_text()) if reports else None
    return result, data, out


class OfflineSuiteTests(unittest.TestCase):
    def test_the_suite_passes_against_the_simulator_and_writes_a_report(self):
        result, data, out = run_suite()
        self.assertEqual(result.returncode, 0, result.stdout[-3000:] + result.stderr[-2000:])
        self.assertIsNotNone(data)
        failed = [s for s in data['steps'] if s['status'] == 'FAIL']
        self.assertEqual(failed, [])
        diffs = [s for s in data['steps'] if s['status'] == 'DIFF']
        self.assertEqual(diffs, [], 'the simulator model is ideal, so every live expectation should match')
        names = ' | '.join(s['name'] for s in data['steps'])
        for expected in ('refused: a title with a direction override', 'refused: registering the same pledge twice', 'silent: strikes moved', 'publisher ledger, drift table'):
            self.assertIn(expected, names)
        markdown = next(Path(out).glob('*.md')).read_text()
        self.assertIn('**PASSED**', markdown)
        self.assertGreaterEqual(len(data['transactions']), 10)

    def test_the_suite_fails_when_the_publisher_ledger_lies(self):
        result, data, _ = run_suite({'SIM_BUG': 'publisher'}, ['--skip-negative', '--reports', 'silent'])
        self.assertEqual(result.returncode, 1, result.stdout[-2000:])
        self.assertTrue(any('publisher ledger' in s['name'] and s['status'] == 'FAIL' for s in data['steps']))

    def test_the_suite_fails_when_the_drift_table_lies(self):
        result, data, _ = run_suite({'SIM_BUG': 'drift'}, ['--skip-negative', '--reports', 'faithful'])
        self.assertEqual(result.returncode, 1)
        self.assertTrue(any('drift table' in s['name'] and s['status'] == 'FAIL' for s in data['steps']))

    def test_the_suite_fails_when_the_attestation_does_not_recompute(self):
        result, data, _ = run_suite({'SIM_BUG': 'attestation'}, ['--skip-negative', '--reports', 'faithful'])
        self.assertEqual(result.returncode, 1)
        self.assertTrue(any('contract recomputes' in s['name'] and s['status'] == 'FAIL' for s in data['steps']))


if __name__ == '__main__':
    unittest.main()
