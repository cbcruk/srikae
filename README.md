# GraphQL Mock Extension

Mock/modify GraphQL responses per operation in Chrome DevTools.
See [DESIGN.md](./DESIGN.md) for the full spec and rationale.

## Develop

```bash
vp install   # install dependencies
vp dev       # build + watch (HMR)
vp test      # unit tests (match / merge-patch)
vp check     # format, lint, type check
vp build     # production build into dist/
```

## Load in Chrome

1. `vp build` (or `vp dev` for watch mode)
2. `chrome://extensions` → enable **Developer mode**
3. **Load unpacked** → select the `dist/` folder
4. Open DevTools on any page → **GraphQL Mock** panel → add a rule

## pproxy interop

[pproxy](https://github.com/cbcruk/pproxy) is the proxy runtime that solves the
same matching problem outside the browser. **Export for pproxy** writes its
`rules.json`, so a rule tuned in DevTools can be run against a phone, a native
app, or a teammate's machine without retyping it. **Import** takes either
format and tells the two apart by their shape.

What does not survive the trip:

- **Disabled rules are left out of an export.** A pproxy rules file has no
  enabled flag, so exporting one would turn a rule off here into a rule on
  there. Use the plain **Export** for a backup that keeps them.
- **The `includes` matcher becomes a glob** (`/graphql` → `*/graphql*`), since
  pproxy has no substring matcher. It matches the same URLs, but it imports
  back as a glob rather than as `includes`.
- **Non-GraphQL rules are skipped on import**, along with a rule that combines
  `merge_patch` and `patches` — pproxy applies both in one rule, an action here
  is one or the other. The panel lists what it skipped and why.

## Architecture

- `src/main-world/injected.ts` — MAIN world: `@mswjs/interceptors` traps fetch/XHR, matches rules, mocks or merge-patches responses.
- `src/content/bridge.ts` — ISOLATED world: bridges `chrome.storage` to the MAIN world via `CustomEvent`.
- `src/devtools/` — React rule editor (CRUD + JSON import/export).
- `src/shared/` — rule matching, RFC 7386 merge-patch, storage, types, and the pproxy format adapter.
