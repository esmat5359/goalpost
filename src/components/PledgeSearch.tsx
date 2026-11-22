import { useState } from 'react';
import { Link } from 'react-router-dom';

import { reads } from '../lib/api';
import { IS_CONFIGURED } from '../lib/config';
import { KIND_LABEL, hostOf } from '../lib/format';
import { useAsync, useDebounced } from '../lib/hooks';
import type { SearchResult } from '../lib/types';

/** Search the newest pledges by title, id, address, publisher or registrant, as the contract does it. */
export function PledgeSearch() {
  const [text, setText] = useState('');
  const query = useDebounced(text.trim(), 350);
  const active = IS_CONFIGURED && query.length >= 2;
  const result = useAsync(async (): Promise<SearchResult | null> => (active ? await reads.search(query, 8) : null), [query, active], 0);
  const showing = active && text.trim().length >= 2;

  return (
    <div className="search" role="search">
      <label className="sr-only" htmlFor="pledge-search">
        Search pledges
      </label>
      <input
        id="pledge-search"
        className="input search__input"
        type="search"
        placeholder="Search pledges, publishers or ids"
        value={text}
        onChange={(event) => setText(event.target.value)}
        autoComplete="off"
        spellCheck={false}
        aria-controls="pledge-search-results"
        aria-expanded={showing}
      />
      {showing && (
        <ul id="pledge-search-results" className="search__results" aria-live="polite">
          {result.loading && result.data === null && <li className="search__note">Searching…</li>}
          {result.error && <li className="search__note">{result.error}</li>}
          {result.data && result.data.items.length === 0 && !result.loading && <li className="search__note">No pledge matches &ldquo;{query}&rdquo;.</li>}
          {result.data?.items.map((pledge) => (
            <li key={pledge.pledge_id}>
              <Link to={`/pledges/${pledge.pledge_id}`}>
                <strong>{pledge.title}</strong>
                <small>
                  {pledge.pledge_id}, {KIND_LABEL[pledge.kind]}, {hostOf(pledge.pledge_url)}
                </small>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
