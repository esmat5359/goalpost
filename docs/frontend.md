# Web console (1.4.0)

Vite, React 18, TypeScript, plain CSS. No UI library, no WebGL.

## Pages

| Route | File | Reads |
|---|---|---|
| `/` | `pages/Ledger.tsx` | `list_pledges`, `stats`, `search_pledges` |
| `/new` | `pages/Register.tsx` | `contract_info` (limits); writes `register_pledge` |
| `/pledges/:id` | `pages/Pledge.tsx` | `get_pledge_bundle`; writes `submit_report`, `evaluate_report`, `check_pledge_integrity`, `retire_pledge` |
| `/pledges/:id/drift` | `pages/Drift.tsx` | `get_drift`, `get_pledge_bundle` |
| `/audits/:id` | `pages/Audit.tsx` | `get_audit_bundle`, `recompute_attestation` |
| `/publishers` | `pages/Publishers.tsx` | `list_publishers` |
| `/publishers/<scope>` | `pages/Publisher.tsx` | `get_publisher` (a scope may contain `/`, so the route is a splat) |
| `/verify/:id` | `pages/Verify.tsx` | `get_audit_bundle`; optionally `recompute_attestation` |
| `/docs` | `pages/Docs.tsx` | `contract_info` |
| `/how` | `pages/How.tsx` | none |

## Verifying without trusting the node

`src/lib/attestation.ts` reimplements the contract's canonical JSON (sorted keys, compact separators, ASCII
escapes, including the astral-plane surrogate pairs and DEL) and SHA-256 over it with Web Crypto.
`tests/test_attestation_parity.py` runs it under Node on every demonstration audit and on awkward text and
compares with the contract's own attestation.

## The 3D scene

`components/Goalpost3D.tsx` and the `.gp3d` rules in `styles-v14.css`. A `Box` is five CSS-transformed faces
with its base on the ground. The scene is a flat pitch, a fixed left post, a dashed ghost of the pledged right
post and a right post that slides 70px while the crossbar scales along X from the left post, on one shared
timing curve so they stay joined. The post's colour animates through a registered custom property
(`@property --gp-c`); browsers without `@property` keep it static.

- Pointer movement nudges `--rx` and `--ry` (at most a few degrees, throttled with `requestAnimationFrame`).
- `IntersectionObserver` pauses the animations when the scene is off screen.
- With `prefers-reduced-motion: reduce` nothing animates and the scene rests in the "moved" pose.
- It is decoration: the scene has a text alternative and nothing depends on it.
- Scale steps down at 720px and 480px.

`components/TiltCard.tsx` leans a card toward the pointer (mouse and pen only) and adds a highlight.
`components/VerdictBar.tsx` draws verdict counts as a stacked bar; colour is never the only carrier because
every segment has a count in its label and the legend.

## Performance

| Change | Effect |
|---|---|
| `genlayer-js` and `viem` loaded with `import()` on first use (`lib/chain.ts`) | They leave the entry chunk. The SDK still downloads when the first read starts, in parallel with the first paint. |
| Route-level `React.lazy` for every page except the ledger | A visitor who only reads the ledger never downloads the form, the verifier or the docs. |
| `manualChunks` for React and the router | A chunk that changes rarely and caches for long. |
| Fonts from a `<link>` with `display=swap` and only the weights in use | No render-blocking `@import`; text shows in a fallback face until the font arrives. |
| Polling pauses while the tab is hidden and catches up on return (`lib/hooks.ts`) | Fewer reads against the rate-limited public RPC. |
| `warmSdk()` on hover and focus of the "Register a pledge" link | The write path is ready when the visitor gets there. |

Measured with `npm run build` (gzip): entry 18.7 kB, React 54.3 kB, SDK chunks about 125 kB loaded on demand.
Before: one 816 kB chunk. Not measured: real-world timings, because the sandbox has no real network.

## Previewing without a network

The pages can be rendered against recorded contract output: generate the views with the simulator
(`tests/support.World`), build with `genlayer-js` aliased to a stub whose `readContract` looks the answer up
by `function:args`, and serve `dist/`. This is how the 1.4.0 pages were checked in headless Chromium. The
stub is not part of the repository because it must never ship.

## Accessibility notes

Tabs are buttons with `aria-pressed`; the drift table has a caption and `scope` attributes, and every cell has a
text label; the search results are an `aria-live` region; focus outlines are kept. Colour pairs reuse the tokens
of `styles.css`, which have light and dark values.
