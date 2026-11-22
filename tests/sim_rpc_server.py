"""
A line-delimited JSON server around the contract simulator, used by the offline run of the live
end-to-end suite. Reads {"id", "op": "read" | "write", "fn", "args"} on stdin, answers on stdout.
SIM_BUG makes one view lie, so a test can prove the suite notices: publisher | drift | attestation.
"""

import json
import os
import re
import sys

sys.path.insert(0, os.path.dirname(__file__))

from gensim import NoConsensus, UserError  # noqa: E402
from ideal import answer_for  # noqa: E402
from support import ALICE, World, fixed_llm, scenarios  # noqa: E402

BUG = os.environ.get('SIM_BUG', '')
world = World()
REPORT_PATH = re.compile(r'/evidence/([a-z]+)/reports/\d{4}-([a-z]+)\.html$')


def llm_for(audit_id):
    audit = world.jview('get_audit_bundle', audit_id)['audit']
    match = REPORT_PATH.search(audit['report_url'])
    scenario, report = match.group(1), match.group(2)
    known = {r['id'] for s in scenarios().values() for r in s['reports'] if s['id'] == scenario}
    return fixed_llm(answer_for(scenario, report if report in known else 'silent'))


def read(fn, args):
    text = world.view(fn, *args)
    if BUG == 'publisher' and fn == 'get_publisher' and text != 'null':
        data = json.loads(text)
        data['publisher']['strikes'] += 1
        return json.dumps(data)
    if BUG == 'drift' and fn == 'get_drift' and text != 'null':
        data = json.loads(text)
        if data['rows']:
            data['rows'][0]['statuses'][next(iter(data['rows'][0]['statuses']))] = 'MOVED_SILENT'
        return json.dumps(data)
    if BUG == 'attestation' and fn == 'recompute_attestation':
        return '0x' + '00' * 32
    return text


def write(fn, args):
    kwargs = {}
    if fn == 'evaluate_report':
        kwargs['llm'] = llm_for(args[0])
    try:
        world.tx(fn, *args, sender=ALICE, **kwargs)
        return {'ok': True}
    except UserError as error:
        return {'ok': False, 'error': 'UserError: ' + str(error)}
    except NoConsensus:
        return {'ok': False, 'undetermined': True, 'error': 'no agreement'}


for line in sys.stdin:
    message = json.loads(line)
    try:
        if message['op'] == 'read':
            reply = {'ok': True, 'result': read(message['fn'], message['args'])}
        else:
            reply = write(message['fn'], message['args'])
    except Exception as error:  # a bug in the simulator or the suite should be loud
        reply = {'ok': False, 'error': 'SimulatorError: %s: %s' % (type(error).__name__, error)}
    reply['id'] = message['id']
    sys.stdout.write(json.dumps(reply) + '\n')
    sys.stdout.flush()
