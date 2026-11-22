"""The browser recomputes audit attestations on its own. It must agree with the contract byte for byte."""

import json
import shutil
import subprocess
import unittest

from ideal import all_cases
from support import ROOT, World, fixed_llm, load_contract_module
from ideal import answer_for

M = load_contract_module()


def run_probe(cases):
    node = shutil.which('node')
    if node is None:
        return None, 'node is not installed'
    result = subprocess.run([node, str(ROOT / 'tests' / 'attestation_probe.mjs')], input=json.dumps({'cases': cases}), capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        return None, 'this Node cannot strip TypeScript types: ' + result.stderr.strip().splitlines()[-1][:160]
    return json.loads(result.stdout), ''


def synthetic(excerpt):
    audit = {
        'audit_id': 'AUD-0001',
        'pledge_id': 'PLG-0001',
        'report_url': 'https://acme.example/reports/2026.html',
        'period': 'FY2026',
        'verdict': 'MOVED_SILENTLY',
        'elements': [{'key': 'k1', 'status': 'MOVED_SILENT', 'report_excerpt': excerpt, 'disclosure_excerpt': ''}],
        'evaluated_at': 1790000000,
    }
    return audit


class AttestationParityTests(unittest.TestCase):
    def test_every_demonstration_verdict(self):
        cases, expected = [], []
        for scenario, report, case in all_cases():
            w = World(llm=fixed_llm(answer_for(scenario, report)))
            pledge_id = w.register(scenario)
            audit_id = w.submit(pledge_id, scenario, report)
            w.tx('evaluate_report', audit_id)
            bundle = w.jview('get_audit_bundle', audit_id)
            audit = bundle['audit']
            commitment = w.jview('get_pledge_bundle', pledge_id)['pledge']['commitment']
            cases.append({'audit': audit, 'commitment': commitment})
            expected.append(audit['attestation'])
        probe, reason = run_probe(cases)
        if probe is None:
            self.skipTest(reason)
        self.assertEqual(probe, expected)

    def test_awkward_text_is_escaped_exactly_like_python(self):
        texts = [
            'plain ascii',
            'quote " backslash \\ slash /',
            'controls \x00 \x01 \x08 \x09 \x0a \x0c \x0d \x1f \x7f',
            'latin \u00e9\u00e8 and dashes \u2013 \u2014 and nbsp \u00a0',
            'astral \U0001F600 \U00010348 and bmp \uffff \ud7ff \ue000',
            'rtl \u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645 \u202e done',
            '',
        ]
        cases = [{'audit': synthetic(text), 'commitment': '0x' + 'ab' * 32} for text in texts]
        expected = [M._attestation_of(case['audit'], {'commitment': case['commitment']}) for case in cases]
        probe, reason = run_probe(cases)
        if probe is None:
            self.skipTest(reason)
        self.assertEqual(probe, expected)


if __name__ == '__main__':
    unittest.main()
