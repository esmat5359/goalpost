"""
Regression tests for the 1.4.0 fixes. Each weakness below was reproduced against contract 1.3.0
before it was fixed (see CHANGELOG.md), and each test fails on 1.3.0.
"""

import json
import unittest

from ideal import answer_for
from support import World, evidence_web, fixed_llm, item, load_contract_module, model_answer, url

M = load_contract_module()

QUOTE = 'We will cut our absolute Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2030, measured against our 2019 baseline.'


def element(quote=QUOTE, anchors=('absolute', '40%')):
    return M._parse_elements(json.dumps([{'key': 'target', 'dimension': 'target', 'quote': quote, 'anchors': list(anchors)}]))[0]


def judge(status, report, disclosure='', quote=QUOTE, anchors=('absolute', '40%')):
    answer = {'status': status, 'report_excerpt': report, 'disclosure_excerpt': disclosure}
    return M._judge_element(element(quote, anchors), answer, M._norm(report + ' ' + disclosure))


class RelatednessTests(unittest.TestCase):
    def test_filler_words_do_not_make_two_sentences_related(self):
        self.assertFalse(M._related(QUOTE, 'We will open a new office in the north.'))

    def test_a_single_digit_is_not_content(self):
        self.assertFalse(M._related(QUOTE, 'See section 1 for the car park.'))

    def test_real_overlap_still_counts(self):
        self.assertTrue(M._related(QUOTE, 'Our emissions intensity fell 12% in 2025.'))
        self.assertTrue(M._related(QUOTE, 'The 2019 figure was restated.'))

    def test_a_silent_accusation_needs_evidence_about_the_commitment(self):
        result = judge('MOVED_SILENT', 'We will open a new office in the north.')
        self.assertEqual((result['status'], result['flag']), ('UNSUPPORTED', 'excerpt_unrelated_to_pledge'))

    def test_end_to_end_an_unrelated_sentence_earns_no_strike(self):
        web = evidence_web()
        key = url('/evidence/meridian/reports/2026-faithful.html')
        status, body = web[key]
        web[key] = (status, body.replace('Assurance', 'We will open a new office in the north. Assurance', 1))
        honest = answer_for('meridian', 'faithful')['elements']
        reply = model_answer([item('emissions_target', 'MOVED_SILENT', 'We will open a new office in the north.')] + honest[1:])
        w = World(web=web, llm=fixed_llm(reply))
        pledge_id = w.register()
        audit_id = w.submit(pledge_id, 'meridian', 'faithful')
        self.assertEqual(w.tx('evaluate_report', audit_id), 'INCONCLUSIVE')
        self.assertEqual(w.jview('get_pledge_bundle', pledge_id)['pledge']['strikes'], 0)
        flags = {e['key']: e['flag'] for e in w.jview('get_audit_bundle', audit_id)['audit']['elements']}
        self.assertEqual(flags['emissions_target'], 'excerpt_unrelated_to_pledge')


class DisclosureTests(unittest.TestCase):
    MOVED = 'We will cut our emissions intensity of Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2035.'

    def test_a_sentence_that_merely_says_new_is_not_a_disclosure(self):
        result = judge('MOVED_DISCLOSED', self.MOVED, 'We introduced a new reporting format this year.')
        self.assertEqual((result['status'], result['flag']), ('UNSUPPORTED', 'disclosure_not_about_the_commitment'))

    def test_a_generic_admission_that_names_the_pledge_counts(self):
        result = judge('MOVED_DISCLOSED', self.MOVED, 'This is a change from the original pledge.')
        self.assertEqual(result['status'], 'MOVED_DISCLOSED')

    def test_a_disclosure_that_shares_content_with_the_new_wording_counts(self):
        result = judge('MOVED_DISCLOSED', self.MOVED, 'Emissions are now reported on an intensity basis.')
        self.assertEqual(result['status'], 'MOVED_DISCLOSED')

    def test_end_to_end_a_decoy_cannot_turn_a_silent_move_into_a_disclosed_one(self):
        web = evidence_web()
        key = url('/evidence/meridian/reports/2026-silent.html')
        status, body = web[key]
        web[key] = (status, body.replace('Operations', 'We introduced a new reporting format this year. Operations', 1))
        silent = answer_for('meridian', 'silent')['elements']
        reply = model_answer(
            [item('emissions_target', 'MOVED_DISCLOSED', silent[0]['report_excerpt'], 'We introduced a new reporting format this year.')]
            + silent[1:]
        )
        w = World(web=web, llm=fixed_llm(reply))
        pledge_id = w.register()
        audit_id = w.submit(pledge_id, 'meridian', 'silent')
        w.tx('evaluate_report', audit_id)
        elements = {e['key']: e for e in w.jview('get_audit_bundle', audit_id)['audit']['elements']}
        self.assertEqual(elements['emissions_target']['status'], 'UNSUPPORTED')
        self.assertEqual(elements['emissions_target']['flag'], 'disclosure_not_about_the_commitment')


