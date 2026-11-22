// A drop-in for makeClient() in scripts/lib.mjs that talks to tests/sim_rpc_server.py.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const server = path.join(path.dirname(fileURLToPath(import.meta.url)), 'sim_rpc_server.py');
const child = spawn('python3', [server], { stdio: ['pipe', 'pipe', 'inherit'], env: process.env });
const pending = new Map();
let nextId = 1;
let buffer = '';
child.stdout.on('data', (chunk) => {
  buffer += chunk;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const reply = JSON.parse(buffer.slice(0, newline));
    buffer = buffer.slice(newline + 1);
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  }
});
const call = (message) =>
  new Promise((resolve) => {
    const id = nextId++;
    pending.set(id, resolve);
    child.stdin.write(JSON.stringify({ id, ...message }) + '\n');
  });
const plain = (args) => args.map((value) => (typeof value === 'bigint' ? Number(value) : value));

export function makeClient() {
  const transactions = new Map();
  let counter = 0;
  const client = {
    async readContract({ functionName, args = [] }) {
      const reply = await call({ op: 'read', fn: functionName, args: plain(args) });
      if (!reply.ok) throw new Error(reply.error);
      return reply.result;
    },
    async writeContract({ functionName, args = [] }) {
      const reply = await call({ op: 'write', fn: functionName, args: plain(args) });
      counter += 1;
      const hash = '0x' + String(counter).padStart(64, '0');
      transactions.set(hash, reply);
      return hash;
    },
    async getTransaction({ hash }) {
      const reply = transactions.get(hash);
      if (reply.ok) return { statusName: 'ACCEPTED', txExecutionResultName: 'FINISHED_WITH_RETURN' };
      if (reply.undetermined) return { statusName: 'UNDETERMINED' };
      return { statusName: 'ACCEPTED', consensus_data: { leader_receipt: [{ execution_result: 'ERROR', genvm_result: { stderr: reply.error } }] } };
    },
  };
  return { client, account: { address: '0x00000000000000000000000000000000000000aa' } };
}
