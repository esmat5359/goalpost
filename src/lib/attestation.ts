// Independent recomputation of an audit attestation in the browser.
//
// The contract stores `attestation` and can recompute it on request, but both answers come from
// the same node. This module rebuilds the digest from the public audit record alone, so a visitor
// can check the proof without trusting anyone's RPC endpoint. It mirrors the contract's
// `_canonical` (json.dumps with sorted keys, compact separators, ensure_ascii) and `_digest`
// (SHA-256 of the UTF-8 encoding); tests/test_attestation_parity.py compares the two on every run.

export interface AttestationElement {
  key: string;
  status: string;
  report_excerpt: string;
  disclosure_excerpt: string;
}

export interface AttestationAudit {
  audit_id: string;
  pledge_id: string;
  report_url: string;
  period: string;
  verdict: string;
  elements: AttestationElement[];
  evaluated_at: number;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function encodeString(value: string): string {
  let out = '"';
  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    const code = value.charCodeAt(index);
    if (char === '"') out += '\\"';
    else if (char === '\\') out += '\\\\';
    else if (code === 0x0a) out += '\\n';
    else if (code === 0x0d) out += '\\r';
    else if (code === 0x09) out += '\\t';
    else if (code === 0x08) out += '\\b';
    else if (code === 0x0c) out += '\\f';
    else if (code < 0x20 || code > 0x7e) out += '\\u' + code.toString(16).padStart(4, '0');
    else out += char;
  }
  return out + '"';
}

/** Python's json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=True). */
export function canonicalJson(value: Json): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return encodeString(value);
  if (typeof value === 'number') {
    if (!Number.isInteger(value)) throw new Error('Only integers appear in an attestation.');
    return String(value);
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) return '[' + value.map((entry) => canonicalJson(entry)).join(',') + ']';
  const keys = Object.keys(value).sort();
  return '{' + keys.map((key) => encodeString(key) + ':' + canonicalJson(value[key])).join(',') + '}';
}

export async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return '0x' + Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** The exact payload the contract hashes. Exposed so a verifier can show what was hashed. */
export function attestationPayload(audit: AttestationAudit, pledgeCommitment: string): Json {
  return {
    kind: 'goalpost-attestation',
    audit_id: audit.audit_id,
    pledge_id: audit.pledge_id,
    pledge_commitment: pledgeCommitment,
    report_url: audit.report_url,
    period: audit.period,
    verdict: audit.verdict,
    elements: audit.elements.map((item) => ({
      key: item.key,
      status: item.status,
      report_excerpt: item.report_excerpt,
      disclosure_excerpt: item.disclosure_excerpt,
    })),
    evaluated_at: audit.evaluated_at,
  };
}

export function attestationOf(audit: AttestationAudit, pledgeCommitment: string): Promise<string> {
  return sha256Hex(canonicalJson(attestationPayload(audit, pledgeCommitment)));
}
