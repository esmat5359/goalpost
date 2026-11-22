// Runs one pure check from scripts/suite-lib.mjs on JSON given on stdin. Used by test_suite_lib.py.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const lib = await import(path.join(root, 'scripts/suite-lib.mjs'));
const { op, args } = JSON.parse(readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(lib[op](...args)));