class SofteningTests(unittest.TestCase):
    def test_a_restatement_is_kept(self):
        self.assertEqual(judge('KEPT', QUOTE)['status'], 'KEPT')

    def test_a_hedge_the_pledge_did_not_have_blocks_kept(self):
        for text in (
            'We aim to cut our absolute Scope 1 and Scope 2 greenhouse gas emissions by 40% by 2030, measured against our 2019 baseline.',
            'We will cut our absolute emissions by 40% by 2030, subject to regulatory approval, measured against our 2019 baseline.',
            'We hope to cut our absolute emissions by 40% by 2030 against our 2019 baseline.',
            'We will try to cut our absolute emissions by 40% by 2030 against our 2019 baseline.',
        ):
            with self.subTest(text=text):
                result = judge('KEPT', text)
                self.assertEqual((result['status'], result['flag']), ('UNSUPPORTED', 'kept_excerpt_hedges_or_negates'))

    def test_a_negation_the_pledge_did_not_have_blocks_kept(self):
        result = judge('KEPT', 'We will not cut our absolute emissions by 40% by 2030 against our 2019 baseline.')
        self.assertEqual(result['flag'], 'kept_excerpt_hedges_or_negates')
        result = judge('KEPT', 'We no longer commit to cutting our absolute emissions by 40% by 2030 against our 2019 baseline.')
        self.assertEqual(result['flag'], 'kept_excerpt_hedges_or_negates')

    def test_a_marker_the_pledge_itself_contains_is_not_an_addition(self):
        quote = 'We will never emit more than 40% of our 2019 absolute emissions.'
        self.assertEqual(judge('KEPT', quote, quote=quote, anchors=('never', '40%'))['status'], 'KEPT')

    def test_a_month_named_may_is_not_a_hedge(self):
        result = judge('KEPT', 'We will cut our absolute emissions by 40% by May 2030 against our 2019 baseline.')
        self.assertEqual(result['status'], 'KEPT')

    def test_the_demonstration_reports_are_unaffected(self):
        for scenario, report in (('meridian', 'faithful'), ('halden', 'faithful')):
            w = World(llm=fixed_llm(answer_for(scenario, report)))
            pledge_id = w.register(scenario)
            audit_id = w.submit(pledge_id, scenario, report)
            self.assertEqual(w.tx('evaluate_report', audit_id), 'KEPT')


class HiddenCharacterTests(unittest.TestCase):
    def rejected(self, text, label='title'):
        with self.assertRaises(Exception) as caught:
            M._validate_text(text, label, 1, 400)
        self.assertIn('invisible', str(caught.exception))

    def test_direction_overrides_and_invisible_characters_are_refused(self):
        for text in ('Fine \u202etitle', 'Zero\u200bwidth', 'bom\ufeffhere', 'null\x00byte', 'del\x7fchar', 'c1\x9fchar', 'isolate\u2066x', 'joiner\u2060x'):
            with self.subTest(text=repr(text)):
                self.rejected(text)

    def test_every_free_text_field_is_checked(self):
        bad = 'x\u202ey'
        with self.assertRaises(Exception):
            M._parse_elements(json.dumps([{'key': 'k1', 'dimension': 'target', 'quote': 'We will do this thing ' + bad, 'anchors': ['thing']}]))
        with self.assertRaises(Exception):
            M._parse_elements(json.dumps([{'key': 'k1', 'dimension': 'target', 'quote': 'We will do this thing well', 'anchors': ['th\u200bing']}]))

    def test_scripts_that_need_joiners_still_work(self):
        # Persian text with a zero-width non-joiner, written as escapes: the repository stays English-only.
        persian = '\u0645\u06cc\u200c\u062e\u0648\u0627\u0647\u0645 \u0627\u0646\u062a\u0634\u0627\u0631 \u06af\u0627\u0632\u0647\u0627\u06cc \u06af\u0644\u062e\u0627\u0646\u0647\u200c\u0627\u06cc \u0631\u0627 \u06a9\u0627\u0647\u0634 \u062f\u0647\u0645'
        self.assertEqual(M._validate_text(persian, 'title', 3, 120), persian)
        self.assertEqual(M._validate_text('left\u200eright\u200f', 'title', 3, 120), 'left\u200eright\u200f')

    def test_urls_must_be_plain_ascii(self):
        for address in ('https://acme.example/reports/caf\u00e9.html', 'https://acme.example/reports/\u202e2026.html', 'https://acme.example/r\u0430ports/'):
            with self.subTest(address=address):
                with self.assertRaises(Exception) as caught:
                    M._validate_public_https_url(address, 'report_url')
                self.assertIn('ASCII', str(caught.exception))
        self.assertTrue(M._validate_public_https_url('https://acme.example/reports/caf%C3%A9.html', 'u').endswith('caf%C3%A9.html'))


class SharedHostTableTests(unittest.TestCase):
    def test_more_namespaced_hosts(self):
        self.assertEqual(M._publisher_scope('https://x.com/Acme/status/1', 'u'), 'x.com/acme')
        self.assertEqual(M._publisher_scope('https://www.linkedin.com/company/acme/posts', 'u'), 'linkedin.com/company/acme')
        self.assertEqual(M._publisher_scope('https://dev.to/acme/post', 'u'), 'dev.to/acme')

    def test_more_flat_hosts_are_refused(self):
        for address in ('https://telegra.ph/Pledge-01-01', 'https://bit.ly/abc', 'https://imgur.com/a/x', 'https://mega.nz/file/x'):
            with self.subTest(address=address):
                with self.assertRaises(Exception) as caught:
                    M._publisher_scope(address, 'pledge_url')
                self.assertIn('no publisher a namespace', str(caught.exception))


if __name__ == '__main__':
    unittest.main()
