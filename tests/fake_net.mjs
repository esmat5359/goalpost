// Preloaded with `node --import`. Answers fetch() for the demonstration site from public/, so the
// suite's reachability checks work without a network.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
const realFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.host !== 'goalpost.example') return realFetch(input, init);
  const file = path.join(publicDir, decodeURIComponent(url.pathname));
  if (!existsSync(file)) return new Response('not found', { status: 404 });
  return new Response(readFileSync(file), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
};
