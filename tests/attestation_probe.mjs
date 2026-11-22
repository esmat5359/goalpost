// Prints the attestations the TypeScript client computes, so the Python suite can compare them with the contract.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const A = await import(path.join(root, 'src/lib/attestation.ts'));
const input = JSON.parse(readFileSync(0, 'utf8'));
const out = [];
for (const entry of input.cases) out.push(await A.attestationOf(entry.audit, entry.commitment));
process.stdout.write(JSON.stringify(out));
